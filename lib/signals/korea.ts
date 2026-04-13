/**
 * FlowSignal v3 — Korean Stocks 12 Signals (K1~K12)
 * 외국인·기관·공매도·대차 + OHLCV 기술지표
 */

import { flowScore, type SignalScore } from "./crypto";

const clip = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// K1. 외국인 순매수 5일 누적 (시총 대비 %)
export const k1ForeignNet = (net5dKrw: number, marketCap: number) =>
  clip(50 + (net5dKrw / marketCap) * 100 * 30, 0, 100);

// K2. 기관 순매수
export const k2InstNet = (net5dKrw: number, marketCap: number) =>
  clip(50 + (net5dKrw / marketCap) * 100 * 30, 0, 100);

// K3. 프로그램 매매 (외국인 선행지표)
export const k3ProgramNet = (net5dKrw: number, marketCap: number) =>
  clip(50 + (net5dKrw / marketCap) * 100 * 35, 0, 100);

// K4. 외국인 보유율 변화
export const k4ForeignHolding = (currPct: number, pct20dAgo: number) =>
  clip(50 + (currPct - pct20dAgo) * 25, 0, 100);

// K5. 공매도 잔고/시총 (역)
export const k5ShortBalance = (shortBalancePct: number) =>
  clip(80 - shortBalancePct * 12, 0, 100);

// K6. 대차잔고 변화 (역)
export const k6LoanBalance = (curr: number, ma20d: number) => {
  const changePct = (curr / ma20d - 1) * 100;
  return clip(50 - changePct * 2, 0, 100);
};

// K7. 신용잔고율 (개인 레버리지, 역)
export const k7CreditRatio = (creditPctOfMcap: number) =>
  clip(80 - creditPctOfMcap * 8, 0, 100);

// K8. 외국계 창구 집중도
export const k8ForeignBrokers = (topForeignBuyShare: number) =>
  clip(topForeignBuyShare * 100, 0, 100);

// K9. 거래량 Z + OBV
export const k9VolumeObv = (volZ: number, obvSlope: number, priceSlope: number) => {
  const volScore = clip(50 + volZ * 15, 0, 100);
  const obvAlign = (obvSlope > 0) === (priceSlope > 0) ? 70 : 30;
  return (volScore + obvAlign) / 2;
};

// K10. RSI + MACD
export const k10Momentum = (rsi: number, macdHist: number, macdHistPrev: number) => {
  const rsiScore = clip(((rsi - 30) * 100) / 40, 0, 100);
  const macdScore =
    macdHist > 0 && macdHist > macdHistPrev ? 70 :
    macdHist < 0 && macdHist < macdHistPrev ? 30 : 50;
  return (rsiScore + macdScore) / 2;
};

// K11. 이평선 정배열
export const k11MaAlignment = (price: number, ma5: number, ma20: number, ma60: number) => {
  if (price > ma5 && ma5 > ma20 && ma20 > ma60) return 90;
  if (price > ma20 && ma20 > ma60) return 70;
  if (price > ma60) return 55;
  if (price < ma5 && ma5 < ma20 && ma20 < ma60) return 10;
  return 35;
};

// K12. 업종 상대강도
export const k12RelativeStrength = (stockRet20d: number, sectorRet20d: number) =>
  clip(50 + (stockRet20d - sectorRet20d) * 200, 0, 100);

export type KoreaInput = {
  foreignNet5d: number;     marketCap: number;
  instNet5d: number;
  programNet5d: number;
  foreignHoldingCurr: number;  foreignHolding20dAgo: number;
  shortBalancePct: number;
  loanBalanceCurr: number;     loanBalanceMa20: number;
  creditPctOfMcap: number;
  topForeignBuyShare: number;
  volumeZ: number;             obvSlope14d: number;  priceSlope14d: number;
  rsi: number;                 macdHist: number;     macdHistPrev: number;
  price: number;               ma5: number;          ma20: number;  ma60: number;
  stockRet20d: number;         sectorRet20d: number;
};

export function computeKoreaSignals(input: KoreaInput, liveFlags?: Record<string, boolean>): SignalScore[] {
  const live = liveFlags ?? {};
  return [
    { id: "K1",  name: "외국인 순매수",     score: k1ForeignNet(input.foreignNet5d, input.marketCap), weight: 14, live: live.K1 ?? false },
    { id: "K2",  name: "기관 순매수",       score: k2InstNet(input.instNet5d, input.marketCap), weight: 12, live: live.K2 ?? false },
    { id: "K3",  name: "프로그램 매매",     score: k3ProgramNet(input.programNet5d, input.marketCap), weight: 10, live: live.K3 ?? false },
    { id: "K4",  name: "외국인 보유율 Δ",  score: k4ForeignHolding(input.foreignHoldingCurr, input.foreignHolding20dAgo), weight: 8, live: live.K4 ?? false },
    { id: "K5",  name: "공매도 잔고",       score: k5ShortBalance(input.shortBalancePct), weight: 8, live: live.K5 ?? false },
    { id: "K6",  name: "대차잔고 Δ",        score: k6LoanBalance(input.loanBalanceCurr, input.loanBalanceMa20), weight: 6, live: live.K6 ?? false },
    { id: "K7",  name: "신용잔고율",        score: k7CreditRatio(input.creditPctOfMcap), weight: 5, live: live.K7 ?? false },
    { id: "K8",  name: "외국계 창구",       score: k8ForeignBrokers(input.topForeignBuyShare), weight: 6, live: live.K8 ?? false },
    { id: "K9",  name: "거래량+OBV",        score: k9VolumeObv(input.volumeZ, input.obvSlope14d, input.priceSlope14d), weight: 7, live: live.K9 ?? true },
    { id: "K10", name: "모멘텀",            score: k10Momentum(input.rsi, input.macdHist, input.macdHistPrev), weight: 10, live: live.K10 ?? true },
    { id: "K11", name: "이평선 정배열",     score: k11MaAlignment(input.price, input.ma5, input.ma20, input.ma60), weight: 6, live: live.K11 ?? true },
    { id: "K12", name: "업종 상대강도",     score: k12RelativeStrength(input.stockRet20d, input.sectorRet20d), weight: 8, live: live.K12 ?? true },
  ];
}

export { flowScore };
