/**
 * score-distribution-check.ts
 * v3.0(전체 신호) vs v3.1(live-only) 점수 분포 비교
 *
 * 실행: npx tsx scripts/score-distribution-check.ts
 *
 * 출력: 시장별로 min/max/mean/stddev 비교
 * 목적: live:false 신호 제외 후 점수 범위가 어떻게 변하는지 확인
 */

// ── 신호 타입 ──────────────────────────────────────────────────────────────────
type SignalScore = { id: string; name: string; score: number; weight: number; live: boolean };

// ── flowScore 두 버전 ──────────────────────────────────────────────────────────

/** v3.0: live 여부 무관하게 전체 신호로 계산 */
function flowScoreV30(signals: SignalScore[]): number {
  const totalW = signals.reduce((s, x) => s + x.weight, 0);
  return signals.reduce((s, x) => s + x.score * x.weight, 0) / totalW;
}

/** v3.1: live:true 신호만 사용 (없으면 전체 fallback) */
function flowScoreV31(signals: SignalScore[]): number {
  const active = signals.filter((x) => x.live);
  const pool = active.length > 0 ? active : signals;
  const totalW = pool.reduce((s, x) => s + x.weight, 0);
  return pool.reduce((s, x) => s + x.score * x.weight, 0) / totalW;
}

