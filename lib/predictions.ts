/**
 * FlowSignal v4 — 예측 저장/조회 유틸
 * Redis key: prediction:{market}:{ticker}:{YYYY-MM-DD}
 * weights key (global):        weights:{market}
 * weights key (regime-scoped): weights:{market}:{regime}
 */

import { getRedis } from "./redis";
import type { ConfidenceLabel } from "./signals/types";

export type Market = "crypto" | "korea" | "us";

export type Prediction = {
  market: Market;
  ticker: string;
  name: string;
  date: string;           // YYYY-MM-DD
  score: number;
  label: string;
  signals: Array<{ id: string; score: number; weight: number; live: boolean }>;
  priceAtPrediction: number;
  priceAt5d?: number;
  priceAt14d?: number;
  outcome5d?: "correct" | "wrong" | "pending" | "neutral"; // neutral = 관망 예측, 정확도 계산 제외
  outcome14d?: "correct" | "wrong" | "pending" | "neutral";
  verifiedAt?: string;
  scoreVersion?: string; // 'v3.1' = live-only 가중합 (v3.1 이전은 undefined/'v3.0')
  risk_flags?: string[];  // Risk Gate 실패 체크 목록. undefined = 통과, 배열 = 페널티 모드 플래그
  // Phase A P0 (2026-04-24): confidence 두 필드 분리
  confidenceScore?: number;         // 0~100, stddev 기반. Dashboard UI에서 표시.
  confidenceLabel?: ConfidenceLabel; // Risk Gate 로그 / MEMORY / 내러티브 등 텍스트 경로용.
};

export type MarketWeights = Record<string, number>;  // { C1: 12, C2: 12, ... }

const PREDICTION_TTL = 60 * 60 * 24 * 365; // 365일 — walk-forward 180d 윈도우를 위해 1년치 보존
const WEIGHTS_TTL    = 60 * 60 * 24 * 365; // 1년

function predictionKey(market: Market, ticker: string, date: string): string {
  return `prediction:${market}:${ticker}:${date}`;
}

type Regime = "bull" | "bear" | "chop";

function weightsKey(market: Market): string {
  return `weights:${market}`;
}

function regimeWeightsKey(market: Market, regime: Regime): string {
  return `weights:${market}:${regime}`;
}

function allPredictionsPattern(market: Market): string {
  return `prediction:${market}:*`;
}

export async function savePrediction(pred: Prediction): Promise<void> {
  const redis = getRedis();
  const key = predictionKey(pred.market, pred.ticker, pred.date);
  await redis.set(key, JSON.stringify(pred), { ex: PREDICTION_TTL });
}

export async function getPrediction(market: Market, ticker: string, date: string): Promise<Prediction | null> {
  const redis = getRedis();
  const key = predictionKey(market, ticker, date);
  const data = await redis.get<string>(key);
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data as Prediction;
}

/** 특정 market의 모든 예측 (미검증 + 검증됨 포함) */
export async function getAllPredictions(market: Market): Promise<Prediction[]> {
  const redis = getRedis();
  const keys = await redis.keys(allPredictionsPattern(market));
  if (!keys.length) return [];

  const values = await Promise.all(keys.map((k: string) => redis.get<string>(k)));
  return values
    .filter((v): v is string => v !== null)
    .map((v) => (typeof v === "string" ? JSON.parse(v) : v as Prediction));
}

/** 검증 대상 예측: outcome 미결 + 날짜가 충분히 지난 것 */
export async function getPendingPredictions(market: Market, daysAgo: number): Promise<Prediction[]> {
  const all = await getAllPredictions(market);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysAgo);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return all.filter((p) => {
    const isDue = p.date <= cutoffStr;
    if (daysAgo === 5)  return isDue && p.outcome5d  === "pending";
    if (daysAgo === 14) return isDue && p.outcome14d === "pending";
    return isDue;
  });
}

export async function saveWeights(market: Market, weights: MarketWeights): Promise<void> {
  const redis = getRedis();
  await redis.set(weightsKey(market), JSON.stringify(weights), { ex: WEIGHTS_TTL });
}

export async function getWeights(market: Market): Promise<MarketWeights | null> {
  const redis = getRedis();
  const data = await redis.get<string>(weightsKey(market));
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data as MarketWeights;
}

// ─── Regime-scoped weights ───────────────────────────────────────────────────

/** 레짐별 가중치 저장 (bull/bear/chop 각각 독립 학습) */
export async function saveRegimeWeights(
  market: Market,
  regime: Regime,
  weights: MarketWeights
): Promise<void> {
  const redis = getRedis();
  await redis.set(regimeWeightsKey(market, regime), JSON.stringify(weights), { ex: WEIGHTS_TTL });
}

/** 레짐별 가중치 조회 — 없으면 global weights, 그것도 없으면 null */
export async function getRegimeWeights(
  market: Market,
  regime: Regime
): Promise<MarketWeights | null> {
  const redis = getRedis();
  const data = await redis.get<string>(regimeWeightsKey(market, regime));
  if (data) return typeof data === "string" ? JSON.parse(data) : (data as MarketWeights);
  // fallback: global weights
  return getWeights(market);
}

/** 오늘 날짜 문자열 */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** N일 전 날짜 문자열 */
export function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
