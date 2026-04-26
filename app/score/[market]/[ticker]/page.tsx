"use client";

/**
 * /score/[market]/[ticker] — 종목 신호 상세 페이지 v5
 * 모바일 우선 (380px) 디자인 — docs/design/SCORE_PAGE.md 토큰 기반.
 * 헤더 카드: 점수 도넛 + 가격 + 진입 영역 + AI 해설 통합.
 */

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAlerts, requestNotificationPermission, fireNotification } from "@/lib/alerts";

// ─── 타입 ────────────────────────────────────────────────────────────────────

type SignalScore = {
  id: string;
  name: string;
  score: number;
  weight: number;
  live: boolean;
};

type MacroIndicator = {
  id: string;
  label: string;
  value: number;
  unit: string;
  prev7d: number | null;
  change7d: number | null;
  positiveIsGood: boolean;
  description: string;
};

type MacroContextData = {
  market: string;
  indicators: MacroIndicator[];
  fetchedAt: string;
  cached: boolean;
};

type EntryZoneStatus = "in_zone" | "pending_pullback" | "no_recommendation";
type EntryZone = {
  status: EntryZoneStatus;
  lower: number | null;
  upper: number | null;
  ma20: number;
  sigma: number;
  reason: string;
};

type ResultMeta = {
  score: number;
  label: string;
  liveCount: number;
  totalCount: number;
  evaluatedAt: string;
  modelVersion: string;
  confidenceScore: number;
  confidenceLabel?: "high" | "med" | "low";
  price: number;
  ret7d: number | null;
  ret30d: number | null;
  spark: number[];
  name: string;
  cached: boolean;
  risk_flags?: string[];
  entryZone?: EntryZone | null;
  history7d?: number[];
};

// ─── 시그널 그룹 ─────────────────────────────────────────────────────────────

type GroupDef = { label: string; ids: string[] };

const SIGNAL_GROUPS: Record<string, GroupDef[]> = {
  crypto: [
    { label: "온체인 / 수급", ids: ["C1", "C2", "C3", "C9", "C10"] },
    { label: "파생 / 포지셔닝", ids: ["C4", "C5", "C6"] },
    { label: "심리", ids: ["C7"] },
    { label: "기술적 분석", ids: ["C8", "C11", "C12"] },
  ],
  korea: [
    { label: "수급 흐름", ids: ["K1", "K2", "K3", "K4", "K8"] },
    { label: "리스크 지표", ids: ["K5", "K6", "K7"] },
    { label: "기술적 분석", ids: ["K9", "K10", "K11", "K12"] },
  ],
  us: [
    { label: "수급 / 단기 모멘텀", ids: ["U1", "U2", "U3", "U4"] },
    { label: "기술적 분석", ids: ["U5", "U6", "U7", "U8"] },
    { label: "시장 맥락", ids: ["U9", "U10", "U11", "U12"] },
  ],
};

// 한국 dormant 신호 — K1~K8 미수집 (메모리 28)
const KOREA_DORMANT_IDS = ["K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8"];

// ─── 토큰 헬퍼 ───────────────────────────────────────────────────────────────

/** 점수 → SCORE_PAGE.md §6 의 시그널 토큰 (text/bg/border 클래스 prefix 용) */
function scoreToToken(score: number): "strong-buy" | "buy" | "neutral" | "sell" | "strong-sell" {
  if (score >= 80) return "strong-buy";
  if (score >= 60) return "buy";
  if (score >= 40) return "neutral";
  if (score >= 20) return "sell";
  return "strong-sell";
}

/** 점수 → SCORE_PAGE.md hex (SVG / inline style 용) */
function scoreToHex(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#34d399";
  if (score >= 40) return "#6b7280";
  if (score >= 20) return "#f87171";
  return "#dc2626";
}

function pctColor(v: number | null): string {
  if (v == null) return "text-fg-tertiary";
  if (v > 0) return "text-signal-buy";
  if (v < 0) return "text-signal-sell";
  return "text-fg-tertiary";
}

function pctStr(v: number | null): string {
  if (v == null) return "–";
  return (v > 0 ? "+" : "") + v.toFixed(1) + "%";
}

