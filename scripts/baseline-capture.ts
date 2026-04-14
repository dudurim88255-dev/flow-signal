/**
 * scripts/baseline-capture.ts
 *
 * FlowSignal v3.1 Complexity Wedge baseline 캡처 스크립트
 *
 * 사용법:
 *   pnpm tsx scripts/baseline-capture.ts \
 *     --tickers bitcoin,005930,NVDA \
 *     --output docs/baseline-v3.1-2026-04-27-pre.json \
 *     --mode pre-evolve
 *
 * 참고: docs/complexity-wedge-notes.md, docs/baseline-schedule.md
 * 이론: Didisheim et al. (2023) NBER WP 31689
 *
 * === Claude Code 작업 지시 ===
 * 이 파일은 초안이다. 아래 TODO 항목들을 FlowSignal 프로젝트 구조에 맞게 완성해라.
 * 기존 모듈을 임포트해서 재활용할 것 (특히 lib/signals/*, lib/score/*).
 * Dashboard 코드는 절대 건드리지 말 것.
 */

import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// TODO: FlowSignal 실제 경로로 교체
// import { evaluateSignals } from '@/lib/signals/evaluate';
// import { getMarketForTicker } from '@/lib/routes';
// import { fetchOHLCV } from '@/lib/data/ohlcv';

// ============================================================
// 타입 정의
// ============================================================

type Market = 'crypto' | 'korea' | 'us';
type Mode = 'pre-evolve' | 'post-evolve';

interface SignalBreakdown {
  id: string;              // 예: "C1", "K3", "U7"
  score: number;           // 0-100
  weight: number;          // Redis 동적 가중치
  live: boolean;           // 온체인 실연결 여부
  contribution: number;    // score * weight (분모보정 전)
}

interface InSampleMetrics {
  primary: {
    source: 'wf_bootstrap_60d_realized';
    sharpe_5d: number | null;
    sharpe_14d: number | null;
    return_mean_5d: number | null;
    return_vol_5d: number | null;
    hit_rate_5d: number | null;
    n_obs_5d: number;      // 기대: 12 (60/5)
    n_obs_14d: number;     // 기대: 4 (60/14)
    se_sharpe_5d: number;  // √((1+0.5·SR²)/n)
    se_sharpe_14d: number;
  };
  reference: {
    source: 'evaluateSignals_internal';
    sharpe_5d: number | null;
    sharpe_14d: number | null;
    note: string;
  };
}

interface OutOfSampleMetrics {
  sharpe_5d: number | null;
  sharpe_14d: number | null;
  return_mean_5d: number | null;
  return_vol_5d: number | null;
  hit_rate_5d: number | null;
  n_obs_5d: number;
  n_obs_14d: number;
  se_sharpe_5d: number | null;
  se_sharpe_14d: number | null;
  last_updated: string | null; // ISO 8601
}

interface WedgeEstimate {
  overfit_component: number | null;
  limits_to_learning: number | null;
  total_wedge: number | null;
  significant: boolean | null;  // total_wedge > 2 * SE 여부
  note: string;
}

interface TickerBaseline {
  ticker: string;
  market: Market;
  score_snapshot: {
    total: number;
    label: string;          // 강매수/매수/중립/매도/강매도
    confidence: 'high' | 'med' | 'low';
    breakdown: SignalBreakdown[];
    regime: 'bull' | 'bear' | 'chop';
  };
  in_sample_metrics: InSampleMetrics;
  out_of_sample_metrics: OutOfSampleMetrics;
  wedge_estimate: WedgeEstimate;
}

interface BaselineDocument {
  meta: {
    version: 'v3.1';
    baseline_date: string;        // ISO 8601
    commit_hash: string;           // git rev-parse HEAD
    mode: Mode;
    model: 'claude-haiku-4.5';
    schema_version: '1.0';
    source_paper: 'Didisheim-Ke-Kelly-Malamud 2023 NBER WP 31689';
  };
  complexity_params: {
    P_signals: Record<string, number>;
    T_train_bootstrap: number;     // 60
    T_train_mature: number;        // 180 (아직 shadow)
    c_current: Record<string, number>;
    interpolation_boundary_distance: Record<string, number>;
    regime_weights_version: string;
  };
  per_ticker: Record<string, TickerBaseline>;
  infeasible_upper_bound: {
    method: 'HJ_bound_with_RMT_correction';
    value: number | null;
    note: string;
  };
}

// ============================================================
// 샤프비율 SE 계산 (Lo 2002)
// SE(SR) ≈ √((1 + 0.5·SR²) / n)
// ============================================================

