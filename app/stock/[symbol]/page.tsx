"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { T, FT, MO, scoreColor, changeColor } from "@/lib/theme";
import type { DetailData } from "@/app/api/stock/[symbol]/route";
import PriceChart from "@/components/PriceChart";
import FlowScoreRing from "@/components/FlowScoreRing";
import Backtest from "@/components/Backtest";

// 세션 내 인메모리 캐시 — 재방문 시 즉시 표시
const _cache = new Map<string, DetailData>();
const _commentCache = new Map<string, string>();

// ── 점수 컴포넌트 바 ──────────────────────────────────
function ScoreBar({
  label, value, max, color,
}: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: MO, fontSize: 11, color: T.tx2 }}>{label}</span>
        <span style={{ fontFamily: MO, fontSize: 11, color }}>{value}/{max}</span>
      </div>
      <div style={{ height: 4, background: T.bd, borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${(value / max) * 100}%`,
          background: color,
          borderRadius: 2,
          transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
}

// ── RSI 게이지 ────────────────────────────────────────
function RSIGauge({ rsi }: { rsi: number }) {
  const zones = [
    { label: "과매도", range: "< 30", color: T.ok, from: 0, to: 30 },
    { label: "중립", range: "30–70", color: T.wn, from: 30, to: 70 },
    { label: "과열", range: "> 70", color: T.dn, from: 70, to: 100 },
  ];
  const rsiColor = rsi < 30 ? T.ok : rsi > 70 ? T.dn : T.wn;

  return (
    <div>
      <div style={{ position: "relative", height: 8, background: T.bd, borderRadius: 4, overflow: "visible", marginBottom: 6 }}>
        {/* 그라데이션 바 */}
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(to right, ${T.ok}, ${T.wn} 35%, ${T.wn} 65%, ${T.dn})`,
          borderRadius: 4, opacity: 0.3,
        }} />
        {/* 포인터 */}
        <div style={{
          position: "absolute",
          left: `${rsi}%`,
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 14, height: 14,
          background: rsiColor,
          borderRadius: "50%",
          border: `2px solid ${T.bg}`,
          zIndex: 1,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {zones.map((z) => (
          <span key={z.label} style={{ fontFamily: MO, fontSize: 10, color: z.color }}>
            {z.label} {z.range}
          </span>
        ))}
      </div>
      <div style={{ fontFamily: MO, fontSize: 13, color: rsiColor, marginTop: 4, textAlign: "center" }}>
        RSI {rsi}
      </div>
    </div>
  );
}

// ── 통계 행 ──────────────────────────────────────────
function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "8px 0", borderBottom: `1px solid ${T.bd}`,
    }}>
      <span style={{ fontFamily: MO, fontSize: 12, color: T.tx2 }}>{label}</span>
      <span style={{ fontFamily: MO, fontSize: 12, color: valueColor ?? T.tx }}>{value}</span>
    </div>
  );
}

