"use client";

/**
 * /score/[market]/[ticker] — 종목 신호 상세 페이지 v4
 * 디자인 전면 개선: 계층 구조 명확화, 가독성 향상, 섹션 구분 강화
 */

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAlerts, requestNotificationPermission, fireNotification } from "@/lib/alerts";

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

type ResultMeta = {
  score: number;
  label: string;
  liveCount: number;
  totalCount: number;
  evaluatedAt: string;
  modelVersion: string;
  confidence: number;
  price: number;
  ret7d: number | null;
  ret30d: number | null;
  spark: number[];
  name: string;
  cached: boolean;
};

// ─── 시그널 그룹 정의 ────────────────────────────────────────────────────────

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

// ─── 색상 헬퍼 ───────────────────────────────────────────────────────────────

function scoreToColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 55) return "#34d399";
  if (score >= 45) return "#facc15";
  if (score >= 30) return "#fb923c";
  return "#ef4444";
}

function scoreToBg(score: number): string {
  if (score >= 70) return "bg-emerald-950 border-emerald-800 text-emerald-300";
  if (score >= 55) return "bg-emerald-950 border-emerald-900 text-emerald-400";
  if (score >= 45) return "bg-yellow-950 border-yellow-900 text-yellow-300";
  if (score >= 30) return "bg-orange-950 border-orange-900 text-orange-300";
  return "bg-red-950 border-red-900 text-red-300";
}

function pctColor(v: number | null): string {
  if (v == null) return "text-gray-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-red-400";
  return "text-gray-400";
}

function pctStr(v: number | null): string {
  if (v == null) return "–";
  return (v > 0 ? "+" : "") + v.toFixed(1) + "%";
}

// ─── 섹션 헤더 ───────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
      {children}
    </p>
  );
}

// ─── 원형 게이지 (SVG) ───────────────────────────────────────────────────────

