import { NextResponse } from "next/server";
import yahooFinance from "@/lib/yahoo";
import { KOSPI_STOCKS } from "@/lib/stocks";
import { evaluateSignals } from "@/lib/signals";
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
    // quote: change1d, volume 등 당일 데이터 / evaluateSignals: 12시그널 점수
    const [quote, evalResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yahooFinance.quote(def.symbol, {}, { validateResult: false }) as Promise<any>,
      evaluateSignals("korea", def.symbol),
    ]);

    if (!quote || !quote.regularMarketPrice) return null;

    const price = quote.regularMarketPrice as number;
    const change1d = (quote.regularMarketChangePercent as number) ?? 0;
    const p7d = Math.round(evalResult.ret7d * 1000) / 10;
    const p30d = Math.round(evalResult.ret30d * 1000) / 10;

    return {
      symbol: def.symbol,
      name: def.name,
      sector: def.sector,
      market: "kospi",
      price,
      priceStr: fmtKRW(price),
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
    console.error(`[api/kospi] ${def.symbol} 조회 실패:`, e instanceof Error ? e.message : e);
    return null;
  }
}

export async function GET() {
  const CACHE_KEY = "flowsignal:kospi:v2";

  try {
    const cached = await getRedis().get<StockData[]>(CACHE_KEY);
    if (cached) return NextResponse.json({ stocks: cached, cached: true });
  } catch {
    // Redis 없으면 진행
  }

  const results = await Promise.all(KOSPI_STOCKS.map(fetchStock));
  const stocks = results
    .filter((s): s is StockData => s !== null)
    .sort((a, b) => b.score - a.score);

  console.info(`[api/kospi] 조회 완료: ${stocks.length}/${KOSPI_STOCKS.length}개`);

  try {
    await getRedis().set(CACHE_KEY, stocks, { ex: 900 }); // 15분 TTL
  } catch (e) {
    console.warn("[api/kospi] Redis 캐시 저장 실패:", e instanceof Error ? e.message : e);
  }

  if (stocks.length === 0) {
    console.error("[api/kospi] 전체 조회 실패 — 503 반환");
    return NextResponse.json({ error: "데이터 조회 실패" }, { status: 503 });
  }

  return NextResponse.json({ stocks, cached: false });
}