function computeSharpeSE(sharpe: number, n: number): number {
  if (n <= 1) return Number.POSITIVE_INFINITY;
  return Math.sqrt((1 + 0.5 * sharpe * sharpe) / n);
}

// ============================================================
// IS 지표 계산 — Primary (WF bootstrap 60일 realized)
// ============================================================

async function computeInSamplePrimary(
  ticker: string,
  market: Market,
): Promise<InSampleMetrics['primary']> {
  // TODO: FlowSignal의 walk-forward bootstrap 함수 호출
  // 60일 분량의 과거 점수 + 실현 수익률 쌍을 가져와야 함
  //
  // 예시 구조:
  // const wfData = await getWalkForwardBootstrap({
  //   ticker,
  //   market,
  //   window: 60,
  //   horizon: 5,  // 5d 예측
  // });
  //
  // const predictions = wfData.map(d => d.predicted_direction);
  // const realized = wfData.map(d => d.realized_return_5d);
  //
  // 전략 수익률 = sign(predicted) * realized
  // 샤프 = mean(strat) / std(strat) * √252 (일일) 또는 √(252/5) (5일)

  // 임시 스텁 (Claude Code가 실제 구현으로 교체)
  const n_obs_5d = 12;
  const n_obs_14d = 4;
  const sharpe_5d = 0;     // TODO: 실제 계산
  const sharpe_14d = 0;    // TODO: 실제 계산

  return {
    source: 'wf_bootstrap_60d_realized',
    sharpe_5d,
    sharpe_14d,
    return_mean_5d: null,  // TODO
    return_vol_5d: null,   // TODO
    hit_rate_5d: null,     // TODO
    n_obs_5d,
    n_obs_14d,
    se_sharpe_5d: computeSharpeSE(sharpe_5d, n_obs_5d),
    se_sharpe_14d: computeSharpeSE(sharpe_14d, n_obs_14d),
  };
}

// ============================================================
// IS 지표 계산 — Reference (evaluateSignals 내부)
// ============================================================

async function computeInSampleReference(
  ticker: string,
  market: Market,
): Promise<InSampleMetrics['reference']> {
  // TODO: evaluateSignals가 내부적으로 쓰는 성능 메트릭을 그대로 가져오기
  // 이 값은 쐐기 계산에 사용하지 않고 primary와의 괴리 대조용

  return {
    source: 'evaluateSignals_internal',
    sharpe_5d: null,  // TODO
    sharpe_14d: null, // TODO
    note: 'primary와 대조용 — 괴리 크면 evaluateSignals 로직 재검토',
  };
}

// ============================================================
// 한 종목 baseline 캡처
// ============================================================

async function captureTicker(
  ticker: string,
  market: Market,
): Promise<TickerBaseline> {
  // TODO: evaluateSignals 호출
  // const evaluation = await evaluateSignals({ ticker, market });
  //
  // 예상 반환 구조:
  // {
  //   score: number,
  //   label: string,
  //   confidence: 'high' | 'med' | 'low',
  //   signals: Array<{ id, score, weight, live }>,
  //   regime: 'bull' | 'bear' | 'chop',
  // }

  const [primaryIS, referenceIS] = await Promise.all([
    computeInSamplePrimary(ticker, market),
    computeInSampleReference(ticker, market),
  ]);

  return {
    ticker,
    market,
    score_snapshot: {
      total: 0,                   // TODO: evaluation.score
      label: 'TODO',              // TODO: evaluation.label
      confidence: 'med',          // TODO: evaluation.confidence
      breakdown: [],              // TODO: evaluation.signals.map(...)
      regime: 'chop',             // TODO: evaluation.regime
    },
    in_sample_metrics: {
      primary: primaryIS,
      reference: referenceIS,
    },
    out_of_sample_metrics: {
      sharpe_5d: null,
      sharpe_14d: null,
      return_mean_5d: null,
      return_vol_5d: null,
      hit_rate_5d: null,
      n_obs_5d: 0,
      n_obs_14d: 0,
      se_sharpe_5d: null,
      se_sharpe_14d: null,
      last_updated: null,
    },
    wedge_estimate: {
      overfit_component: null,
      limits_to_learning: null,
      total_wedge: null,
      significant: null,
      note: 'OOS 수집 전 — 체크포인트 1(5/12)부터 채워짐',
    },
  };
}

// ============================================================
// 복잡도 파라미터 계산
// ============================================================