function formatPrice(market: string, price: number): string {
  if (market === "korea") return `${Math.round(price).toLocaleString("ko-KR")}원`;
  return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

// ─── CircleGauge ─────────────────────────────────────────────────────────────

function CircleGauge({ score, label, animating }: { score: number; label: string; animating: boolean }) {
  const R = 48;
  const C = 2 * Math.PI * R;
  const fill = animating ? (score / 100) * C : 0;
  const color = scoreToHex(score);

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 124, height: 124 }}>
      <svg width="124" height="124" viewBox="0 0 124 124">
        <circle cx="62" cy="62" r={R} fill="none" stroke="rgb(31 32 36)" strokeWidth="10" />
        <circle
          cx="62" cy="62" r={R}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${C}`}
          strokeDashoffset={`${C - fill}`}
          transform="rotate(-90 62 62)"
          style={{ transition: animating ? "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)" : "none" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-medium tabular-nums leading-none" style={{ fontSize: 32, color: "rgb(231 231 233)" }}>{score}</span>
        <span className="mt-1 font-medium tracking-wide" style={{ fontSize: 11, color }}>{label}</span>
      </div>
    </div>
  );
}

// ─── SparkLine (가격) ────────────────────────────────────────────────────────

function SparkLine({ prices }: { prices: number[] }) {
  if (prices.length < 2) return null;
  const w = 110, h = 32, pad = 2;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const pts = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  const isUp = prices[prices.length - 1] >= prices[0];
  const color = isUp ? "#34d399" : "#f87171";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

// ─── EntryZoneCard ───────────────────────────────────────────────────────────

function EntryZoneCard({ zone, market }: { zone: EntryZone; market: string }) {
  if (zone.status === "no_recommendation") return null;

  const isInZone = zone.status === "in_zone";
  const tokenBg = isInZone ? "bg-signal-buy/10" : "bg-pending/10";
  const tokenBorder = isInZone ? "border-signal-buy/30" : "border-pending/30";
  const tokenText = isInZone ? "text-signal-buy" : "text-pending";
  const icon = isInZone ? "✓" : "⚠";
  const labelText = isInZone ? "즉시 진입권" : "되돌림 대기";

  const lowerStr = zone.lower != null ? formatPrice(market, zone.lower) : "–";
  const upperStr = zone.upper != null ? formatPrice(market, zone.upper) : "–";

  return (
    <div className={`px-3 py-2.5 rounded border ${tokenBg} ${tokenBorder}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-caption font-medium ${tokenText}`}>진입 영역</span>
        <span className={`text-caption font-medium ${tokenText} flex items-center gap-1`}>
          <span>{icon}</span>
          <span>{labelText}</span>
        </span>
      </div>
      <p className="text-body text-fg-primary tabular-nums">
        {lowerStr} ~ {upperStr}
      </p>
      <p className="text-caption text-fg-secondary mt-0.5">{zone.reason}</p>
    </div>
  );
}

// ─── AISummaryInline ─────────────────────────────────────────────────────────

/**
 * 자동 한 줄 요약 (heuristic, AI 호출 없음).
 *  - top driver = max(|score - 50| * weight)
 *  - 점수 밴드 + top driver name + entryZone 결합 → 한국어 한 문장.
 *  - AI 해설 더 보기 버튼은 별도 lazy-load (full prompt 호출).
 */
function buildHeuristicSummary(
  result: ResultMeta,
  signals: SignalScore[]
): string {
  if (signals.length === 0) {
    return `점수 ${Math.round(result.score)} — 신호 분석 데이터 부족.`;
  }
  // top driver
  const top = [...signals]
    .map((s) => ({ ...s, impact: Math.abs(s.score - 50) * s.weight }))
    .sort((a, b) => b.impact - a.impact)[0];

  const score = Math.round(result.score);
  const ez = result.entryZone;

  // 점수 밴드별 톤
  let tone = "";
  if (score >= 80) tone = `강한 매수 우위 — ${top.name} 신호가 견인`;
  else if (score >= 60) tone = `매수 우위 — ${top.name} 양호`;
  else if (score >= 40) tone = `혼조 — 명확한 방향성 부족 (${top.name} 비중 큼)`;
  else if (score >= 20) tone = `매도 우위 — ${top.name} 약세`;
  else tone = `강한 매도 — ${top.name} 약세 신호 강함`;

  // entryZone 보강
  if (ez?.status === "pending_pullback") {
    tone += ". 단기 과열, 되돌림 대기 권고";
  } else if (ez?.status === "in_zone") {
    tone += ". 현재가 진입 권장 영역 내";
  }
  return tone + ".";
}

function AISummaryInline({ market, ticker, result, signals }: {
  market: string;
  ticker: string;
  result: ResultMeta;
  signals: SignalScore[];
}) {
  const [aiComment, setAiComment] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOpened, setAiOpened] = useState(false);

  // 자동 요약 — 신호 6개 이상 모이면 즉시 생성
  const heuristic = signals.length >= 1 ? buildHeuristicSummary(result, signals) : null;

  const fetchFullAI = async () => {
    if (aiComment || aiLoading) return;
    setAiOpened(true);
    setAiLoading(true);

    const groupDefs = SIGNAL_GROUPS[market] ?? [];
    const components: Record<string, number> = {};
    for (const g of groupDefs) {
      const vals = signals.filter((s) => g.ids.includes(s.id)).map((s) => s.score);
      components[g.label] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 50;
    }
    const compArr = Object.entries(components).map(([k, v]) => `${k}: ${v.toFixed(0)}`);

    try {
      const res = await fetch(`/api/ai-comment/${encodeURIComponent(ticker)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: result.name, symbol: ticker, market, score: result.score, grade: result.label,
          change1d: 0, p7d: result.ret7d ?? 0, p30d: result.ret30d ?? 0, rsi: 0, volRatio: 0,
          signals: signals.slice(0, 5).map((s) => `${s.name}(${s.score.toFixed(0)})`),
          components: { momentum: 0, technical: 0, volume: 0, trend: 0,
            ...Object.fromEntries(compArr.map((s) => s.split(": "))) },
        }),
      });
      if (!res.ok) throw new Error();
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const json = await res.json();
        setAiComment(json.comment);
        setAiLoading(false);
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setAiComment(text);
      }
      setAiLoading(false);
    } catch {
      setAiComment("AI 코멘트를 불러오지 못했습니다.");
      setAiLoading(false);
    }
  };

  return (
    <div className="border-l-[3px] border-ai pl-3 py-1.5 space-y-1.5">
      <p className="text-micro text-ai font-medium">AI 해설</p>
      {heuristic && (
        <p className="text-body text-fg-primary leading-relaxed">{heuristic}</p>
      )}
      {aiOpened && (
        <div className="pt-1.5 border-t border-ai/20">
          {aiLoading && !aiComment && (
            <p className="text-body text-fg-secondary">상세 분석 중…</p>
          )}
          {aiComment && (
            <p className="text-body text-fg-primary leading-relaxed">{aiComment}</p>
          )}
        </div>
      )}
      {!aiOpened && signals.length >= 6 && (
        <button
          onClick={fetchFullAI}
          className="text-caption text-ai hover:opacity-80 transition-opacity"
        >
          상세 분석 보기 →
        </button>
      )}
    </div>
  );
}

