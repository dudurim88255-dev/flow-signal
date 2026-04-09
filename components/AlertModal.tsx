"use client";
import { useState } from "react";
import { T, FT, MO } from "@/lib/theme";
import type { StockData } from "@/app/api/kospi/route";
import type { Alert } from "@/lib/alerts";

const ALERT_TYPES: { value: Alert["type"]; label: string; hint: string }[] = [
  { value: "price_above", label: "가격 이상 도달", hint: "price" },
  { value: "price_below", label: "가격 이하 하락", hint: "price" },
  { value: "score_above", label: "FlowScore 이상", hint: "score" },
  { value: "score_below", label: "FlowScore 이하", hint: "score" },
];

interface Props {
  stock: StockData;
  existingAlerts: Alert[];
  onAdd: (a: Omit<Alert, "id" | "createdAt">) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

export default function AlertModal({ stock, existingAlerts, onAdd, onRemove, onClose }: Props) {
  const [type, setType] = useState<Alert["type"]>("price_above");
  const [valueStr, setValueStr] = useState("");

  const stockId = stock.coinId ?? stock.symbol;
  const isScore = type.startsWith("score");

  const placeholder = isScore
    ? `현재 ${stock.score}점 (0–100)`
    : `현재 ${stock.priceStr}`;

  function handleAdd() {
    const n = parseFloat(valueStr.replace(/,/g, ""));
    if (isNaN(n) || n <= 0) return;
    if (isScore && n > 100) return;
    onAdd({
      stockId,
      name: stock.name,
      symbol: stock.symbol,
      market: stock.market,
      type,
      value: n,
    });
    setValueStr("");
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.bg,
          border: `1px solid ${T.bd}`,
          borderRadius: 16,
          padding: 24,
          width: "100%", maxWidth: 360,
          display: "flex", flexDirection: "column", gap: 16,
        }}
      >
        {/* 헤더 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: FT, fontSize: 15, fontWeight: 700 }}>🔔 알림 설정</div>
            <div style={{ fontFamily: MO, fontSize: 12, color: T.tx2, marginTop: 3 }}>
              {stock.name}
              <span style={{ marginLeft: 6, opacity: 0.6 }}>{stock.symbol}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none",
              color: T.tx2, cursor: "pointer",
              fontSize: 18, lineHeight: 1, padding: 2,
            }}
          >✕</button>
        </div>

        {/* 기존 알림 목록 */}
        {existingAlerts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontFamily: MO, fontSize: 11, color: T.tx2, fontWeight: 600, letterSpacing: 0.3 }}>
              설정된 알림 ({existingAlerts.length})
            </div>
            {existingAlerts.map(a => {
              const typeLabel = ALERT_TYPES.find(t => t.value === a.type)?.label ?? a.type;
              const valStr = a.type.startsWith("score")
                ? `${a.value}점`
                : a.value.toLocaleString();
              return (
                <div
                  key={a.id}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: T.sf, border: `1px solid ${T.bd}`,
                    borderRadius: 8, padding: "8px 12px",
                  }}
                >
                  <span style={{ fontFamily: MO, fontSize: 12, color: T.tx }}>
                    {typeLabel}{" "}
                    <span style={{ color: T.pri, fontWeight: 600 }}>{valStr}</span>
                  </span>
                  <button
                    onClick={() => onRemove(a.id)}
                    title="삭제"
                    style={{
                      background: "none", border: "none",
                      color: T.dn, cursor: "pointer",
                      fontSize: 14, padding: "0 2px",
                    }}
                  >🗑</button>
                </div>
              );
            })}
          </div>
        )}

        {/* 새 알림 추가 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontFamily: MO, fontSize: 11, color: T.tx2, fontWeight: 600, letterSpacing: 0.3 }}>
            새 알림 추가
          </div>

          <select
            value={type}
            onChange={e => setType(e.target.value as Alert["type"])}
            style={{
              background: T.sf, border: `1px solid ${T.bd}`,
              borderRadius: 8, padding: "9px 12px",
              fontFamily: MO, fontSize: 13, color: T.tx,
              outline: "none", cursor: "pointer",
            }}
          >
            {ALERT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <input
            type="number"
            value={valueStr}
            onChange={e => setValueStr(e.target.value)}
            placeholder={placeholder}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            style={{
              background: T.sf, border: `1px solid ${T.bd}`,
              borderRadius: 8, padding: "9px 12px",
              fontFamily: MO, fontSize: 13, color: T.tx,
              outline: "none",
            }}
          />

          <button
            onClick={handleAdd}
            disabled={!valueStr.trim()}
            style={{
              background: valueStr.trim() ? T.pri : T.bd,
              color: valueStr.trim() ? T.bg : T.tx2,
              border: "none", borderRadius: 8, padding: "11px",
              fontFamily: MO, fontSize: 13, fontWeight: 600,
              cursor: valueStr.trim() ? "pointer" : "default",
              transition: "background 0.15s",
            }}
          >
            알림 추가
          </button>
        </div>

        <div style={{ fontFamily: MO, fontSize: 10, color: T.tx2, textAlign: "center", lineHeight: 1.5 }}>
          알림은 대시보드 접속 후 데이터 로드 시 확인됩니다.<br />
          브라우저에만 저장됩니다.
        </div>
      </div>
    </div>
  );
}
