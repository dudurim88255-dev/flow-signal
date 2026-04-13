/**
 * GET /api/search?q=삼성전자&market=korea
 * 전체 종목 검색 — Yahoo Finance search (한국/미국) + CoinGecko top 250 (코인)
 */

import { NextRequest, NextResponse } from "next/server";
import yahooFinance from "@/lib/yahoo";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";

type SearchResult = {
  market: "crypto" | "korea" | "us";
  ticker: string;
  name: string;
  sector: string;
};

type CoinItem = { id: string; symbol: string; name: string };

// ─── 코인: CoinGecko 상위 250개 (Redis 24h 캐시) ────────────────────────────

async function searchCrypto(q: string): Promise<SearchResult[]> {
  const redis = getRedis();
  const cacheKey = "search:crypto:list:v1";

  let coins: CoinItem[] | null = null;
  try {
    coins = await redis.get<CoinItem[]>(cacheKey);
  } catch { /* Redis 미연결 시 무시 */ }

  if (!coins) {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1",
        { next: { revalidate: 0 } }
      );
      if (res.ok) {
        const data = await res.json();
        coins = (data as { id: string; symbol: string; name: string }[]).map((c) => ({
          id: c.id,
          symbol: c.symbol.toLowerCase(),
          name: c.name,
        }));
        try {
          await redis.set(cacheKey, JSON.stringify(coins), { ex: 86400 });
        } catch { /* 캐시 저장 실패 무시 */ }
      }
    } catch { /* CoinGecko 실패 시 빈 결과 */ }
  }

  if (!coins) return [];

  return coins
    .filter(
      (c) =>
        c.id.includes(q) ||
        c.symbol.includes(q) ||
        c.name.toLowerCase().includes(q)
    )
    .slice(0, 8)
    .map((c) => ({
      market: "crypto" as const,
      ticker: c.id,        // CoinGecko ID = /score/crypto/ 라우팅에 사용
      name: c.name,
      sector: "코인",
    }));
}

// ─── 한국 주식: Yahoo Finance search (.KS / .KQ 필터) ────────────────────────

async function searchKorea(q: string): Promise<SearchResult[]> {
  try {
    const result = await yahooFinance.search(q, {
      quotesCount: 20,
      newsCount: 0,
      enableFuzzyQuery: true,
    });

    type YahooQuote = { quoteType?: string; symbol: string; shortname?: string; longname?: string; sectorDisp?: string; isYahooFinance?: boolean };
    return (result.quotes ?? [] as YahooQuote[])
      .filter((r: YahooQuote) => {
        if (!r.quoteType || !r.isYahooFinance) return false;
        return (
          r.quoteType === "EQUITY" &&
          (r.symbol.endsWith(".KS") || r.symbol.endsWith(".KQ"))
        );
      })
      .slice(0, 8)
      .map((r: YahooQuote) => ({
        market: "korea" as const,
        ticker: r.symbol.replace(/\.(KS|KQ)$/i, ""),
        name: r.shortname || r.longname || r.symbol,
        sector: r.sectorDisp || "주식",
      }));
  } catch {
    return [];
  }
}

// ─── 미국 주식: Yahoo Finance search (점 없는 EQUITY 필터) ───────────────────

async function searchUS(q: string): Promise<SearchResult[]> {
  try {
    const result = await yahooFinance.search(q, {
      quotesCount: 20,
      newsCount: 0,
      enableFuzzyQuery: true,
    });

    type YahooQuote = { quoteType?: string; symbol: string; shortname?: string; longname?: string; sectorDisp?: string; isYahooFinance?: boolean };
    return (result.quotes ?? [] as YahooQuote[])
      .filter((r: YahooQuote) => {
        if (!r.quoteType || !r.isYahooFinance) return false;
        // 미국 주식: 점 없고 EQUITY 타입
        return r.quoteType === "EQUITY" && !r.symbol.includes(".");
      })
      .slice(0, 8)
      .map((r: YahooQuote) => ({
        market: "us" as const,
        ticker: r.symbol,
        name: r.shortname || r.longname || r.symbol,
        sector: r.sectorDisp || "주식",
      }));
  } catch {
    return [];
  }
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const marketFilter = url.searchParams.get("market");

  if (q.length < 1) return NextResponse.json({ results: [] });

  const t0 = Date.now();
  console.log(`[search] 요청: q="${q}" market=${marketFilter ?? "all"}`);

  const [cryptoRes, koreaRes, usRes] = await Promise.allSettled([
    !marketFilter || marketFilter === "crypto" ? searchCrypto(q) : Promise.resolve([]),
    !marketFilter || marketFilter === "korea" ? searchKorea(q) : Promise.resolve([]),
    !marketFilter || marketFilter === "us" ? searchUS(q) : Promise.resolve([]),
  ]);

  const results: SearchResult[] = [
    ...(cryptoRes.status === "fulfilled" ? cryptoRes.value : []),
    ...(koreaRes.status === "fulfilled" ? koreaRes.value : []),
    ...(usRes.status === "fulfilled" ? usRes.value : []),
  ];

  // 정확도 정렬: 시작 일치 우선
  results.sort((a, b) => {
    const aExact = a.name.toLowerCase().startsWith(q) || a.ticker.toLowerCase().startsWith(q) ? 0 : 1;
    const bExact = b.name.toLowerCase().startsWith(q) || b.ticker.toLowerCase().startsWith(q) ? 0 : 1;
    return aExact - bExact;
  });

  console.log(`[search] q="${q}" → ${results.length}건 (${Date.now() - t0}ms)`);
  return NextResponse.json({ results: results.slice(0, 20) });
}