// ─── ScoreHistorySparkline (FlowScore 7d) ───────────────────────────────────

function ScoreHistorySparkline({ history, currentScore }: { history: number[]; currentScore: number }) {
  const HISTORY_TARGET = 7;
  const count = history?.length ?? 0;

  // 0 ~ 6 일치만 누적 시 placeholder + 진행률
  if (count < HISTORY_TARGET) {
    const sparkColor = scoreToHex(currentScore);
    return (
      <div className="px-4 py-3 rounded-lg bg-bg-card border border-border-subtle">
        <div className="flex items-center justify-between mb-2">
          <p className="text-caption text-fg-secondary">FlowScore 7일 추이</p>
          <span className="text-caption text-fg-tertiary tabular-nums">
            {count}/{HISTORY_TARGET}일
          </span>
        </div>
        <p className="text-body text-fg-tertiary mb-2">
          추이 데이터 누적 중 — {HISTORY_TARGET - count}일 더 필요
        </p>
        {/* 진행률 바 */}
        <div className="h-1 bg-bg-primary rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full"
            style={{ width: `${(count / HISTORY_TARGET) * 100}%`, backgroundColor: sparkColor, opacity: 0.5 }}
          />
        </div>
        {/* 누적된 점수 점들 (있을 경우) */}
        {count > 0 && (
          <div className="flex items-end justify-between h-10 gap-1.5">
            {Array.from({ length: HISTORY_TARGET }).map((_, i) => {
              const filled = i < count;
              const score = filled ? history[i] : null;
              const dotH = score != null ? Math.max((score / 100) * 36, 4) : 4;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full max-w-[20px] rounded-sm"
                    style={{
                      height: dotH,
                      backgroundColor: filled ? sparkColor : "rgb(31 32 36)",
                      opacity: filled ? 1 : 0.6,
                    }}
                  />
                  <span className="text-micro text-fg-tertiary tabular-nums leading-none">
                    {filled ? Math.round(score!) : "·"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const w = 280, h = 64, pad = 8;
  const max = 100, min = 0;
  const points = history.map((s, i) => {
    const x = pad + (i / Math.max(history.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - ((s - min) / (max - min)) * (h - pad * 2);
    return { x, y, score: s };
  });

  const trend = history[history.length - 1] - history[0];
  const lineColor = scoreToHex(currentScore);
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath = `M${points[0].x},${h - pad} L${polyline.split(" ").join(" L")} L${points[points.length - 1].x},${h - pad} Z`;

  return (
    <div className="px-4 py-3 rounded-lg bg-bg-card border border-border-subtle">
      <div className="flex items-center justify-between mb-2">
        <p className="text-caption text-fg-secondary">FlowScore 7일 추이</p>
        <span className={`text-caption tabular-nums ${trend >= 0 ? "text-signal-buy" : "text-signal-sell"}`}>
          {trend >= 0 ? "+" : ""}{trend.toFixed(0)}
        </span>
      </div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <path d={areaPath} fill={lineColor} opacity="0.15" />
        <polyline points={polyline} fill="none" stroke={lineColor}
          strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="2.5" fill={lineColor} />
            <text x={p.x} y={p.y - 6} textAnchor="middle" fontSize="9"
              fill="rgb(156 156 160)" className="tabular-nums">
              {Math.round(p.score)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── MacroCard (2x2) ─────────────────────────────────────────────────────────

function MacroCard({ market }: { market: string }) {
  const [data, setData] = useState<MacroContextData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(null); setLoading(true);
    fetch(`/api/macro-context?market=${market}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json: MacroContextData) => { setData(json); setLoading(false); })
      .catch(() => setLoading(false));
  }, [market]);

  if (loading) {
    return (
      <div>
        <p className="text-caption text-fg-secondary uppercase tracking-wider mb-2">거시경제 맥락</p>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-bg-card border border-border-subtle rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.indicators.length === 0) return null;

  return (
    <div>
      <p className="text-caption text-fg-secondary uppercase tracking-wider mb-2">거시경제 맥락</p>
      <div className="grid grid-cols-2 gap-2">
        {data.indicators.map((ind) => {
          const hasChange = ind.change7d != null;
          const isPositive = hasChange && (ind.change7d ?? 0) > 0;
          const isNegative = hasChange && (ind.change7d ?? 0) < 0;
          const favorable = ind.positiveIsGood ? isPositive : isNegative;
          const adverse = ind.positiveIsGood ? isNegative : isPositive;

          // 우호/불리 — 종목 등락 색과 의도적으로 분리. 작은 점 + 라벨.
          const badgeText = favorable ? "우호" : adverse ? "불리" : null;
          const badgeColor = favorable ? "bg-signal-buy" : adverse ? "bg-signal-sell" : "bg-fg-tertiary";

          const sign = hasChange && (ind.change7d ?? 0) > 0 ? "+" : "";

          return (
            <div key={ind.id} className="p-3 bg-bg-card border border-border-subtle rounded" title={ind.description}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-caption text-fg-secondary truncate">{ind.label}</p>
                {badgeText && (
                  <span className="flex items-center gap-1 flex-shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${badgeColor}`} />
                    <span className="text-micro text-fg-secondary">{badgeText}</span>
                  </span>
                )}
              </div>
              <p className="text-h3 text-fg-primary leading-none tabular-nums">
                {ind.value.toLocaleString("ko-KR")}
                <span className="text-caption font-normal text-fg-tertiary ml-1">{ind.unit}</span>
              </p>
              {hasChange && (
                <p className="text-caption mt-1 text-fg-tertiary tabular-nums">
                  7일 {sign}{(ind.change7d ?? 0).toFixed(ind.unit === "원" ? 0 : 2)}{ind.unit}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SignalGroupCard (4 미니 막대) ──────────────────────────────────────────

function SignalGroupCard({ group, signals, market }: {
  group: GroupDef;
  signals: SignalScore[];
  market: string;
}) {
  const [open, setOpen] = useState(false);
  const groupSignals = group.ids
    .map((id) => signals.find((s) => s.id === id))
    .filter(Boolean) as SignalScore[];

  if (groupSignals.length === 0) return null;

  // 한국 dormant 신호 (K1~K8) 는 평균에서 제외
  const isKoreaDormant = (id: string) => market === "korea" && KOREA_DORMANT_IDS.includes(id);
  const activeSignals = groupSignals.filter((s) => !isKoreaDormant(s.id));
  const avg = activeSignals.length > 0
    ? activeSignals.reduce((s, g) => s + g.score, 0) / activeSignals.length
    : 0;
  const avgColor = scoreToHex(avg);

  // 미니 막대 — 그룹 안 모든 신호 (dormant 포함, 시각적으로 흐림)
  return (
    <div className="rounded-lg bg-bg-card border border-border-subtle overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3.5 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-body font-medium text-fg-primary">{group.label}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-caption text-fg-tertiary tabular-nums">
                ({activeSignals.length}/{groupSignals.length})
              </span>
              <span className="text-h3 tabular-nums" style={{ color: avgColor }}>
                {avg.toFixed(0)}
              </span>
            </div>
          </div>
          {/* 미니 막대 — title 로 신호 정식 이름 호버 표시 */}
          <div className="flex items-end gap-1 h-7">
            {groupSignals.map((s) => {
              const dormant = isKoreaDormant(s.id);
              const barColor = dormant ? "rgb(108 108 112)" : scoreToHex(s.score);
              const barH = Math.max((s.score / 100) * 24, 2);
              const tip = dormant
                ? `${s.id} ${s.name} — 데이터 미수집`
                : `${s.id} ${s.name} — ${s.score.toFixed(0)}점${s.live ? "" : " (추정)"}`;
              return (
                <div key={s.id} title={tip} className="flex-1 flex flex-col items-center gap-0.5 cursor-help">
                  <div
                    className="w-full rounded-sm"
                    style={{
                      height: barH,
                      backgroundColor: barColor,
                      opacity: dormant ? 0.4 : 1,
                    }}
                  />
                  <span className="text-micro text-fg-tertiary tabular-nums leading-none">{s.id}</span>
                </div>
              );
            })}
          </div>
        </div>
        <svg
          className={`w-4 h-4 ml-3 flex-shrink-0 text-fg-tertiary transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-3.5 py-3 bg-bg-card-elevated border-t border-border-subtle space-y-3">
          {groupSignals.map((s) => {
            const dormant = isKoreaDormant(s.id);
            const sigColor = dormant ? "rgb(108 108 112)" : scoreToHex(s.score);
            return (
              <div key={s.id} className={dormant ? "opacity-50" : ""}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-micro font-mono text-fg-tertiary w-7 flex-shrink-0">{s.id}</span>
                    <span className="text-body text-fg-primary truncate">{s.name}</span>
                    {dormant && (
                      <span className="text-micro px-1 py-0.5 bg-bg-card border border-border-subtle text-fg-tertiary rounded-sm flex-shrink-0">
                        데이터 미수집
                      </span>
                    )}
                    {!dormant && s.live && (
                      <span className="text-micro px-1 py-0.5 bg-signal-buy/10 text-signal-buy rounded-sm flex-shrink-0">
                        LIVE
                      </span>
                    )}
                    {!dormant && !s.live && (
                      <span className="text-micro px-1 py-0.5 bg-bg-card text-fg-tertiary rounded-sm flex-shrink-0">
                        추정
                      </span>
                    )}
                  </div>
                  <span className="text-body font-medium ml-2 tabular-nums" style={{ color: sigColor }}>
                    {s.score.toFixed(0)}
                  </span>
                </div>
                <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${s.score}%`, backgroundColor: sigColor, opacity: dormant ? 0.4 : 1,
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── AlertSection (기존 유지, 토큰 정리) ─────────────────────────────────────

function AlertSection({ market, ticker, result }: {
  market: string;
  ticker: string;
  result: ResultMeta;
}) {
  const { add, remove, getFor } = useAlerts();
  const [open, setOpen] = useState(false);
  const [scoreThreshold, setScoreThreshold] = useState("");
  const [alertType, setAlertType] = useState<"score_above" | "score_below">("score_above");
  const [saved, setSaved] = useState(false);

  const stockId = ticker;
  const myAlerts = getFor(stockId);

  const handleAdd = async () => {
    const val = parseFloat(scoreThreshold);
    if (isNaN(val) || val < 0 || val > 100) return;
    await requestNotificationPermission();
    add({
      stockId, name: result.name, symbol: ticker,
      market: market as "kospi" | "korea" | "us" | "crypto",
      type: alertType, value: val,
    });
    setScoreThreshold("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fireNotification(`🔔 알림 설정 완료`,
      `${result.name} FlowScore ${val}점 ${alertType === "score_above" ? "이상" : "이하"} 시 알림`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-caption text-fg-secondary uppercase tracking-wider">알림</p>
        <button
          onClick={() => setOpen(v => !v)}
          className={`text-caption px-2.5 py-1 rounded font-medium transition-colors border ${
            open
              ? "bg-bg-card border-border-subtle text-fg-secondary"
              : "bg-signal-buy/10 border-signal-buy/30 text-signal-buy hover:bg-signal-buy/20"
          }`}
        >
          {open ? "닫기" : `🔔 설정${myAlerts.length > 0 ? ` · ${myAlerts.length}` : ""}`}
        </button>
      </div>

      {myAlerts.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-2">
          {myAlerts.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-bg-card border border-border-subtle rounded px-3 py-2">
              <span className="text-body text-fg-primary">
                FlowScore <span className="font-medium tabular-nums">{a.value}</span>점 {a.type === "score_above" ? "이상" : "이하"}
              </span>
              <button onClick={() => remove(a.id)} className="text-caption text-fg-tertiary hover:text-signal-sell transition-colors">
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="p-3 bg-bg-card border border-border-subtle rounded space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={alertType}
              onChange={e => setAlertType(e.target.value as "score_above" | "score_below")}
              className="flex-shrink-0 bg-bg-card-elevated border border-border-subtle text-fg-primary text-body rounded px-2 py-1.5 outline-none"
            >
              <option value="score_above">이상</option>
              <option value="score_below">이하</option>
            </select>
            <input
              type="number" min={0} max={100}
              placeholder={`현재 ${Math.round(result.score)}점`}
              value={scoreThreshold}
              onChange={e => setScoreThreshold(e.target.value)}
              className="flex-1 bg-bg-card-elevated border border-border-subtle text-fg-primary text-body rounded px-2 py-1.5 outline-none placeholder:text-fg-tertiary"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!scoreThreshold || saved}
            className="w-full py-2 rounded text-body font-medium transition-colors bg-signal-buy hover:opacity-90 text-bg-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saved ? "✓ 저장됨" : "알림 추가"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function ScorePage() {
  const params = useParams<{ market: string; ticker: string }>();
  const { market, ticker } = params;

  const [signals, setSignals] = useState<SignalScore[]>([]);
  const [result, setResult] = useState<ResultMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [gaugeAnim, setGaugeAnim] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const gotResultRef = useRef(false);

  useEffect(() => {
    if (!market || !ticker) return;
    let cancelled = false;

    setSignals([]); setResult(null); setError(null); setLoading(true); setGaugeAnim(false);
    gotResultRef.current = false;

    const es = new EventSource(`/api/score/${market}/${ticker}`);
    esRef.current = es;

    es.addEventListener("signal", (e) => {
      if (cancelled) return;
      const signal: SignalScore = JSON.parse(e.data);
      setSignals((prev) => [...prev, signal]);
    });

    es.addEventListener("result", (e) => {
      if (cancelled) return;
      const data: ResultMeta = JSON.parse(e.data);
      gotResultRef.current = true;
      setResult(data);
      setLoading(false);
      es.close();
      setTimeout(() => setGaugeAnim(true), 100);
    });

    es.addEventListener("error", (e) => {
      if (cancelled) return;
      if (gotResultRef.current) { es.close(); return; }
      const raw = (e as MessageEvent).data;
      if (raw == null) return;
      try {
        const payload = JSON.parse(raw);
        setError(payload.message ?? "평가 중 오류가 발생했습니다");
      } catch {
        setError("평가 중 오류가 발생했습니다");
      }
      setLoading(false); es.close();
    });

    es.onerror = (e) => {
      if (cancelled) return;
      if (gotResultRef.current) { es.close(); return; }
      if ((e as MessageEvent).data != null) return;
      if (es.readyState === EventSource.CLOSED) return;
      setError("연결이 끊어졌습니다. 새로고침해 주세요.");
      setLoading(false); es.close();
    };

    return () => { cancelled = true; es.close(); };
  }, [market, ticker]);

  const marketLabel =
    market === "crypto" ? "암호화폐" : market === "korea" ? "국내주식" : "미국주식";

  const groups = SIGNAL_GROUPS[market] ?? [];

  // 한국 K1~K8 dormant 경고 — 활성 신호 ≥4 (K9~K12) 인데 K1~K8 모두 추정/0 점이면 표시
  const showKoreaDormantWarning = market === "korea" && signals.some((s) =>
    KOREA_DORMANT_IDS.includes(s.id)
  );

  return (
    <main className="min-h-screen bg-bg-primary text-fg-primary">
      {/* 상단 네비 */}
      <nav className="sticky top-0 z-10 bg-bg-primary/90 backdrop-blur border-b border-border-subtle px-4 py-2.5">
        <a href="/dashboard" className="inline-flex items-center gap-1 text-caption text-fg-tertiary hover:text-fg-secondary transition-colors">
          <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          대시보드
        </a>
      </nav>

      {/* 페이지 컨테이너 — 모바일 380px 우선, 태블릿 560, 데스크톱 1080 (2 col) */}
      <div className="mx-auto px-3.5 py-3 sm:max-w-[560px] sm:px-5 sm:py-4 lg:max-w-[1080px] lg:px-8 lg:py-6 lg:grid lg:grid-cols-[minmax(0,540px)_1fr] lg:gap-6">

        {/* 좌측 컬럼 (모바일/태블릿: 단일, 데스크톱: 좌측) */}
        <div className="space-y-3">

          {/* ── 헤더 카드 (점수 + 가격 + 진입영역 + AI) ── */}
          <div className="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
            {/* 종목명 */}
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-micro px-1.5 py-0.5 rounded-sm border border-border-subtle bg-bg-card-elevated text-fg-secondary font-medium">
                  {marketLabel}
                </span>
                <span className="text-micro font-mono text-fg-tertiary">{decodeURIComponent(ticker)}</span>
              </div>
              <h1 className="text-h1 text-fg-primary truncate">
                {result?.name ?? decodeURIComponent(ticker)}
              </h1>
            </div>

            {/* 게이지 + 가격 */}
            <div className="flex items-start gap-4 px-4 pb-3">
              {result ? (
                <CircleGauge score={result.score} label={result.label} animating={gaugeAnim} />
              ) : (
                <div className="w-[124px] h-[124px] rounded-full border-[10px] border-border-subtle animate-pulse flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0 space-y-1.5">
                {result?.price ? (
                  <p className="text-h2 text-fg-primary tabular-nums">
                    {formatPrice(market, result.price)}
                  </p>
                ) : (
                  <div className="h-7 bg-bg-card-elevated rounded w-24 animate-pulse" />
                )}
                <div className="flex gap-3">
                  {(["7일", "30일"] as const).map((label, i) => {
                    const val = i === 0 ? result?.ret7d : result?.ret30d;
                    return (
                      <div key={label} className="flex flex-col">
                        <span className="text-micro text-fg-tertiary mb-0.5">{label}</span>
                        {val !== undefined && val !== null ? (
                          <span className={`text-body font-medium tabular-nums ${pctColor(val)}`}>
                            {pctStr(val)}
                          </span>
                        ) : (
                          <div className="h-4 w-10 bg-bg-card-elevated rounded animate-pulse" />
                        )}
                      </div>
                    );
                  })}
                </div>
                {result?.spark && result.spark.length > 1 && (
                  <SparkLine prices={result.spark.slice(-14)} />
                )}
              </div>
            </div>

            {/* 신뢰도 + 캐시 + risk_flags + 한국 dormant 경고 */}
            {result && (
              <div className="px-4 py-2 bg-bg-card-elevated border-t border-border-subtle flex items-center justify-between flex-wrap gap-1.5">
                <div className="flex items-center gap-2.5 text-caption text-fg-tertiary">
                  <span>신뢰도 <span className="text-fg-primary tabular-nums">{result.confidenceScore}%</span></span>
                  <span>실시간 <span className="text-fg-primary tabular-nums">{result.liveCount}/{result.totalCount}</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  {(() => {
                    // evaluatedAt 기준 경과 시간 + 갱신까지 (10분 캐시 TTL).
                    const evaluated = new Date(result.evaluatedAt);
                    const ageMs = Date.now() - evaluated.getTime();
                    const ageMin = Math.max(0, Math.round(ageMs / 60000));
                    const remainMin = Math.max(0, 10 - ageMin);
                    const evalLocal = evaluated.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
                    if (result.cached) {
                      const tip = `10분 캐시 — 평가 ${evalLocal} (${ageMin}분 전), 갱신까지 ~${remainMin}분`;
                      return (
                        <span title={tip} className="text-caption text-fg-tertiary cursor-help underline decoration-dotted decoration-fg-tertiary/40 underline-offset-2">
                          캐시 · {ageMin}m
                        </span>
                      );
                    }
                    return (
                      <span title={`방금 평가 — ${evalLocal}`} className="text-caption text-signal-buy cursor-help">
                        실시간
                      </span>
                    );
                  })()}
                  {showKoreaDormantWarning && (
                    <span
                      title="K1~K8: KIS API 미연결 — K9~K12 (기술적 분석) 만으로 평가"
                      className="text-micro px-1.5 py-0.5 bg-pending/10 border border-pending/30 text-pending rounded-sm font-medium"
                    >
                      ⚠ K1~K8 미수집
                    </span>
                  )}
                  {result.risk_flags?.map((flag) => (
                    <span key={flag}
                      className="text-micro px-1.5 py-0.5 bg-pending/10 border border-pending/30 text-pending rounded-sm font-medium">
                      ⚠ {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 진입 영역 + AI 해설 */}
            {result && (
              <div className="px-4 py-3 border-t border-border-subtle space-y-2.5">
                {result.entryZone && <EntryZoneCard zone={result.entryZone} market={market} />}
                {signals.length >= 1 && (
                  <AISummaryInline market={market} ticker={ticker} result={result} signals={signals} />
                )}
              </div>
            )}
          </div>

          {/* ── 시계열 카드 ── */}
          {result && (
            <ScoreHistorySparkline
              history={result.history7d ?? []}
              currentScore={result.score}
            />
          )}

          {/* ── 알림 ── */}
          {result && <AlertSection market={market} ticker={ticker} result={result} />}
        </div>

        {/* 우측 컬럼 (데스크톱) / 본문 하단 (모바일) */}
        <div className="space-y-3 mt-3 lg:mt-0">

          {/* ── 로딩 / 에러 ── */}
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-bg-card border border-border-subtle">
              <div className="w-3 h-3 border-2 border-signal-buy border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <span className="text-caption text-fg-secondary">신호 분석 중… <span className="tabular-nums">({signals.length}/12)</span></span>
            </div>
          )}
          {error && (
            <div className="px-3 py-2.5 bg-signal-sell/10 border border-signal-sell/30 rounded text-body text-signal-sell">
              {error}
            </div>
          )}

          {/* ── 거시경제 ── */}
          <MacroCard market={market} />

          {/* ── 신호 그룹 ── */}
          {signals.length > 0 && groups.length > 0 && (
            <div>
              <p className="text-caption text-fg-secondary uppercase tracking-wider mb-2">12개 신호 상세</p>
              <div className="space-y-2">
                {groups.map((g) => (
                  <SignalGroupCard key={g.label} group={g} signals={signals} market={market} />
                ))}
              </div>
            </div>
          )}

          {/* ── 신호 로딩 스켈레톤 ── */}
          {loading && signals.length === 0 && groups.length > 0 && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 bg-bg-card border border-border-subtle rounded-lg animate-pulse" />
              ))}
            </div>
          )}
        </div>

        {/* ── 푸터 ── */}
        {result && (
          <div className="lg:col-span-2 mt-4 pt-3 border-t border-border-subtle text-micro text-fg-tertiary space-y-0.5">
            <div className="flex items-center justify-between">
              <span>{result.modelVersion}</span>
              <span>{new Date(result.evaluatedAt).toLocaleString("ko-KR")}</span>
            </div>
            <p>참고용 정보. 투자 판단의 책임은 사용자 본인에게 있습니다.</p>
          </div>
        )}
      </div>
    </main>
  );
}
