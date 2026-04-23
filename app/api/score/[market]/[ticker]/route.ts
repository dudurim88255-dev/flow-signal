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
import { savePrediction, today, type Market as PredMarket } from "@/lib/predictions";
import { runRiskGate } from "@/lib/signals/riskgate";
import { loadRiskGateData } from "@/lib/signals/riskgate-loader";
import { confidenceScoreToLabel } from "@/lib/signals/types";

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
      let isClosed = false;
      const safeClose = () => {
        if (!isClosed) {
          isClosed = true;
          controller.close();
        }
      };

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
          // Phase A P0: 캐시 히트 시에도 두 필드로 전송.
          //   - parsed.confidenceScore 없으면 legacy 숫자 필드(parsed.confidence)에서 폴백,
          //     그것도 없으면 50(neutral).
          //   - parsed.confidenceLabel 없으면 score에서 재계산.
          const cachedScore = typeof parsed.confidenceScore === "number"
            ? parsed.confidenceScore
            : (typeof parsed.confidence === "number" ? parsed.confidence : 50);
          const cachedLabel = parsed.confidenceLabel ?? confidenceScoreToLabel(cachedScore);
          enqueue("result", {
            score: parsed.score,
            label: parsed.label,
            liveCount: parsed.liveCount,
            totalCount: parsed.totalCount,
            evaluatedAt: parsed.evaluatedAt,
            modelVersion: parsed.modelVersion ?? MODEL_VERSION,
            confidenceScore: cachedScore,
            confidenceLabel: cachedLabel,
            price: parsed.price ?? 0,
            ret7d: parsed.ret7d != null ? Math.round(parsed.ret7d * 1000) / 10 : null,
            ret30d: parsed.ret30d != null ? Math.round(parsed.ret30d * 1000) / 10 : null,
            spark: parsed.spark ?? [],
            name: parsed.name ?? "",
            cached: true,
            risk_flags: parsed.risk_flags ?? undefined,
          });
          safeClose();
          return;
        }

        // 실시간 평가 — 신호 계산될 때마다 SSE 전송
        const collectedSignals: SignalScore[] = [];

        const result = await evaluateSignals(market, ticker, (signal) => {
          collectedSignals.push(signal);
          enqueue("signal", signal);
        });

        // Phase A P0: 두 필드 분리
        //   confidenceScore  = stddev 기반 숫자 (Dashboard UI용)
        //   confidenceLabel  = score 구간 매핑 (Risk Gate 로그 / MEMORY / 내러티브)
        const confidenceScore = calcConfidence(result.signals);
        const confidenceLabel = confidenceScoreToLabel(confidenceScore);

        // Risk Gate — 신호 평가 후 적용, 점수 차단 없이 플래그만 기록
        const riskData = await loadRiskGateData(market as PredMarket);
        const riskResult = runRiskGate({
          evaluatedAt: result.evaluatedAt,
          signals: result.signals,
          recentVolume: result.recentVolume,
          avgVolume30d: result.avgVolume30d,
          recentRegimes: riskData.recentRegimes,
          wfResult: riskData.wfResult,
          verifiedPredictionCount: riskData.verifiedCount,
        });
        const riskFlags = riskResult.failedChecks.length > 0 ? riskResult.failedChecks : undefined;

        // 캐시 저장 (modelVersion + confidence{Score,Label} + risk_flags 포함)
        // WHY: Phase A P0 이전에는 `confidence` 단일 키에 숫자를 덮어써 문자열 라벨이 유실됐음.
        //      새 키 confidenceScore/confidenceLabel로 분리해 EvalResult.coverageLabel 과 충돌 없음.
        await redis.set(
          cacheKey,
          JSON.stringify({
            ...result,
            modelVersion: MODEL_VERSION,
            confidenceScore,
            confidenceLabel,
            risk_flags: riskFlags,
          }),
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
          scoreVersion: "v3.1",
          risk_flags: riskFlags,
          confidenceScore,
          confidenceLabel,
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
          confidenceScore,
          confidenceLabel,
          price: result.price,
          ret7d: Math.round(result.ret7d * 1000) / 10,
          ret30d: Math.round(result.ret30d * 1000) / 10,
          spark: result.spark,
          name: result.name,
          cached: false,
          risk_flags: riskFlags,
        });
      } catch (err) {
        console.error(`[score] ${market}/${ticker} 평가 실패:`, err);
        enqueue("error", { message: err instanceof Error ? err.message : "평가 중 오류 발생" });
      } finally {
        safeClose();
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
