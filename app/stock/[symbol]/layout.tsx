import { Metadata } from "next";
import { KOSPI_STOCKS, US_STOCKS, CRYPTO_COINS } from "@/lib/stocks";

const ALL_STOCKS = [...KOSPI_STOCKS, ...US_STOCKS, ...CRYPTO_COINS];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  const decoded = decodeURIComponent(symbol);
  const stock = ALL_STOCKS.find((s) => s.symbol === decoded);

  if (!stock) {
    return { title: "FlowSignal" };
  }

  const title = `${stock.name} (${stock.symbol.replace(".KS", "")}) AI 시그널 — FlowSignal`;
  const description = `${stock.name} FlowScore 실시간 분석. ${stock.sector} 섹터 매수·매도 타이밍을 AI가 포착합니다.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://flow-signal.vercel.app/stock/${symbol}`,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default function StockLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
