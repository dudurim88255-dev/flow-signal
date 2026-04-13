"use client";
import Link from "next/link";
import { T, FT, MO, scoreColor, changeColor } from "@/lib/theme";
import type { StockData } from "@/app/api/kospi/route";
import { toScoreRouteFromData } from "@/lib/routes";
import Sparkline from "./Sparkline";
import FlowScoreRing from "./FlowScoreRing";

function PctBadge({ val }: { val: number }) {
  return (
    <span className="tabular-nums" style={{ color: changeColor(val), fontFamily: MO, fontSize: 12 }}>
      {val > 0 ? "+" : ""}{val}%
    </span>
  );
}

interface Props {
  stock: StockData;
  rank: number;
  isWatched?: boolean;
  onToggleWatch?: (id: string) => void;
  hasAlert?: boolean;
  onSetAlert?: (stock: StockData) => void;
}

export default function StockRow({ stock, rank, isWatched = false, onToggleWatch, hasAlert = false, onSetAlert }: Props) {
  const sparkColor = stock.p7d >= 0 ? T.ok : T.dn;
  const gradeColor = scoreColor(stock.score);
  const scoreHref = toScoreRouteFromData(stock);

  return (
    <Link
      href={scoreHref}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div className="stock-row-grid" style={{
        background: T.sf,
        border: `1px solid ${isWatched ? `${T.wn}66` : T.bd}`,
        borderRadius: 12,
        padding: "12px 16px",
        transition: "border-color 0.2s",
        cursor: "pointer",
      }}>
        {/* 순위 */}
        <span style={{ fontFamily: MO, fontSize: 12, color: T.tx2, textAlign: "right" }}>
          #{rank}
        </span>

        {/* 이름 + 시그널 */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap", overflow: "hidden" }}>
            <span className="stock-name-text" style={{ fontFamily: FT, fontSize: 14, fontWeight: 600 }}>{stock.name}</span>
            <span style={{ fontFamily: MO, fontSize: 10, color: T.tx2, flexShrink: 0 }}>{stock.symbol.replace(".KS", "")}</span>
          </div>
          {stock.signals.length > 0 && (
            <div className="stock-signal-badges" style={{ display: "flex", gap: 4, marginTop: 3 }}>
              {stock.signals.slice(0, 2).map((s) => (
                <span key={s} style={{
                  fontFamily: MO, fontSize: 10,
                  background: `${gradeColor}22`,
                  color: gradeColor,
                  borderRadius: 4, padding: "1px 6px",
                  whiteSpace: "nowrap",
                }}>
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 가격 + 1d */}
        <div style={{ textAlign: "right" }}>
          <div className="tabular-nums" style={{ fontFamily: MO, fontSize: 13 }}>{stock.priceStr}</div>
          <div style={{ fontFamily: MO, fontSize: 11, color: T.tx2 }}>
            1d <PctBadge val={stock.change1d} />
          </div>
        </div>

        {/* 스파크라인 — 모바일 숨김 */}
        <div className="stock-row-hide-mobile">
          <Sparkline data={stock.spark} color={sparkColor} />
        </div>

        {/* 7d / 30d — 모바일 숨김 */}
        <div className="stock-row-hide-mobile" style={{ textAlign: "right" }}>
          <div style={{ marginBottom: 2 }}>
            <PctBadge val={stock.p7d} />
            <span style={{ fontFamily: MO, fontSize: 10, color: T.tx2, marginLeft: 3 }}>7d</span>
          </div>
          <div>
            <PctBadge val={stock.p30d} />
            <span style={{ fontFamily: MO, fontSize: 10, color: T.tx2, marginLeft: 3 }}>30d</span>
          </div>
        </div>

        {/* FlowScore 링 */}
        <FlowScoreRing score={stock.score} size={44} />

        {/* 관심 별표 */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleWatch?.(stock.coinId ?? stock.symbol);
          }}
          style={{
            background: "none",
            border: "none",
            cursor: onToggleWatch ? "pointer" : "default",
            fontSize: 16,
            lineHeight: 1,
            color: isWatched ? T.wn : T.bd,
            padding: 2,
            transition: "color 0.15s, transform 0.1s",
            transform: isWatched ? "scale(1.15)" : "scale(1)",
          }}
          title={isWatched ? "관심 해제" : "관심 추가"}
        >
          {isWatched ? "★" : "☆"}
        </button>

        {/* 알림 벨 */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSetAlert?.(stock);
          }}
          style={{
            background: "none",
            border: "none",
            cursor: onSetAlert ? "pointer" : "default",
            fontSize: 14,
            lineHeight: 1,
            color: hasAlert ? T.pri : T.bd,
            padding: 2,
            transition: "color 0.15s",
          }}
          title={hasAlert ? "알림 설정됨" : "알림 추가"}
        >
          {hasAlert ? "🔔" : "🔕"}
        </button>
      </div>
    </Link>
  );
}
