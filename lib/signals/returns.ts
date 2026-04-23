/**
 * FlowSignal — 공통 수익률 유틸 (Phase A P3, 2026-04-24)
 *
 * WHY: K12 sectorRet20d, 각 시장의 stockRet20d/ret7d/ret30d 등
 *      N일 수익률 계산이 여러 곳에서 반복 구현될 여지가 있어 단일 소스로 통합.
 *      Phase A P3에서는 compute.ts의 returnPct 를 이 유틸로 위임하는 데까지.
 *      호출 사이트 교체 범위는 RFC signal-function-signature.md 에서 확장.
 */

import type { ConfidenceLabel } from "./types";

export type ReturnResult = {
  value: number; // (end/start - 1) — 소수 (0.05 = +5%)
  confidence: ConfidenceLabel;
  reason?: string; // confidence !== "high" 일 때 근거
};

/**
 * 연속 결측 몇 일까지 forward-fill 을 허용하되 confidence 를 낮추는가.
 * 5일 이상이면 "low" (주말/장기 공휴일 + 시스템 장애 의심 구간).
 */
const FFILL_LOW_THRESHOLD_DAYS = 5;

/**
 * N일 수익률을 결측 관용성을 가지고 계산한다.
 *
 * @param prices 시간 오름차순(0=가장 오래된, last=가장 최근). number | null | undefined 허용.
 * @param n      윈도우 일수. 최종값과 (len-1-n) 인덱스 값을 비교.
 *
 * 규칙:
 *  - 길이 < n+1 → value=0, confidence="low", reason="insufficient_data"
 *  - null/undefined/NaN → 전일 값으로 forward-fill
 *  - 최대 연속 결측 ≥ FFILL_LOW_THRESHOLD_DAYS → confidence="low"
 *  - 0 < 최대 연속 결측 < threshold → confidence="med"
 *  - 결측 없음 → confidence="high"
 *  - start 가 복구 불가 또는 0 → value=0, confidence="low"
 */
export function calcReturnNd(
  prices: ReadonlyArray<number | null | undefined>,
  n: number,
): ReturnResult {
  const len = prices.length;
  if (len < n + 1 || n <= 0) {
    return { value: 0, confidence: "low", reason: "insufficient_data" };
  }

  const filled: number[] = new Array(len);
  let lastValid = NaN;
  let maxGap = 0;
  let currentGap = 0;
  for (let i = 0; i < len; i++) {
    const p = prices[i];
    if (typeof p === "number" && Number.isFinite(p)) {
      filled[i] = p;
      lastValid = p;
      currentGap = 0;
    } else {
      filled[i] = lastValid; // 최초 결측이면 NaN 유지 — 아래에서 체크
      currentGap += 1;
      if (currentGap > maxGap) maxGap = currentGap;
    }
  }

  const start = filled[len - 1 - n];
  const end = filled[len - 1];

  if (
    start === undefined ||
    end === undefined ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start === 0
  ) {
    return { value: 0, confidence: "low", reason: "missing_or_zero_start" };
  }

  const value = end / start - 1;

  if (maxGap >= FFILL_LOW_THRESHOLD_DAYS) {
    return { value, confidence: "low", reason: `ffill_gap=${maxGap}d` };
  }
  if (maxGap > 0) {
    return { value, confidence: "med", reason: `ffill_gap=${maxGap}d` };
  }
  return { value, confidence: "high" };
}
