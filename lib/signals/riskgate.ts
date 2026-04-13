/**
 * FlowSignal v4 — 리스크 게이트
 *
 * harvest/evaluate 전 6개 조건을 체크. 하나라도 실패하면 해당 종목 신호 발행을 억제.
 * 억제된 종목은 FlowScore를 50(neutral)으로 오버라이드하고 label = "리스크차단".
 *
 * 6가지 체크:
 *   1. 데이터 신선도  — 가격이 48h 이내에 갱신됐는지
 *   2. 거래량 붕괴    — 최근 거래량이 30일 평균 대비 20% 이하
 *   3. 레짐 전환      — 직전 3일 내 레짐이 바뀐 경우 (불확실성 급등)
 *   4. 신뢰폭 과다    — 개별 신호 점수의 표준편차 > 25 (신호 합의 없음)
 *   5. Walk-forward 성능 저하  — wf 정확도 < 45% (전략이 시장에 맞지 않음)
 *   6. 샘플 부족      — 검증된 예측이 5개 미만 (통계적 신뢰 없음)
 */

import type { SignalScore } from "./crypto";
import type { WalkforwardResult } from "./walkforward";
import type { Regime } from "./regime";

// ─── 타입 ───────────────────────────────────────────────────────────────────

export type RiskCheckResult = {
  pass: boolean;
  failedChecks: string[];
  details: Record<string, unknown>;
};

// ─── 개별 체크 함수 ─────────────────────────────────────────────────────────

/** 1. 데이터 신선도: evaluatedAt이 48h 이내 */
export function checkDataFreshness(evaluatedAt: string): boolean {
  const ageMins = (Date.now() - new Date(evaluatedAt).getTime()) / 60000;
  return ageMins < 48 * 60; // 48시간
}

/** 2. 거래량 붕괴: 최근 거래량 / 30일 평균 < 0.2 */
export function checkVolumeCrash(recentVolume: number, avgVolume30d: number): boolean {
  if (avgVolume30d === 0) return true;
  return recentVolume / avgVolume30d >= 0.2;
}

/** 3. 레짐 전환: 최근 3일 레짐 기록에서 레짐이 변화했는지 */
export function checkRegimeStability(recentRegimes: Regime[]): boolean {
  // 최근 3일이 모두 같은 레짐이면 안정
  if (recentRegimes.length < 2) return true;
  const last3 = recentRegimes.slice(-3);
  return last3.every((r) => r === last3[0]);
}

/** 4. 신뢰폭: live 신호들의 점수 표준편차가 25 초과 시 합의 없음 */
export function checkSignalConsensus(signals: SignalScore[]): boolean {
  const liveScores = signals.filter((s) => s.live).map((s) => s.score);
  if (liveScores.length < 3) return true;
  const mean = liveScores.reduce((a, b) => a + b, 0) / liveScores.length;
  const variance = liveScores.reduce((s, v) => s + (v - mean) ** 2, 0) / liveScores.length;
  const stdDev = Math.sqrt(variance);
  return stdDev <= 25;
}

/** 5. Walk-forward 성능: 최근 WF 전체 정확도 >= 45% */
export function checkWalkforwardPerformance(wfResult: WalkforwardResult | null): boolean {
  if (!wfResult || wfResult.windows.length === 0) return true; // 데이터 없으면 pass (초기 단계)
  const avgAcc = wfResult.windows.reduce((s, w) => s + w.overallAccuracy, 0) / wfResult.windows.length;
  return avgAcc >= 45;
}

/** 6. 샘플 부족: 검증된 예측 수 >= 5 */
export function checkSampleSufficiency(verifiedCount: number): boolean {
  return verifiedCount >= 5;
}

// ─── 통합 리스크 게이트 ──────────────────────────────────────────────────────

export type RiskGateInput = {
  evaluatedAt: string;
  signals: SignalScore[];
  recentVolume: number;
  avgVolume30d: number;
  recentRegimes: Regime[];        // 최근 3일 레짐 배열 (오래된 것 → 최근 것)
  wfResult: WalkforwardResult | null;
  verifiedPredictionCount: number;
};

export function runRiskGate(input: RiskGateInput): RiskCheckResult {
  const failedChecks: string[] = [];
  const details: Record<string, unknown> = {};

  // 1. 데이터 신선도
  const freshOk = checkDataFreshness(input.evaluatedAt);
  details.freshness = { pass: freshOk, evaluatedAt: input.evaluatedAt };
  if (!freshOk) failedChecks.push("데이터신선도");

  // 2. 거래량 붕괴
  const volumeRatio = input.avgVolume30d > 0 ? input.recentVolume / input.avgVolume30d : 1;
  const volumeOk = checkVolumeCrash(input.recentVolume, input.avgVolume30d);
  details.volume = { pass: volumeOk, ratio: Math.round(volumeRatio * 100) / 100 };
  if (!volumeOk) failedChecks.push("거래량붕괴");

  // 3. 레짐 안정성
  const regimeOk = checkRegimeStability(input.recentRegimes);
  details.regime = { pass: regimeOk, recent: input.recentRegimes };
  if (!regimeOk) failedChecks.push("레짐전환");

  // 4. 신호 합의
  const consensusOk = checkSignalConsensus(input.signals);
  const liveScores = input.signals.filter((s) => s.live).map((s) => s.score);
  const mean = liveScores.length > 0 ? liveScores.reduce((a, b) => a + b, 0) / liveScores.length : 50;
  const variance = liveScores.length > 0
    ? liveScores.reduce((s, v) => s + (v - mean) ** 2, 0) / liveScores.length : 0;
  details.consensus = { pass: consensusOk, stdDev: Math.round(Math.sqrt(variance) * 10) / 10 };
  if (!consensusOk) failedChecks.push("신호합의없음");

  // 5. Walk-forward 성능
  const wfOk = checkWalkforwardPerformance(input.wfResult);
  const wfAvg = input.wfResult && input.wfResult.windows.length > 0
    ? Math.round(input.wfResult.windows.reduce((s, w) => s + w.overallAccuracy, 0) / input.wfResult.windows.length * 10) / 10
    : null;
  details.walkforward = { pass: wfOk, avgAccuracy: wfAvg };
  if (!wfOk) failedChecks.push("WF성능저하");

  // 6. 샘플 충분성
  const sampleOk = checkSampleSufficiency(input.verifiedPredictionCount);
  details.samples = { pass: sampleOk, count: input.verifiedPredictionCount };
  if (!sampleOk) failedChecks.push("샘플부족");

  return {
    pass: failedChecks.length === 0,
    failedChecks,
    details,
  };
}
