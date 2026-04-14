/**
 * lib/metrics/wedge.ts
 *
 * Complexity Wedge 계산 모듈
 *
 * Didisheim-Ke-Kelly-Malamud (2023) NBER WP 31689
 *   Wedge(z, c) = u_IS − u_OOS
 *               = (u_IS − u_TRUE) + (u_TRUE − u_OOS)
 *               = Overfit + Limits_to_Learning
 *
 * 이 모듈은 저장된 baseline JSON을 읽고, 4/27 이후 실제 실현 수익률로
 * OOS 지표를 채운 뒤 wedge를 계산해 in-place 업데이트한다.
 *
 * 사용법:
 *   import { computeWedge } from '@/lib/metrics/wedge';
 *   await computeWedge('docs/baseline-v3.1-2026-04-27-pre.json');
 *
 * 참고: docs/complexity-wedge-notes.md, docs/baseline-schedule.md
 *
 * === Claude Code 작업 지시 ===
 * 이 파일은 초안. TODO를 FlowSignal 실제 모듈로 교체.
 * 특히 과거 점수 이력 조회는 Redis (upstash-kv-lime-lamp)에서 가져와야 함.
 * ideal-wahoo-82696 (빈 Redis)은 절대 건드리지 말 것.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// TODO: FlowSignal 실제 경로
// import { getPredictionHistory } from '@/lib/redis/predictions';
// import { fetchRealizedReturns } from '@/lib/data/returns';

// ============================================================
// 타입 (baseline-capture.ts와 동일, 실제로는 lib/types/baseline.ts로 분리 권장)
// ============================================================

interface WedgeReport {
  ticker: string;
  overfit_component: number;
  limits_to_learning: number | null; // u_TRUE 모르면 null
  total_wedge: number;
  significant: boolean;
  is_sharpe_5d: number;
  oos_sharpe_5d: number;
  n_obs_oos: number;
  se_oos: number;
  updated_at: string;
}

// ============================================================
// 샤프비율 계산 유틸
// ============================================================

function computeSharpe(returns: number[], horizon: number): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return 0;

  // 연율화: 252 영업일 기준, horizon일 단위이므로 √(252/horizon)
  const annualizationFactor = Math.sqrt(252 / horizon);
  return (mean / std) * annualizationFactor;
}

function computeSharpeSE(sharpe: number, n: number): number {
  if (n <= 1) return Number.POSITIVE_INFINITY;
  return Math.sqrt((1 + 0.5 * sharpe * sharpe) / n);
}

function computeHitRate(predictions: number[], realized: number[]): number {
  if (predictions.length === 0) return 0;
  let hits = 0;
  for (let i = 0; i < predictions.length; i++) {
    if (Math.sign(predictions[i]) === Math.sign(realized[i])) hits++;
  }
  return hits / predictions.length;
}

// ============================================================
// OOS 데이터 수집
// ============================================================

interface OOSDataPoint {
  date: string;
  predicted_score: number;   // 0-100
  predicted_direction: number; // -1 / 0 / +1
  realized_return: number;
}

async function collectOOSData(
  ticker: string,
  market: string,
  baselineDate: string,
  horizon: 5 | 14,
): Promise<OOSDataPoint[]> {
  // TODO: 실제 구현
  //
  // 1. Redis에서 baselineDate 이후의 예측 이력 가져오기
  //    const history = await getPredictionHistory({
  //      ticker, market, since: baselineDate
  //    });
  //
  // 2. 각 예측에 대해 horizon일 뒤 실현 수익률 매칭
  //    const realized = await fetchRealizedReturns({
  //      ticker, market,
  //      startDate: baselineDate,
  //      horizon,
  //    });
  //
  // 3. 점수를 방향 시그널로 변환
  //    - score >= 70: direction = +1 (매수)
  //    - score <= 30: direction = -1 (매도)
  //    - 그 사이: direction = 0 (중립, 관측에서 제외 또는 0으로 유지)
  //
  //    주의: 중립 관측을 제외할지 0으로 넣을지 결정 필요
  //    → 제외하면 n이 줄어듦, 0으로 넣으면 샤프 왜곡
  //    → 권장: 제외 (Kelly-Malamud-Zhou 2024도 직접 타이밍만 평가)

  return []; // 스텁
}

// ============================================================
// Overfit 계산
// ============================================================

function computeOverfit(is_sharpe: number, oos_sharpe: number): number {
  // 단순 차이. 부호까지 포함해서 저장 (음수면 OOS가 IS를 이긴 비정상 상황)
  return is_sharpe - oos_sharpe;
}

// ============================================================
// Limits to Learning — u_TRUE 추정 시도
// ============================================================

function estimateLimitsToLearning(
  is_sharpe: number,
  oos_sharpe: number,
  c: number,
  n_oos: number,
): number | null {
  // Didisheim et al. (2023) Corollary 4 근사:
  //   Limits to Learning = u_TRUE - u_OOS
  // u_TRUE는 infeasible HJ bound. RMT로 사후 추정 가능.
  //
  // 체크포인트 4(85일) 이전에는 n이 작아서 안정적 추정 불가 → null 반환.
  // 체크포인트 4 이후 RMT 기반 추정 로직 추가할 것.
  //
  // 참고: Kelly-Xiu 2023 §2.1.2 Stieltjes transform, Marcenko-Pastur law
  //
  // 임시: 양의 쐐기와 저복잡도(c<0.3) 가정 하에
  //   Limits to Learning ≈ c * oos_sharpe (순수 rough heuristic, 진짜 RMT 아님)

  if (n_oos < 17) return null; // 체크포인트 4 기준
  return c * Math.abs(oos_sharpe); // TODO: 정확한 RMT 공식으로 교체
}

// ============================================================
// 유의성 판정
// ============================================================

function isSignificant(
  wedge: number,
  se_oos: number,
  se_is: number,
): boolean {
  // 쐐기 ± SE를 2σ 기준으로 판정
  // SE(wedge) ≈ √(SE_IS² + SE_OOS²)  (독립 가정)
  const combinedSE = Math.sqrt(se_is * se_is + se_oos * se_oos);
  return Math.abs(wedge) > 2 * combinedSE;
}

// ============================================================
// 한 종목 wedge 계산
// ============================================================

async function computeWedgeForTicker(
  ticker: string,
  market: string,
  baselineDate: string,
  baselineData: any, // TickerBaseline (baseline-capture.ts 참조)
  c: number,
): Promise<WedgeReport> {
  // 5d OOS 데이터 수집
  const oos5d = await collectOOSData(ticker, market, baselineDate, 5);
  const oosReturns5d = oos5d.map((d) => d.realized_return * d.predicted_direction);
  const oosSharpe5d = computeSharpe(oosReturns5d, 5);

  // IS는 baseline에 이미 저장돼 있음 (primary 사용)
  const isSharpe5d = baselineData.in_sample_metrics.primary.sharpe_5d ?? 0;
  const isSE5d = baselineData.in_sample_metrics.primary.se_sharpe_5d;

  // 계산
  const n_oos = oosReturns5d.length;
  const oosSE5d = computeSharpeSE(oosSharpe5d, n_oos);
  const overfit = computeOverfit(isSharpe5d, oosSharpe5d);
  const limits = estimateLimitsToLearning(isSharpe5d, oosSharpe5d, c, n_oos);
  const totalWedge = overfit + (limits ?? 0);
  const significant = isSignificant(totalWedge, oosSE5d, isSE5d);

  return {
    ticker,
    overfit_component: Number(overfit.toFixed(4)),
    limits_to_learning: limits !== null ? Number(limits.toFixed(4)) : null,
    total_wedge: Number(totalWedge.toFixed(4)),
    significant,
    is_sharpe_5d: isSharpe5d,
    oos_sharpe_5d: Number(oosSharpe5d.toFixed(4)),
    n_obs_oos: n_oos,
    se_oos: Number(oosSE5d.toFixed(4)),
    updated_at: new Date().toISOString(),
  };
}

// ============================================================
// 메인 API — baseline 파일 in-place 업데이트
// ============================================================

export async function computeWedge(
  baselinePath: string,
): Promise<Record<string, WedgeReport>> {
  const absPath = resolve(process.cwd(), baselinePath);
  const raw = await readFile(absPath, 'utf-8');
  const doc = JSON.parse(raw);

  const baselineDate = doc.meta.baseline_date;
  const results: Record<string, WedgeReport> = {};

  console.log(`[wedge] baseline: ${baselinePath}`);
  console.log(`[wedge] baseline_date: ${baselineDate}`);
  console.log(`[wedge] 현재 시각: ${new Date().toISOString()}`);

  for (const [ticker, tickerData] of Object.entries(doc.per_ticker)) {
    const market = (tickerData as any).market;
    const c = doc.complexity_params.c_current[ticker];

    console.log(`[wedge] ${ticker} 계산 중 (c=${c})...`);

    const report = await computeWedgeForTicker(
      ticker,
      market,
      baselineDate,
      tickerData,
      c,
    );

    // in-place 업데이트
    (tickerData as any).out_of_sample_metrics = {
      ...((tickerData as any).out_of_sample_metrics ?? {}),
      sharpe_5d: report.oos_sharpe_5d,
      n_obs_5d: report.n_obs_oos,
      se_sharpe_5d: report.se_oos,
      last_updated: report.updated_at,
    };

    (tickerData as any).wedge_estimate = {
      overfit_component: report.overfit_component,
      limits_to_learning: report.limits_to_learning,
      total_wedge: report.total_wedge,
      significant: report.significant,
      note: report.significant
        ? `유의미 (|wedge|=${Math.abs(report.total_wedge)} > 2σ=${(2 * report.se_oos).toFixed(2)})`
        : `노이즈 범위 (n=${report.n_obs_oos}, SE=${report.se_oos})`,
    };

    results[ticker] = report;
    console.log(
      `[wedge] ${ticker}: wedge=${report.total_wedge}, ` +
        `significant=${report.significant}, n=${report.n_obs_oos}`,
    );
  }

  // 파일 저장
  await writeFile(absPath, JSON.stringify(doc, null, 2), 'utf-8');
  console.log(`[wedge] ✅ ${baselinePath} 갱신 완료`);

  return results;
}

// ============================================================
// CLI 직접 실행도 지원
// ============================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: wedge.ts <baseline-json-path>');
    process.exit(1);
  }
  computeWedge(path).catch((err) => {
    console.error('[wedge] 실패:', err);
    process.exit(1);
  });
}
