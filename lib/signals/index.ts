/**
 * FlowSignal v3 — 통합 평가 엔진
 * evaluateSignals(market, ticker) → SignalScore[] + flowScore + metadata
 * SSE 스트리밍 지원을 위한 단계별 콜백 인터페이스 포함
 */

import { computeCryptoSignals, flowScore, type SignalScore } from "./crypto";
import { computeKoreaSignals } from "./korea";
import { computeUsSignals } from "./us";
import {
  fetchCryptoData,
  fetchKoreaData,
  fetchUSData,
  fetchSpyReturn60d,
  computeOhlcvIndicators,
} from "./fetcher";
import { returnPct } from "./compute";
import { CRYPTO_COINS, KOSPI_STOCKS, KOSDAQ_STOCKS, US_STOCKS } from "../stocks";
import { getRegimeWeights } from "../predictions";
import { getCurrentRegime } from "./regime";
import type { CoverageLabel } from "./types";

export type Market = "crypto" | "korea" | "us";

export type EvalResult = {
  market: Market;
  ticker: string;
  name: string;
  signals: SignalScore[];
  score: number;
  label: string;
  liveCount: number;
  totalCount: number;
  evaluatedAt: string;
  price: number;   // 예측 시점 현재가
  ret7d: number;   // 7일 수익률 (소수, e.g. 0.05 = +5%)
  ret30d: number;  // 30일 수익률
  spark: number[]; // 최근 14일 종가 (스파크라인)
  recentVolume: number;  // v4: 최근 1일 거래량 (리스크 게이트용)
  avgVolume30d: number;  // v4: 30일 평균 거래량
  regime?: string;       // v4: bull | bear | chop (레짐 인식 가중치 적용 시 설정됨)
  // WHY rename (Phase A P0, 2026-04-24):
  //   기존 `confidence`/`confidence_reason`은 route.ts의 calcConfidence() 숫자 값과
  //   JSON.stringify 시점에 동일 키로 충돌해 항상 숫자가 덮어씌워졌음.
  //   → coverage-based 라벨은 `coverageLabel`/`coverageReason`으로 분리,
  //     score-based 숫자/라벨은 route.ts에서 confidenceScore/confidenceLabel로 별도 주입.
  coverageLabel: CoverageLabel;  // live 신호 커버리지(%) 기반 라벨
  coverageReason: string;        // 라벨 근거 (예: "신호 커버리지 50%")
};

export type StepCallback = (signal: SignalScore) => void;

// ─── Ticker 메타 조회 ─────────────────────────────────────────────────────

export type TickerMeta = {
  market: Market;
  ticker: string;
  name: string;
  /** CoinGecko id (crypto only) — stocks.ts에서 symbol 필드가 CoinGecko ID */
  coinId?: string;
  /** Binance base symbol (crypto only, e.g. 'BTC') */
  binanceBase?: string;
  /** Yahoo Finance symbol (korea/us) */
  yahooSymbol?: string;
};

/** CoinGecko ID → Binance USDT-M base symbol 매핑 */
const COIN_TO_BINANCE: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
  binancecoin: "BNB",
  ripple: "XRP",
  cardano: "ADA",
  "avalanche-2": "AVAX",
  near: "NEAR",
  sui: "SUI",
  "the-open-network": "TON",
  chainlink: "LINK",
  polkadot: "DOT",
  "polygon-ecosystem-token": "POL",
  arbitrum: "ARB",
  optimism: "OP",
  hyperliquid: "HYPE",
  stellar: "XLM",
  dogecoin: "DOGE",
  pepe: "PEPE",
  dogwifcoin: "WIF",
};

