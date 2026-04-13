/**
 * FlowSignal v3 — Crypto 12 Signals (C1~C12)
 * 온체인 + 파생상품 + 기술적 지표 통합
 */

export type SignalScore = { id: string; name: string; score: number; weight: number; live: boolean };

const clip = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const std = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
};
const zscore = (x: number, history: number[]) => {
  const s = std(history);
  return s === 0 ? 0 : (x - mean(history)) / s;
};
const toScore = (z: number) => clip(50 + z * 15, 0, 100);

// C1. Whale Netflow
export const c1WhaleNetflow = (net24h: number, history30d: number[]) =>
  toScore(zscore(net24h, history30d));

// C2. Exchange Netflow (out - in, +면 강세)
export const c2ExchangeNetflow = (outMinusIn: number, history30d: number[]) =>
  toScore(zscore(outMinusIn, history30d));

// C3. Stablecoin Inflow
export const c3StablecoinInflow = (inflow24h: number, history30d: number[]) =>
  toScore(zscore(inflow24h, history30d));

// C4. Funding Rate
export const c4Funding = (rate: number) => {
  if (rate > 0.0005) return 20;
  if (rate > 0.0002) return 40;
  if (rate < -0.0005) return 80;
  if (rate < -0.0002) return 65;
  return 55;
};

// C5. Open Interest delta
export const c5OiDelta = (oiPct: number, pricePct: number) => {
  if (oiPct > 0 && pricePct > 0) return 80;
  if (oiPct > 0 && pricePct < 0) return 25;
  if (oiPct < 0 && pricePct > 0) return 45;
  return 50;
};

// C6. Long/Short Ratio
export const c6LongShort = (ratio: number) => {
  if (ratio > 2.0) return 25;
  if (ratio < 0.5) return 75;
  return clip(50 + (1 - ratio) * 25, 0, 100);
};

// C7. Fear & Greed (역지표 — 극공포=매수 기회)
export const c7Fng = (value: number) => 100 - value;

// C8. A/D Divergence
export const c8AdDivergence = (adSlope: number, priceSlope: number) => {
  if (adSlope > 0 && priceSlope < 0) return 80;
  if (adSlope < 0 && priceSlope > 0) return 25;
  if (adSlope > 0 && priceSlope > 0) return 65;
  return 35;
};

// C9. Dormant Supply Reactivation (역 — 적을수록 강세)
export const c9Dormant = (reactivated7d: number, history180d: number[]) =>
  toScore(-zscore(reactivated7d, history180d));

// C10. MVRV (낮을수록 저평가)
export const c10Mvrv = (mvrv: number) => {
  if (mvrv < 1.0) return 85;
  if (mvrv < 1.5) return 65;
  if (mvrv < 2.5) return 45;
  if (mvrv < 3.5) return 25;
  return 10;
};

// C11. Momentum (RSI + MACD)
export const c11Momentum = (rsi: number, macdHist: number, macdHistPrev: number) => {
  const rsiScore = clip(((rsi - 30) * 100) / 40, 0, 100);
  const macdScore =
    macdHist > 0 && macdHist > macdHistPrev ? 70 :
    macdHist < 0 && macdHist < macdHistPrev ? 30 : 50;
  return (rsiScore + macdScore) / 2;
};

// C12. Volume Z-score
export const c12Volume = (volToday: number, history30d: number[], priceUp: boolean) => {
  const base = toScore(zscore(volToday, history30d));
  return priceUp ? base : 100 - base;
};

// C13. Liquidation Spike (숏 청산 우세 → 강세, 롱 청산 우세 → 약세)
export const c13LiquidationSpike = (longLiq: number, shortLiq: number) => {
  const total = longLiq + shortLiq;
  if (total < 1_000_000) return 50; // 청산 미미 — neutral
  const shortRatio = shortLiq / total;
  if (shortRatio > 0.65) return 72; // 숏 스퀴즈 → 강세
  if (shortRatio < 0.35) return 28; // 롱 cascade 청산 → 약세
  return 50;
};

