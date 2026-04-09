export const T = {
  bg: "#0B0E14",
  sf: "#12161F",
  sfEl: "#1A1F2E",
  bd: "#1E2536",
  pri: "#00D4AA",   // teal — 브랜드 컬러
  priD: "rgba(0,212,170,0.15)",
  dn: "#EF4444",
  dnD: "rgba(239,68,68,0.12)",
  ok: "#10B981",
  okD: "rgba(16,185,129,0.12)",
  wn: "#F59E0B",
  wnD: "rgba(245,158,11,0.15)",
  pu: "#8B5CF6",
  puD: "rgba(139,92,246,0.12)",
  tx: "#E8ECF4",
  tx2: "#7A8599",
  tx3: "#4A5568",
};

export const FT = "'Pretendard Variable',Pretendard,-apple-system,sans-serif";
export const MO = "var(--font-mono),'SF Mono',monospace";

// FlowScore 색상
export function scoreColor(score: number): string {
  if (score >= 70) return T.ok;
  if (score >= 45) return T.wn;
  return T.dn;
}

// 등락 색상
export function changeColor(val: number): string {
  if (val > 0) return T.ok;
  if (val < 0) return T.dn;
  return T.tx2;
}