export function findTicker(market: Market, ticker: string): TickerMeta {
  if (market === "crypto") {
    // stocks.ts에서 symbol = CoinGecko ID (e.g. 'bitcoin')
    // Binance 심볼(BTC, ETH)로도 찾을 수 있도록 역방향 매핑 지원
    const coin = CRYPTO_COINS.find(
      (c) =>
        c.symbol.toLowerCase() === ticker.toLowerCase() ||
        c.name === ticker ||
        (COIN_TO_BINANCE[c.symbol] ?? "").toLowerCase() === ticker.toLowerCase()
    );
    if (coin) {
      return {
        market,
        ticker: coin.symbol,
        name: coin.name,
        coinId: coin.symbol,
        binanceBase: COIN_TO_BINANCE[coin.symbol] ?? coin.symbol.toUpperCase().slice(0, 4),
      };
    }
    // 목록에 없는 코인: coinId = ticker, Binance 심볼 추정
    const coinId = ticker.toLowerCase();
    return {
      market,
      ticker: coinId,
      name: ticker,
      coinId,
      binanceBase: ticker.toUpperCase().slice(0, 6),
    };
  }

  if (market === "korea") {
    // KOSPI + KOSDAQ 통합 검색
    const allKorea = [...KOSPI_STOCKS, ...KOSDAQ_STOCKS];
    const stock = allKorea.find(
      (s) =>
        s.symbol === ticker ||
        s.symbol.split(".")[0] === ticker ||
        s.name === ticker
    );
    if (stock) {
      return {
        market,
        ticker: stock.symbol.split(".")[0], // 종목코드
        name: stock.name,
        yahooSymbol: stock.symbol,
      };
    }
    // 목록에 없는 한국 종목: 심볼에 .KQ/.KS 명시 시 그대로, 없으면 .KS 기본
    const code = ticker.replace(/\.(KS|KQ)$/i, "");
    const yahooSymbol = /\.(KS|KQ)$/i.test(ticker) ? ticker : `${ticker}.KS`;
    return { market, ticker: code, name: code, yahooSymbol };
  }

  if (market === "us") {
    const stock = US_STOCKS.find(
      (s) => s.symbol.toLowerCase() === ticker.toLowerCase() || s.name === ticker
    );
    if (stock) {
      return {
        market,
        ticker: stock.symbol,
        name: stock.name,
        yahooSymbol: stock.symbol,
      };
    }
    // 목록에 없는 미국 종목
    const sym = ticker.toUpperCase();
    return { market, ticker: sym, name: sym, yahooSymbol: sym };
  }

  throw new Error(`Unknown market: ${market}`);
}

// ─── Crypto 평가 ──────────────────────────────────────────────────────────

async function evaluateCrypto(meta: TickerMeta, onStep?: StepCallback): Promise<EvalResult> {
  const data = await fetchCryptoData(meta.coinId!, meta.binanceBase!);
  const ind = computeOhlcvIndicators(data.closes, data.highs, data.lows, data.volumes);

  // 30일 히스토리 배열 생성 (zscore용)
  const makeHistory = (val: number, len = 30) => Array(len).fill(val * 0.9);

  const signals = computeCryptoSignals({
    whaleNet24h: data.whaleNet24h,
    whaleHistory30d: makeHistory(data.whaleNet24h),
    exchangeNetOut: data.exchangeNetOut,
    exchangeHistory30d: makeHistory(data.exchangeNetOut),
    stablecoinIn24h: data.stablecoinIn24h,
    stablecoinHistory30d: makeHistory(data.stablecoinIn24h),
    fundingRate: data.fundingRate,
    oiChangePct: data.oiChangePct,
    priceChangePct: data.priceChangePct,
    longShortRatio: data.longShortRatio,
    fearGreed: data.fearGreed,
    adSlope14d: ind.adSlopeVal,
    priceSlope14d: ind.priceSlopeVal,
    dormantReactivated7d: 0,
    dormantHistory180d: Array(180).fill(0),
    mvrv: data.mvrv,
    rsi: ind.rsiVal,
    macdHist: ind.macdHist,
    macdHistPrev: ind.macdHistPrev,
    volumeToday: data.volumes[data.volumes.length - 1] ?? 0,
    volumeHistory30d: data.volumes.slice(-31, -1),
    priceUp: ind.priceUp,
    longLiq24h: data.longLiq24h,
    shortLiq24h: data.shortLiq24h,
  }, {
    // live 플래그: 온체인 제외하고 나머지는 live
    C4: true,  // Binance fundingRate
    C5: true,  // Binance OI
    C6: true,  // Binance L/S ratio
    C7: true,  // alternative.me F&G
    C8: true,  // A/D divergence (OHLCV)
    C11: true, // momentum (OHLCV)
    C12: true, // volume Z (OHLCV)
    C13: true, // Binance allForceOrders (공개 엔드포인트)
  });

  if (onStep) signals.forEach(onStep);

  const { score, label } = flowScore(signals);
  return {
    market: "crypto",
    ticker: meta.ticker,
    name: meta.name,
    signals,
    score,
    label,
    liveCount: signals.filter((s: SignalScore) => s.live).length,
    totalCount: signals.length,
    evaluatedAt: new Date().toISOString(),
    price: data.closes[data.closes.length - 1] ?? 0,
    ret7d: returnPct(data.closes, 7),
    ret30d: returnPct(data.closes, 30),
    spark: data.closes.slice(-14),
    recentVolume: data.volumes[data.volumes.length - 1] ?? 0,
    avgVolume30d: data.volumes.slice(-31, -1).reduce((s, v) => s + v, 0) / Math.max(data.volumes.slice(-31, -1).length, 1),
    coverageLabel: 'high' as const,
    coverageReason: '',
  };
}