// ── AI 코멘트 섹션 ───────────────────────────────────
function AIComment({ data }: { data: DetailData }) {
  const sym = data.coinId ?? data.symbol;
  const [comment, setComment] = useState<string | null>(() => _commentCache.get(sym) ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // data 객체 전체를 의존성으로 두면 매 렌더마다 새 참조 → 무한 루프
  // 실제로 사용하는 원시값/배열만 ref로 고정하여 fetchComment 안정화
  const dataRef = useRef(data);
  dataRef.current = data;

  const fetchComment = useCallback(async () => {
    if (_commentCache.has(sym)) return;
    setLoading(true);
    setError(false);
    const d = dataRef.current;
    try {
      const res = await fetch(`/api/ai-comment/${encodeURIComponent(sym)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: d.name,
          symbol: d.symbol,
          market: d.market,
          score: d.score,
          grade: d.grade,
          change1d: d.change1d,
          p7d: d.p7d,
          p30d: d.p30d,
          rsi: d.rsi,
          volRatio: d.volRatio,
          signals: d.signals,
          components: d.components,
        }),
      });
      if (!res.ok) throw new Error();

      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        // 캐시 히트 — JSON 파싱
        const json = await res.json();
        _commentCache.set(sym, json.comment);
        setComment(json.comment);
        setLoading(false);
      } else {
        // 스트리밍 — 첫 청크 도착 시 로딩 스피너 숨기고 텍스트 누적
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let full = "";
        let firstChunk = true;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          // AI SDK text stream: "0:\"chunk\"\n" 형식 파싱
          const raw = decoder.decode(value, { stream: true });
          for (const line of raw.split("\n")) {
            const m = line.match(/^0:"((?:[^"\\]|\\.)*)"/);
            if (m) full += m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
          }
          if (firstChunk) { setLoading(false); firstChunk = false; }
          setComment(full);
        }
        _commentCache.set(sym, full);
      }
    } catch {
      setError(true);
      setLoading(false);
    }
  }, [sym]); // sym만 — dataRef는 렌더마다 갱신되므로 의존성 불필요

  // 페이지 진입 시 자동 생성
  useEffect(() => {
    fetchComment();
  }, [fetchComment]);

  const gradeColor = scoreColor(data.score);

  return (
    <div style={{
      background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 16,
      padding: "16px 20px", marginBottom: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: MO, fontSize: 12, color: T.tx2 }}>🤖 AI 코멘트</span>
          <span style={{
            fontFamily: MO, fontSize: 9,
            background: `${T.pri}22`, color: T.pri,
            borderRadius: 4, padding: "1px 6px",
          }}>Claude</span>
        </div>
        {comment && (
          <button
            onClick={() => { _commentCache.delete(sym); setComment(null); fetchComment(); }}
            style={{
              fontFamily: MO, fontSize: 11,
              background: "transparent", color: T.tx2,
              border: `1px solid ${T.bd}`,
              borderRadius: 6, padding: "4px 12px",
              cursor: "pointer",
            }}
          >
            재생성
          </button>
        )}
      </div>

      {loading && (
        <div style={{ padding: "4px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <div style={{
              width: 12, height: 12, borderRadius: "50%",
              border: `2px solid ${T.bd}`, borderTopColor: T.pri,
              animation: "spin 0.7s linear infinite", flexShrink: 0,
            }} />
            <span style={{ fontFamily: MO, fontSize: 11, color: T.tx2 }}>Claude가 분석 중...</span>
          </div>
          {/* 스켈레톤 줄 */}
          {[100, 90, 95, 70].map((w, i) => (
            <div key={i} style={{
              height: 11, borderRadius: 4, marginBottom: 8,
              width: `${w}%`,
              background: `linear-gradient(90deg, ${T.bd} 25%, ${T.sfEl} 50%, ${T.bd} 75%)`,
              backgroundSize: "200% 100%",
              animation: "shimmer 1.4s infinite",
            }} />
          ))}
        </div>
      )}

      {error && !loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: MO, fontSize: 12, color: T.dn }}>⚠ 코멘트 생성 실패</span>
          <button
            onClick={() => { setError(false); fetchComment(); }}
            style={{
              fontFamily: MO, fontSize: 11, background: "transparent",
              color: T.tx2, border: `1px solid ${T.bd}`,
              borderRadius: 6, padding: "4px 12px", cursor: "pointer",
            }}
          >
            재시도
          </button>
        </div>
      )}

      {comment && (
        <p style={{
          fontFamily: MO, fontSize: 13, color: T.tx,
          lineHeight: 1.7, margin: 0,
          whiteSpace: "pre-wrap",
        }}>
          {comment}
        </p>
      )}
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────
export default function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const router = useRouter();
  const [data, setData] = useState<DetailData | null>(() => _cache.get(symbol as string) ?? null);
  const [loading, setLoading] = useState(!_cache.has(symbol as string));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    // 이미 캐시에 있으면 스킵
    if (_cache.has(symbol)) return;
    setLoading(true);
    fetch(`/api/stock/${encodeURIComponent(symbol)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: DetailData) => {
        _cache.set(symbol, d);
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [symbol]);

  // 로딩 스켈레톤
  if (loading) {
    const Bone = ({ w, h, mb = 8 }: { w: string; h: number; mb?: number }) => (
      <div style={{
        width: w, height: h, borderRadius: 6, marginBottom: mb,
        background: `linear-gradient(90deg, ${T.bd} 25%, ${T.sfEl} 50%, ${T.bd} 75%)`,
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
      }} />
    );
    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.tx }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 60px" }}>
          {/* 뒤로가기 */}
          <div style={{ height: 20, marginBottom: 20 }} />
          {/* 헤더 카드 */}
          <div style={{ background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 16, padding: "20px 24px", marginBottom: 16 }}>
            <Bone w="40%" h={14} mb={10} />
            <Bone w="25%" h={28} mb={8} />
            <Bone w="15%" h={12} />
          </div>
          {/* 차트 */}
          <div style={{ background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 16, padding: "16px 12px", marginBottom: 16, height: 180 }}>
            <Bone w="20%" h={11} mb={12} />
            <Bone w="100%" h={120} />
          </div>
          {/* 중간 그리드 */}
          <div className="detail-mid-grid">
            {[0, 1].map(i => (
              <div key={i} style={{ background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 16, padding: "16px 20px" }}>
                <Bone w="40%" h={11} mb={16} />
                {[90, 75, 60, 80].map((w, j) => <Bone key={j} w={`${w}%`} h={8} mb={14} />)}
              </div>
            ))}
          </div>
          {/* AI 코멘트 */}
          <div style={{ background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 16, padding: "16px 20px", marginBottom: 16 }}>
            <Bone w="30%" h={11} mb={14} />
            {[100, 90, 95, 60].map((w, i) => <Bone key={i} w={`${w}%`} h={11} mb={9} />)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ fontFamily: MO, fontSize: 13, color: T.dn }}>⚠ 조회 실패: {error}</div>
        <button
          onClick={() => router.back()}
          style={{ fontFamily: MO, fontSize: 12, background: T.sf, color: T.tx2, border: `1px solid ${T.bd}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}
        >
          ← 돌아가기
        </button>
      </div>
    );
  }

  const gradeColor = scoreColor(data.score);
  const chartColor = data.p7d >= 0 ? T.ok : T.dn;

  const marketLabel = data.market === "kospi" ? "KOSPI" : data.market === "us" ? "US" : "CRYPTO";
  const marketColor = data.market === "kospi" ? T.pri : data.market === "us" ? T.pu : T.wn;

  const fmtVol = (v: number) => {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return String(v);
  };

  const fmtCap = (v: number) => {
    if (v >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)}T`;
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
    return String(v);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.tx }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 60px" }}>

        {/* 뒤로가기 + 공유 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <button
            onClick={() => router.back()}
            style={{
              fontFamily: MO, fontSize: 12, color: T.tx2,
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4, padding: "4px 0",
            }}
          >
            ← 목록으로
          </button>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${data.name} FlowScore ${data.score}점 (${data.grade}) | ${data.change1d > 0 ? "+" : ""}${data.change1d}% 오늘 | #FlowSignal`)}&url=${encodeURIComponent(`https://flow-signal.vercel.app/stock/${symbol}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: MO, fontSize: 11, color: T.tx2,
              background: T.sfEl, border: `1px solid ${T.bd}`,
              borderRadius: 8, padding: "5px 12px",
              display: "flex", alignItems: "center", gap: 5,
              textDecoration: "none",
            }}
          >
            <span style={{ fontSize: 13 }}>𝕏</span> 공유
          </a>
        </div>

        {/* 헤더: 이름 + 배지 + 가격 */}
        <div style={{
          background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 16,
          padding: "20px 24px", marginBottom: 16,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <h1 style={{ fontFamily: FT, fontSize: 22, fontWeight: 700, margin: 0 }}>{data.name}</h1>
              <span style={{ fontFamily: MO, fontSize: 11, color: T.tx2 }}>{data.symbol}</span>
              <span style={{
                fontFamily: MO, fontSize: 10,
                background: `${marketColor}22`, color: marketColor,
                borderRadius: 4, padding: "2px 7px",
              }}>{marketLabel}</span>
              <span style={{
                fontFamily: MO, fontSize: 10,
                background: T.sfEl, color: T.tx2,
                borderRadius: 4, padding: "2px 7px",
              }}>{data.sector}</span>
            </div>
            <div style={{ fontFamily: MO, fontSize: 26, fontWeight: 700 }}>{data.priceStr}</div>
            <div style={{ fontFamily: MO, fontSize: 13, color: changeColor(data.change1d), marginTop: 4 }}>
              {data.change1d > 0 ? "+" : ""}{data.change1d}% 오늘
            </div>
          </div>

          {/* FlowScore 링 (큰 버전) */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <FlowScoreRing score={data.score} size={80} />
            <span style={{
              fontFamily: MO, fontSize: 12, fontWeight: 700,
              color: gradeColor,
              background: `${gradeColor}22`,
              borderRadius: 6, padding: "3px 12px",
            }}>
              {data.grade}
            </span>
          </div>
        </div>

        {/* 가격 차트 */}
        <div style={{
          background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 16,
          padding: "16px 12px", marginBottom: 16,
        }}>
          <div style={{ fontFamily: MO, fontSize: 12, color: T.tx2, marginBottom: 10, paddingLeft: 4 }}>
            90일 가격 차트
          </div>
          <PriceChart data={data.priceHistory} ma20={data.ma20} ma60={data.ma60} color={chartColor} />
        </div>

        {/* 중간: FlowScore 분해 + RSI */}
        <div className="detail-mid-grid">
          {/* 점수 분해 */}
          <div style={{
            background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 16, padding: "16px 20px",
          }}>
            <div style={{ fontFamily: MO, fontSize: 12, color: T.tx2, marginBottom: 14 }}>FlowScore 분해</div>
            <ScoreBar label="모멘텀 (MA)" value={data.components.momentum} max={30} color={T.pri} />
            <ScoreBar label="기술적 (RSI)" value={data.components.technical} max={25} color={T.pu} />
            <ScoreBar label="거래량" value={data.components.volume} max={20} color={T.wn} />
            <ScoreBar label="추세 (7d/30d)" value={data.components.trend} max={25} color={T.ok} />
          </div>

          {/* RSI */}
          <div style={{
            background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 16, padding: "16px 20px",
          }}>
            <div style={{ fontFamily: MO, fontSize: 12, color: T.tx2, marginBottom: 14 }}>RSI 분석</div>
            <RSIGauge rsi={data.rsi} />
            <div style={{ marginTop: 20 }}>
              <div style={{ fontFamily: MO, fontSize: 11, color: T.tx2, marginBottom: 6 }}>이동평균</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: MO, fontSize: 11, color: T.wn }}>MA20</span>
                  <span style={{ fontFamily: MO, fontSize: 11 }}>
                    {data.ma20 >= 1000 ? data.ma20.toLocaleString() : data.ma20.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: MO, fontSize: 11, color: T.pu }}>MA60</span>
                  <span style={{ fontFamily: MO, fontSize: 11 }}>
                    {data.ma60 >= 1000 ? data.ma60.toLocaleString() : data.ma60.toFixed(2)}
                  </span>
                </div>
              </div>
              {/* MA 해석 */}
              {(() => {
                const maStatus = data.price > data.ma20
                  ? (data.ma20 > data.ma60 ? { text: "골든크로스 강세", color: T.ok } : { text: "단기 상승 추세", color: T.ok })
                  : (data.ma20 < data.ma60 ? { text: "데드크로스 약세", color: T.dn } : { text: "단기 하락 추세", color: T.dn });
                return (
                  <div style={{
                    marginTop: 10, fontFamily: MO, fontSize: 11,
                    color: maStatus.color, background: `${maStatus.color}18`,
                    borderRadius: 6, padding: "4px 8px", textAlign: "center",
                  }}>
                    {maStatus.text}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* 시그널 뱃지 */}
        {data.signals.length > 0 && (
          <div style={{
            background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 16,
            padding: "16px 20px", marginBottom: 16,
          }}>
            <div style={{ fontFamily: MO, fontSize: 12, color: T.tx2, marginBottom: 12 }}>감지된 시그널</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {data.signals.map((s) => (
                <span key={s} style={{
                  fontFamily: MO, fontSize: 12,
                  background: `${gradeColor}22`, color: gradeColor,
                  borderRadius: 6, padding: "5px 12px",
                  border: `1px solid ${gradeColor}44`,
                }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* AI 코멘트 */}
        <AIComment data={data} />

        {/* FlowScore 백테스팅 */}
        <Backtest priceHistory={data.priceHistory} market={data.market} />

        {/* 핵심 지표 테이블 */}
        <div style={{
          background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 16,
          padding: "16px 20px",
        }}>
          <div style={{ fontFamily: MO, fontSize: 12, color: T.tx2, marginBottom: 4 }}>핵심 지표</div>
          <StatRow label="현재가" value={data.priceStr} />
          <StatRow
            label="1일 등락"
            value={`${data.change1d > 0 ? "+" : ""}${data.change1d}%`}
            valueColor={changeColor(data.change1d)}
          />
          <StatRow
            label="7일 수익률"
            value={`${data.p7d > 0 ? "+" : ""}${data.p7d}%`}
            valueColor={changeColor(data.p7d)}
          />
          <StatRow
            label="30일 수익률"
            value={`${data.p30d > 0 ? "+" : ""}${data.p30d}%`}
            valueColor={changeColor(data.p30d)}
          />
          <StatRow label="거래량 비율" value={`${data.volRatio}× (20일 평균 대비)`} />
          <StatRow label="거래량" value={fmtVol(data.volume)} />
          <StatRow label="시가총액" value={fmtCap(data.marketCap)} />
        </div>

      </div>
    </div>
  );
}
