import { NextResponse } from "next/server";
import yahooFinance from "@/lib/yahoo";
import { US_STOCKS } from "@/lib/stocks";
import { calculateFlowScore } from "@/lib/flowscore";
import type { StockData } from "@/app/api/kospi/route";
import { getRedis } from "@/lib/redis";

export const revalidate = 0;

function fmtUSD(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

async function fetchUS(def: typeof US_STOCKS[number]): Promise<StockData | null> {
  try {
    const past = new Date();
    past.setDate(past.getDate() - 90);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [quote, chart]: [any, any] = await Promise.all([
      yahooFinance.quote(def.symbol, {}, { validateResult: false }),
      yahooFinance.chart(def.symbol, {
        period1: past.toISOString().split("T")[0],
        interval: "1d",
      }, { validateResult: false }),
    ]);

    if (!quote?.regularMarketPrice) return null;

    const quotes: { close?: number | null; volume?: number | null }[] = chart?.quotes ?? [];
    const closes = quotes.map((q) => q.close ?? 0).filter((v) => v > 0);
    const volumes = quotes.map((q) => q.volume ?? 0);

    const flow = calculateFlowScore(closes, volumes);
    const price = quote.regularMarketPrice;
    const change1d = quote.regularMarketChangePercent ?? 0;

    return {
      symbol: def.symbol,
      name: def.name,
      sector: def.sector,
      market: "us" as const,
      price,
      priceStr: fmtUSD(price),
      change1d: Math.round(change1d * 10) / 10,
      p7d: flow.p7d,
      p30d: flow.p30d,
      volume: quote.regularMarketVolume ?? 0,
      marketCap: quote.marketCap ?? 0,
      volRatio: flow.volRatio,
      rsi: flow.rsi,
      score: flow.score,
      grade: flow.grade,
      signals: flow.signals,
      spark: closes.slice(-14),
    };
  } catch (e) {
    console.error(`[api/us] ${def.symbol} 조회 실패:`, e instanceof Error ? e.message : e);
    return null;
  }
}

export async function GET() {
  const CACHE_KEY = "flowsignal:us:v1";

  try {
    const cached = await getRedis().get<StockData[]>(CACHE_KEY);
    if (cached) return NextResponse.json({ stocks: cached, cached: true });
  } catch {
    // Redis 없으면 진행
  }

  const results = await Promise.all(US_STOCKS.map(fetchUS));
  const stocks = results
    .filter((s): s is StockData => s !== null)
    .sort((a, b) => b.score - a.score);

  console.info(`[api/us] 조회 완료: ${stocks.length}/${US_STOCKS.length}개`);

  try {
    await getRedis().set(CACHE_KEY, stocks, { ex: 300 });
  } catch (e) {
    console.warn("[api/us] Redis 캐시 저장 실패:", e instanceof Error ? e.message : e);
  }

  if (stocks.length === 0) {
    console.error("[api/us] 전체 조회 실패 — 503 반환");
    return NextResponse.json({ error: "데이터 조회 실패" }, { status: 503 });
  }

  return NextResponse.json({ stocks, cached: false });
}
