/**
 * GET /api/score/[market]/[ticker]
 * SSE 스트리밍 — 신호 하나씩 실시간 전송
 *
 * 이벤트 타입:
 *   signal  → { id, name, score, weight, live }
 *   result  → { score, label, liveCount, totalCount, evaluatedAt }
 *   error   → { message }
 */

import { NextRequest } from "next/server";
import { evaluateSignals, type Market } from "@/lib/signals/index";
import { type SignalScore } from "@/lib/signals/crypto";
import { getRedis } from "@/lib/redis";
import { savePrediction, today } from "@/lib/predictions";

export const runtime = "nodejs";

const VALID_MARKETS: Market[] = ["crypto", "korea", "us"];
const CACHE_TTL_SEC = 60 * 10; // 10분
const MODEL_VERSION = "v3";

/** 신호 점수의 표준편차 → 신뢰도 (낮은 편차 = 높은 확신) */
function calcConfidence(signals: SignalScore[]): number {
  if (signals.length === 0) return 50;
  const scores = signals.map((s) => s.score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);
  // stddev 최대 ≈ 50 (모든 신호가 0 또는 100일 때) → confidence = 100 - stddev*2
  return Math.max(0, Math.round(100 - stddev * 2));
}

function sseEvent(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ market: string; ticker: string }> }
) {
  const { market: marketParam, ticker } = await context.params;
  const market = marketParam as Market;

  // 유효성 검사
  if (!VALID_MARKETS.includes(market)) {
    return new Response(sseEvent("error", { message: `Invalid market: ${market}` }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const cacheKey = `score:v3:${market}:${ticker}`;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (type: string, data: unknown) => {
        try {
          controller.enqueue(new TextEncoder().encode(sseEvent(type, data)));
        } catch {
          // 클라이언트 연결 종료 시 무시
        }
      };

      try {
        // Redis 캐시 확인
        const redis = getRedis();
        const cached = await redis.get<string>(cacheKey);
        if (cached) {
          const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
          // 캐시된 신호들을 개별 전송 (스트리밍 효과)
          for (const signal of parsed.signals as SignalScore[]) {
            enqueue("signal", signal);
          }
          enqueue("result", {
            score: parsed.score,
            label: parsed.label,
            liveCount: parsed.liveCount,
            totalCount: parsed.totalCount,
            evaluatedAt: parsed.evaluatedAt,
            modelVersion: parsed.modelVersion ?? MODEL_VERSION,
            confidence: parsed.confidence ?? 50,
            price: parsed.price ?? 0,
            ret7d: parsed.ret7d != null ? Math.round(parsed.ret7d * 1000) / 10 : null,
            ret30d: parsed.ret30d != null ? Math.round(parsed.ret30d * 1000) / 10 : null,
            spark: parsed.spark ?? [],
            name: parsed.name ?? "",
            cached: true,
          });
          controller.close();
          return;
        }

        // 실시간 평가 — 신호 계산될 때마다 SSE 전송
        const collectedSignals: SignalScore[] = [];

        const result = await evaluateSignals(market, ticker, (signal) => {
          collectedSignals.push(signal);
          enqueue("signal", signal);
        });

        const confidence = calcConfidence(result.signals);

        // 캐시 저장 (modelVersion + confidence 포함)
        await redis.set(
          cacheKey,
          JSON.stringify({ ...result, modelVersion: MODEL_VERSION, confidence }),
          { ex: CACHE_TTL_SEC }
        );

        // 예측 저장 (비동기 — 실패해도 응답 차단 안 함)
        savePrediction({
          market,
          ticker,
          name: result.name,
          date: today(),
          score: result.score,
          label: result.label,
          signals: result.signals.map((s) => ({
            id: s.id,
            score: s.score,
            weight: s.weight,
            live: s.live,
          })),
          priceAtPrediction: result.price,
          outcome5d: "pending",
          outcome14d: "pending",
        }).catch((err) =>
          console.warn(`[score] 예측 저장 실패 ${market}/${ticker}:`, err instanceof Error ? err.message : err)
        );

        enqueue("result", {
          score: result.score,
          label: result.label,
          liveCount: result.liveCount,
          totalCount: result.totalCount,
          evaluatedAt: result.evaluatedAt,
          modelVersion: MODEL_VERSION,
          confidence,
          price: result.price,
          ret7d: Math.round(result.ret7d * 1000) / 10,
          ret30d: Math.round(result.ret30d * 1000) / 10,
          spark: result.spark,
          name: result.name,
          cached: false,
        });
      } catch (err) {
        console.error(`[score] ${market}/${ticker} 평가 실패:`, err);
        enqueue("error", { message: err instanceof Error ? err.message : "평가 중 오류 발생" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
