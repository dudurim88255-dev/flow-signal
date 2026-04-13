/**
 * GET /api/cron/narrate
 * 주간 AI 발견 리포트 — Claude가 진화 결과를 분석해 인사이트 생성
 * Vercel Cron: 매주 일요일 04:00 UTC
 * Redis key: report:weekly:{YYYY-WW}
 */

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { getAllPredictions, getWeights, type Market } from "@/lib/predictions";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";
export const maxDuration = 60;

const MARKETS: Market[] = ["crypto", "korea", "us"];
const REPORT_TTL = 60 * 60 * 24 * 8; // 8일 (다음 리포트 전까지 유지)

/** ISO 주차 번호 */
function getWeekKey(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weekKey = getWeekKey();
  const redisKey = `report:weekly:${weekKey}`;
  const redis = getRedis();

  // 이미 이번 주 리포트 있으면 스킵
  const existing = await redis.get(redisKey);
  if (existing) {
    return NextResponse.json({ skipped: true, weekKey });
  }

  console.log(`[narrate] 주간 리포트 생성 시작 — ${weekKey}`);

  // 각 시장 데이터 수집
  const summaries: string[] = [];

  for (const market of MARKETS) {
    const [predictions, weights] = await Promise.all([
      getAllPredictions(market),
      getWeights(market),
    ]);

    const verified = predictions.filter(
      (p) => p.outcome14d === "correct" || p.outcome14d === "wrong"
    );
    const correct = verified.filter((p) => p.outcome14d === "correct").length;
    const accuracy = verified.length > 0 ? Math.round((correct / verified.length) * 100) : 0;

    // 최근 7일 예측 중 주목할 종목
    const week7ago = new Date();
    week7ago.setDate(week7ago.getDate() - 7);
    const recent = predictions
      .filter((p) => new Date(p.date) >= week7ago)
      .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50)) // 극단값 먼저
      .slice(0, 3);

    const marketLabel = market === "crypto" ? "암호화폐" : market === "korea" ? "국내주식" : "미국주식";

    summaries.push(`
[${marketLabel}]
- 누적 검증: ${verified.length}개 예측, 정확도 ${accuracy}%
- 최근 7일 주목 종목: ${recent.map((p) => `${p.name}(${p.score.toFixed(0)}점/${p.label})`).join(", ") || "없음"}
- 현재 가중치 상위 3개: ${weights ? Object.entries(weights).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}(${v})`).join(", ") : "기본값"}
`);
  }

  // Claude API 호출
  const { text, usage } = await generateText({
    model: anthropic("claude-haiku-4.5"),
    maxOutputTokens: 800,
    prompt: `당신은 AI 투자 시그널 분석 시스템 "FlowSignal"의 자동 리포트 작성자입니다.
아래 이번 주 데이터를 바탕으로 한국어로 인사이트 리포트를 작성하세요.

조건:
- 3~5문단, 각 문단 2~3문장
- 투자 권유가 아닌 분석/관찰 관점
- 어떤 신호가 잘 작동했는지, 어떤 시장이 예측 정확도가 높았는지 언급
- 마지막 문단: 다음 주 주목할 포인트

데이터:
${summaries.join("\n")}

주차: ${weekKey}`,
  });

  const report = {
    weekKey,
    generatedAt: new Date().toISOString(),
    text,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  await redis.set(redisKey, JSON.stringify(report), { ex: REPORT_TTL });
  console.log(`[narrate] 완료 — ${usage.outputTokens} tokens`);

  return NextResponse.json({ ok: true, weekKey, preview: text.slice(0, 200) });
}
