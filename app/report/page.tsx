"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type WeeklyReport = {
  weekKey: string;
  generatedAt: string;
  text: string;
  inputTokens: number;
  outputTokens: number;
};

export default function ReportPage() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/report")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setReport(data);
        }
      })
      .catch(() => setError("리포트를 불러오지 못했습니다"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e0e0e0", fontFamily: "var(--font-mono)" }}>
      {/* 헤더 */}
      <header style={{ borderBottom: "1px solid #1e1e1e", padding: "16px 24px", display: "flex", alignItems: "center", gap: "16px" }}>
        <Link href="/" style={{ color: "#666", textDecoration: "none", fontSize: "14px" }}>
          ← 홈
        </Link>
        <span style={{ color: "#333" }}>|</span>
        <span style={{ color: "#00ff88", fontSize: "14px", fontWeight: 600 }}>FlowSignal</span>
        <span style={{ color: "#555", fontSize: "14px" }}>주간 AI 리포트</span>
      </header>

      <main style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ color: "#00ff88", fontSize: "13px", letterSpacing: "0.1em" }}>리포트 로딩 중...</div>
          </div>
        )}

        {error && !loading && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: "32px", marginBottom: "16px" }}>📭</div>
            <div style={{ color: "#666", fontSize: "14px", marginBottom: "8px" }}>{error}</div>
            <div style={{ color: "#444", fontSize: "12px" }}>
              매주 일요일 오전 13시(KST)에 자동 생성됩니다
            </div>
          </div>
        )}

        {report && !loading && (
          <>
            {/* 메타 정보 */}
            <div style={{ marginBottom: "40px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "8px" }}>
                <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#fff" }}>
                  주간 AI 분석 리포트
                </h1>
                <span style={{
                  background: "#00ff8820",
                  color: "#00ff88",
                  border: "1px solid #00ff8840",
                  borderRadius: "4px",
                  padding: "2px 8px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}>
                  {report.weekKey}
                </span>
              </div>
              <div style={{ color: "#444", fontSize: "12px" }}>
                생성: {new Date(report.generatedAt).toLocaleString("ko-KR", {
                  year: "numeric", month: "long", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
                &nbsp;·&nbsp;
                Claude Haiku
                &nbsp;·&nbsp;
                {((report.inputTokens ?? 0) + (report.outputTokens ?? 0)).toLocaleString()} tokens
              </div>
            </div>

            {/* 구분선 */}
            <div style={{ height: "1px", background: "linear-gradient(to right, #00ff8840, #00ff8810, transparent)", marginBottom: "40px" }} />

            {/* 리포트 본문 */}
            <article style={{ lineHeight: 1.9, color: "#ccc", fontSize: "15px" }}>
              {report.text.split("\n\n").filter(Boolean).map((paragraph, i) => (
                <p key={i} style={{ marginBottom: "24px", marginTop: 0 }}>
                  {paragraph}
                </p>
              ))}
            </article>

            {/* 하단 안내 */}
            <div style={{
              marginTop: "60px",
              padding: "20px",
              border: "1px solid #1e1e1e",
              borderRadius: "8px",
              background: "#111",
            }}>
              <div style={{ color: "#555", fontSize: "12px", lineHeight: 1.7 }}>
                ⚠️ 이 리포트는 AI가 자동 생성한 분석이며 투자 권유가 아닙니다.
                모든 투자 판단과 책임은 투자자 본인에게 있습니다.
              </div>
            </div>

            {/* 네비게이션 */}
            <div style={{ marginTop: "40px", display: "flex", gap: "12px" }}>
              <Link href="/dashboard" style={{
                padding: "10px 20px",
                background: "#00ff8815",
                border: "1px solid #00ff8840",
                borderRadius: "6px",
                color: "#00ff88",
                textDecoration: "none",
                fontSize: "13px",
              }}>
                시장 대시보드 →
              </Link>
              <Link href="/" style={{
                padding: "10px 20px",
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "6px",
                color: "#888",
                textDecoration: "none",
                fontSize: "13px",
              }}>
                종목 검색
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
