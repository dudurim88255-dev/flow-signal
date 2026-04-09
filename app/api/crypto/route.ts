import { NextResponse } from "next/server";
import { CRYPTO_COINS } from "@/lib/stocks";
import { calculateFlowScore } from "@/lib/flowscore";
import type { StockData } from "@/app/api/kospi/route";
import { getRedis } from "@/lib/redis";

// CoinGecko 동시 요청 제한 (429 방지)
function withConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = new Array(tasks.length);
    let started = 0, finished = 0;
    function next() {
      if (started >= tasks.length) return;
      const idx = started++;
      tasks[idx]().then((v) => {
        results[idx] = v;
        finished++;
        if (finished === tasks.length) resolve(results);
        else next();
      }).catch(reject);
    }
    for (let i = 0; i < Math.min(limit, tasks.length); i++) next();
  });
}

export const revalidate = 0;

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
  sparkline_in_7d?: { price: number[] };
}

interface CoinGeckoChart {
  prices: [number, number][];
  total_volumes: [number, number][];
}

function fmtCrypto(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

function cgHeaders(): HeadersInit {
  const key = process.env.COINGECKO_API_KEY;
  return key
    ? { Accept: "application/json", "x-cg-demo-api-key": key }
    : { Accept: "application/json" };
}

async function fetchCoinGeckoMarkets(): Promise<CoinGeckoMarket[]> {
  const ids = CRYPTO_COINS.map((c) => c.symbol).join(",");
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=7d,30d`;
  const res = await fetch(url, {
    headers: cgHeaders(),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`CoinGecko markets: ${res.status}`);
  return res.json();
}

async function fetchCoinChart(id: string): Promise<CoinGeckoChart> {
  const url = `${COINGECKO_BASE}/coins/${id}/market_chart?vs_currency=usd&days=90&interval=daily`;
  const res = await fetch(url, {
    headers: cgHeaders(),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`CoinGecko chart ${id}: ${res.status}`);
  return res.json();
}

export async function GET() {
  const CACHE_KEY = "flowsignal:crypto:v1";

  try {
    const cached = await getRedis().get<StockData[]>(CACHE_KEY);
    if (cached) return NextResponse.json({ stocks: cached, cached: true });
  } catch {
    // Redis 없으면 진행
  }

  try {
    const markets = await fetchCoinGeckoMarkets();

    const stocks: StockData[] = await withConcurrency(
      markets.map((coin) => async () => {
        const def = CRYPTO_COINS.find((c) => c.symbol === coin.id);

        let closes: number[] = [];
        let volumes: number[] = [];
        try {
          const chart = await fetchCoinChart(coin.id);
          closes = chart.prices.map(([, p]) => p);
          volumes = chart.total_volumes.map(([, v]) => v);
        } catch (e) {
          console.warn(`[api/crypto] ${coin.id} 차트 조회 실패:`, e instanceof Error ? e.message : e);
          // 스파크라인으로 대체
          closes = coin.sparkline_in_7d?.price ?? [];
        }

        const flow = calculateFlowScore(closes, volumes);
        const spark = (coin.sparkline_in_7d?.price ?? []).filter((_, i, a) =>
          i % Math.max(1, Math.floor(a.length / 14)) === 0
        ).slice(0, 14);

        return {
          symbol: coin.symbol.toUpperCase(),
          coinId: coin.id,   // CoinGecko ID — 상세 라우팅에 사용
          name: def?.name ?? coin.name,
          sector: def?.sector ?? "코인",
          market: "crypto" as const,
          price: coin.current_price,
          priceStr: fmtCrypto(coin.current_price),
          change1d: Math.round((coin.price_change_percentage_24h ?? 0) * 10) / 10,
          p7d: Math.round((coin.price_change_percentage_7d_in_currency ?? flow.p7d) * 10) / 10,
          p30d: Math.round((coin.price_change_percentage_30d_in_currency ?? flow.p30d) * 10) / 10,
          volume: coin.total_volume,
          marketCap: coin.market_cap,
          volRatio: flow.volRatio,
          rsi: flow.rsi,
          score: flow.score,
          grade: flow.grade,
          signals: flow.signals,
          spark,
        };
      }),
      5  // 동시 최대 5개 요청
    );

    const sorted = stocks.sort((a, b) => b.score - a.score);

    console.info(`[api/crypto] 조회 완료: ${sorted.length}개`);

    try {
      await getRedis().set(CACHE_KEY, sorted, { ex: 300 });
    } catch (e) {
      console.warn("[api/crypto] Redis 캐시 저장 실패:", e instanceof Error ? e.message : e);
    }

    return NextResponse.json({ stocks: sorted, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // 레이트 리밋(429)은 잠시 후 재시도 안내, 500 대신 빈 결과 반환
    if (message.includes("429")) {
      console.warn("[api/crypto] CoinGecko 레이트 리밋 — 잠시 후 재시도");
      return NextResponse.json({ stocks: [], cached: false, rateLimited: true });
    }
    console.error("[api/crypto] 오류:", message);
    return NextResponse.json({ stocks: [], cached: false, error: message });
  }
}