// ── 통계 헬퍼 ────────────────────────────────────────────────────────────────
function stats(values: number[]) {
  if (values.length === 0) return { min: 0, max: 0, mean: 0, stddev: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  return {
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
    mean: Math.round(mean * 10) / 10,
    stddev: Math.round(stddev * 10) / 10,
  };
}

// ── 신호 시나리오 생성기 ───────────────────────────────────────────────────────
// 실제 API 없이 신호의 score를 무작위로 변화시켜 분포를 시뮬레이션
// 각 시장별로 live 신호들의 score만 0~100 범위에서 균등하게 샘플링
// live:false 신호는 항상 fetcher에서 neutral(50) 또는 고정값으로 들어옴

// Crypto 신호 정의 (live 여부 포함)
const CRYPTO_SIGNAL_DEFS: Array<{ id: string; name: string; weight: number; live: boolean; fixedScore?: number }> = [
  { id: "C1",  name: "고래 순매수",    weight: 12, live: false, fixedScore: 50 }, // zscore(0,0) → 50
  { id: "C2",  name: "거래소 순유출",  weight: 12, live: false, fixedScore: 50 },
  { id: "C3",  name: "스테이블 유입",  weight: 8,  live: false, fixedScore: 50 },
  { id: "C4",  name: "펀딩비",         weight: 10, live: true  },
  { id: "C5",  name: "OI 변화",        weight: 8,  live: true  },
  { id: "C6",  name: "롱숏 비율",      weight: 6,  live: true  },
  { id: "C7",  name: "공포탐욕",       weight: 6,  live: true  },
  { id: "C8",  name: "A/D 다이버전스", weight: 8,  live: true  },
  { id: "C9",  name: "휴면코인 활성",  weight: 5,  live: false, fixedScore: 50 },
  { id: "C10", name: "MVRV",           weight: 8,  live: false, fixedScore: 45 }, // mvrv=2.5 → 45
  { id: "C11", name: "모멘텀",         weight: 10, live: true  },
  { id: "C12", name: "거래량 Z",       weight: 7,  live: true  },
  { id: "C13", name: "청산 스파이크",  weight: 6,  live: true  },
];

// Korea 신호 정의
const KOREA_SIGNAL_DEFS: Array<{ id: string; name: string; weight: number; live: boolean; fixedScore?: number }> = [
  { id: "K1",  name: "외국인 순매수",    weight: 14, live: false, fixedScore: 50 }, // 0/cap → 50
  { id: "K2",  name: "기관 순매수",      weight: 12, live: false, fixedScore: 50 },
  { id: "K3",  name: "프로그램 매매",    weight: 10, live: false, fixedScore: 50 },
  { id: "K4",  name: "외국인 보유율",    weight: 8,  live: false, fixedScore: 50 },
  { id: "K5",  name: "공매도 잔고",      weight: 8,  live: false, fixedScore: 68 }, // shortBalancePct=1 → 80-12=68
  { id: "K6",  name: "대차잔고",         weight: 6,  live: false, fixedScore: 50 },
  { id: "K7",  name: "신용잔고",         weight: 5,  live: false, fixedScore: 72 }, // creditPct=1 → 72
  { id: "K8",  name: "외국인 주도",      weight: 6,  live: false, fixedScore: 30 }, // topBuyShare=0.3 → 30
  { id: "K9",  name: "모멘텀(RSI)",      weight: 7,  live: true  },
  { id: "K10", name: "볼린저밴드",       weight: 10, live: true  },
  { id: "K11", name: "거래량",           weight: 6,  live: true  },
  { id: "K12", name: "추세(MA)",         weight: 8,  live: true  },
];

// US 신호 정의 (전체 live:true)
const US_SIGNAL_DEFS: Array<{ id: string; name: string; weight: number; live: boolean; fixedScore?: number }> = [
  { id: "U1",  name: "모멘텀",        weight: 12, live: true },
  { id: "U2",  name: "RSI",           weight: 11, live: true },
  { id: "U3",  name: "MACD",          weight: 8,  live: true },
  { id: "U4",  name: "볼린저밴드",    weight: 7,  live: true },
  { id: "U5",  name: "거래량",        weight: 5,  live: true },
  { id: "U6",  name: "이동평균",      weight: 9,  live: true },
  { id: "U7",  name: "ATR",           weight: 6,  live: true },
  { id: "U8",  name: "OBV",           weight: 7,  live: true },
  { id: "U9",  name: "섹터",          weight: 6,  live: true },
  { id: "U10", name: "VIX",           weight: 8,  live: true },
  { id: "U11", name: "DXY",           weight: 11, live: true },
  { id: "U12", name: "수익률",        weight: 10, live: true },
];

// ── 시뮬레이션 실행 ───────────────────────────────────────────────────────────
// live 신호의 score를 5점 간격으로 균등 샘플링하여 분포의 min/max를 탐색

const SCORE_STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function generateScenarios(
  defs: typeof CRYPTO_SIGNAL_DEFS
): { v30scores: number[]; v31scores: number[] } {
  const v30scores: number[] = [];
  const v31scores: number[] = [];

  const liveIndices = defs.map((d, i) => d.live ? i : -1).filter((i) => i >= 0);

  // live 신호 수가 많으면 완전 열거 대신 대표 조합 샘플링
  // live 신호 2개씩 조합으로 충분 (분포 탐색 목적)
  if (liveIndices.length === 0) {
    // 전체가 fixed — 단일 결과
    const signals: SignalScore[] = defs.map((d) => ({
      id: d.id, name: d.name, weight: d.weight, live: d.live,
      score: d.fixedScore ?? 50,
    }));
    v30scores.push(flowScoreV30(signals));
    v31scores.push(flowScoreV31(signals));
    return { v30scores, v31scores };
  }

  // 모든 live 신호가 동일한 극단값(0/50/100)을 가질 때의 점수
  for (const uniformScore of SCORE_STEPS) {
    const signals: SignalScore[] = defs.map((d) => ({
      id: d.id, name: d.name, weight: d.weight, live: d.live,
      score: d.live ? uniformScore : (d.fixedScore ?? 50),
    }));
    v30scores.push(flowScoreV30(signals));
    v31scores.push(flowScoreV31(signals));
  }

  // 일부 live 신호가 극단값, 나머지가 중립일 때
  for (const idx of liveIndices) {
    for (const extreme of [0, 100]) {
      const signals: SignalScore[] = defs.map((d, i) => ({
        id: d.id, name: d.name, weight: d.weight, live: d.live,
        score: d.live ? (i === idx ? extreme : 50) : (d.fixedScore ?? 50),
      }));
      v30scores.push(flowScoreV30(signals));
      v31scores.push(flowScoreV31(signals));
    }
  }

  return { v30scores, v31scores };
}

// ── 메인 ─────────────────────────────────────────────────────────────────────

function run() {
  const markets = [
    { name: "Crypto", defs: CRYPTO_SIGNAL_DEFS },
    { name: "Korea",  defs: KOREA_SIGNAL_DEFS },
    { name: "US",     defs: US_SIGNAL_DEFS },
  ];

  console.log("=== FlowScore 분포 비교: v3.0 (전체) vs v3.1 (live-only) ===\n");

  for (const { name, defs } of markets) {
    const liveSignals = defs.filter((d) => d.live);
    const deadSignals = defs.filter((d) => !d.live);
    const liveWeight = liveSignals.reduce((s, d) => s + d.weight, 0);
    const deadWeight = deadSignals.reduce((s, d) => s + d.weight, 0);
    const totalWeight = liveWeight + deadWeight;

    console.log(`── ${name} ──`);
    console.log(`  live 신호: ${liveSignals.length}개 (weight ${liveWeight}/${totalWeight} = ${Math.round(liveWeight/totalWeight*100)}%)`);
    console.log(`  dead 신호: ${deadSignals.length}개 (weight ${deadWeight}/${totalWeight} = ${Math.round(deadWeight/totalWeight*100)}%)`);

    if (deadSignals.length > 0) {
      const fixedDesc = deadSignals.map((d) => `${d.id}=${d.fixedScore ?? 50}`).join(", ");
      console.log(`  dead 고정값: ${fixedDesc}`);
    }

    const { v30scores, v31scores } = generateScenarios(defs as typeof CRYPTO_SIGNAL_DEFS);
    const s30 = stats(v30scores);
    const s31 = stats(v31scores);

    console.log(`\n  v3.0 (전체 신호): min=${s30.min}  max=${s30.max}  mean=${s30.mean}  stddev=${s30.stddev}`);
    console.log(`  v3.1 (live-only): min=${s31.min}  max=${s31.max}  mean=${s31.mean}  stddev=${s31.stddev}`);

    const rangeV30 = s30.max - s30.min;
    const rangeV31 = s31.max - s31.min;
    console.log(`\n  점수 범위: v3.0=${rangeV30.toFixed(1)}점  v3.1=${rangeV31.toFixed(1)}점`);
    if (rangeV31 > rangeV30) {
      console.log(`  ✓ v3.1이 ${(rangeV31 - rangeV30).toFixed(1)}점 더 넓은 분포 (개선됨)`);
    } else if (rangeV31 === rangeV30) {
      console.log(`  = 범위 동일 (영향 없음)`);
    } else {
      console.log(`  △ v3.1이 ${(rangeV30 - rangeV31).toFixed(1)}점 더 좁은 분포 (검토 필요)`);
    }
    console.log();
  }

  // 요약
  console.log("=== 요약 ===");
  console.log("Crypto: C4/C5/C6/C7/C8/C11/C12/C13 live, C1/C2/C3/C9 neutral(50), C10 biased(45)");
  console.log("Korea : K9/K10/K11/K12만 live, K5=68/K7=72/K8=30으로 고정 → v3.0에서 편향 심각");
  console.log("US    : 전체 live → v3.0 = v3.1 (영향 없음)");
}

run();