function computeComplexityParams(
  tickersBaselines: Record<string, TickerBaseline>,
): BaselineDocument['complexity_params'] {
  const T_train_bootstrap = 60;
  const T_train_mature = 180;

  const P_signals: Record<string, number> = {};
  const c_current: Record<string, number> = {};
  const interpolation_boundary_distance: Record<string, number> = {};

  for (const [ticker, data] of Object.entries(tickersBaselines)) {
    const P = data.score_snapshot.breakdown.length;
    const c = P / T_train_bootstrap;
    P_signals[ticker] = P;
    c_current[ticker] = Number(c.toFixed(4));
    interpolation_boundary_distance[ticker] = Number((1 - c).toFixed(4));
  }

  return {
    P_signals,
    T_train_bootstrap,
    T_train_mature,
    c_current,
    interpolation_boundary_distance,
    regime_weights_version: 'v3.1_pre_evolve', // TODO: mode에 따라 변경
  };
}

// ============================================================
// 시장 추론
// ============================================================

function inferMarket(ticker: string): Market {
  // 단순 규칙 — Claude Code가 lib/routes.ts의 getMarketForTicker로 교체
  if (/^\d{6}$/.test(ticker)) return 'korea';
  if (/^[a-z-]+$/.test(ticker)) return 'crypto'; // bitcoin, ethereum ...
  return 'us';
}

// ============================================================
// Git commit hash
// ============================================================

async function getGitCommitHash(): Promise<string> {
  // TODO: child_process.execSync('git rev-parse HEAD').toString().trim()
  return 'TODO_git_rev_parse_HEAD';
}

// ============================================================
// CLI 파싱
// ============================================================

interface CliArgs {
  tickers: string[];
  output: string;
  mode: Mode;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const args: Partial<CliArgs> = { mode: 'pre-evolve' };

  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === '--tickers') {
      args.tickers = val.split(',').map((t) => t.trim());
      i++;
    } else if (key === '--output') {
      args.output = val;
      i++;
    } else if (key === '--mode') {
      args.mode = val as Mode;
      i++;
    }
  }

  if (!args.tickers || !args.output) {
    throw new Error(
      'Usage: baseline-capture.ts --tickers <csv> --output <path> [--mode pre-evolve|post-evolve]',
    );
  }

  return args as CliArgs;
}

// ============================================================
// 메인
// ============================================================

async function main() {
  const { tickers, output, mode } = parseArgs();
  const outputPath = resolve(process.cwd(), output);

  if (existsSync(outputPath)) {
    throw new Error(
      `Baseline 파일이 이미 존재: ${output}\n` +
        `갱신이 목적이면 wedge.ts의 computeWedge()를 쓸 것.\n` +
        `완전히 덮어쓰려면 먼저 삭제하고 재실행.`,
    );
  }

  console.log(`[baseline-capture] tickers: ${tickers.join(', ')}`);
  console.log(`[baseline-capture] output: ${outputPath}`);
  console.log(`[baseline-capture] mode: ${mode}`);

  // 각 종목 캡처
  const perTicker: Record<string, TickerBaseline> = {};
  for (const ticker of tickers) {
    const market = inferMarket(ticker);
    console.log(`[baseline-capture] ${ticker} (${market}) 캡처 중...`);
    perTicker[ticker] = await captureTicker(ticker, market);
  }

  // 문서 조립
  const doc: BaselineDocument = {
    meta: {
      version: 'v3.1',
      baseline_date: new Date().toISOString(),
      commit_hash: await getGitCommitHash(),
      mode,
      model: 'claude-haiku-4.5',
      schema_version: '1.0',
      source_paper: 'Didisheim-Ke-Kelly-Malamud 2023 NBER WP 31689',
    },
    complexity_params: computeComplexityParams(perTicker),
    per_ticker: perTicker,
    infeasible_upper_bound: {
      method: 'HJ_bound_with_RMT_correction',
      value: null,
      note: 'RMT(Random Matrix Theory)로 사후 계산 — 체크포인트 4(85일) 이후',
    },
  };

  // 저장
  await writeFile(outputPath, JSON.stringify(doc, null, 2), 'utf-8');
  console.log(`[baseline-capture] ✅ 저장 완료: ${output}`);
  console.log(
    `[baseline-capture] 복잡도 c: ${JSON.stringify(doc.complexity_params.c_current)}`,
  );
  console.log(`[baseline-capture] 다음 단계: 2026-05-12 wedge.ts 1차 실행`);
}

main().catch((err) => {
  console.error('[baseline-capture] 실패:', err);
  process.exit(1);
});
