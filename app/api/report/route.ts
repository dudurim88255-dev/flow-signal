/**
 * GET /api/report?week=2025-W15
 * 주간 AI 리포트 조회 — Redis에서 narrate cron이 저장한 리포트 반환
 * week 파라미터 없으면 최신 리포트 자동 탐색 (최근 4주)
 */

import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";

function getWeekKey(offsetWeeks = 0): string {
  const now = new Date();
  now.setDate(now.getDate() - offsetWeeks * 7);
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7
  );
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const weekParam = searchParams.get("week");
  const redis = getRedis();

  if (weekParam) {
    const raw = await redis.get(`report:weekly:${weekParam}`);
    if (!raw) {
      return NextResponse.json({ error: "리포트 없음", weekKey: weekParam }, { status: 404 });
    }
    return NextResponse.json(JSON.parse(raw as string));
  }

  // week 미지정 → 최근 4주 탐색
  for (let offset = 0; offset < 4; offset++) {
    const weekKey = getWeekKey(offset);
    const raw = await redis.get(`report:weekly:${weekKey}`);
    if (raw) {
      return NextResponse.json(JSON.parse(raw as string));
    }
  }

  return NextResponse.json({ error: "아직 생성된 리포트가 없습니다" }, { status: 404 });
}
