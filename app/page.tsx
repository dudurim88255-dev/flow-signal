"use client";
import Link from "next/link";

const T = {
  bg: "#0B0E14",
  sf: "#111827",
  bd: "#1E2536",
  tx: "#E8ECF4",
  tx2: "#8892A4",
  pri: "#4F8EF7",
  ok: "#34D399",
  dn: "#F87171",
  wn: "#FBBF24",
  pu: "#A78BFA",
  sfEl: "#1A2236",
};
const FT = "'Pretendard Variable', Pretendard, sans-serif";
const MO = "ui-monospace, 'SF Mono', monospace";

const FEATURES = [
  {
    icon: "📊",
    title: "FlowScore 엔진",
    desc: "모멘텀·RSI·거래량·추세 4개 지표를 100점으로 통합. 복잡한 차트 없이 한눈에 파악.",
  },
  {
    icon: "🤖",
    title: "AI 투자 코멘트",
    desc: "Claude AI가 종목별 데이터를 분석해 3~4문장의 핵심 코멘트를 자동 생성.",
  },
  {
    icon: "🔥",
    title: "섹터 히트맵",
    desc: "코스피·미국·코인 전 섹터의 흐름을 색상으로 즉시 확인. 강세 섹터를 놓치지 마세요.",
  },
  {
    icon: "📈",
    title: "백테스팅",
    desc: "FlowScore 전략을 90일 실제 데이터로 시뮬레이션. 수익률 vs 단순 보유 비교.",
  },
  {
    icon: "💼",
    title: "포트폴리오 추적",
    desc: "보유 종목의 손익·자산 배분을 실시간으로 관리. FlowScore 경고도 즉시 확인.",
  },
  {
    icon: "🔔",
    title: "가격·점수 알림",
    desc: "목표 가격 또는 FlowScore 도달 시 즉시 알림. 원하는 타이밍을 놓치지 않습니다.",
  },
];

const MARKETS = [
  { label: "코스피", count: "15종목", color: T.pri },
  { label: "미국 주식", count: "10종목", color: T.ok },
  { label: "암호화폐", count: "8종목", color: T.pu },
];

const MOCKSCORES = [
  { name: "삼성전자", score: 78, grade: "매수", change: "+1.4%", color: T.ok },
  { name: "NVIDIA", score: 85, grade: "강매수", change: "+3.2%", color: T.ok },
  { name: "Bitcoin", score: 62, grade: "매수", change: "+0.8%", color: T.ok },
  { name: "SK하이닉스", score: 41, grade: "관망", change: "-0.6%", color: T.wn },
];

