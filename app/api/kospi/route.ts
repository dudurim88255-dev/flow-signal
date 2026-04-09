import { NextResponse } from "next/server";
import yahooFinance from "@/lib/yahoo";
import { KOSPI_STOCKS } from "@/lib/stocks";
import { calculateFlowScore } from "@/lib/flowscore";
import { getRedis } from "@/lib/redis";

export const revalidate = 0;

export interface StockData {
  symbol: string;
  coinId?: string;   // 코인 전용 — CoinGecko ID (라우팅용)
  name: string;
  sector: string;
  market: "kospi" | "us" | "crypto";
  price: number;
  priceStr: string;
  change1d: number;
  p7d: number;
  p30d: number;
  volume: number;
  marketCap: number;
  volRatio: number;
  rsi: number;
  score: number;
  grade: string;
  signals: string[];
  spark: number[];
}

function fmtKRW(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

async function fetchStock(def: typeof KOSPI_STOCKS[number]): Promise<StockData | null> {
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

    if (!quote || !quote.regularMarketPrice) return null;

    const quotes: { close?: number | null; volume?: number | null }[] = chart?.quotes ?? [];
    const closes = quotes.map((q) => q.close ?? 0).filter((v) => v > 0);
    const volumes = quotes.map((q) => q.volume ?? 0);

    const flow = calculateFlowScore(closes, volumes);
    const spark = closes.slice(-14);
    const price = quote.regularMarketPrice;
    const change1d = quote.regularMarketChangePercent ?? 0;

    return {
      symbol: def.symbol,
      name: def.name,
      sector: def.sector,
      market: "kospi" as const,
      price,
      priceStr: fmtKRW(price),
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
      spark,
    };
  } catch (e) {
    console.error(`[api/kospi] ${def.symbol} 조회 실패:`, e instanceof Error ? e.message : e);
    return null;
  }
}

export async function GET() {
  const CACHE_KEY = "flowsignal:kospi:v1";

  try {
    const cached = await getRedis().get<StockData[]>(CACHE_KEY);
    if (cached) return NextResponse.json({ stocks: cached, cached: true });
  } catch {
    // Redis 없으면 그냥 진행
  }

  const results = await Promise.all(KOSPI_STOCKS.map(fetchStock));
  const stocks = results
    .filter((s): s is StockData => s !== null)
    .sort((a, b) => b.score - a.score);

  console.info(`[api/kospi] 조회 완료: ${stocks.length}/${KOSPI_STOCKS.length}개`);

  try {
    await getRedis().set(CACHE_KEY, stocks, { ex: 1800 });
  } catch (e) {
    console.warn("[api/kospi] Redis 캐시 저장 실패:", e instanceof Error ? e.message : e);
  }

  if (stocks.length === 0) {
    console.error("[api/kospi] 전체 조회 실패 — 503 반환");
    return NextResponse.json({ error: "데이터 조회 실패" }, { status: 503 });
  }

  return NextResponse.json({ stocks, cached: false });
}
