/**
 * GET /api/cron/seed
 * Cold-start 백테스트 시딩 — Yahoo Finance 과거 데이터 기반 가상 예측 사전 적재
 *
 * 동작 원리:
 *   1. 각 종목의 120일 과거 가격 데이터 조회
 *   2. 14~120일 전 구간에서 N일 간격으로 가상 예측 생성
 *   3. 당시 가격(priceAtPrediction) + 14일 후 가격(priceAt14d) 기반으로 outcome 미리 계산
 *   4. Redis에 적재 → evolve cron이 즉시 가중치 업데이트 가능
 *
 * 주의: 1회성 실행. 이미 적재된 날짜는 스킵.
 * 보안: CRON_SECRET 필요 (수동 실행 가능)
 */

import { NextRequest, NextResponse } from "next/server";
import yahooFinance from "@/lib/yahoo";
import { savePrediction, getPrediction, type Market, type Prediction } from "@/lib/predictions";
import { KOSPI_STOCKS, US_STOCKS } from "@/lib/stocks";
import { CRYPTO_WEIGHTS } from "@/lib/signals/crypto";

export const runtime = "nodejs";
export const maxDuration = 300;

// 시딩 대상 종목
const SEED_TARGETS: Array<{ market: Market; ticker: string; name: string; yahooSymbol: string }> = [
  // 국내 상위 10
  ...KOSPI_STOCKS.slice(0, 10).map((s) => ({
    market: "korea" as Market,
    ticker: s.symbol.split(".")[0],
    name: s.name,
    yahooSymbol: s.symbol,
  })),
  // 미국 상위 10
  ...US_STOCKS.slice(0, 10).map((s) => ({
    market: "us" as Market,
    ticker: s.symbol,
    name: s.name,
    yahooSymbol: s.symbol,
  })),
];

// 기본 가중치 (evolve 전 초기값)
const DEFAULT_SIGNAL_IDS: Record<Market, string[]> = {
  crypto: Object.keys(CRYPTO_WEIGHTS),
  korea:  ["K1","K2","K3","K4","K5","K6","K7","K8","K9","K10","K11","K12"],
  us:     ["U1","U2","U3","U4","U5","U6","U7","U8","U9","U10","U11","U12"],
};

const DEFAULT_WEIGHTS_VAL: Record<Market, number> = {
  crypto: 8,   // 100 / 12 ≈ 8
  korea:  8,
  us:     8,
};

/** 점수 → label */
function scoreToLabel(score: number): string {
  if (score >= 70) return "강한 매수";
  if (score >= 60) return "매수";
  if (score >= 55) return "약한 매수";
  if (score >= 45) return "관망";
  if (score >= 40) return "약한 매도";
  if (score >= 30) return "매도";
  return "강한 매도";
}

/** 가격 시계열로 가상 FlowScore 생성 (단순 모멘텀 기반) */
function syntheticScore(closes: number[], dayIdx: number): number {
  // 5일 / 20일 모멘텀 기반으로 50~100 사이 점수 계산
  const price = closes[dayIdx];
  if (!price || dayIdx < 20) return 50;

  const ma5  = closes.slice(dayIdx - 5,  dayIdx).reduce((a, b) => a + b, 0) / 5;
  const ma20 = closes.slice(dayIdx - 20, dayIdx).reduce((a, b) => a + b, 0) / 20;
  const ret5d = (price - closes[dayIdx - 5]) / closes[dayIdx - 5];

  // 5일 모멘텀 + 골든크로스/데드크로스 신호 합산
  let raw = 50;
  raw += ret5d * 300;                            // 5일 수익률 반영
  raw += (ma5 > ma20 ? 5 : -5);                 // 골든/데드 크로스
  raw += (price > ma20 ? 5 : -5);               // 가격 > MA20

  return Math.max(10, Math.min(90, raw));
}

/** 예측이 맞았는지 판정 */
function judgeOutcome(score: number, priceAtPred: number, priceAtVeri: number): "correct" | "wrong" {
  if (priceAtPred === 0 || priceAtVeri === 0) return "wrong";
  const diff = (priceAtVeri - priceAtPred) / priceAtPred;
  const bullish = score >= 60;
  const bearish  = score < 40;
  if (bullish && diff > 0.01)  return "correct";
  if (bearish  && diff < -0.01) return "correct";
  if (!bullish && !bearish)     return "correct"; // 관망은 neutral
  return "wrong";
}

async function seedTicker(
  market: Market,
  ticker: string,
  name: string,
  yahooSymbol: string,
  intervalDays: number
): Promise<{ seeded: number; skipped: number }> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 120);

  let historicals: Array<{ date: Date; close: number }> = [];
  try {
    historicals = await yahooFinance.historical(yahooSymbol, {
      period1: start,
      period2: end,
      interval: "1d",
    });
    historicals.sort((a, b) => a.date.getTime() - b.date.getTime());
  } catch {
    return { seeded: 0, skipped: 0 };
  }

  const closes = historicals.map((d) => d.close);
  const dates  = historicals.map((d) => d.date.toISOString().slice(0, 10));
  const signalIds = DEFAULT_SIGNAL_IDS[market];
  const weight = DEFAULT_WEIGHTS_VAL[market];

  let seeded = 0, skippedCount = 0;

  // 14일 이상 전 데이터에서 intervalDays 간격으로 시딩 (outcome14d 계산 가능)
  for (let i = 20; i < closes.length - 14; i += intervalDays) {
    const dateStr = dates[i];
    if (!dateStr) continue;

    // 이미 존재하면 스킵
    const existing = await getPrediction(market, ticker, dateStr);
    if (existing) { skippedCount++; continue; }

    const score = syntheticScore(closes, i);
    const label = scoreToLabel(score);
    const priceAtPred = closes[i];
    const priceAt5  = closes[i + 5]  ?? 0;
    const priceAt14 = closes[i + 14] ?? 0;

    const outcome5d  = judgeOutcome(score, priceAtPred, priceAt5);
    const outcome14d = judgeOutcome(score, priceAtPred, priceAt14);

    const pred: Prediction = {
      market,
      ticker,
      name,
      date: dateStr,
      score,
      label,
      signals: signalIds.map((id) => ({
        id,
        score: score + (Math.random() * 20 - 10), // 신호별 약간의 분산
        weight,
        live: false, // 백테스트 데이터
      })),
      priceAtPrediction: priceAtPred,
      priceAt5d: priceAt5,
      priceAt14d: priceAt14,
      outcome5d,
      outcome14d,
      verifiedAt: dates[i + 14] ?? dateStr,
    };

    await savePrediction(pred);
    seeded++;
  }

  return { seeded, skipped: skippedCount };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  // intervalDays: 몇 일 간격으로 시딩할지 (기본 3일 → 120일 / 3 = 최대 40개/종목)
  const intervalDays = parseInt(searchParams.get("interval") ?? "3", 10);

  console.log(`[seed] 백테스트 시딩 시작 — ${SEED_TARGETS.length}개 종목, ${intervalDays}일 간격`);

  const report: Record<string, { seeded: number; skipped: number }> = {};
  let totalSeeded = 0;

  for (const target of SEED_TARGETS) {
    const result = await seedTicker(
      target.market,
      target.ticker,
      target.name,
      target.yahooSymbol,
      intervalDays
    );
    report[`${target.market}/${target.ticker}`] = result;
    totalSeeded += result.seeded;

    // Rate limit 방어 (Yahoo Finance 무료)
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`[seed] 완료 — 총 ${totalSeeded}개 예측 적재`);

  return NextResponse.json({ ok: true, totalSeeded, intervalDays, report });
}
