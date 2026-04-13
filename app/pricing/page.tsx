"use client";

export default function PricingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0D1117",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-mono), monospace",
        color: "#E6EDF3",
        textAlign: "center",
        padding: "40px 20px",
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 16 }}>🚀</div>
      <div
        style={{
          fontSize: 11,
          color: "#3FB950",
          background: "#3FB95018",
          border: "1px solid #3FB95044",
          borderRadius: 20,
          padding: "4px 14px",
          marginBottom: 20,
          letterSpacing: 1,
        }}
      >
        BETA
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
        베타 기간 무료 운영 중
      </h1>
      <p
        style={{
          fontSize: 13,
          color: "#8B949E",
          maxWidth: 400,
          lineHeight: 1.8,
          marginBottom: 32,
        }}
      >
        FlowSignal은 현재 베타 서비스로 모든 기능을 무료로 제공합니다.
        <br />
        향후 요금제 도입 시 사전에 공지합니다.
      </p>
      <a
        href="/"
        style={{
          fontSize: 13,
          color: "#388BFD",
          background: "#388BFD18",
          border: "1px solid #388BFD44",
          borderRadius: 8,
          padding: "8px 20px",
          textDecoration: "none",
        }}
      >
        ← 홈으로 돌아가기
      </a>
    </div>
  );
}
