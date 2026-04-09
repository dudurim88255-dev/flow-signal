import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  verification: {
    google: "de9TSsBBneQps0DJ0It1vzBsUTeGLGOoqqjAvSsx3fI",
    other: { "naver-site-verification": ["a83e693a06b5dee208d14bce510bef9c655a2be2"] },
  },
  title: "FlowSignal — 한국 개인 투자자 AI 주식 시그널",
  description: "코스피·미국주식·코인을 한 화면에서. AI 기반 FlowScore로 매수 타이밍을 포착합니다. 삼성전자, 엔비디아, 비트코인 등 70개 종목 실시간 분석.",
  keywords: ["주식 시그널", "코스피 분석", "투자 AI", "FlowScore", "동학개미", "주식 매수 타이밍", "미국주식 분석", "코인 분석", "주식 추천"],
  metadataBase: new URL("https://flow-signal.vercel.app"),
  openGraph: {
    title: "FlowSignal — 한국 개인 투자자 AI 주식 시그널",
    description: "코스피·미국주식·코인을 한 화면에서. AI 기반 FlowScore로 매수 타이밍을 포착합니다.",
    url: "https://flow-signal.vercel.app",
    siteName: "FlowSignal",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FlowSignal — AI 주식 시그널",
    description: "코스피·미국주식·코인 70개 종목 실시간 FlowScore 분석",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={jetbrainsMono.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
