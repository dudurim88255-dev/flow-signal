"use client";
import { T, MO } from "@/lib/theme";

interface PricePoint {
  date: string;
  close: number;
  volume: number;
}

interface Props {
  data: PricePoint[];
  ma20: number;
  ma60: number;
  color: string;
}

const W = 680;
const H_PRICE = 180;
const H_VOL = 40;
const H_TOTAL = H_PRICE + H_VOL + 12;
const PAD_L = 8;
const PAD_R = 8;

function calcMA(closes: number[], period: number, idx: number): number | null {
  if (idx < period - 1) return null;
  const slice = closes.slice(idx - period + 1, idx + 1);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export default function PriceChart({ data, color }: Props) {
  if (!data || data.length < 2) {
    return <div style={{ width: "100%", height: H_TOTAL, background: T.sf, borderRadius: 8 }} />;
  }

  const closes = data.map((d) => d.close);
  const volumes = data.map((d) => d.volume);

  const minP = Math.min(...closes);
  const maxP = Math.max(...closes);
  const rangeP = maxP - minP || 1;
  const maxV = Math.max(...volumes) || 1;

  const n = data.length;
  const xOf = (i: number) => PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R);
  const yOfPrice = (v: number) => 4 + ((maxP - v) / rangeP) * (H_PRICE - 8);
  const yOfVol = (v: number) => H_PRICE + 12 + H_VOL - (v / maxV) * H_VOL;

  // 가격 라인 포인트
  const linePts = closes.map((c, i) => `${xOf(i)},${yOfPrice(c)}`).join(" ");

  // 영역 채우기 (area)
  const areaPath = [
    `M ${xOf(0)},${yOfPrice(closes[0])}`,
    ...closes.map((c, i) => `L ${xOf(i)},${yOfPrice(c)}`),
    `L ${xOf(n - 1)},${H_PRICE}`,
    `L ${xOf(0)},${H_PRICE}`,
    "Z",
  ].join(" ");

  // MA20 라인
  const ma20Pts = closes
    .map((_, i) => {
      const v = calcMA(closes, 20, i);
      return v !== null ? `${xOf(i)},${yOfPrice(v)}` : null;
    })
    .filter(Boolean)
    .join(" ");

  // MA60 라인
  const ma60Pts = closes
    .map((_, i) => {
      const v = calcMA(closes, 60, i);
      return v !== null ? `${xOf(i)},${yOfPrice(v)}` : null;
    })
    .filter(Boolean)
    .join(" ");

  // 가격 레이블 (최고/최저/현재)
  const labelStyle = { fontFamily: MO, fontSize: 10, fill: T.tx2 };

  // 날짜 레이블 (첫날, 중간, 마지막)
  const dateLabels = [0, Math.floor(n / 2), n - 1].map((i) => ({
    x: xOf(i),
    label: data[i].date.slice(5), // MM-DD
  }));

  return (
    <svg
      viewBox={`0 0 ${W} ${H_TOTAL}`}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {/* 그리드 라인 */}
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={PAD_L} x2={W - PAD_R}
          y1={4 + t * (H_PRICE - 8)} y2={4 + t * (H_PRICE - 8)}
          stroke={T.bd} strokeWidth={1} strokeDasharray="3 3"
        />
      ))}

      {/* 영역 채우기 */}
      <defs>
        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#priceGrad)" />

      {/* MA60 */}
      {ma60Pts && (
        <polyline points={ma60Pts} fill="none" stroke={T.pu} strokeWidth={1} strokeOpacity={0.7} strokeDasharray="4 2" />
      )}

      {/* MA20 */}
      {ma20Pts && (
        <polyline points={ma20Pts} fill="none" stroke={T.wn} strokeWidth={1} strokeOpacity={0.8} />
      )}

      {/* 가격 라인 */}
      <polyline points={linePts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />

      {/* 현재가 점 */}
      <circle cx={xOf(n - 1)} cy={yOfPrice(closes[n - 1])} r={3} fill={color} />

      {/* 가격 레이블 */}
      <text x={W - PAD_R} y={yOfPrice(maxP) + 3} textAnchor="end" {...labelStyle}>
        {maxP >= 1000 ? maxP.toLocaleString() : maxP.toFixed(2)}
      </text>
      <text x={W - PAD_R} y={yOfPrice(minP) - 2} textAnchor="end" {...labelStyle}>
        {minP >= 1000 ? minP.toLocaleString() : minP.toFixed(2)}
      </text>

      {/* 거래량 바 */}
      {volumes.map((v, i) => (
        <rect
          key={i}
          x={xOf(i) - (W / n) * 0.3}
          y={yOfVol(v)}
          width={(W / n) * 0.6}
          height={H_PRICE + 12 + H_VOL - yOfVol(v)}
          fill={closes[i] >= (closes[i - 1] ?? closes[i]) ? color : T.dn}
          opacity={0.4}
        />
      ))}

      {/* 날짜 레이블 */}
      {dateLabels.map(({ x, label }, i) => (
        <text
          key={i}
          x={x}
          y={H_TOTAL}
          textAnchor="middle"
          fontFamily={MO}
          fontSize={9}
          fill={T.tx2}
        >
          {label}
        </text>
      ))}

      {/* MA 범례 */}
      <g transform={`translate(${PAD_L}, ${H_PRICE - 2})`}>
        <line x1={0} y1={-4} x2={16} y2={-4} stroke={T.wn} strokeWidth={1.5} />
        <text x={20} y={-1} fontFamily={MO} fontSize={9} fill={T.wn}>MA20</text>
        <line x1={50} y1={-4} x2={66} y2={-4} stroke={T.pu} strokeWidth={1.5} strokeDasharray="4 2" />
        <text x={70} y={-1} fontFamily={MO} fontSize={9} fill={T.pu}>MA60</text>
      </g>
    </svg>
  );
}
