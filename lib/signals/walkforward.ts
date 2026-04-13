/**
 * FlowSignal v4 — Walk-forward 검증 엔진 (Shadow Mode)
 *
 * 현재 단계: Shadow — 기존 verify/evolve와 병렬 실행, 점수에 영향 없음
 * 다음 단계: 6개월치 데이터 누적 후 공식 채택
 *
 * Walk-forward 윈도우:
 *   - 초기(≤180일 데이터): train=60d / test=14d / step=14d
 *   - 성숙(>180일 데이터): train=180d / test=30d / step=30d
 *
 * Redis 키:
 *   wf:result:{market}         → 최근 walk-forward 결과 요약 (7일 TTL)
 *   wf:window:{market}:{idx}   → 개별 윈도우 결과 (30일 TTL)
 */

import { getRedis } from "../redis";
import { type Market, type Prediction } from "../predictions";

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export type SignalAccuracy = Record<string, { correct: number; total: number; accuracy: number }>;

export type WalkforwardWindow = {
  idx: number;
  trainStart: string;
  trainEnd: string;
  testStart: string;
  testEnd: string;
  trainSamples: number;
  testSamples: number;
  signalAccuracy: SignalAccuracy;
  overallAccuracy: number;
};

export type WalkforwardResult = {
  market: Market;
  runAt: string;
  totalWindows: number;
  windows: WalkforwardWindow[];
  aggregatedAccuracy: SignalAccuracy; // 모든 윈도우 평균
  dataMode: "bootstrap" | "mature";  // 데이터 양에 따른 모드
};

const WF_RESULT_TTL  = 60 * 60 * 24 * 7;  // 7일
const WF_WINDOW_TTL  = 60 * 60 * 24 * 30; // 30일

// ─── Redis 저장/조회 ────────────────────────────────────────────────────────

export async function saveWalkforwardResult(result: WalkforwardResult): Promise<void> {
  const redis = getRedis();
  const key = `wf:result:${result.market}`;
  await redis.set(key, JSON.stringify(result), { ex: WF_RESULT_TTL });
}

export async function getWalkforwardResult(market: Market): Promise<WalkforwardResult | null> {
  const redis = getRedis();
  const data = await redis.get<string>(`wf:result:${market}`);
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : (data as WalkforwardResult);
}

// ─── 유틸 ──────────────────────────────────────────────────────────────────

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

// ─── 신호 정확도 계산 ────────────────────────────────────────────────────────

/**
 * 테스트 윈도우 예측들로 신호별 정확도 계산
 * - live:false 신호 제외
 * - neutral 예측(outcome14d === "neutral") 제외
 */
function calcWindowAccuracy(testPredictions: Prediction[]): SignalAccuracy {
  const acc: SignalAccuracy = {};

  for (const pred of testPredictions) {
    if (pred.outcome14d !== "correct" && pred.outcome14d !== "wrong") continue;

    for (const sig of pred.signals) {
      if (!sig.live) continue; // 더미 신호 제외

      if (!acc[sig.id]) acc[sig.id] = { correct: 0, total: 0, accuracy: 0 };
      acc[sig.id].total++;

      const signalBullish = sig.score >= 55;
      const outcomeCorrect = pred.outcome14d === "correct";
      if ((signalBullish && outcomeCorrect) || (!signalBullish && !outcomeCorrect)) {
        acc[sig.id].correct++;
      }
    }
  }

  // accuracy 계산
  for (const id of Object.keys(acc)) {
    acc[id].accuracy = acc[id].total > 0
      ? Math.round((acc[id].correct / acc[id].total) * 1000) / 10
      : 50;
  }

  return acc;
}

function overallAccuracy(acc: SignalAccuracy): number {
  const vals = Object.values(acc).filter((v) => v.total >= 3);
  if (!vals.length) return 50;
  return Math.round(vals.reduce((s, v) => s + v.accuracy, 0) / vals.length * 10) / 10;
}

/** 여러 윈도우의 신호 정확도를 가중 평균으로 집계 */
function aggregateAccuracy(windows: WalkforwardWindow[]): SignalAccuracy {
  const agg: Record<string, { correct: number; total: number; accuracy: number }> = {};

  for (const w of windows) {
    for (const [id, stats] of Object.entries(w.signalAccuracy)) {
      if (!agg[id]) agg[id] = { correct: 0, total: 0, accuracy: 0 };
      agg[id].correct += stats.correct;
      agg[id].total   += stats.total;
    }
  }

  for (const id of Object.keys(agg)) {
    agg[id].accuracy = agg[id].total > 0
      ? Math.round((agg[id].correct / agg[id].total) * 1000) / 10
      : 50;
  }

  return agg;
}

// ─── Walk-forward 실행 ────────────────────────────────────────────────────────

/**
 * 전체 예측 히스토리로 walk-forward 검증 실행
 *
 * @param market
 * @param predictions getAllPredictions(market) 결과
 * @returns WalkforwardResult (shadow — 가중치 적용 안 함)
 */
export function runWalkforward(market: Market, predictions: Prediction[]): WalkforwardResult {
  // 날짜 정렬
  const sorted = [...predictions].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) {
    return {
      market,
      runAt: new Date().toISOString(),
      totalWindows: 0,
      windows: [],
      aggregatedAccuracy: {},
      dataMode: "bootstrap",
    };
  }

  const firstDate = new Date(sorted[0].date);
  const lastDate  = new Date(sorted[sorted.length - 1].date);
  const totalDays = daysBetween(sorted[0].date, sorted[sorted.length - 1].date);

  // 데이터 양에 따른 윈도우 크기 결정
  const isMature = totalDays >= 180;
  const TRAIN_DAYS = isMature ? 180 : 60;
  const TEST_DAYS  = isMature ? 30 : 14;
  const STEP_DAYS  = isMature ? 30 : 14;

  const windows: WalkforwardWindow[] = [];
  let windowStart = new Date(firstDate);
  let idx = 0;

  while (true) {
    const trainStart = dateStr(windowStart);
    const trainEnd   = dateStr(addDays(windowStart, TRAIN_DAYS));
    const testStart  = trainEnd;
    const testEnd    = dateStr(addDays(windowStart, TRAIN_DAYS + TEST_DAYS));

    // 테스트 끝이 마지막 데이터를 넘으면 종료
    if (addDays(windowStart, TRAIN_DAYS + TEST_DAYS) > lastDate) break;

    const trainPredictions = sorted.filter(
      (p) => p.date >= trainStart && p.date < trainEnd
    );
    const testPredictions = sorted.filter(
      (p) => p.date >= testStart && p.date < testEnd &&
             (p.outcome14d === "correct" || p.outcome14d === "wrong")
    );

    // 테스트 샘플 최소 5개 이상일 때만 유효 윈도우로 기록
    if (testPredictions.length >= 5) {
      const signalAccuracy = calcWindowAccuracy(testPredictions);
      windows.push({
        idx,
        trainStart,
        trainEnd,
        testStart,
        testEnd,
        trainSamples: trainPredictions.length,
        testSamples: testPredictions.length,
        signalAccuracy,
        overallAccuracy: overallAccuracy(signalAccuracy),
      });
    }

    idx++;
    windowStart = addDays(windowStart, STEP_DAYS);
  }

  const aggregatedAccuracy = aggregateAccuracy(windows);

  return {
    market,
    runAt: new Date().toISOString(),
    totalWindows: windows.length,
    windows,
    aggregatedAccuracy,
    dataMode: isMature ? "mature" : "bootstrap",
  };
}
