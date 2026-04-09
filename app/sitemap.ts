import { MetadataRoute } from "next";
import { KOSPI_STOCKS, US_STOCKS, CRYPTO_COINS } from "@/lib/stocks";

const BASE_URL = "https://flow-signal.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const allStocks = [...KOSPI_STOCKS, ...US_STOCKS, ...CRYPTO_COINS];

  const stockPages = allStocks.map((s) => ({
    url: `${BASE_URL}/stock/${encodeURIComponent(s.symbol)}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    ...stockPages,
  ];
}
