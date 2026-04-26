/**
 * EntryZone — 점수 + Bollinger Band 기반 진입 영역 계산
 *
 * 룰 (docs/design/SCORE_PAGE.md §6):
 *   강매수 (≥80): MA20 - 0.5σ ~ MA20 + 0.5σ
 *   매수 (60~79): MA20 - 1.0σ ~ MA20 + 0.5σ
 *   관망 (40~59): no_recommendation (lower/upper null)
 *   매도 (20~39): MA20 + 0.5σ ~ MA20 + 1.0σ (역방향, 반등 매도 영역)
 *   강매도 (<20): MA20 + 0.5σ ~ MA20 + 1.0σ
 *
 * 현재가 vs 영역:
 *   현재가 ∈ [lower, upper] → 'in_zone'        (즉시 진입권)
 *   현재가 ∉ [lower, upper] → 'pending_pullback' (되돌림 대기)
 *   no_recommendation → 그대로
 */

export type EntryZoneStatus = 'in_zone' | 'pending_pullback' | 'no_recommendation';

export interface EntryZoneResult {
  status: EntryZoneStatus;
  lower: number | null;
  upper: number | null;
  ma20: number;
  sigma: number;
  reason: string;
}

interface CalculateEntryZoneParams {
  score: number;          // 0~100
  prices: number[];       // 최근 20+ 종가 (시간 오름차순)
  currentPrice: number;
}

const MIN_PRICES = 20;

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function stddev(xs: number[]): number {
  const m = mean(xs);
  const variance = xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

/**
 * 점수 → BB 멀티플라이어 (lower, upper). null = no_recommendation.
 */
function scoreToBand(score: number): { lower: number; upper: number } | null {
  if (score >= 80) return { lower: -0.5, upper: 0.5 };
  if (score >= 60) return { lower: -1.0, upper: 0.5 };
  if (score >= 40) return null;                          // 관망
  if (score >= 20) return { lower: 0.5, upper: 1.0 };    // 매도 (반등 영역)
  return { lower: 0.5, upper: 1.0 };                     // 강매도
}

function formatSigmaOffset(currentPrice: number, ma20: number, sigma: number): string {
  if (sigma === 0) return '편차 0';
  const offset = (currentPrice - ma20) / sigma;
  const sign = offset > 0 ? '+' : '';
  return `${sign}${offset.toFixed(1)}σ`;
}

export function calculateEntryZone(params: CalculateEntryZoneParams): EntryZoneResult {
  const { score, prices, currentPrice } = params;

  if (prices.length < MIN_PRICES) {
    throw new Error(`prices.length must be ≥ ${MIN_PRICES}, got ${prices.length}`);
  }

  // 최근 20개로 BB 계산 (모집단 표준편차 — 시계열 BB 표준)
  const window = prices.slice(-MIN_PRICES);
  const ma20 = mean(window);
  const sigma = stddev(window);

  const band = scoreToBand(score);
  if (!band) {
    return {
      status: 'no_recommendation',
      lower: null,
      upper: null,
      ma20,
      sigma,
      reason: '점수 40~59 관망 구간 — 진입 권고 없음',
    };
  }

  const lower = ma20 + band.lower * sigma;
  const upper = ma20 + band.upper * sigma;

  // sigma=0 (가격 일정) 인 경우 lower=upper=ma20 → 현재가 == ma20 일 때만 in_zone
  const inZone = currentPrice >= lower && currentPrice <= upper;
  const offsetText = formatSigmaOffset(currentPrice, ma20, sigma);

  if (inZone) {
    return {
      status: 'in_zone',
      lower,
      upper,
      ma20,
      sigma,
      reason: `즉시 진입권 (현재가 ${offsetText})`,
    };
  }

  const direction = currentPrice > upper ? '위' : '아래';
  return {
    status: 'pending_pullback',
    lower,
    upper,
    ma20,
    sigma,
    reason: `되돌림 대기 (현재가가 ${offsetText} ${direction})`,
  };
}
