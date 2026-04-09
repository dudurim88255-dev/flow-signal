import { NextResponse } from "next/server";
import { KOSPI_STOCKS, US_STOCKS, CRYPTO_COINS } from "@/lib/stocks";

export const revalidate = 0;

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const baseUrl = new URL(req.url).origin;
  const symbols = [
    ...KOSPI_STOCKS.map((s) => s.symbol),
    ...US_STOCKS.map((s) => s.symbol),
    ...CRYPTO_COINS.map((s) => s.symbol),
  ];

  const results = await Promise.allSettled(
    symbols.map((sym) =>
      fetch(`${baseUrl}/api/stock/${encodeURIComponent(sym)}`, {
        // 캐시 우회 — 항상 최신 데이터로 갱신
        headers: { "Cache-Control": "no-cache" },
      })
    )
  );

  const ok = results.filter((r) => r.status === "fulfilled").length;
  const fail = results.length - ok;

  console.info(`[cron/warm-stocks] 완료: ${ok}/${symbols.length} 성공, ${fail} 실패`);
  return NextResponse.json({ warmed: ok, failed: fail, total: symbols.length });
}
