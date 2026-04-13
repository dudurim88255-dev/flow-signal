/**
 * GET /api/cron/verify
 * 예측 결과 검증 — 5일/14일 후 가격 확인 → outcome 업데이트
 * Vercel Cron: 매일 02:00 UTC
 *
 * 예측이 맞다 = score >= 60(매수) 이고 실제 가격 상승 OR score < 40(매도) 이고 실제 하락
 */

import { NextRequest, NextResponse } from "next/server";
import yahooFinance from "@/lib/yahoo";
import { getAllPredictions, savePrediction, today, type Market, type Prediction } from "@/lib/predictions";

export const runtime = "nodejs";
export const maxDuration = 300;

const MARKETS: Market[] = ["crypto", "korea", "us"];

/** Yahoo Finance / CoinGecko에서 현재가 조회 */
async function fetchCurrentPrice(market: Market, ticker: string): Promise<number> {
  try {
    if (market === "crypto") {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ticker}&vs_currencies=usd`,
        { next: { revalidate: 0 } }
      );
      const data = await res.json();
      return data[ticker]?.usd ?? 0;
    }

    // korea: ticker는 종목코드(005930) → Yahoo심볼은 005930.KS
    const yahooSymbol = market === "korea" ? `${ticker}.KS` : ticker;
    const quote = await yahooFinance.quote(yahooSymbol);
    return quote.regularMarketPrice ?? 0;
  } catch {
    return 0;
  }
}

/** 예측이 맞았는지 판정 */
function judgeOutcome(
  prediction: Prediction,
  currentPrice: number
): "correct" | "wrong" | "neutral" {
  if (prediction.priceAtPrediction === 0 || currentPrice === 0) return "wrong";
  const priceDiff = (currentPrice - prediction.priceAtPrediction) / prediction.priceAtPrediction;
  const isBullish = prediction.score >= 60;
  const isBearish = prediction.score < 40;

  // 관망(score 40~59) = neutral: 정확도 계산에서 제외. auto-correct 처리 금지 (데이터 오염 방지)
  if (!isBullish && !isBearish) return "neutral";

  if (isBullish && priceDiff > 0.01) return "correct";   // 매수 신호 + 1% 이상 상승
  if (isBearish && priceDiff < -0.01) return "correct";  // 매도 신호 + 1% 이상 하락
  return "wrong";
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateStr = today();
  console.log(`[verify] 시작 ${dateStr}`);

  let updated5d = 0, updated14d = 0, errors = 0;

  for (const market of MARKETS) {
    const all = await getAllPredictions(market);

    const pending = all.filter((p) => {
      const predDate = new Date(p.date);
      const daysPassed = Math.floor((Date.now() - predDate.getTime()) / 86400000);
      return (p.outcome5d === "pending" && daysPassed >= 5) ||
             (p.outcome14d === "pending" && daysPassed >= 14);
    });

    for (const pred of pending) {
      try {
        const currentPrice = await fetchCurrentPrice(market, pred.ticker);
        const daysPassed = Math.floor((Date.now() - new Date(pred.date).getTime()) / 86400000);

        const updated: Prediction = { ...pred };

        if (pred.outcome5d === "pending" && daysPassed >= 5) {
          updated.priceAt5d = currentPrice;
          updated.outcome5d = judgeOutcome(pred, currentPrice);
          updated5d++;
        }

        if (pred.outcome14d === "pending" && daysPassed >= 14) {
          updated.priceAt14d = currentPrice;
          updated.outcome14d = judgeOutcome(pred, currentPrice);
          updated.verifiedAt = new Date().toISOString();
          updated14d++;
        }

        await savePrediction(updated);
        // Rate limit 방어
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        console.error(`[verify] ${market}/${pred.ticker} 실패:`, err);
        errors++;
      }
    }
  }

  console.log(`[verify] 완료 — 5d: ${updated5d}, 14d: ${updated14d}, 오류: ${errors}`);

  return NextResponse.json({ date: dateStr, updated5d, updated14d, errors });
}
