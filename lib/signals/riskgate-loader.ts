import { getHistoricalRegime, type Regime } from "@/lib/signals/regime";
import { getWalkforwardResult, type WalkforwardResult } from "@/lib/signals/walkforward";
import { getAllPredictions, type Market as PredMarket } from "@/lib/predictions";

export type MarketRiskData = {
  recentRegimes: Regime[];
  wfResult: WalkforwardResult | null;
  verifiedCount: number;
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

  return { recentRegimes, wfResult, verifiedCount };
}
