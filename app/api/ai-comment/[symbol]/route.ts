import { NextResponse } from "next/server";
import { generateText } from "ai";
import { KOSPI_STOCKS, US_STOCKS, CRYPTO_COINS } from "@/lib/stocks";
import { getRedis } from "@/lib/redis";

export const revalidate = 0;

// 허용된 심볼 집합 — 등록되지 않은 심볼로 API 비용 폭탄 방지
const ALLOWED_SYMBOLS = new Set([
  ...KOSPI_STOCKS.map((s) => s.symbol),
  ...US_STOCKS.map((s) => s.symbol),
  ...CRYPTO_COINS.map((s) => s.symbol),
]);

interface CommentRequest {
  name: string;
  symbol: string;
  market: string;
  score: number;
  grade: string;
  change1d: number;
  p7d: number;
  p30d: number;
  rsi: number;
  volRatio: number;
  signals: string[];
  components: { momentum: number; technical: number; volume: number; trend: number };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const decoded = decodeURIComponent(symbol);

  // 허용 심볼 검증
  if (!ALLOWED_SYMBOLS.has(decoded)) {
    return NextResponse.json({ error: "허용되지 않은 종목" }, { status: 400 });
  }

  // Redis 키 인젝션 방지
  const safeId = decoded.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const CACHE_KEY = `flowsignal:ai-comment:${safeId}:v1`;

  // 캐시 확인 (1시간)
  try {
    const cached = await getRedis().get<string>(CACHE_KEY);
    if (cached) return NextResponse.json({ comment: cached, cached: true });
  } catch { /* Redis 없으면 무시 */ }

  let body: CommentRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const {
    name, market, score, grade, change1d, p7d, p30d,
    rsi, volRatio, signals, components,
  } = body;

  const marketLabel = market === "kospi" ? "코스피" : market === "us" ? "미국" : "암호화폐";
  const signalStr = signals.length > 0 ? signals.join(", ") : "특별 시그널 없음";

  const prompt = `당신은 한국 개인투자자를 위한 주식 분석 전문가입니다. 아래 데이터를 바탕으로 종목 투자 코멘트를 작성하세요.

종목: ${name} (${marketLabel})
FlowScore: ${score}/100 (등급: ${grade})
오늘 등락: ${change1d > 0 ? "+" : ""}${change1d}%
7일 수익률: ${p7d > 0 ? "+" : ""}${p7d}%
30일 수익률: ${p30d > 0 ? "+" : ""}${p30d}%
RSI: ${rsi} (${rsi < 30 ? "과매도 구간" : rsi > 70 ? "과열 구간" : "중립 구간"})
거래량 비율: ${volRatio}× (20일 평균 대비)
감지된 시그널: ${signalStr}
점수 분해 — 모멘텀: ${components.momentum}/30, 기술적: ${components.technical}/25, 거래량: ${components.volume}/20, 추세: ${components.trend}/25

요구사항:
- 3~4문장으로 간결하게 작성
- 핵심 강점과 주의점을 각 1가지씩 포함
- 투자 결정은 본인 책임임을 마지막에 한 문장으로 언급
- 친근하고 전문적인 한국어로 작성
- 숫자를 구체적으로 인용하여 근거 제시`;

  try {
    const { text } = await generateText({
      model: "anthropic/claude-haiku-4.5",
      prompt,
      maxTokens: 400,
    });

    // 캐시 저장 (1시간)
    try { await getRedis().set(CACHE_KEY, text, { ex: 3600 }); } catch { /* 무시 */ }

    return NextResponse.json({ comment: text, cached: false });
  } catch (e) {
    console.error("[ai-comment] 생성 실패:", e);
    return NextResponse.json({ error: "AI 코멘트 생성 실패" }, { status: 500 });
  }
}
