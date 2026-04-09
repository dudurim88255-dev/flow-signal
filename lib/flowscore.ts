// FlowScore 엔진 — 4개 컴포넌트, 100점 만점
// Seeking Alpha 5팩터 + TradingView 기술지표 + altFINS 거래량 분석 합성

export interface FlowScoreResult {
  score: number;
  grade: "매수" | "관망" | "주의";
  signals: string[];
  components: {
    momentum: number;   // 0~30: MA 배열
    technical: number;  // 0~25: RSI
    volume: number;     // 0~20: 거래량
    trend: number;      // 0~25: 7d/30d 수익률
  };
  rsi: number;
  ma20: number;
  ma60: number;
  volRatio: number;
  p7d: number;
  p30d: number;
}

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// RSI 계산 (Wilder 방식)
function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const changes = closes.slice(1).map((v, i) => v - closes[i]);
  const gains = changes.map(c => (c > 0 ? c : 0));
  const losses = changes.map(c => (c < 0 ? -c : 0));
  let avgGain = mean(gains.slice(0, period));
  let avgLoss = mean(losses.slice(0, period));
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calculateFlowScore(
  closes: number[],
  volumes: number[],
): FlowScoreResult {
  // 데이터 부족 시 기본값
  if (closes.length < 30) {
    return {
      score: 50, grade: "관망", signals: [],
      components: { momentum: 10, technical: 12, volume: 8, trend: 10 },
      rsi: 50, ma20: closes[closes.length - 1] ?? 0, ma60: closes[closes.length - 1] ?? 0,
      volRatio: 1, p7d: 0, p30d: 0,
    };
  }

  const price = closes[closes.length - 1];
  const ma20 = mean(closes.slice(-20));
  const ma60 = mean(closes.slice(-Math.min(60, closes.length)));
  const rsi = calcRSI(closes.slice(-29), 14);
  const avgVol = mean(volumes.slice(-20)) || 1;
  const volRatio = (volumes[volumes.length - 1] ?? avgVol) / avgVol;

  const idx7 = closes.length - 8;
  const idx30 = closes.length - 31;
  const p7d = idx7 >= 0 && closes[idx7] ? ((price / closes[idx7]) - 1) * 100 : 0;
  const p30d = idx30 >= 0 && closes[idx30] ? ((price / closes[idx30]) - 1) * 100 : 0;

  // ── 컴포넌트 1: 모멘텀 (0~30) ─────────────────────
  let momentum = 0;
  if (price > ma20) momentum += 10;   // 단기 위
  if (price > ma60) momentum += 10;   // 중기 위
  if (ma20 > ma60)  momentum += 10;   // 정배열

  // ── 컴포넌트 2: RSI 기술적 (0~25) ────────────────
  let technical = 0;
  if (rsi < 30)       technical = 25;  // 과매도 — 반등 기대
  else if (rsi < 45)  technical = 18;
  else if (rsi < 60)  technical = 22;  // 건강한 상승
  else if (rsi < 70)  technical = 16;
  else                technical = 8;   // 과열

  // ── 컴포넌트 3: 거래량 (0~20) ────────────────────
  let volume = 0;
  if (volRatio >= 3)       volume = 20;
  else if (volRatio >= 2)  volume = 15;
  else if (volRatio >= 1.5)volume = 10;
  else if (volRatio >= 1)  volume = 6;
  else                     volume = 3;

  // ── 컴포넌트 4: 가격 추세 (0~25) ─────────────────
  let trend = 0;
  // 7일 수익률 (0~12)
  if (p7d > 10)      trend += 12;
  else if (p7d > 5)  trend += 10;
  else if (p7d > 2)  trend += 8;
  else if (p7d > 0)  trend += 5;
  else if (p7d > -3) trend += 2;
  // 30일 수익률 (0~13)
  if (p30d > 20)      trend += 13;
  else if (p30d > 10) trend += 11;
  else if (p30d > 5)  trend += 8;
  else if (p30d > 0)  trend += 5;
  else if (p30d > -5) trend += 2;

  const score = Math.min(100, Math.round(momentum + technical + volume + trend));

  // ── 시그널 감지 ───────────────────────────────────
  const signals: string[] = [];
  if (price > ma20 && ma20 > ma60)         signals.push("골든크로스");
  if (volRatio >= 3)                        signals.push(`거래량 폭발 (${volRatio.toFixed(1)}배)`);
  if (rsi < 30)                             signals.push(`RSI 과매도 (${Math.round(rsi)})`);
  if (rsi > 70)                             signals.push(`RSI 과열 (${Math.round(rsi)})`);
  if (p7d > 7)                              signals.push(`7일 급등 (+${p7d.toFixed(1)}%)`);
  if (p30d > 20)                            signals.push(`30일 강세 (+${p30d.toFixed(1)}%)`);
  if (price < ma20 && price > ma60)         signals.push("눌림목 구간");
  if (price < ma60)                         signals.push("이평 하향 이탈");

  const grade: FlowScoreResult["grade"] =
    score >= 70 ? "매수" : score >= 45 ? "관망" : "주의";

  return {
    score,
    grade,
    signals,
    components: { momentum, technical, volume, trend },
    rsi: Math.round(rsi * 10) / 10,
    ma20: Math.round(ma20 * 100) / 100,
    ma60: Math.round(ma60 * 100) / 100,
    volRatio: Math.round(volRatio * 10) / 10,
    p7d: Math.round(p7d * 10) / 10,
    p30d: Math.round(p30d * 10) / 10,
  };
}
