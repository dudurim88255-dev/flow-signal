/**
 * FlowSignal — 공유 시그널 타입
 *
 * WHY 별도 파일: confidence 관련 타입이 lib/signals/index.ts, app/api/score/**,
 *               lib/predictions.ts, app/score/** 여러 레이어에서 import되므로
 *               순환 참조를 피하기 위해 최상위 타입만 모아두는 중립 파일.
 */

/**
 * confidenceScore(0~100)에서 유도된 라벨.
 * Risk Gate 로그 / MEMORY 기록 / 내러티브 생성 등 사람이 읽는 경로에서 사용.
 * Dashboard UI는 숫자(confidenceScore)를 그대로 표시한다.
 */
export type ConfidenceLabel = "high" | "med" | "low";

/**
 * live 신호 커버리지(%)에서 유도된 라벨. confidenceScore와는 독립.
 * evaluateSignals() 내부에서 채워진다.
 */
export type CoverageLabel = "high" | "medium" | "low";

/**
 * 신뢰도 점수 → 라벨 매핑.
 *   score ≥ 70 → "high"
 *   40 ≤ score < 70 → "med"
 *   score < 40 → "low"
 *
 * NaN/undefined/out-of-range 방어:
 *   - 유효하지 않은 값은 "low"로 처리 (보수적 기본값).
 */
export function confidenceScoreToLabel(score: number): ConfidenceLabel {
  if (!Number.isFinite(score)) return "low";
  if (score >= 70) return "high";
  if (score >= 40) return "med";
  return "low";
}
