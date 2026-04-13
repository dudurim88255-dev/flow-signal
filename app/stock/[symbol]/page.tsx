import { redirect } from "next/navigation";
import { KOSPI_STOCKS, KOSDAQ_STOCKS, US_STOCKS, CRYPTO_COINS } from "@/lib/stocks";

// /stock/[symbol] 구형 URL → /score/[market]/[ticker] 영구 리디렉트

interface Props {
  params: Promise<{ symbol: string }>;
}

export default async function StockRedirect({ params }: Props) {
  const { symbol } = await params;
  const decoded = decodeURIComponent(symbol);

  // 코스피/코스닥 — .KS / .KQ 접미사 또는 목록 검색
  const koreaStock = [...KOSPI_STOCKS, ...KOSDAQ_STOCKS].find(
    (s) => s.symbol === decoded || s.symbol.replace(/\.(KS|KQ)$/, "") === decoded
  );
  if (koreaStock) {
    const code = koreaStock.symbol.replace(/\.(KS|KQ)$/, "");
    redirect(`/score/korea/${code}`);
  }

  // 미국 주식
  const usStock = US_STOCKS.find((s) => s.symbol === decoded);
  if (usStock) {
    redirect(`/score/us/${decoded}`);
  }

  // 코인 — coinId(symbol) 또는 name 기준
  const coin = CRYPTO_COINS.find((s) => s.symbol === decoded);
  if (coin) {
    redirect(`/score/crypto/${decoded}`);
  }

  // 접미사로 추측
  if (decoded.endsWith(".KS") || decoded.endsWith(".KQ")) {
    const code = decoded.replace(/\.(KS|KQ)$/, "");
    redirect(`/score/korea/${code}`);
  }

  // 기본 — 대시보드로
  redirect("/");
}
