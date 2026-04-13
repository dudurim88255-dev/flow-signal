/**
 * GET /api/cron/evolve
 * 주간 Bayesian 가중치 진화 — 검증된 예측 기반으로 신호별 가중치 업데이트
 * Vercel Cron: 매주 일요일 03:00 UTC
 *
 * Bayesian 업데이트 원리:
 *   P(signal_good | correct) ∝ P(correct | signal_good) * P(signal_good)
 *   가중치 ∝ 해당 신호의 정답률 (min/max 클리핑으로 극단값 방지)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAllPredictions,
  getWeights,
  saveWeights,
  getRegimeWeights,
  saveRegimeWeights,
  type Market,
  type MarketWeights,
} from "@/lib/predictions";
import { CRYPTO_WEIGHTS } from "@/lib/signals/crypto";
import { runWalkforward, saveWalkforwardResult } from "@/lib/signals/walkforward";
import { getHistoricalRegime, type Regime } from "@/lib/signals/regime";

export const runtime = "nodejs";
export const maxDuration = 60;

const MARKETS: Market[] = ["crypto", "korea", "us"];

// 기본 가중치 (최초 실행 시 seed)
const DEFAULT_WEIGHTS: Record<Market, MarketWeights> = {
  crypto: { ...CRYPTO_WEIGHTS },
  korea: { K1:14, K2:12, K3:10, K4:8, K5:8, K6:6, K7:5, K8:6, K9:7, K10:10, K11:6, K12:8 },
  us:    { U1:12, U2:11, U3:8,  U4:7,  U5:5, U6:9, U7:6, U8:7, U9:6, U10:8,  U11:11, U12:10 },
};

const MIN_WEIGHT = 2;
const MAX_WEIGHT = 20;
const MIN_SAMPLE = 10; // 최소 샘플 수 미달 시 업데이트 건너뜀

/**
 * 신호별 정답 기여도 계산
 * 각 예측에서 해당 신호의 score가 방향성 예측에 기여했는지 확인
 */
