/**
 * FlowSignal v3 — 시장별 데이터 수집
 * Crypto: CoinGecko + alternative.me + Binance Futures
 * Korea/US: Yahoo Finance
 */

import yahooFinance from "../yahoo";
import { rsi, macd, volumeZ, adSlope, obvSlope, maValue, linearSlope, returnPct, bollingerPos, volatility20d } from "./compute";
import { getRedis } from "../redis";

// ─── 공통 유틸 ─────────────────────────────────────────────────────────────

const fetchJson = async (url: string) => {
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
};

// ─── CRYPTO 데이터 ─────────────────────────────────────────────────────────

export type CryptoFetchResult = {
  closes: number[];
  volumes: number[];
  highs: number[];
  lows: number[];
  priceChangePct: number;       // 24h
  oiChangePct: number;
  fundingRate: number;
  longShortRatio: number;
  fearGreed: number;
  whaleNet24h: number;
  exchangeNetOut: number;
  stablecoinIn24h: number;
  mvrv: number;
  marketCap: number;
  longLiq24h: number;           // C13: 24h 롱 청산 (USD)
  shortLiq24h: number;          // C13: 24h 숏 청산 (USD)
};

/** CoinGecko 시장 데이터 (90일 OHLCV + 메타) */
async function fetchCoinGeckoOhlcv(coinId: string): Promise<{
  closes: number[];
  volumes: number[];
  highs: number[];
  lows: number[];
  priceChangePct: number;
  marketCap: number;
}> {
  // OHLC 90일
  const ohlcUrl = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=90`;
  // 시장 정보
  const marketUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinId}&sparkline=false`;
  // 실제 일별 거래량 — market_chart (days=31, interval=daily)
  // 응답: { total_volumes: [[timestamp, volume], ...] }
  const volumeUrl = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=31&interval=daily`;

  const [ohlcData, marketData, chartData] = await Promise.all([
    fetchJson(ohlcUrl),
    fetchJson(marketUrl),
    fetchJson(volumeUrl).catch(() => null), // 실패 시 fallback
  ]);

  // ohlcData: [[timestamp, open, high, low, close], ...]
  const closes = ohlcData.map((d: number[]) => d[4]);
  const highs = ohlcData.map((d: number[]) => d[2]);
  const lows = ohlcData.map((d: number[]) => d[3]);

  // market_chart의 일별 실제 거래량 사용
  // closes(90일)보다 짧으므로 앞을 최신 거래량 평균으로 채움
  let volumes: number[];
  const chartVolumes: number[] = chartData?.total_volumes?.map((v: number[]) => v[1]) ?? [];
  if (chartVolumes.length > 0) {
    const avgVol = chartVolumes.reduce((s: number, v: number) => s + v, 0) / chartVolumes.length;
    // closes 길이에 맞게 앞부분은 평균으로 패딩, 뒷부분은 실제값
    const padLen = Math.max(0, closes.length - chartVolumes.length);
    volumes = [...Array(padLen).fill(avgVol), ...chartVolumes];
  } else {
    // chart API 실패 시 markets total_volume으로 fallback (구버전 동작)
    const vol24h = marketData[0]?.total_volume ?? 0;
    volumes = closes.map((_: number, i: number) => (i === closes.length - 1 ? vol24h : vol24h * (0.8 + Math.random() * 0.4)));
  }

  return {
    closes,
    highs,
    lows,
    volumes,
    priceChangePct: (marketData[0]?.price_change_percentage_24h ?? 0) / 100,
    marketCap: marketData[0]?.market_cap ?? 1,
  };
}

/** alternative.me Fear & Greed */
async function fetchFearGreed(): Promise<number> {
  try {
    const data = await fetchJson("https://api.alternative.me/fng/?limit=1");
    return parseInt(data.data[0].value, 10);
  } catch {
    return 50;
  }
}

/** Binance Futures: fundingRate, OI 변화, Long/Short ratio */
async function fetchBinanceFutures(symbol: string): Promise<{
  fundingRate: number;
  oiChangePct: number;
  longShortRatio: number;
}> {
  // USDT-M perpetual symbol (예: BTCUSDT)
  const binanceSymbol = symbol.toUpperCase() + "USDT";
  try {
    const [fundingData, oiData, lsData] = await Promise.all([
      fetchJson(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${binanceSymbol}&limit=1`),
      fetchJson(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${binanceSymbol}`),
      fetchJson(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${binanceSymbol}&period=1h&limit=2`),
    ]);

    const fundingRate = parseFloat(fundingData[0]?.fundingRate ?? "0");
    const oi = parseFloat(oiData?.openInterest ?? "0");
    const longShortRatio = parseFloat(lsData[0]?.longShortRatio ?? "1");

    // 이전 OI와 비교해 delta % 계산 (Redis — 없으면 0)
    let oiChangePct = 0;
    if (oi > 0) {
      try {
        const redis = getRedis();
        const prevOi = await redis.get<number>(`oi:${binanceSymbol}`);
        if (prevOi && prevOi > 0) oiChangePct = (oi - prevOi) / prevOi;
        await redis.set(`oi:${binanceSymbol}`, oi, { ex: 21600 }); // TTL 6h
      } catch {
        // Redis 미연결 시 무시 — C5는 neutral(50) 유지
      }
    }

    return { fundingRate, oiChangePct, longShortRatio };
  } catch {
    return { fundingRate: 0, oiChangePct: 0, longShortRatio: 1 };
  }
}

