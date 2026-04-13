/**
 * GET /api/macro-context?market=crypto|korea|us
 * 시장별 거시경제 지표 반환 (Redis 30분 캐시)
 *
 * 지표:
 *   crypto: BTC 도미넌스, DXY, 미국 10Y, VIX
 *   korea:  KRW/USD, KOSPI 변동성(20d), 미국 10Y
 *   us:     VIX, 미국 10Y, DXY, SPY 50MA 이격
 */

import { NextRequest, NextResponse } from "next/server";
import yahooFinance from "@/lib/yahoo";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";

const CACHE_TTL_SEC = 60 * 30; // 30분

export type MacroIndicator = {
  id: string;
  label: string;
  value: number;
  unit: string;
  prev7d: number | null; // 7일 전 값 (없으면 null)
  change7d: number | null; // 7일 전 대비 변화량 (값 기준)
  /** true = 값 상승이 "좋음" (e.g. BTC 도미넌스↑ = 리스크오프) */
  positiveIsGood: boolean;
  description: string;
};

export type MacroContextResult = {
  market: string;
  indicators: MacroIndicator[];
  fetchedAt: string;
  cached: boolean;
};

// ─── Yahoo Finance 단일 종목 현재가 + 7일 전 종가 조회 ──────────────────────

async function fetchYahooQuote(
  symbol: string
): Promise<{ current: number; prev7d: number | null }> {
  // 최근 30일 일봉으로 현재/7일 전 데이터 확보
  const quotes = await yahooFinance.historical(symbol, {
    period1: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    period2: new Date(),
    interval: "1d",
  });
  if (!quotes || quotes.length === 0) throw new Error(`No data for ${symbol}`);
  const sorted = [...quotes].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const current = sorted[sorted.length - 1].close ?? sorted[sorted.length - 1].adjClose ?? 0;
  // 7 거래일 전 (약 1주일)
  const prev7d =
    sorted.length >= 8
      ? (sorted[sorted.length - 8].close ?? sorted[sorted.length - 8].adjClose ?? null)
      : null;
  return { current, prev7d };
}

// ─── BTC 도미넌스 (CoinGecko global) ──────────────────────────────────────

