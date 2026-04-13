import type { Metadata } from "next";

// 결제 게이트 도입 전까지 검색 색인 차단 (유료화 시 이 파일 삭제)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