/** Binance 공개 API — 최근 24h 강제청산 집계 (인증 불필요) */
async function fetchLiquidationData(binanceBase: string): Promise<{
  longLiq24h: number;
  shortLiq24h: number;
}> {
  try {
    const symbol = binanceBase.toUpperCase() + "USDT";
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const url =
      `https://fapi.binance.com/fapi/v1/allForceOrders?symbol=${symbol}&startTime=${since}&limit=1000`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return { longLiq24h: 0, shortLiq24h: 0 };
    const orders: { side: string; price: string; executedQty: string }[] = await res.json();
    // side=SELL → 롱 포지션 강제청산, side=BUY → 숏 포지션 강제청산
    let longLiq24h = 0;
    let shortLiq24h = 0;
    for (const o of orders) {
      const usd = parseFloat(o.price) * parseFloat(o.executedQty);
      if (o.side === "SELL") longLiq24h += usd;
      else shortLiq24h += usd;
    }
    return { longLiq24h, shortLiq24h };
  } catch {
    return { longLiq24h: 0, shortLiq24h: 0 };
  }
}

/** 전체 Crypto 데이터 수집 (coinId: 'bitcoin', binanceBase: 'BTC') */
export async function fetchCryptoData(coinId: string, binanceBase: string): Promise<CryptoFetchResult> {
  const [geckoData, fearGreed, futures, liqData] = await Promise.all([
    fetchCoinGeckoOhlcv(coinId),
    fetchFearGreed(),
    fetchBinanceFutures(binanceBase),
    fetchLiquidationData(binanceBase),
  ]);

  return {
    closes: geckoData.closes,
    volumes: geckoData.volumes,
    highs: geckoData.highs,
    lows: geckoData.lows,
    priceChangePct: geckoData.priceChangePct,
    oiChangePct: futures.oiChangePct,
    fundingRate: futures.fundingRate,
    longShortRatio: futures.longShortRatio,
    fearGreed,
    // 온체인 데이터 (CoinGecko 무료 한계 — neutral 처리)
    whaleNet24h: 0,
    exchangeNetOut: 0,
    stablecoinIn24h: 0,
    mvrv: 1.5,
    marketCap: geckoData.marketCap,
    longLiq24h: liqData.longLiq24h,
    shortLiq24h: liqData.shortLiq24h,
  };
}

// ─── KOREA 데이터 ──────────────────────────────────────────────────────────

export type KoreaFetchResult = {
  closes: number[];
  volumes: number[];
  highs: number[];
  lows: number[];
  price: number;
  marketCap: number;
};

