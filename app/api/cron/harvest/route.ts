/**
 * GET /api/cron/harvest
 * 일일 자율 예측 수집기 — 상위 종목 자동 분석 및 예측 저장
 * Vercel Cron: 매일 01:00 UTC
 *
 * v4: 신호 발행 전 6가지 리스크 게이트 체크
 *   실패 시 → 원본 score/label 유지 + risk_flags에 실패 체크 기록 (페널티 모드)
 */

import { NextRequest, NextResponse } from "next/server";
import { evaluateSignals, type Market } from "@/lib/signals/index";
import { savePrediction, today, type Market as PredMarket } from "@/lib/predictions";
import { KOSPI_STOCKS, US_STOCKS, CRYPTO_COINS } from "@/lib/stocks";
import { runRiskGate } from "@/lib/signals/riskgate";
import { loadRiskGateData, type MarketRiskData } from "@/lib/signals/riskgate-loader";

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

    // 페널티 모드: 게이트 실패 시 원본 점수/레이블 유지, risk_flags에 실패 체크 기록
    // (이전 차단 모드는 score=50→neutral→verifiedCount 증가 불가 데드락 유발)
    const riskFlags = riskResult.failedChecks.length > 0 ? riskResult.failedChecks : undefined;

    if (riskFlags) {
      console.log(`[harvest] ${market}/${ticker} 리스크 페널티: ${riskFlags.join(", ")}`);
    }

    await savePrediction({
      market,
      ticker,
      name,
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
    });

    return {
      ticker,
      score: result.score,
      label: result.label,
      riskPenalty: !!riskFlags,
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
  const riskPenalty = results.filter((r) => r.ok && (r as { riskPenalty?: boolean }).riskPenalty).length;
  console.log(`[harvest] 완료 — ${succeeded}/${HARVEST_TARGETS.length} 성공 (리스크 페널티: ${riskPenalty}개)`);

  return NextResponse.json({
    date: dateStr,
    total: HARVEST_TARGETS.length,
    succeeded,
    riskPenalty,
    failed: HARVEST_TARGETS.length - succeeded,
  });
}
