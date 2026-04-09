"use client";
import { useRouter } from "next/navigation";
import { T, FT, MO } from "@/lib/theme";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  price: string;
  period: string;
  highlight: boolean;
  color: string;
  badge?: string;
  features: PlanFeature[];
  cta: string;
}

const PLANS: Plan[] = [
  {
    name: "무료",
    price: "₩0",
    period: "영구 무료",
    highlight: false,
    color: T.tx2,
    features: [
      { text: "KOSPI·미국·코인 전체 대시보드", included: true },
      { text: "FlowScore 실시간 업데이트", included: true },
      { text: "섹터 히트맵", included: true },
      { text: "검색 / 필터 / 정렬", included: true },
      { text: "종목 상세 차트 (90일)", included: true },
      { text: "AI 투자 코멘트", included: false },
      { text: "알림 설정 (준비 중)", included: false },
      { text: "포트폴리오 추적 (준비 중)", included: false },
    ],
    cta: "지금 시작",
  },
  {
    name: "프리미엄",
    price: "₩4,900",
    period: "월",
    highlight: true,
    color: T.pri,
    badge: "인기",
    features: [
      { text: "무료 플랜 모든 기능", included: true },
      { text: "AI 투자 코멘트 (Claude 분석)", included: true },
      { text: "무제한 종목 상세 조회", included: true },
      { text: "알림 설정 (준비 중)", included: true },
      { text: "포트폴리오 추적 (준비 중)", included: true },
      { text: "백테스팅 (준비 중)", included: true },
      { text: "우선 고객지원", included: true },
      { text: "신기능 얼리 액세스", included: true },
    ],
    cta: "프리미엄 시작",
  },
];

function CheckIcon({ ok }: { ok: boolean }) {
  return (
    <span style={{
      fontSize: 14,
      color: ok ? T.ok : T.bd,
      flexShrink: 0,
    }}>
      {ok ? "✓" : "✕"}
    </span>
  );
}

export default function PricingPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.tx }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 16px 80px" }}>

        {/* 뒤로 */}
        <button
          onClick={() => router.back()}
          style={{
            fontFamily: MO, fontSize: 12, color: T.tx2,
            background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4,
            padding: "4px 0", marginBottom: 32,
          }}
        >
          ← 돌아가기
        </button>

        {/* 헤더 */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1 style={{ fontFamily: FT, fontSize: 28, fontWeight: 800, margin: "0 0 12px", letterSpacing: -0.5 }}>
            플랜 선택
          </h1>
          <p style={{ fontFamily: MO, fontSize: 14, color: T.tx2, margin: 0 }}>
            무료로 시작하고, 더 깊은 분석이 필요할 때 업그레이드하세요.
          </p>
        </div>

        {/* 플랜 카드 */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}>
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              style={{
                background: T.sf,
                border: `1px solid ${plan.highlight ? plan.color : T.bd}`,
                borderRadius: 20,
                padding: "28px 24px",
                position: "relative",
                boxShadow: plan.highlight ? `0 0 0 1px ${plan.color}44, 0 8px 24px ${plan.color}18` : "none",
              }}
            >
              {/* 인기 뱃지 */}
              {plan.badge && (
                <span style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  fontFamily: MO, fontSize: 11, fontWeight: 700,
                  background: plan.color, color: T.bg,
                  borderRadius: 20, padding: "3px 14px",
                  whiteSpace: "nowrap",
                }}>
                  {plan.badge}
                </span>
              )}

              {/* 플랜명 */}
              <div style={{ fontFamily: FT, fontSize: 16, fontWeight: 700, color: plan.highlight ? plan.color : T.tx, marginBottom: 4 }}>
                {plan.name}
              </div>

              {/* 가격 */}
              <div style={{ marginBottom: 24 }}>
                <span style={{ fontFamily: FT, fontSize: 32, fontWeight: 800, color: T.tx }}>{plan.price}</span>
                {plan.period !== "영구 무료" && (
                  <span style={{ fontFamily: MO, fontSize: 13, color: T.tx2 }}>/{plan.period}</span>
                )}
                {plan.period === "영구 무료" && (
                  <div style={{ fontFamily: MO, fontSize: 11, color: T.tx2, marginTop: 4 }}>{plan.period}</div>
                )}
              </div>

              {/* 기능 목록 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                {plan.features.map((f) => (
                  <div key={f.text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CheckIcon ok={f.included} />
                    <span style={{ fontFamily: MO, fontSize: 12, color: f.included ? T.tx : T.tx2 }}>
                      {f.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA 버튼 */}
              <button
                onClick={() => plan.highlight
                  ? alert("결제 기능 준비 중입니다. 조금만 기다려 주세요!")
                  : router.push("/dashboard")
                }
                style={{
                  width: "100%",
                  fontFamily: FT, fontSize: 14, fontWeight: 700,
                  color: plan.highlight ? T.bg : T.tx,
                  background: plan.highlight ? plan.color : "transparent",
                  border: `1px solid ${plan.highlight ? plan.color : T.bd}`,
                  borderRadius: 10, padding: "12px 0",
                  cursor: "pointer",
                  transition: "opacity 0.15s",
                }}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* 안내 문구 */}
        <div style={{ textAlign: "center", marginTop: 40, fontFamily: MO, fontSize: 11, color: T.tx2 }}>
          FlowSignal은 투자 참고용 정보를 제공합니다. 투자 결정은 본인 책임입니다.
        </div>
      </div>
    </div>
  );
}