// ─── Korea 평가 ───────────────────────────────────────────────────────────

async function evaluateKorea(meta: TickerMeta, onStep?: StepCallback): Promise<EvalResult> {
  const data = await fetchKoreaData(meta.yahooSymbol!);
  const ind = computeOhlcvIndicators(data.closes, data.highs, data.lows, data.volumes);

  // 시총 (원화 기준 — Yahoo는 USD이므로 KRW 환산 근사)
  const mcapKrw = data.marketCap * 1350;

  const signals = computeKoreaSignals({
    foreignNet5d: 0,
    marketCap: mcapKrw || 1,
    instNet5d: 0,
    programNet5d: 0,
    foreignHoldingCurr: 30,
    foreignHolding20dAgo: 30,
    shortBalancePct: 1,
    loanBalanceCurr: 100,
    loanBalanceMa20: 100,
    creditPctOfMcap: 1,
    topForeignBuyShare: 0.3,
    volumeZ: ind.volZ,
    obvSlope14d: ind.obvSlopeVal,
    priceSlope14d: ind.priceSlopeVal,
    rsi: ind.rsiVal,
    macdHist: ind.macdHist,
    macdHistPrev: ind.macdHistPrev,
    price: data.price,
    ma5: ind.ma5,
    ma20: ind.ma20,
    ma60: ind.ma60,
    stockRet20d: ind.ret20d,
    sectorRet20d: 0,
  }, {
    K9: true,  // 거래량+OBV (OHLCV)
    K10: true, // 모멘텀 (OHLCV)
    K11: true, // 이평선 (OHLCV)
    K12: true, // 업종 상대강도 (partially — sector는 neutral)
  });

  if (onStep) signals.forEach(onStep);

  const { score, label } = flowScore(signals);
  return {
    market: "korea",
    ticker: meta.ticker,
    name: meta.name,
    signals,
    score,
    label,
    liveCount: signals.filter((s: SignalScore) => s.live).length,
    totalCount: signals.length,
    evaluatedAt: new Date().toISOString(),
    price: data.price,
    ret7d: returnPct(data.closes, 7),
    ret30d: returnPct(data.closes, 30),
    spark: data.closes.slice(-14),
    recentVolume: data.volumes[data.volumes.length - 1] ?? 0,
    avgVolume30d: data.volumes.slice(-31, -1).reduce((s, v) => s + v, 0) / Math.max(data.volumes.slice(-31, -1).length, 1),
    coverageLabel: 'high' as const,
    coverageReason: '',
  };
}

// ─── US 평가 ──────────────────────────────────────────────────────────────

