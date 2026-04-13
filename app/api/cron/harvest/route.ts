/**
 * GET /api/cron/harvest
 * 일일 자율 예측 수집기 — 상위 종목 자동 분석 및 예측 저장
 * Vercel Cron: 매일 01:00 UTC
 *
 * v4: 신호 발행 전 6가지 리스크 게이트 체크
 *   실패 시 → score=50(neutral), label="리스크차단"으로 저장 (예측 억제)
 */

import { NextRequest, NextResponse } from "next/server";
import { evaluateSignals, type Market } from "@/lib/signals/index";
import { savePrediction, today, getAllPredictions, type Market as PredMarket } from "@/lib/predictions";
import { KOSPI_STOCKS, US_STOCKS, CRYPTO_COINS } from "@/lib/stocks";
import { runRiskGate } from "@/lib/signals/riskgate";
import { getHistoricalRegime, type Regime } from "@/lib/signals/regime";
import { getWalkforwardResult, type WalkforwardResult } from "@/lib/signals/walkforward";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Pro 최대 5분

// 각 시장별 수집 대상 (시가총액/중요도 순)
const HARVEST_TARGETS: Array<{ market: PredMarket; ticker: string; name: string }> = [
  // 암호화폐 상위 10
  ...CRYPTO_COINS.slice(0, 10).map((c) => ({ market: "crypto" as PredMarket, ticker: c.symbol, name: c.name })),
  // 국내 상위 10
  ...KOSPI_STOCKS.slice(0, 10).map((s) => ({
    market: "korea" as PredMarket,
    ticker: s.symbol.split(".")[0],
    name: s.name,
  })),
  // 미국 상위 10
  ...US_STOCKS.slice(0, 10).map((s) => ({ market: "us" as PredMarket, ticker: s.symbol, name: s.name })),
];

// ─── 리스크 게이트 사전 데이터 로드 ─────────────────────────────────────────

type MarketRiskData = {
  recentRegimes: Regime[];
  wfResult: WalkforwardResult | null;
  verifiedCount: number;
};

/**
 * 시장별 리스크 게이트 입력 데이터를 한 번에 로드 (종목별 반복 조회 방지)
 * - 최근 3일 레짐 이력 (Redis)
 * - Walk-forward 결과 (Redis)
 * - 검증된 예측 수 (Redis)
 */
async function loadRiskGateData(market: PredMarket): Promise<MarketRiskData> {
  const now = new Date();
  // 최근 3일: [2일전, 1일전, 오늘]
  const dates = [2, 1, 0].map((n) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  });

  const [regimeResults, wfResult, allPreds] = await Promise.all([
    Promise.all(dates.map((d) => getHistoricalRegime(market, d))),
    getWalkforwardResult(market),
    getAllPredictions(market),
  ]);

  const recentRegimes = regimeResults.filter((r): r is Regime => r !== null);
  const verifiedCount = allPreds.filter(
    (p) => p.outcome14d === "correct" || p.outcome14d === "wrong"
  ).length;

  return { recentRegimes, wfResult, verifiedCount };
}

// ─── 종목별 수집 ──────────────────────────────────────────────────────────────

async function harvestOne(
  market: PredMarket,
  ticker: string,
  name: string,
  riskData: MarketRiskData
) {
  try {
    const result = await evaluateSignals(market as Market, ticker);
    const now = new Date().toISOString();

    // ── 리스크 게이트 ──────────────────────────────────────────────────────
    const riskResult = runRiskGate({
      evaluatedAt: now,
      signals: result.signals,
      recentVolume: result.recentVolume,
      avgVolume30d: result.avgVolume30d,
      recentRegimes: riskData.recentRegimes,
      wfResult: riskData.wfResult,
      verifiedPredictionCount: riskData.verifiedCount,
    });

    // 게이트 실패 시 점수 50(중립), 레이블 "리스크차단"으로 억제
    const finalScore = riskResult.pass ? result.score : 50;
    const finalLabel = riskResult.pass ? result.label : "리스크차단";

    if (!riskResult.pass) {
      console.log(`[harvest] ${market}/${ticker} 리스크차단: ${riskResult.failedChecks.join(", ")}`);
    }

    await savePrediction({
      market,
      ticker,
      name,
      date: today(),
      score: finalScore,
      label: finalLabel,
      signals: result.signals.map((s) => ({
        id: s.id,
        score: s.score,
        weight: s.weight,
        live: s.live,
      })),
      priceAtPrediction: result.price,
      outcome5d: "pending",
      outcome14d: "pending",
    });

    return {
      ticker,
      score: finalScore,
      label: finalLabel,
      riskBlocked: !riskResult.pass,
      failedChecks: riskResult.failedChecks,
      ok: true,
    };
  } catch (err) {
    return { ticker, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(req: NextRequest) {
  // 운영 환경 보안 검증
  const authHeader = req.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateStr = today();
  console.log(`[harvest] 시작 ${dateStr} — ${HARVEST_TARGETS.length}개 종목`);

  // ── 시장별 리스크 게이트 데이터 사전 로드 (종목당 반복 조회 방지) ──────────
  const markets: PredMarket[] = ["crypto", "korea", "us"];
  const riskDataMap: Record<PredMarket, MarketRiskData> = {} as Record<PredMarket, MarketRiskData>;
  await Promise.all(
    markets.map(async (m) => {
      try {
        riskDataMap[m] = await loadRiskGateData(m);
      } catch (err) {
        // 로드 실패 시 빈 데이터로 폴백 (게이트 체크는 pass 처리)
        console.error(`[harvest] ${m} 리스크 데이터 로드 실패:`, err);
        riskDataMap[m] = { recentRegimes: [], wfResult: null, verifiedCount: 0 };
      }
    })
  );

  // ── 종목별 평가 (5개씩 병렬, CoinGecko rate limit 방어) ─────────────────────
  type HarvestResult = Awaited<ReturnType<typeof harvestOne>>;
  const results: HarvestResult[] = [];
  for (let i = 0; i < HARVEST_TARGETS.length; i += 5) {
    const batch = HARVEST_TARGETS.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map((t) => harvestOne(t.market, t.ticker, t.name, riskDataMap[t.market]))
    );
    results.push(...batchResults);
    if (i + 5 < HARVEST_TARGETS.length) {
      await new Promise((r) => setTimeout(r, 4000));
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const riskBlocked = results.filter((r) => r.ok && (r as { riskBlocked?: boolean }).riskBlocked).length;
  console.log(`[harvest] 완료 — ${succeeded}/${HARVEST_TARGETS.length} 성공 (리스크차단: ${riskBlocked}개)`);

  return NextResponse.json({
    date: dateStr,
    total: HARVEST_TARGETS.length,
    succeeded,
    riskBlocked,
    failed: HARVEST_TARGETS.length - succeeded,
  });
}
