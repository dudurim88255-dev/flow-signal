/**
 * FlowSignal v3 — OHLCV 계산 헬퍼
 * RSI(Wilder), MACD(12/26/9), Volume Z, A/D line, OBV, MA, 선형회귀 기울기
 */

import { calcReturnNd } from "./returns";

/** 단순 이동평균 */
export const sma = (data: number[], period: number): number[] => {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    const slice = data.slice(i - period + 1, i + 1);
    result.push(slice.reduce((s, v) => s + v, 0) / period);
  }
  return result;
};

/** Wilder RSI (period=14) */
export const rsi = (closes: number[], period = 14): number => {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
};

/** EMA */
const ema = (data: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = NaN;
  for (const v of data) {
    if (isNaN(prev)) { prev = v; result.push(v); continue; }
    prev = v * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
};

/** MACD — { hist, histPrev } */
export const macd = (
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): { hist: number; histPrev: number } => {
  if (closes.length < slow + signal) return { hist: 0, histPrev: 0 };
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const macdLine = fastEma.map((v, i) => v - slowEma[i]).slice(slow - 1);
  const signalLine = ema(macdLine, signal);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  const len = histogram.length;
  return {
    hist: histogram[len - 1] ?? 0,
    histPrev: histogram[len - 2] ?? 0,
  };
};

/** Volume Z-score (최근 30일 기준) */
export const volumeZ = (volumes: number[]): number => {
  if (volumes.length < 2) return 0;
  const history = volumes.slice(0, -1);
  const today = volumes[volumes.length - 1];
  const mean = history.reduce((s, v) => s + v, 0) / history.length;
  const std = Math.sqrt(history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length);
  return std === 0 ? 0 : (today - mean) / std;
};

/** A/D Line (Accumulation/Distribution) slope (선형회귀 기울기) */
export const adSlope = (highs: number[], lows: number[], closes: number[], volumes: number[], period = 14): number => {
  const len = Math.min(highs.length, lows.length, closes.length, volumes.length, period);
  const adValues: number[] = [];
  let cumAd = 0;
  for (let i = 0; i < len; i++) {
    const hl = highs[i] - lows[i];
    const clv = hl === 0 ? 0 : ((closes[i] - lows[i]) - (highs[i] - closes[i])) / hl;
    cumAd += clv * volumes[i];
    adValues.push(cumAd);
  }
  return linearSlope(adValues);
};

/** OBV slope */
export const obvSlope = (closes: number[], volumes: number[], period = 14): number => {
  const len = Math.min(closes.length, volumes.length, period + 1);
  const obvValues: number[] = [0];
  for (let i = 1; i < len; i++) {
    const prev = obvValues[obvValues.length - 1];
    if (closes[i] > closes[i - 1]) obvValues.push(prev + volumes[i]);
    else if (closes[i] < closes[i - 1]) obvValues.push(prev - volumes[i]);
    else obvValues.push(prev);
  }
  return linearSlope(obvValues);
};

/** 이동평균 최근값 */
export const maValue = (closes: number[], period: number): number => {
  if (closes.length < period) return closes[closes.length - 1] ?? NaN;
  return closes.slice(-period).reduce((s, v) => s + v, 0) / period;
};

/** 선형회귀 기울기 (정규화: 최초값 기준 % 기울기) */
export const linearSlope = (data: number[]): number => {
  const n = data.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = data.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (data[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  // 절대값 기울기를 첫 값 대비 %로 정규화
  const base = Math.abs(data[0]) || 1;
  return slope / base;
};

/**
 * 수익률 계산: (최근 / N일전 - 1)
 * Phase A P3 (2026-04-24): lib/signals/returns.ts::calcReturnNd 로 위임.
 * 기존 시그너처(number 반환) 유지 — 호출 사이트 무변경.
 * 값 동등성: closes 배열에 null/undefined 없고 nDays>0 인 정상 경로에서
 *           기존 식 (end/start - 1) 과 수학적으로 동일.
 *           `len < nDays+1` → 0, `start === 0` → 0 도 calcReturnNd 에서 동일 분기.
 */
export const returnPct = (closes: number[], nDays: number): number =>
  calcReturnNd(closes, nDays).value;

/** 볼린저 밴드 위치 — (price - sma20) / (2 * std20), 대략 -1 ~ +1 */
export const bollingerPos = (closes: number[], period = 20): number => {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  const avg = slice.reduce((s, v) => s + v, 0) / period;
  const variance = slice.reduce((s, v) => s + (v - avg) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return (closes[closes.length - 1] - avg) / (2 * stdDev);
};

/** 20일 일간 수익률 표준편차 (변동성 지표) */
export const volatility20d = (closes: number[]): number => {
  if (closes.length < 21) return 0.02;
  const slice = closes.slice(-21);
  const rets: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    rets.push(slice[i] / slice[i - 1] - 1);
  }
  const avg = rets.reduce((s, v) => s + v, 0) / rets.length;
  return Math.sqrt(rets.reduce((s, v) => s + (v - avg) ** 2, 0) / rets.length);
};