function calcSignalAccuracy(
  predictions: Array<{ signals: Array<{ id: string; score: number; weight: number; live: boolean }>; outcome14d?: string }>,
  signalId: string
): { correct: number; total: number } {
  let correct = 0, total = 0;

  for (const pred of predictions) {
    if (pred.outcome14d !== "correct" && pred.outcome14d !== "wrong") continue;
    const signal = pred.signals.find((s) => s.id === signalId);
    if (!signal) continue;
    // 더미 신호(live:false)는 실제 데이터가 아니므로 정확도 계산 제외
    if (!signal.live) continue;

    total++;
    // 신호 점수가 예측 방향(매수/매도)과 일치했는지
    const signalBullish = signal.score >= 55;
    const outcomeCorrect = pred.outcome14d === "correct";

    // 신호가 맞는 방향을 가리켰을 때 correct 카운트
    if ((signalBullish && outcomeCorrect) || (!signalBullish && !outcomeCorrect)) {
      correct++;
    }
  }

  return { correct, total };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[evolve] Bayesian 가중치 업데이트 시작");

  const report: Record<string, unknown> = {};

  for (const market of MARKETS) {
    const predictions = await getAllPredictions(market);
    // v3.1 이전 예측(biased scores)과 섞이지 않도록 scoreVersion 필터링
    const verified = predictions.filter(
      (p) => (p.outcome14d === "correct" || p.outcome14d === "wrong") && p.scoreVersion === "v3.1"
    );

    // 예상 해제일 계산: 하루 1개 수집 가정 → 부족 샘플 수만큼 날짜 추가
    const daysUntilUnlock = Math.max(0, MIN_SAMPLE - verified.length);
    const unlockDate = new Date();
    unlockDate.setDate(unlockDate.getDate() + daysUntilUnlock);
    const unlockStr = unlockDate.toISOString().slice(0, 10);
    const learningStatus = verified.length >= MIN_SAMPLE ? "학습중" : "동결중";
    console.log(`[evolve] ${market}: v3.1 샘플 ${verified.length}개 / 최소 ${MIN_SAMPLE}개 — 가중치 ${learningStatus} (예상 해제: ${unlockStr})`);

    if (verified.length < MIN_SAMPLE) {
      report[market] = { skipped: true, samples: verified.length };
      continue;
    }

    // 현재 가중치 로드 (없으면 default)
    const currentWeights = (await getWeights(market)) ?? { ...DEFAULT_WEIGHTS[market] };
    const newWeights: MarketWeights = { ...currentWeights };
    const updates: Record<string, { from: number; to: number; accuracy: number }> = {};

    for (const signalId of Object.keys(currentWeights)) {
      const { correct, total } = calcSignalAccuracy(verified, signalId);
      if (total < 5) continue; // 신호별 최소 샘플

      const accuracy = correct / total; // 0~1
      const currentW = currentWeights[signalId];

      // Bayesian 업데이트: 정확도 0.5 기준으로 가중치 조정
      // accuracy > 0.5 → 가중치 증가, < 0.5 → 감소
      const adjustment = (accuracy - 0.5) * 4; // 최대 ±2
      const newW = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, currentW + adjustment));
      const rounded = Math.round(newW * 10) / 10;

      newWeights[signalId] = rounded;
      updates[signalId] = { from: currentW, to: rounded, accuracy: Math.round(accuracy * 1000) / 10 };
    }

    // 가중치 합이 100이 되도록 정규화
    const totalW = Object.values(newWeights).reduce((s, v) => s + v, 0);
    const scale = 100 / totalW;
    for (const k of Object.keys(newWeights)) {
      newWeights[k] = Math.round(newWeights[k] * scale * 10) / 10;
    }

    await saveWeights(market, newWeights);
    console.log(`[evolve] ${market}: ${verified.length}개 샘플 → 가중치 업데이트`);
    report[market] = { samples: verified.length, updates };
  }

  // ── Regime-scoped weight 업데이트 ────────────────────────────────────────
  // 각 예측의 날짜에 해당하는 레짐을 조회해 bull/bear/chop별로 분리 학습
  for (const market of MARKETS) {
    try {
      const predictions = await getAllPredictions(market);
      // v3.1 예측만 사용 — biased 이전 데이터 제외
      const verified = predictions.filter(
        (p) => (p.outcome14d === "correct" || p.outcome14d === "wrong") && p.scoreVersion === "v3.1"
      );
      if (verified.length < MIN_SAMPLE) continue;

      // 각 예측에 레짐 태그 부착 (Redis 조회)
      const tagged = await Promise.all(
        verified.map(async (p) => ({
          pred: p,
          regime: (await getHistoricalRegime(market, p.date)) ?? "chop" as Regime,
        }))
      );

      const regimes: Regime[] = ["bull", "bear", "chop"];

      for (const regime of regimes) {
        const regimePreds = tagged
          .filter((t) => t.regime === regime)
          .map((t) => t.pred);

        if (regimePreds.length < MIN_SAMPLE) continue;

        const baseWeights = (await getRegimeWeights(market, regime)) ?? { ...DEFAULT_WEIGHTS[market] };
        const newWeights: MarketWeights = { ...baseWeights };

        for (const signalId of Object.keys(baseWeights)) {
          const { correct, total } = calcSignalAccuracy(regimePreds, signalId);
          if (total < 5) continue;

          const accuracy = correct / total;
          const adjustment = (accuracy - 0.5) * 4;
          const newW = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, baseWeights[signalId] + adjustment));
          newWeights[signalId] = Math.round(newW * 10) / 10;
        }

        // 정규화
        const totalW = Object.values(newWeights).reduce((s, v) => s + v, 0);
        const scale = 100 / totalW;
        for (const k of Object.keys(newWeights)) {
          newWeights[k] = Math.round(newWeights[k] * scale * 10) / 10;
        }

        await saveRegimeWeights(market, regime, newWeights);
        console.log(`[evolve] ${market}/${regime}: ${regimePreds.length}개 → 레짐 가중치 업데이트`);
      }
    } catch (err) {
      console.error(`[evolve] regime-scoped ${market} 실패:`, err);
    }
  }

  // ── Walk-forward shadow 실행 (점수 영향 없음, 로그 목적) ────────────────
  const wfReport: Record<string, unknown> = {};
  for (const market of MARKETS) {
    try {
      const allPreds = await getAllPredictions(market);
      const wfResult = runWalkforward(market, allPreds);
      await saveWalkforwardResult(wfResult);
      wfReport[market] = {
        windows: wfResult.totalWindows,
        mode: wfResult.dataMode,
        overallAccuracy: wfResult.windows.length > 0
          ? Math.round(wfResult.windows.reduce((s, w) => s + w.overallAccuracy, 0) / wfResult.windows.length * 10) / 10
          : null,
      };
      console.log(`[evolve/wf] ${market}: ${wfResult.totalWindows}개 윈도우 (${wfResult.dataMode})`);
    } catch (err) {
      console.error(`[evolve/wf] ${market} 실패:`, err);
      wfReport[market] = { error: String(err) };
    }
  }

  return NextResponse.json({ ok: true, report, walkforward: wfReport });
}
