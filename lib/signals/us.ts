/**
 * FlowSignal v3 — US Stocks 12 Signals (U1~U12)
 * 전부 Yahoo Finance 120일 OHLCV 실데이터 기반 계산
 * (기존 옵션플로우·내부자·ETF 데이터는 무료 소스 없어 제거)
 */

import { flowScore, type SignalScore } from "./crypto";

const clip = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// U1. 5일 단기 수익률 (short-term momentum)
// +10% → 100, -10% → 0, ±2% → 60/40
export const u1ReturnShort = (ret5d: number) =>
  clip(50 + ret5d * 500, 0, 100);

// U2. 거래량 서지 (Volume Z-score)
// Z > 2 → 70 (주목받는 거래), Z < -2 → 30
export const u2VolumeZ = (volZ: number) =>
  clip(50 + volZ * 10, 0, 100);

// U3. OBV 추세 (스마트머니 누적/분산)
// 기울기 양수 → 매집, 음수 → 분산
export const u3ObvTrend = (obvSlope: number) =>
  clip(50 + obvSlope * 3000, 0, 100);

// U4. A/D Line 추세 (수급 압력)
// A/D 상승 → 매수세 우위
export const u4AdTrend = (adSlope: number) =>
  clip(50 + adSlope * 3000, 0, 100);

// U5. 이평선 정배열 (MA Alignment)
// 가격 > MA5 > MA20 > MA60 = 완전 정배열 → 80
// 역배열 → 20
export const u5MaAlign = (price: number, ma5: number, ma20: number, ma60: number) => {
  let score = 50;
  if (price > ma5)  score += 10; else score -= 10;
  if (ma5  > ma20)  score += 10; else score -= 10;
  if (ma20 > ma60)  score += 10; else score -= 10;
  return clip(score, 0, 100);
};

// U6. 20일 중기 수익률 (medium-term momentum)
// +20% → 100, -20% → 0
export const u6Return20d = (ret20d: number) =>
  clip(50 + ret20d * 250, 0, 100);

// U7. 14일 가격 추세 기울기 (Price Trend Slope, 선형회귀)
// 기울기 양수·강할수록 상승 추세
export const u7PriceSlope = (priceSlopeVal: number) =>
  clip(50 + priceSlopeVal * 5000, 0, 100);

// U8. 볼린저 밴드 위치 (-1 ~ +1)
// 상단 이탈(>1) → 과매수 주의 40
// 상단 근처(0.5~1) → 강세 65
// 중간 위(0~0.5) → 약 강세 55
// 중간 아래(-0.5~0) → 약 약세 45
// 하단 근처(-1~-0.5) → 약세 35
// 하단 이탈(<-1) → 과매도, 반등 가능 60
export const u8Bollinger = (bbPos: number): number => {
  if (bbPos > 1)    return 40;
  if (bbPos > 0.5)  return 65;
  if (bbPos > 0)    return 55;
  if (bbPos > -0.5) return 45;
  if (bbPos > -1)   return 35;
  return 60;
};

// U9. 60일 수익률 (long-term momentum, 절대)
// +30% → 95, -30% → 5
export const u9Return60d = (ret60d: number) =>
  clip(50 + ret60d * 150, 0, 100);

// U10. 변동성 안정성 (20일 일간 표준편차)
// 낮은 변동성에서의 상승 = 건강한 추세
// vol < 1% → 65 (매우 안정적)
// vol 1~2% → 55
// vol 2~3% → 45
// vol > 3% → 35 (불안정)
export const u10Volatility = (vol20d: number): number => {
  if (vol20d < 0.01) return 65;
  if (vol20d < 0.02) return 55;
  if (vol20d < 0.03) return 45;
  return 35;
};

// U11. 모멘텀 오실레이터 (RSI + MACD) — 실데이터
export const u11Momentum = (rsiVal: number, macdHist: number, macdHistPrev: number) => {
  const rsiScore = clip(((rsiVal - 30) * 100) / 40, 0, 100);
  const macdScore =
    macdHist > 0 && macdHist > macdHistPrev ? 70 :
    macdHist < 0 && macdHist < macdHistPrev ? 30 : 50;
  return (rsiScore + macdScore) / 2;
};

// U12. SPY 대비 상대강도 (60일) — 실데이터
export const u12Rs = (stockRet60d: number, spyRet60d: number) =>
  clip(50 + (stockRet60d - spyRet60d) * 150, 0, 100);

export type UsOhlcvInput = {
  ret5d: number;
  volZ: number;
  obvSlopeVal: number;
  adSlopeVal: number;
  price: number;
  ma5: number;
  ma20: number;
  ma60: number;
  ret20d: number;
  priceSlopeVal: number;
  bbPos: number;
  ret60d: number;
  vol20d: number;
  rsi: number;
  macdHist: number;
  macdHistPrev: number;
  spyRet60d: number;
};

export function computeUsSignals(input: UsOhlcvInput): SignalScore[] {
  return [
    { id: "U1",  name: "단기 모멘텀",   score: u1ReturnShort(input.ret5d),                                           weight: 8,  live: true },
    { id: "U2",  name: "거래량 서지",    score: u2VolumeZ(input.volZ),                                                weight: 9,  live: true },
    { id: "U3",  name: "OBV 누적",      score: u3ObvTrend(input.obvSlopeVal),                                        weight: 9,  live: true },
    { id: "U4",  name: "A/D 수급",      score: u4AdTrend(input.adSlopeVal),                                          weight: 8,  live: true },
    { id: "U5",  name: "이평선 정배열",  score: u5MaAlign(input.price, input.ma5, input.ma20, input.ma60),            weight: 10, live: true },
    { id: "U6",  name: "20일 수익률",   score: u6Return20d(input.ret20d),                                            weight: 9,  live: true },
    { id: "U7",  name: "추세 기울기",   score: u7PriceSlope(input.priceSlopeVal),                                    weight: 7,  live: true },
    { id: "U8",  name: "볼린저 위치",   score: u8Bollinger(input.bbPos),                                             weight: 7,  live: true },
    { id: "U9",  name: "60일 수익률",   score: u9Return60d(input.ret60d),                                            weight: 8,  live: true },
    { id: "U10", name: "변동성 안정성", score: u10Volatility(input.vol20d),                                          weight: 6,  live: true },
    { id: "U11", name: "RSI+MACD",     score: u11Momentum(input.rsi, input.macdHist, input.macdHistPrev),            weight: 11, live: true },
    { id: "U12", name: "SPY 상대강도", score: u12Rs(input.ret60d, input.spyRet60d),                                  weight: 10, live: true },
  ];
}

export { flowScore };
