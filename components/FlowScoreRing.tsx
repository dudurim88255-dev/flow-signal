"use client";
import { T, MO, scoreColor } from "@/lib/theme";

interface Props {
  score: number;
  size?: number;
}

export default function FlowScoreRing({ score, size = 48 }: Props) {
  const color = scoreColor(score);
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* 배경 트랙 */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.bd} strokeWidth={3} />
        {/* 점수 호 */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      {/* 중앙 숫자 */}
      <span style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: MO, fontSize: size * 0.28, fontWeight: 700, color,
      }}>
        {score}
      </span>
    </div>
  );
}