async function evaluateUS(meta: TickerMeta, onStep?: StepCallback): Promise<EvalResult> {
  const [data, spyRet] = await Promise.all([
    fetchUSData(meta.yahooSymbol!),
    fetchSpyReturn60d(),
  ]);
  const ind = computeOhlcvIndicators(data.closes, data.highs, data.lows, data.volumes);

  const signals = computeUsSignals({
    ret5d: ind.ret5d,
    volZ: ind.volZ,
    obvSlopeVal: ind.obvSlopeVal,
    adSlopeVal: ind.adSlopeVal,
    price: data.price,
    ma5: ind.ma5,
    ma20: ind.ma20,
    ma60: ind.ma60,
    ret20d: ind.ret20d,
    priceSlopeVal: ind.priceSlopeVal,
    bbPos: ind.bbPos,
    ret60d: ind.ret60d,
    vol20d: ind.vol20d,
    rsi: ind.rsiVal,
    macdHist: ind.macdHist,
    macdHistPrev: ind.macdHistPrev,
    spyRet60d: spyRet,
  });

  if (onStep) signals.forEach(onStep);

  const { score, label } = flowScore(signals);
  return {
    market: "us",
    ticker: meta.ticker,
    name: meta.name,
    signals,
    score,
    label,
    liveCount: signals.filter((s: SignalScore) => s.live).length,
    totalCount: signals.length,
    evaluatedAt: new Date().toISOString(),
    price: data.price,
    ret7d: returnPct(data.closes, 7),
    ret30d: returnPct(data.closes, 30),
    spark: data.closes.slice(-14),
    recentVolume: data.volumes[data.volumes.length - 1] ?? 0,
    avgVolume30d: data.volumes.slice(-31, -1).reduce((s, v) => s + v, 0) / Math.max(data.volumes.slice(-31, -1).length, 1),
    coverageLabel: 'high' as const,
    coverageReason: '',
  };
}

// ─── 통합 진입점 ──────────────────────────────────────────────────────────

/**
 * 종목 평가
 * @param market 'crypto' | 'korea' | 'us'
 * @param ticker coinId / 종목코드 / 티커
 * @param onStep SSE 스트리밍용 단계 콜백 (각 신호 계산 후 호출)
 */
export async function evaluateSignals(
  market: Market,
  ticker: string,
  onStep?: StepCallback
): Promise<EvalResult> {
  const meta = findTicker(market, ticker);

  let result: EvalResult;
  switch (market) {
    case "crypto": result = await evaluateCrypto(meta, onStep); break;
    case "korea":  result = await evaluateKorea(meta, onStep); break;
    case "us":     result = await evaluateUS(meta, onStep); break;
  }

  // 현재 레짐에 맞는 진화된 가중치 적용 후 점수 재계산
  // bull/bear/chop별로 별도 학습된 가중치 사용, 없으면 global weights fallback
  try {
    const regime = (await getCurrentRegime(market)) ?? "chop";
    const storedWeights = await getRegimeWeights(market, regime);
    if (storedWeights) {
      for (const sig of result.signals) {
        if (sig.id in storedWeights) {
          sig.weight = storedWeights[sig.id];
        }
      }
      const { score, label } = flowScore(result.signals);
      result.score = score;
      result.label = label;
      // 레짐 정보를 결과에 포함
      (result as EvalResult & { regime?: string }).regime = regime;
    }
  } catch {
    // 가중치 로딩 실패 시 기본 가중치 유지
  }

  // ── Confidence 계산 (live 신호 weight 커버리지 기반) ─────────────────────
  const totalW = result.signals.reduce((s, x) => s + x.weight, 0);
  const liveW  = result.signals.filter((x) => x.live).reduce((s, x) => s + x.weight, 0);
  const coverage = totalW > 0 ? Math.round((liveW / totalW) * 100) : 0;

  let coverageLabel: CoverageLabel;
  if (coverage >= 70) coverageLabel = 'high';
  else if (coverage >= 50) coverageLabel = 'medium';
  else coverageLabel = 'low';

  result.coverageLabel = coverageLabel;
  result.coverageReason = `신호 커버리지 ${coverage}%`;

  return result;
}

export { flowScore };
export type { SignalScore };
