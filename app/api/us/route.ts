import { NextResponse } from "next/server";
import yahooFinance from "@/lib/yahoo";
import { US_STOCKS } from "@/lib/stocks";
import { evaluateSignals } from "@/lib/signals";
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
    // quote: change1d, volume 등 당일 데이터 / evaluateSignals: 12시그널 점수
    const [quote, evalResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yahooFinance.quote(def.symbol, {}, { validateResult: false }) as Promise<any>,
      evaluateSignals("us", def.symbol),
    ]);

    if (!quote?.regularMarketPrice) return null;

    const price = quote.regularMarketPrice as number;
    const change1d = (quote.regularMarketChangePercent as number) ?? 0;
    const p7d = Math.round(evalResult.ret7d * 1000) / 10;
    const p30d = Math.round(evalResult.ret30d * 1000) / 10;

    return {
      symbol: def.symbol,
      name: def.name,
      sector: def.sector,
      market: "us",
      price,
      priceStr: fmtUSD(price),
      change1d: Math.round(change1d * 10) / 10,
      p7d,
      p30d,
      volume: (quote.regularMarketVolume as number) ?? 0,
      marketCap: (quote.marketCap as number) ?? 0,
      volRatio: 1,
      rsi: 50,
      score: evalResult.score,
      grade: evalResult.label,
      signals: evalResult.signals.map((s) => s.name),
      spark: evalResult.spark,
    };
  } catch (e) {
    console.error(`[api/us] ${def.symbol} 조회 실패:`, e instanceof Error ? e.message : e);
    return null;
  }
}

export async function GET() {
  const CACHE_KEY = "flowsignal:us:v2";

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
    await getRedis().set(CACHE_KEY, stocks, { ex: 900 }); // 15분 TTL
  } catch (e) {
    console.warn("[api/us] Redis 캐시 저장 실패:", e instanceof Error ? e.message : e);
  }

  if (stocks.length === 0) {
    console.error("[api/us] 전체 조회 실패 — 503 반환");
    return NextResponse.json({ error: "데이터 조회 실패" }, { status: 503 });
  }

  return NextResponse.json({ stocks, cached: false });
}
