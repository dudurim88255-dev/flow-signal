import { NextResponse } from "next/server";
import yahooFinance from "@/lib/yahoo";
import { KOSPI_STOCKS, US_STOCKS, CRYPTO_COINS } from "@/lib/stocks";
import { calculateFlowScore } from "@/lib/flowscore";
import type { StockData } from "@/app/api/kospi/route";
import { getRedis } from "@/lib/redis";

export const revalidate = 0;

export interface DetailData extends StockData {
  market: "kospi" | "us" | "crypto";
  priceHistory: { date: string; close: number; volume: number }[];
  ma20: number;
  ma60: number;
  components: { momentum: number; technical: number; volume: number; trend: number };
}

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

function cgHeaders(): HeadersInit {
  const key = process.env.COINGECKO_API_KEY;
  return key
    ? { Accept: "application/json", "x-cg-demo-api-key": key }
    : { Accept: "application/json" };
}

function fmtKRW(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function fmtUSD(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

async function fetchYahooDetail(symbol: string, name: string, sector: string, market: "kospi" | "us"): Promise<DetailData | null> {
  try {
    const past = new Date();
    past.setDate(past.getDate() - 90);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [quote, chart]: [any, any] = await Promise.all([
      yahooFinance.quote(symbol, {}, { validateResult: false }),
      yahooFinance.chart(symbol, {
        period1: past.toISOString().split("T")[0],
        interval: "1d",
      }, { validateResult: false }),
    ]);

    if (!quote?.regularMarketPrice) return null;

    const rawQuotes: { date?: unknown; close?: number | null; volume?: number | null }[] = chart?.quotes ?? [];
    const priceHistory = rawQuotes
      .filter((q) => q.close != null && q.close > 0)
      .map((q) => ({
        date: q.date instanceof Date ? q.date.toISOString().split("T")[0] : String(q.date ?? ""),
        close: q.close as number,
        volume: q.volume ?? 0,
      }));

    const closes = priceHistory.map((q) => q.close);
    const volumes = priceHistory.map((q) => q.volume);

    const flow = calculateFlowScore(closes, volumes);
    const price = quote.regularMarketPrice;
    const change1d = quote.regularMarketChangePercent ?? 0;

    return {
      symbol,
      name,
      sector,
      market,
      price,
      priceStr: market === "kospi" ? fmtKRW(price) : fmtUSD(price),
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
      priceHistory,
      ma20: flow.ma20,
      ma60: flow.ma60,
      components: flow.components,
    };
  } catch {
    return null;
  }
}

// 리스트 캐시에서 기본 데이터 재활용 → markets API 호출 1회 절감
async function fetchCryptoDetail(
  coinId: string,
  def: typeof CRYPTO_COINS[number],
  listBase?: StockData,
): Promise<DetailData | null> {
  try {
    // 차트는 항상 새로 가져옴 (90일 상세 데이터)
    const chartRes = await fetch(
      `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=90&interval=daily`,
      { headers: cgHeaders() },
    );

    let priceHistory: { date: string; close: number; volume: number }[] = [];
    if (chartRes.ok) {
      const chart = await chartRes.json();
      priceHistory = (chart.prices as [number, number][]).map(([ts, price], i) => ({
        date: new Date(ts).toISOString().split("T")[0],
        close: price,
        volume: (chart.total_volumes as [number, number][])[i]?.[1] ?? 0,
      }));
    } else {
      console.warn(`[fetchCryptoDetail] chart API ${chartRes.status}: ${coinId}`);
    }

    // 차트 데이터가 있으면 FlowScore 재계산, 없으면 리스트 캐시 값 활용
    const closes = priceHistory.map((q) => q.close);
    const volumes = priceHistory.map((q) => q.volume);

    if (!listBase && closes.length === 0) {
      // 차트도 실패했고 리스트 캐시도 없으면 포기
      console.error(`[fetchCryptoDetail] 차트 없음 + 리스트 캐시 없음: ${coinId}`);
      return null;
    }

    const flow = calculateFlowScore(closes.length > 0 ? closes : (listBase?.spark ?? []), volumes);

    // 리스트 캐시 우선, 없으면 markets API 호출
    if (listBase) {
      return {
        ...listBase,
        market: "crypto",
        priceHistory,
        ma20: flow.ma20,
        ma60: flow.ma60,
        components: flow.components,
        // FlowScore도 90일 데이터 기반으로 재계산
        rsi: flow.rsi,
        score: flow.score,
        grade: flow.grade,
        signals: flow.signals,
        volRatio: flow.volRatio,
        p7d: closes.length > 0 ? flow.p7d : listBase.p7d,
        p30d: closes.length > 0 ? flow.p30d : listBase.p30d,
      };
    }

    // 리스트 캐시 없을 때만 markets API 호출 (fallback)
    const marketRes = await fetch(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${coinId}&sparkline=true&price_change_percentage=7d,30d`,
      { headers: cgHeaders() },
    );
    if (!marketRes.ok) {
      console.error(`[fetchCryptoDetail] markets API ${marketRes.status}: ${coinId}`);
      return null;
    }
    const markets = await marketRes.json();
    const coin = markets[0];
    if (!coin) return null;

    return {
      symbol: coin.symbol.toUpperCase(),
      name: def.name,
      sector: def.sector,
      market: "crypto",
      price: coin.current_price,
      priceStr: fmtUSD(coin.current_price),
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
      spark: (coin.sparkline_in_7d?.price ?? []).slice(-14),
      priceHistory,
      ma20: flow.ma20,
      ma60: flow.ma60,
      components: flow.components,
    };
  } catch (e) {
    console.error(`[fetchCryptoDetail] 예외: ${coinId}`, e);
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const decoded = decodeURIComponent(symbol);
  // Redis 키 인젝션 방지 — 영숫자·점·하이픈·밑줄만 허용
  const safeId = decoded.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const CACHE_KEY = `flowsignal:detail:${safeId}:v1`;

  // Redis 캐시 확인
  try {
    const cached = await getRedis().get<DetailData>(CACHE_KEY);
    if (cached) {
      console.info(`[api/stock] ${decoded} 캐시 히트`);
      return NextResponse.json(cached);
    }
  } catch {
    // Redis 없으면 진행
  }

  const start = Date.now();

  async function saveCache(data: DetailData) {
    try { await getRedis().set(CACHE_KEY, data, { ex: 1800 }); } catch { /* Redis 없으면 무시 */ }
  }

  // 코스피
  const kospiDef = KOSPI_STOCKS.find((s) => s.symbol === decoded);
  if (kospiDef) {
    const data = await fetchYahooDetail(kospiDef.symbol, kospiDef.name, kospiDef.sector, "kospi");
    if (!data) {
      console.error(`[api/stock] kospi ${decoded} 조회 실패`);
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }
    console.info(`[api/stock] ${decoded} 완료 ${Date.now() - start}ms`);
    await saveCache(data);
    return NextResponse.json(data);
  }

  // 미국
  const usDef = US_STOCKS.find((s) => s.symbol === decoded);
  if (usDef) {
    const data = await fetchYahooDetail(usDef.symbol, usDef.name, usDef.sector, "us");
    if (!data) {
      console.error(`[api/stock] us ${decoded} 조회 실패`);
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }
    console.info(`[api/stock] ${decoded} 완료 ${Date.now() - start}ms`);
    await saveCache(data);
    return NextResponse.json(data);
  }

  // 코인 (CoinGecko id로 조회)
  const cryptoDef = CRYPTO_COINS.find((s) => s.symbol === decoded);
  if (cryptoDef) {
    // 리스트 캐시에서 기본 데이터 재활용 → markets API 429 방지
    let listBase: StockData | undefined;
    try {
      const listCached = await getRedis().get<StockData[]>("flowsignal:crypto:v1");
      listBase = listCached?.find((s) => s.coinId === decoded) ?? undefined;
    } catch { /* Redis 없으면 무시 */ }

    const data = await fetchCryptoDetail(cryptoDef.symbol, cryptoDef, listBase);
    if (!data) {
      console.error(`[api/stock] crypto ${decoded} 조회 실패`);
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }
    console.info(`[api/stock] ${decoded} 완료 ${Date.now() - start}ms`);
    await saveCache(data);
    return NextResponse.json(data);
  }

  console.warn(`[api/stock] 종목 없음: ${decoded}`);
  return NextResponse.json({ error: "종목을 찾을 수 없습니다" }, { status: 404 });
}
