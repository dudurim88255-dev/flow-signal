import { getHistoricalRegime, type Regime } from "@/lib/signals/regime";
import { getWalkforwardResult, type WalkforwardResult } from "@/lib/signals/walkforward";
import { getAllPredictions, type Market as PredMarket } from "@/lib/predictions";

export type MarketRiskData = {
  recentRegimes: Regime[];
  wfResult: WalkforwardResult | null;
  verifiedCount: number;
  /**
   * Phase A P1 (2026-04-24): 첫 prediction 저장일로부터 경과 일수.
   * Risk Gate 게이팅에는 사용하지 않음 — 분석/로깅 전용.
   * prediction이 하나도 없으면 0.
   */
  daysOperational: number;
};

export async function loadRiskGateData(market: PredMarket): Promise<MarketRiskData> {
  const now = new Date();
  const dates = [2, 1, 0].map((n) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  });

  const [regimeResults, wfResult, allPreds] = await Promise.all([
    Promise.all(dates.map((d) => getHistoricalRegime(market, d))),
    getWalkforwardResult(market),
    getAllPredictions(market),
  ]);

  const recentRegimes = regimeResults.filter((r): r is Regime => r !== null);
  const verifiedCount = allPreds.filter(
    (p) => p.outcome14d === "correct" || p.outcome14d === "wrong"
  ).length;

  // daysOperational — allPreds의 가장 오래된 date 기준.
  // 추가 Redis 호출 없이 이미 로드한 배열에서 계산.
  let daysOperational = 0;
  if (allPreds.length > 0) {
    const minDate = allPreds.reduce(
      (m, p) => (p.date < m ? p.date : m),
      allPreds[0]!.date,
    );
    const diffMs = now.getTime() - new Date(minDate).getTime();
    daysOperational = Math.max(0, Math.floor(diffMs / 86_400_000));
  }

  return { recentRegimes, wfResult, verifiedCount, daysOperational };
}