/** Yahoo Finance KR 종목 데이터 (120일) */
export async function fetchKoreaData(yahooSymbol: string): Promise<KoreaFetchResult> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 120);

  // historical()은 내부적으로 chart() 래퍼이며, KOSPI 데이터에서
  // 일부 필드만 null인 row가 섞일 경우 unconditional throw 발생.
  // (validateResult 옵션으로 우회 불가 — throw가 해당 체크 이전에 위치)
  // chart()를 직접 호출해 null 필터링을 직접 제어한다.
  const chartResult = await yahooFinance.chart(yahooSymbol, {
    period1: start,
    period2: end,
    interval: "1d",
  });

  const sorted = (chartResult.quotes ?? [])
    .filter((q: { open: number | null; high: number | null; low: number | null; close: number | null }) =>
      q.close != null && q.high != null && q.low != null && q.open != null
    )
    .sort((a: { date: Date }, b: { date: Date }) => a.date.getTime() - b.date.getTime());

  const closes = sorted.map((d: { close: number }) => d.close);
  const volumes = sorted.map((d: { volume: number }) => d.volume ?? 0);
  const highs = sorted.map((d: { high: number }) => d.high);
  const lows = sorted.map((d: { low: number }) => d.low);

  // Yahoo Finance quote로 시총 조회
  let marketCap = 0;
  try {
    const quote = await yahooFinance.quote(yahooSymbol);
    marketCap = quote.marketCap ?? 0;
  } catch {
    marketCap = (closes[closes.length - 1] ?? 0) * 1e9; // fallback 추정
  }

  return {
    closes,
    volumes,
    highs,
    lows,
    price: closes[closes.length - 1] ?? 0,
    marketCap,
  };
}

// ─── US 데이터 ─────────────────────────────────────────────────────────────

export type USFetchResult = {
  closes: number[];
  volumes: number[];
  highs: number[];
  lows: number[];
  price: number;
  marketCap: number;
};

/** Yahoo Finance US 종목 데이터 (120일) */
export async function fetchUSData(ticker: string): Promise<USFetchResult> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 120);

  const result = await yahooFinance.historical(ticker, {
    period1: start,
    period2: end,
    interval: "1d",
  });

  const sorted = result.sort((a: { date: Date }, b: { date: Date }) => a.date.getTime() - b.date.getTime());
  const closes = sorted.map((d: { close: number }) => d.close);
  const volumes = sorted.map((d: { volume: number }) => d.volume ?? 0);
  const highs = sorted.map((d: { high: number }) => d.high);
  const lows = sorted.map((d: { low: number }) => d.low);

  let marketCap = 0;
  try {
    const quote = await yahooFinance.quote(ticker);
    marketCap = quote.marketCap ?? 0;
  } catch {
    marketCap = (closes[closes.length - 1] ?? 0) * 1e9;
  }

  return {
    closes,
    volumes,
    highs,
    lows,
    price: closes[closes.length - 1] ?? 0,
    marketCap,
  };
}

/** SPY 60일 수익률 (US 상대강도 기준) */
export async function fetchSpyReturn60d(): Promise<number> {
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 70);
    const result = await yahooFinance.historical("SPY", {
      period1: start,
      period2: end,
      interval: "1d",
    });
    const sorted = result.sort((a: { date: Date }, b: { date: Date }) => a.date.getTime() - b.date.getTime());
    const closes = sorted.map((d: { close: number }) => d.close);
    return returnPct(closes, 60);
  } catch {
    return 0;
  }
}

// ─── 공통 OHLCV → 기술지표 변환 ──────────────────────────────────────────

export type OhlcvIndicators = {
  rsiVal: number;
  macdHist: number;
  macdHistPrev: number;
  volZ: number;
  adSlopeVal: number;
  obvSlopeVal: number;
  priceSlopeVal: number;
  ma5: number;
  ma20: number;
  ma60: number;
  ret5d: number;
  ret20d: number;
  ret60d: number;
  bbPos: number;
  vol20d: number;
  priceUp: boolean;
};

export function computeOhlcvIndicators(
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[]
): OhlcvIndicators {
  const { hist, histPrev } = macd(closes);
  const recentVols = volumes.slice(-31); // 30일 히스토리 + 오늘

  return {
    rsiVal: rsi(closes),
    macdHist: hist,
    macdHistPrev: histPrev,
    volZ: volumeZ(recentVols),
    adSlopeVal: adSlope(highs.slice(-14), lows.slice(-14), closes.slice(-14), volumes.slice(-14)),
    obvSlopeVal: obvSlope(closes.slice(-15), volumes.slice(-15)),
    priceSlopeVal: linearSlope(closes.slice(-14)),
    ma5: maValue(closes, 5),
    ma20: maValue(closes, 20),
    ma60: maValue(closes, 60),
    ret5d: returnPct(closes, 5),
    ret20d: returnPct(closes, 20),
    ret60d: returnPct(closes, 60),
    bbPos: bollingerPos(closes),
    vol20d: volatility20d(closes),
    priceUp: closes.length >= 2 ? closes[closes.length - 1] > closes[closes.length - 2] : true,
  };
}
