/**
 * FlowSignal v4 — 시장 레짐 감지
 *
 * 레짐 3종: "bull" | "bear" | "chop"
 * - bull  : 추세 상승 + 낮은 변동성 → 매수 신호 가중치 상향
 * - bear  : 추세 하락 + 높은 변동성 → 매도/리스크 게이트 활성화
 * - chop  : 횡보/불명확 → 레짐 스코어 감쇠 없이 유지
 *
 * Redis 캐시:
 *   regime:{market}:current   → 오늘 레짐 (1시간 TTL)
 *   regime:{market}:{date}    → 날짜별 레짐 히스토리 (365일 TTL)
 */

import { getRedis } from "../redis";

export type Regime = "bull" | "bear" | "chop";
export type Market = "crypto" | "korea" | "us";

const REGIME_TTL = 60 * 60;           // 1시간 (current)
const REGIME_HIST_TTL = 60 * 60 * 24 * 365; // 365일 (history)

// ─── Redis 키 ──────────────────────────────────────────────────────────────

function currentKey(market: Market): string {
  return `regime:${market}:current`;
}

function histKey(market: Market, date: string): string {
  return `regime:${market}:${date}`;
}

// ─── Redis 저장/조회 ────────────────────────────────────────────────────────

export async function saveRegime(market: Market, regime: Regime, date: string): Promise<void> {
  const redis = getRedis();
  await Promise.all([
    redis.set(currentKey(market), regime, { ex: REGIME_TTL }),
    redis.set(histKey(market, date), regime, { ex: REGIME_HIST_TTL }),
  ]);
}

export async function getCurrentRegime(market: Market): Promise<Regime | null> {
  const redis = getRedis();
  return (await redis.get<string>(currentKey(market))) as Regime | null;
}

export async function getHistoricalRegime(market: Market, date: string): Promise<Regime | null> {
  const redis = getRedis();
  return (await redis.get<string>(histKey(market, date))) as Regime | null;
}

/** 최근 N일간 레짐 목록 — walk-forward, regime-scoped weight 조회에 사용 */
export async function getRecentRegimes(
  market: Market,
  days: number
): Promise<Array<{ date: string; regime: Regime }>> {
  const redis = getRedis();
  const result: Array<{ date: string; regime: Regime }> = [];

  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const regime = (await redis.get<string>(histKey(market, date))) as Regime | null;
    if (regime) result.push({ date, regime });
  }

  return result;
}

// ─── 레짐 감지 로직 ──────────────────────────────────────────────────────────

const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

/** 이동평균 */
function ma(closes: number[], period: number): number {
  const slice = closes.slice(-period);
  return slice.length < period ? closes[closes.length - 1] : mean(slice);
}

/** 연간화 변동성 (일별 수익률 표준편차 × √252) */
function annualizedVol(closes: number[], days = 20): number {
  if (closes.length < days + 1) return 0.5;
  const slice = closes.slice(-(days + 1));
  const returns = slice.slice(1).map((p, i) => Math.log(p / slice[i]));
  const m = mean(returns);
  const variance = returns.reduce((s, r) => s + (r - m) ** 2, 0) / returns.length;
  return Math.sqrt(variance * 252);
}

/**
 * Crypto 레짐: BTC 60일 MA 위치 + 30일 연간화 변동성
 *
 * bull : BTC > 60d MA AND vol < 70%
 * bear : BTC < 60d MA AND vol > 80%  (or BTC < 60d MA + price trend down strongly)
 * chop : 그 외
 */
export function detectCryptoRegime(btcCloses: number[]): Regime {
  const price = btcCloses[btcCloses.length - 1];
  const ma60  = ma(btcCloses, 60);
  const vol   = annualizedVol(btcCloses, 30);

  const aboveMa = price > ma60;

  if (aboveMa && vol < 0.70) return "bull";
  if (!aboveMa && vol > 0.80) return "bear";

  // 가격이 MA 아래이나 변동성이 낮으면 회복 가능성 있는 chop
  // 가격이 MA 위이나 변동성이 높으면 과열된 bull → chop으로 분류
  return "chop";
}

/**
 * Korea 레짐: KOSPI 20일 MA 위치 + 20일 연간화 변동성
 *
 * bull : KOSPI > 20d MA AND vol < 15%
 * bear : KOSPI < 20d MA AND vol > 20%
 * chop : 그 외
 */
export function detectKoreaRegime(kospiCloses: number[]): Regime {
  const price = kospiCloses[kospiCloses.length - 1];
  const ma20  = ma(kospiCloses, 20);
  const vol   = annualizedVol(kospiCloses, 20);

  if (price > ma20 && vol < 0.15) return "bull";
  if (price < ma20 && vol > 0.20) return "bear";
  return "chop";
}

/**
 * US 레짐: SPY 50일 MA 위치 + 20일 연간화 변동성
 *
 * bull : SPY > 50d MA AND vol < 18%
 * bear : SPY < 50d MA AND vol > 22%
 * chop : 그 외
 */
export function detectUsRegime(spyCloses: number[]): Regime {
  const price = spyCloses[spyCloses.length - 1];
  const ma50  = ma(spyCloses, 50);
  const vol   = annualizedVol(spyCloses, 20);

  if (price > ma50 && vol < 0.18) return "bull";
  if (price < ma50 && vol > 0.22) return "bear";
  return "chop";
}

/** 레짐별 FlowScore 스케일 팩터 — 레짐에 맞지 않는 신호 방향을 감쇠 */
export function regimeScaleFactor(regime: Regime, signalBullish: boolean): number {
  if (regime === "bull") return signalBullish ? 1.1 : 0.9;  // bull 레짐에서 강세 신호 10% 증폭
  if (regime === "bear") return signalBullish ? 0.9 : 1.1;  // bear 레짐에서 약세 신호 10% 증폭
  return 1.0; // chop = 감쇠 없음
}