export default function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.tx, fontFamily: FT }}>

      {/* 네비게이션 */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: `${T.bg}ee`, backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.bd}`,
        padding: "0 24px",
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <span style={{ fontFamily: FT, fontWeight: 700, fontSize: 18, letterSpacing: "-0.5px" }}>
              Flow<span style={{ color: T.pri }}>Signal</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/pricing" style={{
              fontFamily: MO, fontSize: 12, color: T.tx2,
              padding: "6px 14px",
            }}>
              요금제
            </Link>
            <Link href="/dashboard" style={{
              fontFamily: MO, fontSize: 12, color: T.bg,
              background: T.pri, borderRadius: 8,
              padding: "7px 18px", fontWeight: 600,
            }}>
              대시보드 →
            </Link>
          </div>
        </div>
      </nav>

      {/* 히어로 */}
      <section style={{
        maxWidth: 1100, margin: "0 auto",
        padding: "80px 24px 60px",
        textAlign: "center",
      }}>
        <div style={{
          display: "inline-block",
          fontFamily: MO, fontSize: 11,
          color: T.pri, background: `${T.pri}18`,
          borderRadius: 20, padding: "4px 14px",
          marginBottom: 24, letterSpacing: "0.5px",
        }}>
          KOSPI · 미국 · 암호화폐 실시간 시그널
        </div>

        <h1 style={{
          fontFamily: FT, fontSize: "clamp(32px, 6vw, 60px)",
          fontWeight: 800, lineHeight: 1.15,
          letterSpacing: "-1.5px", marginBottom: 24,
        }}>
          복잡한 차트 말고<br />
          <span style={{ color: T.pri }}>점수 하나</span>로 종목을 읽는다
        </h1>

        <p style={{
          fontSize: 16, color: T.tx2, lineHeight: 1.7,
          maxWidth: 520, margin: "0 auto 40px",
        }}>
          FlowScore는 모멘텀·RSI·거래량·추세를 100점으로 압축합니다.<br />
          AI 코멘트, 백테스팅, 포트폴리오 추적까지 — 한 곳에서.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/dashboard" style={{
            fontFamily: MO, fontSize: 14, fontWeight: 700,
            color: T.bg, background: T.pri,
            borderRadius: 12, padding: "14px 32px",
            display: "inline-block",
          }}>
            무료로 시작하기 →
          </Link>
          <Link href="/pricing" style={{
            fontFamily: MO, fontSize: 14,
            color: T.tx2, background: T.sfEl,
            border: `1px solid ${T.bd}`,
            borderRadius: 12, padding: "14px 32px",
            display: "inline-block",
          }}>
            요금제 보기
          </Link>
        </div>

        {/* 마켓 뱃지 */}
        <div style={{
          display: "flex", gap: 10, justifyContent: "center",
          marginTop: 40, flexWrap: "wrap",
        }}>
          {MARKETS.map((m) => (
            <div key={m.label} style={{
              fontFamily: MO, fontSize: 12,
              background: `${m.color}15`, color: m.color,
              border: `1px solid ${m.color}30`,
              borderRadius: 20, padding: "5px 14px",
            }}>
              {m.label} <span style={{ opacity: 0.7 }}>{m.count}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 목업 카드 */}
      <section style={{ maxWidth: 600, margin: "0 auto", padding: "0 24px 80px" }}>
        <div style={{
          background: T.sf, border: `1px solid ${T.bd}`,
          borderRadius: 20, padding: "24px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        }}>
          <div style={{
            fontFamily: MO, fontSize: 11, color: T.tx2,
            marginBottom: 16, display: "flex", justifyContent: "space-between",
          }}>
            <span>종목</span>
            <span>FlowScore · 등락</span>
          </div>
          {MOCKSCORES.map((s) => (
            <div key={s.name} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 0",
              borderBottom: `1px solid ${T.bd}`,
            }}>
              <span style={{ fontFamily: FT, fontWeight: 600, fontSize: 15 }}>{s.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{
                  fontFamily: MO, fontSize: 11,
                  color: s.color, background: `${s.color}18`,
                  borderRadius: 6, padding: "3px 10px",
                }}>
                  {s.grade}
                </span>
                <span style={{
                  fontFamily: MO, fontSize: 13, fontWeight: 700, color: s.color,
                  minWidth: 56, textAlign: "right",
                }}>
                  {s.score}점
                </span>
                <span style={{ fontFamily: MO, fontSize: 12, color: T.ok, minWidth: 50, textAlign: "right" }}>
                  {s.change}
                </span>
              </div>
            </div>
          ))}
          <div style={{
            marginTop: 16, textAlign: "center",
            fontFamily: MO, fontSize: 11, color: T.tx2,
          }}>
            실시간 데이터 · 매 5분 갱신
          </div>
        </div>
      </section>

      {/* 기능 그리드 */}
      <section style={{
        maxWidth: 1100, margin: "0 auto",
        padding: "0 24px 80px",
      }}>
        <h2 style={{
          fontFamily: FT, fontSize: "clamp(22px, 4vw, 36px)",
          fontWeight: 700, textAlign: "center",
          marginBottom: 48, letterSpacing: "-0.5px",
        }}>
          투자 판단에 필요한 것,<br />
          <span style={{ color: T.pri }}>전부 여기에</span>
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16,
        }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{
              background: T.sf, border: `1px solid ${T.bd}`,
              borderRadius: 16, padding: "24px",
            }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                {f.title}
              </div>
              <div style={{ fontFamily: FT, fontSize: 14, color: T.tx2, lineHeight: 1.6 }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA 배너 */}
      <section style={{
        maxWidth: 1100, margin: "0 auto",
        padding: "0 24px 100px",
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${T.pri}22, ${T.pu}18)`,
          border: `1px solid ${T.pri}40`,
          borderRadius: 24, padding: "60px 40px",
          textAlign: "center",
        }}>
          <h2 style={{
            fontFamily: FT, fontSize: "clamp(22px, 4vw, 36px)",
            fontWeight: 700, marginBottom: 16, letterSpacing: "-0.5px",
          }}>
            지금 바로 FlowScore를 확인하세요
          </h2>
          <p style={{ color: T.tx2, fontSize: 15, marginBottom: 32 }}>
            가입 없이 무료로 시작 · 카드 불필요
          </p>
          <Link href="/dashboard" style={{
            fontFamily: MO, fontSize: 15, fontWeight: 700,
            color: T.bg, background: T.pri,
            borderRadius: 12, padding: "16px 40px",
            display: "inline-block",
          }}>
            대시보드 열기 →
          </Link>
        </div>
      </section>

      {/* 푸터 */}
      <footer style={{
        borderTop: `1px solid ${T.bd}`,
        padding: "24px",
        textAlign: "center",
      }}>
        <p style={{ fontFamily: MO, fontSize: 11, color: T.tx2 }}>
          © 2025 FlowSignal · 본 서비스는 투자 참고용이며 투자 결정의 책임은 본인에게 있습니다.
        </p>
      </footer>

    </div>
  );
}