async function fetchBtcDominance(): Promise<number> {
  const res = await fetch("https://api.coingecko.com/api/v3/global", {
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`CoinGecko global: HTTP ${res.status}`);
  const json = await res.json();
  return json.data?.market_cap_percentage?.btc ?? 0;
}

// ─── KOSPI 20일 실현변동성 ──────────────────────────────────────────────────

async function fetchKospiVol20d(): Promise<{ current: number; prev7d: number | null }> {
  const quotes = await yahooFinance.historical("^KS11", {
    period1: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    period2: new Date(),
    interval: "1d",
  });
  if (!quotes || quotes.length < 22) throw new Error("Not enough KOSPI data");
  const sorted = [...quotes].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const calcVol20d = (endIdx: number): number => {
    const slice = sorted.slice(Math.max(0, endIdx - 20), endIdx + 1);
    if (slice.length < 5) return 0;
    const returns = slice.slice(1).map((d, i) => {
      const prev = slice[i].close ?? 1;
      const cur = d.close ?? prev;
      return Math.log(cur / prev);
    });
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
    return Math.sqrt(variance * 252) * 100; // 연환산 %
  };
  const current = calcVol20d(sorted.length - 1);
  const prev7d = sorted.length >= 9 ? calcVol20d(sorted.length - 8) : null;
  return { current, prev7d };
}

// ─── SPY 50MA 이격률 ────────────────────────────────────────────────────────

async function fetchSpyMaDeviation(): Promise<{ current: number; prev7d: number | null }> {
  const quotes = await yahooFinance.historical("SPY", {
    period1: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
    period2: new Date(),
    interval: "1d",
  });
  if (!quotes || quotes.length < 55) throw new Error("Not enough SPY data");
  const sorted = [...quotes].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const calcDeviation = (endIdx: number): number => {
    const slice = sorted.slice(Math.max(0, endIdx - 49), endIdx + 1);
    const ma50 = slice.reduce((s, d) => s + (d.close ?? 0), 0) / slice.length;
    const price = sorted[endIdx].close ?? ma50;
    return ((price - ma50) / ma50) * 100;
  };
  const current = calcDeviation(sorted.length - 1);
  const prev7d = sorted.length >= 9 ? calcDeviation(sorted.length - 8) : null;
  return { current, prev7d };
}

// ─── 시장별 지표 수집 ────────────────────────────────────────────────────────

async function fetchCryptoMacro(): Promise<MacroIndicator[]> {
  const [btcDom, dxy, tnx, vix] = await Promise.allSettled([
    fetchBtcDominance(),
    fetchYahooQuote("DX-Y.NYB"),
    fetchYahooQuote("^TNX"),
    fetchYahooQuote("^VIX"),
  ]);

  return [
    {
      id: "btc_dom",
      label: "BTC 도미넌스",
      value: btcDom.status === "fulfilled" ? Math.round(btcDom.value * 10) / 10 : 0,
      unit: "%",
      prev7d: null, // BTC 도미넌스는 7일 전 없음 (CoinGecko 무료 제한)
      change7d: null,
      positiveIsGood: false, // BTC 도미넌스 상승 = 알트 약세 = 리스크오프
      description: "BTC의 전체 암호화폐 시총 비중",
    },
    {
      id: "dxy",
      label: "달러 인덱스 (DXY)",
      value: dxy.status === "fulfilled" ? Math.round(dxy.value.current * 100) / 100 : 0,
      unit: "",
      prev7d: dxy.status === "fulfilled" ? (dxy.value.prev7d ?? null) : null,
      change7d:
        dxy.status === "fulfilled" && dxy.value.prev7d != null
          ? Math.round((dxy.value.current - dxy.value.prev7d) * 100) / 100
          : null,
      positiveIsGood: false, // DXY 상승 = 달러 강세 = 위험자산 하락 압력
      description: "달러 강세 → 암호화폐 하락 압력",
    },
    {
      id: "us10y",
      label: "미국 10Y 국채",
      value: tnx.status === "fulfilled" ? Math.round(tnx.value.current * 100) / 100 : 0,
      unit: "%",
      prev7d: tnx.status === "fulfilled" ? (tnx.value.prev7d ?? null) : null,
      change7d:
        tnx.status === "fulfilled" && tnx.value.prev7d != null
          ? Math.round((tnx.value.current - tnx.value.prev7d) * 100) / 100
          : null,
      positiveIsGood: false, // 금리 상승 = 위험자산 하락
      description: "금리 상승 → 위험자산 하락 압력",
    },
    {
      id: "vix",
      label: "VIX (공포지수)",
      value: vix.status === "fulfilled" ? Math.round(vix.value.current * 100) / 100 : 0,
      unit: "",
      prev7d: vix.status === "fulfilled" ? (vix.value.prev7d ?? null) : null,
      change7d:
        vix.status === "fulfilled" && vix.value.prev7d != null
          ? Math.round((vix.value.current - vix.value.prev7d) * 100) / 100
          : null,
      positiveIsGood: false, // VIX 상승 = 공포 증가 = 하락 압력
      description: "시장 공포 수준 (20 이상 = 고공포)",
    },
  ];
}

async function fetchKoreaMacro(): Promise<MacroIndicator[]> {
  const [krw, kospiVol, tnx] = await Promise.allSettled([
    fetchYahooQuote("KRW=X"), // USD per KRW → 역수로 표현
    fetchKospiVol20d(),
    fetchYahooQuote("^TNX"),
  ]);

  // KRW=X는 1 USD = X KRW 형식
  const krwPerUsd = krw.status === "fulfilled" ? krw.value.current : 0;
  const krwPrev = krw.status === "fulfilled" ? krw.value.prev7d : null;

  return [
    {
      id: "krw_usd",
      label: "원/달러 환율",
      value: krwPerUsd > 0 ? Math.round(krwPerUsd) : 0,
      unit: "원",
      prev7d: krwPrev != null ? Math.round(krwPrev) : null,
      change7d:
        krwPrev != null ? Math.round(krwPerUsd - krwPrev) : null,
      positiveIsGood: false, // 환율 상승(원화 약세) = 외국인 매도 압력
      description: "환율 상승(원화 약세) → 외국인 매도 압력",
    },
    {
      id: "kospi_vol",
      label: "KOSPI 변동성",
      value:
        kospiVol.status === "fulfilled"
          ? Math.round(kospiVol.value.current * 10) / 10
          : 0,
      unit: "%",
      prev7d:
        kospiVol.status === "fulfilled" && kospiVol.value.prev7d != null
          ? Math.round(kospiVol.value.prev7d * 10) / 10
          : null,
      change7d:
        kospiVol.status === "fulfilled" && kospiVol.value.prev7d != null
          ? Math.round((kospiVol.value.current - kospiVol.value.prev7d) * 10) / 10
          : null,
      positiveIsGood: false, // 변동성 상승 = 시장 불안
      description: "KOSPI 20일 실현 변동성 (연환산)",
    },
    {
      id: "us10y",
      label: "미국 10Y 국채",
      value: tnx.status === "fulfilled" ? Math.round(tnx.value.current * 100) / 100 : 0,
      unit: "%",
      prev7d: tnx.status === "fulfilled" ? (tnx.value.prev7d ?? null) : null,
      change7d:
        tnx.status === "fulfilled" && tnx.value.prev7d != null
          ? Math.round((tnx.value.current - tnx.value.prev7d) * 100) / 100
          : null,
      positiveIsGood: false,
      description: "미국 금리 상승 → 한국 시장 하락 압력",
    },
  ];
}

async function fetchUsMacro(): Promise<MacroIndicator[]> {
  const [vix, tnx, dxy, spyDev] = await Promise.allSettled([
    fetchYahooQuote("^VIX"),
    fetchYahooQuote("^TNX"),
    fetchYahooQuote("DX-Y.NYB"),
    fetchSpyMaDeviation(),
  ]);

  return [
    {
      id: "vix",
      label: "VIX (공포지수)",
      value: vix.status === "fulfilled" ? Math.round(vix.value.current * 100) / 100 : 0,
      unit: "",
      prev7d: vix.status === "fulfilled" ? (vix.value.prev7d ?? null) : null,
      change7d:
        vix.status === "fulfilled" && vix.value.prev7d != null
          ? Math.round((vix.value.current - vix.value.prev7d) * 100) / 100
          : null,
      positiveIsGood: false,
      description: "시장 공포 수준 (20 이상 = 고공포)",
    },
    {
      id: "us10y",
      label: "미국 10Y 국채",
      value: tnx.status === "fulfilled" ? Math.round(tnx.value.current * 100) / 100 : 0,
      unit: "%",
      prev7d: tnx.status === "fulfilled" ? (tnx.value.prev7d ?? null) : null,
      change7d:
        tnx.status === "fulfilled" && tnx.value.prev7d != null
          ? Math.round((tnx.value.current - tnx.value.prev7d) * 100) / 100
          : null,
      positiveIsGood: false,
      description: "금리 상승 → 성장주·기술주 하락 압력",
    },
    {
      id: "dxy",
      label: "달러 인덱스 (DXY)",
      value: dxy.status === "fulfilled" ? Math.round(dxy.value.current * 100) / 100 : 0,
      unit: "",
      prev7d: dxy.status === "fulfilled" ? (dxy.value.prev7d ?? null) : null,
      change7d:
        dxy.status === "fulfilled" && dxy.value.prev7d != null
          ? Math.round((dxy.value.current - dxy.value.prev7d) * 100) / 100
          : null,
      positiveIsGood: false, // 달러 강세 = 다국적 기업 실적 부담
      description: "달러 강세 → 다국적 기업 실적·신흥국 자금 이탈",
    },
    {
      id: "spy_ma50",
      label: "SPY 50MA 이격",
      value:
        spyDev.status === "fulfilled"
          ? Math.round(spyDev.value.current * 10) / 10
          : 0,
      unit: "%",
      prev7d:
        spyDev.status === "fulfilled" && spyDev.value.prev7d != null
          ? Math.round(spyDev.value.prev7d * 10) / 10
          : null,
      change7d:
        spyDev.status === "fulfilled" && spyDev.value.prev7d != null
          ? Math.round((spyDev.value.current - spyDev.value.prev7d) * 10) / 10
          : null,
      positiveIsGood: true, // 이격 양수(50MA 위) = 상승 추세
      description: "SPY의 50일 이평선 대비 위치 (양수 = 50MA 위)",
    },
  ];
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const market = req.nextUrl.searchParams.get("market");
  if (!market || !["crypto", "korea", "us"].includes(market)) {
    return NextResponse.json({ error: `Invalid market: ${market}` }, { status: 400 });
  }

  const cacheKey = `macro:v1:${market}`;

  try {
    const redis = getRedis();
    const cached = await redis.get<string>(cacheKey);
    if (cached) {
      const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
      return NextResponse.json({ ...parsed, cached: true });
    }

    const indicators = await (
      market === "crypto"
        ? fetchCryptoMacro()
        : market === "korea"
        ? fetchKoreaMacro()
        : fetchUsMacro()
    );

    const result: MacroContextResult = {
      market,
      indicators,
      fetchedAt: new Date().toISOString(),
      cached: false,
    };

    await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL_SEC });

    return NextResponse.json(result);
  } catch (err) {
    console.error(`[macro-context] ${market} 실패:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "데이터 조회 실패" },
      { status: 500 }
    );
  }
}
