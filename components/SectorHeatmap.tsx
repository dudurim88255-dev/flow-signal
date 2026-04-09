"use client";
import { useState } from "react";
import { T, FT, MO } from "@/lib/theme";
import type { StockData } from "@/app/api/kospi/route";

type Period = "1d" | "7d" | "30d";

interface SectorStat {
  sector: string;
  avg: number;
  count: number;
  topName: string;
  topVal: number;
  marketCapSum: number;
}

function getVal(stock: StockData, period: Period): number {
  if (period === "1d") return stock.change1d;
  if (period === "7d") return stock.p7d;
  return stock.p30d;
}

// 등락률 → 배경색
function heatColor(val: number): string {
  if (val >= 5)   return "rgba(16,185,129,0.55)";
  if (val >= 2)   return "rgba(16,185,129,0.35)";
  if (val >= 0)   return "rgba(16,185,129,0.18)";
  if (val >= -2)  return "rgba(239,68,68,0.18)";
  if (val >= -5)  return "rgba(239,68,68,0.35)";
  return          "rgba(239,68,68,0.55)";
}
function textColor(val: number): string {
  if (val >= 0) return T.ok;
  return T.dn;
}

interface Props {
  allStocks: StockData[];
}

export default function SectorHeatmap({ allStocks }: Props) {
  const [period, setPeriod] = useState<Period>("1d");
  const [expanded, setExpanded] = useState(false);
  const MOBILE_LIMIT = 8;

  if (allStocks.length === 0) return null;

  // 섹터별 집계
  const map = new Map<string, StockData[]>();
  for (const s of allStocks) {
    const arr = map.get(s.sector) ?? [];
    arr.push(s);
    map.set(s.sector, arr);
  }

  const stats: SectorStat[] = [];
  map.forEach((stocks, sector) => {
    const vals = stocks.map((s) => getVal(s, period));
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const topIdx = vals.reduce((best, v, i) => (Math.abs(v) > Math.abs(vals[best]) ? i : best), 0);
    stats.push({
      sector,
      avg: Math.round(avg * 10) / 10,
      count: stocks.length,
      topName: stocks[topIdx].name,
      topVal: vals[topIdx],
      marketCapSum: stocks.reduce((s, st) => s + st.marketCap, 0),
    });
  });

  // 시총 합 기준 정렬
  stats.sort((a, b) => b.marketCapSum - a.marketCapSum);

  const PERIODS: Period[] = ["1d", "7d", "30d"];

  return (
    <div style={{
      background: T.sf,
      border: `1px solid ${T.bd}`,
      borderRadius: 12,
      padding: "14px 16px",
      marginBottom: 20,
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontFamily: FT, fontSize: 12, fontWeight: 700, color: T.tx2, textTransform: "uppercase", letterSpacing: 0.5 }}>
          🗺 섹터 히트맵
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                fontFamily: MO, fontSize: 11,
                color: period === p ? T.bg : T.tx2,
                background: period === p ? T.pri : "transparent",
                border: `1px solid ${period === p ? T.pri : T.bd}`,
                borderRadius: 4, padding: "3px 9px",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* 히트맵 그리드 */}
      <div className="sector-heatmap-grid">
        {stats.map((s, i) => (
          <div
            key={s.sector}
            className={i >= MOBILE_LIMIT && !expanded ? "sector-card-hidden" : undefined}
            style={{
              background: heatColor(s.avg),
              borderRadius: 8,
              padding: "8px 10px",
              border: `1px solid ${s.avg >= 0 ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
              transition: "transform 0.15s",
              cursor: "default",
              minWidth: 0,
            }}
          >
            <div className="sector-card-name" style={{ fontFamily: FT, fontSize: 12, fontWeight: 600, color: T.tx, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.sector}
            </div>
            <div className="sector-card-pct" style={{ fontFamily: MO, fontSize: 14, fontWeight: 700, color: textColor(s.avg) }}>
              {s.avg > 0 ? "+" : ""}{s.avg}%
            </div>
            <div className="sector-card-top" style={{ fontFamily: MO, fontSize: 10, color: T.tx2, marginTop: 3 }}>
              {s.topName} {s.topVal > 0 ? "+" : ""}{s.topVal}%
            </div>
            <div className="sector-card-meta" style={{ fontFamily: MO, fontSize: 9, color: T.tx3, marginTop: 2 }}>
              {s.count}종목
            </div>
          </div>
        ))}
      </div>

      {/* 모바일 더보기/접기 버튼 */}
      {stats.length > MOBILE_LIMIT && (
        <div className="sector-expand-btn-wrap" style={{ textAlign: "center", marginTop: 8 }}>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              fontFamily: MO, fontSize: 11,
              background: "transparent",
              border: `1px solid ${T.bd}`,
              borderRadius: 6,
              color: T.tx2,
              padding: "4px 16px",
              cursor: "pointer",
            }}
          >
            {expanded ? "접기 ▲" : `+${stats.length - MOBILE_LIMIT}개 더보기 ▼`}
          </button>
        </div>
      )}
    </div>
  );
}