function CircleGauge({ score, label, animating }: { score: number; label: string; animating: boolean }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const fill = animating ? (score / 100) * C : 0;
  const color = scoreToColor(score);

  return (
    <div className="relative flex items-center justify-center">
      <svg width="136" height="136" viewBox="0 0 136 136">
        <circle cx="68" cy="68" r={R} fill="none" stroke="#1f2937" strokeWidth="12" />
        <circle
          cx="68" cy="68" r={R}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${C}`}
          strokeDashoffset={`${C - fill}`}
          transform="rotate(-90 68 68)"
          style={{ transition: animating ? "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)" : "none" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-black text-white leading-none tabular-nums">{score}</span>
        <span className="text-xs mt-1 font-bold tracking-wide" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

// ─── 스파크라인 (SVG) ────────────────────────────────────────────────────────

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

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={pts}
        fill="none"
        stroke={isUp ? "#10b981" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}

// ─── 상위 3 드라이버 ─────────────────────────────────────────────────────────

function TopDrivers({ signals }: { signals: SignalScore[] }) {
  const top = [...signals]
    .map((s) => ({ ...s, impact: Math.abs(s.score - 50) * s.weight }))
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);

  if (top.length === 0) return null;

  return (
    <div className="mb-5">
      <SectionLabel>주요 드라이버</SectionLabel>
      <div className="space-y-2">
        {top.map((s, idx) => {
          const bullish = s.score > 50;
          const color = scoreToColor(s.score);
          const rank = ["①", "②", "③"][idx];
          return (
            <div
              key={s.id}
              className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-xl"
            >
              <span className="text-base text-gray-500 w-5 flex-shrink-0">{rank}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm font-medium text-white truncate">{s.name}</span>
                  {s.live && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-900 text-emerald-400 rounded font-semibold flex-shrink-0">LIVE</span>
                  )}
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${s.score}%`, backgroundColor: color }}
                  />
                </div>
              </div>
              <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                <span className="text-base font-black tabular-nums" style={{ color }}>{s.score.toFixed(0)}</span>
                <span className="text-[10px] text-gray-500">{bullish ? "▲ 매수" : "▼ 매도"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 신호 바 ────────────────────────────────────────────────────────────────

function SignalBar({ signal, visible }: { signal: SignalScore; visible: boolean }) {
  const color = scoreToColor(signal.score);
  return (
    <div className={`transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-mono text-gray-400 w-7 flex-shrink-0">{signal.id}</span>
          <span className="text-sm text-gray-200 truncate">{signal.name}</span>
          {signal.live ? (
            <span className="text-[10px] px-1 py-0.5 bg-emerald-900/60 text-emerald-400 rounded flex-shrink-0">LIVE</span>
          ) : (
            <span className="text-[10px] px-1 py-0.5 bg-gray-800 text-gray-400 rounded flex-shrink-0">추정</span>
          )}
        </div>
        <span className="text-sm font-bold ml-3 flex-shrink-0 tabular-nums" style={{ color }}>
          {signal.score.toFixed(0)}
        </span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${signal.score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── 신호 그룹 (아코디언) ────────────────────────────────────────────────────

function SignalGroup({ group, signals, visibleIds }: {
  group: GroupDef;
  signals: SignalScore[];
  visibleIds: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const groupSignals = group.ids
    .map((id) => signals.find((s) => s.id === id))
    .filter(Boolean) as SignalScore[];

  if (groupSignals.length === 0) return null;

  const avg = groupSignals.reduce((s, g) => s + g.score, 0) / groupSignals.length;
  const color = scoreToColor(avg);

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3.5 bg-gray-900 hover:bg-gray-850 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-200">{group.label}</span>
          <span className="text-xs text-gray-400">({groupSignals.length})</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-12 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${avg}%`, backgroundColor: color }} />
            </div>
            <span className="text-sm font-bold tabular-nums" style={{ color }}>{avg.toFixed(0)}</span>
          </div>
          <svg
            className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-4 py-4 space-y-4 bg-gray-950 border-t border-gray-800">
          {groupSignals.map((s) => (
            <SignalBar key={s.id} signal={s} visible={visibleIds.has(s.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 알림 설정 섹션 ─────────────────────────────────────────────────────────

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
      stockId,
      name: result.name,
      symbol: ticker,
      market: market as "kospi" | "korea" | "us" | "crypto",
      type: alertType,
      value: val,
    });
    setScoreThreshold("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fireNotification(`🔔 알림 설정 완료`, `${result.name} FlowScore ${val}점 ${alertType === "score_above" ? "이상" : "이하"} 시 알림`);
  };

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>알림</SectionLabel>
        <button
          onClick={() => setOpen(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${
            open
              ? "bg-gray-800 border-gray-700 text-gray-400"
              : "bg-emerald-900/50 border-emerald-800 text-emerald-300 hover:bg-emerald-900"
          }`}
        >
          {open ? "닫기" : `🔔 알림 설정${myAlerts.length > 0 ? ` · ${myAlerts.length}개 등록` : ""}`}
        </button>
      </div>

      {myAlerts.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {myAlerts.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-300">FlowScore</span>
                <span className="text-sm font-bold text-white">{a.value}점</span>
                <span className="text-sm text-gray-400">{a.type === "score_above" ? "이상" : "이하"} 도달 시</span>
              </div>
              <button onClick={() => remove(a.id)} className="text-xs text-gray-400 hover:text-red-400 transition-colors">
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <select
              value={alertType}
              onChange={e => setAlertType(e.target.value as "score_above" | "score_below")}
              className="flex-shrink-0 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 outline-none"
            >
              <option value="score_above">이상 도달 시</option>
              <option value="score_below">이하 도달 시</option>
            </select>
            <div className="flex-1 relative">
              <input
                type="number"
                min={0}
                max={100}
                placeholder={`현재 ${Math.round(result.score)}점`}
                value={scoreThreshold}
                onChange={e => setScoreThreshold(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none placeholder-gray-600 pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">점</span>
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={!scoreThreshold || saved}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saved ? "✓ 알림 저장됨" : "알림 추가"}
          </button>
          <p className="text-xs text-gray-400 text-center">FlowScore 조건 도달 시 브라우저 알림으로 알려드립니다</p>
        </div>
      )}

      {!open && myAlerts.length === 0 && (
        <p className="text-xs text-gray-400 pl-0.5">FlowScore 조건 도달 시 알림을 받을 수 있습니다.</p>
      )}
    </div>
  );
}

// ─── AI 코멘트 섹션 ─────────────────────────────────────────────────────────

function AiCommentSection({ market, ticker, result, signals }: {
  market: string;
  ticker: string;
  result: ResultMeta;
  signals: SignalScore[];
}) {
  const [comment, setComment] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(false);

  const fetch_ = async () => {
    if (comment || loading) return;
    setOpened(true);
    setLoading(true);

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
          name: result.name,
          symbol: ticker,
          market,
          score: result.score,
          grade: result.label,
          change1d: 0,
          p7d: result.ret7d != null ? +(result.ret7d * 100).toFixed(2) : 0,
          p30d: result.ret30d != null ? +(result.ret30d * 100).toFixed(2) : 0,
          rsi: 0,
          volRatio: 0,
          signals: signals.slice(0, 5).map((s) => `${s.name}(${s.score.toFixed(0)})`),
          components: { momentum: 0, technical: 0, volume: 0, trend: 0, ...Object.fromEntries(compArr.map((s) => s.split(": "))) },
        }),
      });
      if (!res.ok) throw new Error();

      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const json = await res.json();
        setComment(json.comment);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setComment(text);
      }
      setLoading(false);
    } catch {
      setComment("AI 코멘트를 불러오지 못했습니다.");
      setLoading(false);
    }
  };

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>AI 해설</SectionLabel>
        {!opened && (
          <button
            onClick={fetch_}
            className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-full font-medium transition-colors"
          >
            분석 보기
          </button>
        )}
      </div>

      {loading && !comment && (
        <div className="flex items-center gap-2.5 p-4 bg-gray-900 border border-gray-800 rounded-xl">
          <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm text-gray-400">AI 분석 중…</span>
        </div>
      )}

      {comment && (
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
          <p className="text-sm text-gray-200 leading-relaxed">{comment}</p>
        </div>
      )}

      {!opened && !comment && (
        <p className="text-xs text-gray-400">버튼을 눌러 이 종목에 대한 AI 해설을 확인하세요.</p>
      )}
    </div>
  );
}

// ─── 거시경제 맥락 카드 ──────────────────────────────────────────────────────

function MacroContextCard({ market }: { market: string }) {
  const [data, setData] = useState<MacroContextData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(null);
    setLoading(true);
    fetch(`/api/macro-context?market=${market}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json: MacroContextData) => { setData(json); setLoading(false); })
      .catch(() => setLoading(false));
  }, [market]);

  if (loading) {
    return (
      <div className="mb-5">
        <SectionLabel>거시경제 맥락</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.indicators.length === 0) return null;

  return (
    <div className="mb-5">
      <SectionLabel>거시경제 맥락</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5">
        {data.indicators.map((ind) => {
          const hasChange = ind.change7d != null;
          const isPositive = hasChange && (ind.change7d ?? 0) > 0;
          const isNegative = hasChange && (ind.change7d ?? 0) < 0;
          const changeGood = ind.positiveIsGood ? isPositive : isNegative;
          const changeBad = ind.positiveIsGood ? isNegative : isPositive;
          const changeColor = changeBad ? "text-red-400" : changeGood ? "text-emerald-400" : "text-gray-500";
          const sign = hasChange && (ind.change7d ?? 0) > 0 ? "+" : "";

          return (
            <div key={ind.id} className="p-3.5 bg-gray-900 border border-gray-800 rounded-xl" title={ind.description}>
              <p className="text-xs text-gray-500 mb-2 truncate">{ind.label}</p>
              <p className="text-xl font-black text-white leading-none tabular-nums">
                {ind.value.toLocaleString("ko-KR")}
                <span className="text-xs font-normal text-gray-500 ml-1">{ind.unit}</span>
              </p>
              {hasChange && (
                <p className={`text-xs mt-1.5 font-medium ${changeColor}`}>
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

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function ScorePage() {
  const params = useParams<{ market: string; ticker: string }>();
  const { market, ticker } = params;

  const [signals, setSignals] = useState<SignalScore[]>([]);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ResultMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [gaugeAnim, setGaugeAnim] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const gotResultRef = useRef(false);

  useEffect(() => {
    setSignals([]);
    setVisibleIds(new Set());
    setResult(null);
    setError(null);
    setLoading(true);
    setGaugeAnim(false);
    gotResultRef.current = false;

    const es = new EventSource(`/api/score/${market}/${ticker}`);
    esRef.current = es;

    es.addEventListener("signal", (e) => {
      const signal: SignalScore = JSON.parse(e.data);
      setSignals((prev) => [...prev, signal]);
      setTimeout(() => {
        setVisibleIds((prev) => new Set([...prev, signal.id]));
      }, 50);
    });

    es.addEventListener("result", (e) => {
      const data: ResultMeta = JSON.parse(e.data);
      gotResultRef.current = true;
      setResult(data);
      setLoading(false);
      es.close();
      setTimeout(() => setGaugeAnim(true), 100);
    });

    es.addEventListener("error", (e) => {
      // result 수신 후 스트림 종료 시 발생하는 이벤트 → 무시
      if (gotResultRef.current) { es.close(); return; }
      // 네이티브 EventSource 오류는 data가 없음 → 무시
      const raw = (e as MessageEvent).data;
      if (raw == null) return;
      try {
        const data = JSON.parse(raw);
        setError(data.message ?? "평가 중 오류가 발생했습니다");
      } catch {
        setError("평가 중 오류가 발생했습니다");
      }
      setLoading(false);
      es.close();
    });

    es.onerror = () => {
      // result를 이미 받은 후의 onerror는 정상 종료 → 무시
      if (gotResultRef.current) { es.close(); return; }
      if (es.readyState === EventSource.CLOSED) return;
      setError("연결이 끊어졌습니다. 새로고침해 주세요.");
      setLoading(false);
      es.close();
    };

    return () => es.close();
  }, [market, ticker]);

  const marketLabel =
    market === "crypto" ? "암호화폐" : market === "korea" ? "국내주식" : "미국주식";

  const marketBadgeStyle =
    market === "crypto"
      ? "bg-yellow-950 border-yellow-900 text-yellow-400"
      : market === "korea"
      ? "bg-blue-950 border-blue-900 text-blue-400"
      : "bg-emerald-950 border-emerald-900 text-emerald-400";

  const groups = SIGNAL_GROUPS[market] ?? [];

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* 상단 네비 */}
      <nav className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-900 px-4 py-3">
        <a href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors">
          <svg width={16} height={16} className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          대시보드
        </a>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-6">

        {/* ── 히어로 카드 ── */}
        <div className="mb-6 rounded-2xl overflow-hidden border border-gray-800">
          {/* 종목명 영역 */}
          <div className="px-5 pt-5 pb-4 bg-gray-900">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-md border font-semibold ${marketBadgeStyle}`}>
                {marketLabel}
              </span>
              <span className="text-xs font-mono text-gray-400">{decodeURIComponent(ticker)}</span>
            </div>
            <h1 className="text-xl font-black text-white truncate">
              {result?.name ?? decodeURIComponent(ticker)}
            </h1>
          </div>

          {/* 게이지 + 가격 영역 */}
          <div className="flex items-center gap-5 px-5 py-5 bg-gray-950 border-t border-gray-800">
            {/* 원형 게이지 */}
            {result ? (
              <CircleGauge score={result.score} label={result.label} animating={gaugeAnim} />
            ) : (
              <div className="w-[136px] h-[136px] rounded-full border-[12px] border-gray-800 animate-pulse flex-shrink-0" />
            )}

            {/* 가격 & 수익률 */}
            <div className="flex-1 min-w-0 space-y-3">
              {result?.price ? (
                <div>
                  <p className="text-2xl font-black text-white tabular-nums">
                    {market === "korea"
                      ? `${Math.round(result.price).toLocaleString("ko-KR")}원`
                      : `$${result.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
                  </p>
                </div>
              ) : (
                <div className="h-8 bg-gray-800 rounded-lg w-28 animate-pulse" />
              )}

              {/* 7일 / 30일 수익률 배지 */}
              <div className="flex gap-2">
                {(["7일", "30일"] as const).map((label, i) => {
                  const val = i === 0 ? result?.ret7d : result?.ret30d;
                  return (
                    <div key={label} className="flex flex-col">
                      <span className="text-[10px] text-gray-400 mb-0.5">{label}</span>
                      {val !== undefined && val !== null ? (
                        <span className={`text-sm font-bold tabular-nums ${pctColor(val)}`}>
                          {pctStr(val)}
                        </span>
                      ) : (
                        <div className="h-5 w-12 bg-gray-800 rounded animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 스파크라인 */}
              {result?.spark && result.spark.length > 1 && (
                <SparkLine prices={result.spark} />
              )}
            </div>
          </div>

          {/* 신뢰도 바 */}
          {result && (
            <div className="px-5 py-3 bg-gray-900 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-3">
                <span>
                  신뢰도 <span className="text-gray-200 font-bold">{result.confidence}%</span>
                </span>
                <span>
                  실시간 <span className="text-gray-200 font-bold">{result.liveCount}/{result.totalCount}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                {result.cached && <span className="text-gray-400">캐시됨</span>}
                <span className={`text-xs px-2 py-0.5 rounded-md border font-semibold ${scoreToBg(result.score)}`}>
                  {result.label}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── 로딩 ── */}
        {loading && (
          <div className="flex items-center gap-3 text-gray-400 mb-5 px-1">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-sm">신호 분석 중… <span className="tabular-nums text-gray-400">({signals.length}/12)</span></span>
          </div>
        )}

        {/* ── 에러 ── */}
        {error && (
          <div className="mb-5 p-4 bg-red-950 border border-red-900 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* ── 거시경제 맥락 ── */}
        <MacroContextCard market={market} />

        {/* ── 상위 드라이버 ── */}
        {signals.length > 0 && <TopDrivers signals={signals} />}

        {/* ── AI 해설 ── */}
        {result && signals.length >= 6 && (
          <AiCommentSection market={market} ticker={ticker} result={result} signals={signals} />
        )}

        {/* ── 알림 설정 ── */}
        {result && <AlertSection market={market} ticker={ticker} result={result} />}

        {/* ── 구분선 ── */}
        {groups.length > 0 && signals.length > 0 && (
          <div className="border-t border-gray-800 pt-5 mb-5">
            <SectionLabel>12개 신호 상세</SectionLabel>
            <div className="space-y-2">
              {groups.map((g) => (
                <SignalGroup key={g.label} group={g} signals={signals} visibleIds={visibleIds} />
              ))}
            </div>
          </div>
        )}

        {/* 스켈레톤 */}
        {loading && signals.length === 0 && groups.length > 0 && (
          <div className="space-y-2 mb-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* 미분류 신호 폴백 */}
        {groups.length === 0 && signals.length > 0 && (
          <div className="space-y-4 mb-5">
            {signals.map((s) => (
              <SignalBar key={s.id} signal={s} visible={visibleIds.has(s.id)} />
            ))}
          </div>
        )}

        {/* ── 푸터 ── */}
        {result && (
          <div className="pt-4 border-t border-gray-800/50 text-xs text-gray-400 space-y-1">
            <div className="flex items-center justify-between">
              <span>{result.modelVersion}</span>
              <span>{new Date(result.evaluatedAt).toLocaleString("ko-KR")}</span>
            </div>
            <p>이 서비스는 참고용 정보 제공 목적으로만 운영됩니다. 투자 판단의 책임은 사용자 본인에게 있습니다.</p>
          </div>
        )}

      </div>
    </main>
  );
}