export const CRYPTO_WEIGHTS = {
  C1: 12, C2: 12, C3: 8, C4: 10, C5: 8,  C6: 6,
  C7: 6,  C8: 8,  C9: 5, C10: 8, C11: 10, C12: 7, C13: 6,
};

export type CryptoInput = {
  whaleNet24h: number;          whaleHistory30d: number[];
  exchangeNetOut: number;       exchangeHistory30d: number[];
  stablecoinIn24h: number;      stablecoinHistory30d: number[];
  fundingRate: number;
  oiChangePct: number;          priceChangePct: number;
  longShortRatio: number;
  fearGreed: number;
  adSlope14d: number;           priceSlope14d: number;
  dormantReactivated7d: number; dormantHistory180d: number[];
  mvrv: number;
  rsi: number;                  macdHist: number; macdHistPrev: number;
  volumeToday: number;          volumeHistory30d: number[];
  priceUp: boolean;
  longLiq24h: number;           // C13: 24h 롱 청산 USD
  shortLiq24h: number;          // C13: 24h 숏 청산 USD
};

export function computeCryptoSignals(input: CryptoInput, liveFlags?: Record<string, boolean>): SignalScore[] {
  const live = liveFlags ?? {};
  return [
    { id: "C1",  name: "고래 순매수",      score: c1WhaleNetflow(input.whaleNet24h, input.whaleHistory30d), weight: 12, live: live.C1 ?? false },
    { id: "C2",  name: "거래소 순유출",    score: c2ExchangeNetflow(input.exchangeNetOut, input.exchangeHistory30d), weight: 12, live: live.C2 ?? false },
    { id: "C3",  name: "스테이블 유입",    score: c3StablecoinInflow(input.stablecoinIn24h, input.stablecoinHistory30d), weight: 8, live: live.C3 ?? false },
    { id: "C4",  name: "펀딩비",           score: c4Funding(input.fundingRate), weight: 10, live: live.C4 ?? false },
    { id: "C5",  name: "OI 변화",          score: c5OiDelta(input.oiChangePct, input.priceChangePct), weight: 8, live: live.C5 ?? false },
    { id: "C6",  name: "롱숏 비율",        score: c6LongShort(input.longShortRatio), weight: 6, live: live.C6 ?? false },
    { id: "C7",  name: "공포탐욕",         score: c7Fng(input.fearGreed), weight: 6, live: live.C7 ?? false },
    { id: "C8",  name: "A/D 다이버전스",  score: c8AdDivergence(input.adSlope14d, input.priceSlope14d), weight: 8, live: live.C8 ?? false },
    { id: "C9",  name: "휴면코인 활성",    score: c9Dormant(input.dormantReactivated7d, input.dormantHistory180d), weight: 5, live: live.C9 ?? false },
    { id: "C10", name: "MVRV",             score: c10Mvrv(input.mvrv), weight: 8, live: live.C10 ?? false },
    { id: "C11", name: "모멘텀",           score: c11Momentum(input.rsi, input.macdHist, input.macdHistPrev), weight: 10, live: live.C11 ?? true },
    { id: "C12", name: "거래량 Z",         score: c12Volume(input.volumeToday, input.volumeHistory30d, input.priceUp), weight: 7, live: live.C12 ?? true },
    { id: "C13", name: "청산 스파이크",    score: c13LiquidationSpike(input.longLiq24h, input.shortLiq24h), weight: 6, live: live.C13 ?? false },
  ];
}

export function flowScore(signals: SignalScore[]) {
  const totalW = signals.reduce((s, x) => s + x.weight, 0);
  const score = signals.reduce((s, x) => s + x.score * x.weight, 0) / totalW;
  const label =
    score >= 75 ? "강매수" :
    score >= 60 ? "매수"   :
    score >= 40 ? "관망"   :
    score >= 25 ? "매도"   : "강매도";
  return { score: Math.round(score * 10) / 10, label };
}
