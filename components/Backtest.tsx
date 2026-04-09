"use client";
import { useMemo } from "react";
import { calculateFlowScore } from "@/lib/flowscore";
import { T, MO, changeColor } from "@/lib/theme";

interface PricePoint { date: string; close: number; volume: number; }

interface Trade {
  type: "BUY" | "SELL";
  date: string;
  price: number;
  score: number;
  pnl?: number; // SELL 시 수익률 (%)
}

interface BacktestResult {
  strategyFinal: number; // 전략 수익률 (%)
  holdFinal: number;     // 단순 보유 수익률 (%)
  trades: Trade[];
  winRate: number;       // 승률 (%)
  tradeCount: number;    // 완성된 매매 수 (매도 기준)
  maxDrawdown: number;   // 최대 낙폭 (%)
}

const BUY_THRESHOLD = 62;
const SELL_THRESHOLD = 42;

function runBacktest(history: PricePoint[]): BacktestResult {
  const closes = history.map(h => h.close);
  const volumes = history.map(h => h.volume);

  let capital = 100;
  let holding = false;
  let buyPrice = 0;
  const trades: Trade[] = [];
  let peak = 100;
  let maxDrawdown = 0;
  let wins = 0;
  let sellCount = 0;

  for (let i = 30; i < history.length - 1; i++) {
    const score = calculateFlowScore(closes.slice(0, i + 1), volumes.slice(0, i + 1)).score;
    const nextPrice = closes[i + 1];
    const nextDate = history[i + 1].date;

    if (!holding && score >= BUY_THRESHOLD) {
      holding = true;
      buyPrice = nextPrice;
      trades.push({ type: "BUY", date: nextDate, price: nextPrice, score });
    } else if (holding && score < SELL_THRESHOLD) {
      const pnl = ((nextPrice - buyPrice) / buyPrice) * 100;
      capital *= nextPrice / buyPrice;
      if (pnl > 0) wins++;
      sellCount++;
      trades.push({ type: "SELL", date: nextDate, price: nextPrice, score, pnl });
      holding = false;
    }

    // 포트폴리오 현재가치로 MDD 추적
    const currentValue = holding ? capital * (nextPrice / buyPrice) : capital;
    if (currentValue > peak) peak = currentValue;
    const dd = ((peak - currentValue) / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // 백테스트 종료 시점에도 포지션 보유 중이면 마지막 종가로 청산
  if (holding) {
    const lastPrice = closes[closes.length - 1];
    capital *= lastPrice / buyPrice;
  }

  const holdFinal = closes.length > 31
    ? ((closes[closes.length - 1] - closes[30]) / closes[30]) * 100
    : 0;

  return {
    strategyFinal: Math.round((capital - 100) * 10) / 10,
    holdFinal: Math.round(holdFinal * 10) / 10,
    trades,
    winRate: sellCount > 0 ? Math.round((wins / sellCount) * 100) : 0,
    tradeCount: sellCount,
    maxDrawdown: Math.round(maxDrawdown * 10) / 10,
  };
}

function ReturnBar({ label, value, maxAbs }: { label: string; value: number; maxAbs: number }) {
  const color = value >= 0 ? T.ok : T.dn;
  const pct = maxAbs === 0 ? 0 : Math.abs(value) / maxAbs;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontFamily: MO, fontSize: 12, color: T.tx2 }}>{label}</span>
        <span style={{ fontFamily: MO, fontSize: 13, color, fontWeight: 700 }}>
          {value > 0 ? "+" : ""}{value}%
        </span>
      </div>
      <div style={{ height: 6, background: T.bd, borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct * 100}%`,
          background: color,
          borderRadius: 3,
          transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
}

interface Props {
  priceHistory: PricePoint[];
  market: "kospi" | "us" | "crypto";
}

export default function Backtest({ priceHistory, market }: Props) {
  const result = useMemo(() => {
    if (priceHistory.length < 35) return null;
    return runBacktest(priceHistory);
  }, [priceHistory]);

  if (!result) {
    return (
      <div style={{
        background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 16,
        padding: "16px 20px", marginBottom: 16,
      }}>
        <div style={{ fontFamily: MO, fontSize: 12, color: T.tx2 }}>
          백테스팅 데이터 부족 (90일 이상 필요)
        </div>
      </div>
    );
  }

  const { strategyFinal, holdFinal, trades, winRate, tradeCount, maxDrawdown } = result;
  const maxAbs = Math.max(Math.abs(strategyFinal), Math.abs(holdFinal), 0.01);
  const diff = Math.round((strategyFinal - holdFinal) * 10) / 10;
  const strategyWon = diff >= 0;

  const priceLabel = market === "kospi"
    ? (v: number) => `${v.toLocaleString("ko-KR")}원`
    : market === "us"
      ? (v: number) => `$${v.toFixed(2)}`
      : (v: number) => `$${v.toFixed(2)}`;

  const recentTrades = [...trades].reverse().slice(0, 8);

  return (
    <div style={{
      background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 16,
      padding: "16px 20px", marginBottom: 16,
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: MO, fontSize: 12, color: T.tx2 }}>FlowScore 백테스팅</div>
          <div style={{ fontFamily: MO, fontSize: 10, color: T.tx2, marginTop: 2, opacity: 0.7 }}>
            매수 ≥{BUY_THRESHOLD}점 · 매도 ＜{SELL_THRESHOLD}점 · 과거 90일
          </div>
        </div>
        <span style={{
          fontFamily: MO, fontSize: 10,
          background: `${T.pri}18`, color: T.pri,
          borderRadius: 4, padding: "2px 8px",
        }}>시뮬레이션</span>
      </div>

      {/* 수익률 비교 바 */}
      <ReturnBar label="FlowScore 전략" value={strategyFinal} maxAbs={maxAbs} />
      <ReturnBar label="단순 보유 (Buy&Hold)" value={holdFinal} maxAbs={maxAbs} />

      {/* 결과 배너 */}
      <div style={{
        background: strategyWon ? `${T.ok}14` : `${T.wn}14`,
        border: `1px solid ${strategyWon ? T.ok : T.wn}44`,
        borderRadius: 8, padding: "10px 14px", marginBottom: 16,
      }}>
        <span style={{ fontFamily: MO, fontSize: 12, color: strategyWon ? T.ok : T.wn }}>
          {strategyWon
            ? `FlowScore 전략이 ${Math.abs(diff)}%p 우수`
            : `단순 보유가 ${Math.abs(diff)}%p 더 유리`}
        </span>
      </div>

      {/* 통계 칩 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          { label: "완성 매매", value: `${tradeCount}회` },
          { label: "승률", value: `${winRate}%` },
          { label: "최대 낙폭", value: `-${maxDrawdown}%` },
        ].map(c => (
          <div key={c.label} style={{
            background: T.sfEl ?? T.bg,
            border: `1px solid ${T.bd}`,
            borderRadius: 8, padding: "6px 12px",
            display: "flex", flexDirection: "column", alignItems: "center",
            minWidth: 72,
          }}>
            <span style={{ fontFamily: MO, fontSize: 11, color: T.tx2 }}>{c.label}</span>
            <span style={{ fontFamily: MO, fontSize: 13, fontWeight: 700, color: T.tx, marginTop: 2 }}>
              {c.value}
            </span>
          </div>
        ))}
      </div>

      {/* 매매 내역 */}
      {recentTrades.length > 0 && (
        <div>
          <div style={{ fontFamily: MO, fontSize: 11, color: T.tx2, marginBottom: 8, fontWeight: 600 }}>
            최근 매매 내역
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {recentTrades.map((t, idx) => (
              <div key={idx} style={{
                display: "grid",
                gridTemplateColumns: "36px 1fr auto auto",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                background: T.bg,
                border: `1px solid ${T.bd}`,
                borderRadius: 6,
              }}>
                <span style={{
                  fontFamily: MO, fontSize: 10, fontWeight: 700,
                  color: t.type === "BUY" ? T.ok : T.dn,
                  background: t.type === "BUY" ? `${T.ok}18` : `${T.dn}18`,
                  borderRadius: 4, padding: "1px 4px", textAlign: "center",
                }}>
                  {t.type === "BUY" ? "매수" : "매도"}
                </span>
                <span style={{ fontFamily: MO, fontSize: 11, color: T.tx2 }}>
                  {t.date.slice(5)} {/* MM-DD */}
                </span>
                <span style={{ fontFamily: MO, fontSize: 11 }}>
                  {priceLabel(t.price)}
                </span>
                {t.pnl !== undefined ? (
                  <span style={{ fontFamily: MO, fontSize: 11, color: changeColor(t.pnl), fontWeight: 700 }}>
                    {t.pnl > 0 ? "+" : ""}{t.pnl.toFixed(1)}%
                  </span>
                ) : (
                  <span style={{ fontFamily: MO, fontSize: 10, color: T.tx2 }}>
                    점수 {t.score}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div style={{ fontFamily: MO, fontSize: 10, color: T.tx2, marginTop: 8, textAlign: "center" }}>
            ※ 백테스팅은 과거 데이터 기반 시뮬레이션이며 미래 수익을 보장하지 않습니다.
          </div>
        </div>
      )}

      {tradeCount === 0 && (
        <div style={{ fontFamily: MO, fontSize: 12, color: T.tx2, textAlign: "center", padding: "8px 0" }}>
          90일 내 완성된 매매 없음 (현재 {trades.length > 0 ? "포지션 보유 중" : "신호 없음"})
        </div>
      )}
    </div>
  );
}
