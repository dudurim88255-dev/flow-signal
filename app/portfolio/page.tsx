"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { T, FT, MO, changeColor, scoreColor } from "@/lib/theme";
import { usePortfolio, type Holding } from "@/lib/portfolio";
import type { StockData } from "@/app/api/kospi/route";

// 보유 종목에 현재가 매핑
interface HoldingWithPrice extends Holding {
  currentPrice?: number;
  priceStr?: string;
  pnlAmt?: number;   // 평가손익 (매수통화)
  pnlPct?: number;   // 수익률 %
  evalAmt?: number;  // 평가금액
  score?: number;
  grade?: string;
}

// ── 자산 배분 바 ─────────────────────────────────────
function AllocationBar({ holdings }: { holdings: HoldingWithPrice[] }) {
  const segments = useMemo(() => {
    const total = holdings.reduce((s, h) => s + (h.evalAmt ?? h.buyPrice * h.qty), 0);
    if (total === 0) return [];
    const byMarket: Record<string, number> = {};
    for (const h of holdings) {
      const key = h.market;
      byMarket[key] = (byMarket[key] ?? 0) + (h.evalAmt ?? h.buyPrice * h.qty);
    }
    const colors: Record<string, string> = { kospi: T.pri, us: T.pu, crypto: T.wn };
    const labels: Record<string, string> = { kospi: "KOSPI", us: "US", crypto: "CRYPTO" };
    return Object.entries(byMarket).map(([market, amt]) => ({
      market,
      label: labels[market] ?? market,
      color: colors[market] ?? T.tx2,
      pct: Math.round((amt / total) * 1000) / 10,
    }));
  }, [holdings]);

  if (segments.length === 0) return null;

  return (
    <div style={{
      background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 12,
      padding: "14px 20px", marginBottom: 16,
    }}>
      <div style={{ fontFamily: MO, fontSize: 11, color: T.tx2, marginBottom: 10, fontWeight: 600 }}>
        자산 배분
      </div>
      {/* 비율 바 */}
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 10, gap: 2 }}>
        {segments.map(seg => (
          <div key={seg.market} style={{
            width: `${seg.pct}%`, height: "100%",
            background: seg.color, borderRadius: 2,
          }} />
        ))}
      </div>
      {/* 범례 */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {segments.map(seg => (
          <div key={seg.market} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color }} />
            <span style={{ fontFamily: MO, fontSize: 11, color: T.tx2 }}>
              {seg.label} <span style={{ color: T.tx, fontWeight: 700 }}>{seg.pct}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 포트폴리오 FlowScore (가중평균) ──────────────────
function PortfolioFlowScore({ holdings }: { holdings: HoldingWithPrice[] }) {
  const scored = holdings.filter(h => h.score !== undefined && h.evalAmt !== undefined);
  if (scored.length === 0) return null;

  const totalEval = scored.reduce((s, h) => s + (h.evalAmt ?? 0), 0);
  if (totalEval === 0) return null;
  const weightedScore = scored.reduce((s, h) => s + (h.score! * (h.evalAmt! / totalEval)), 0);
  const avg = Math.round(weightedScore);
  const color = scoreColor(avg);
  const alerts = holdings.filter(h => h.score !== undefined && h.score < 42);

  return (
    <div style={{
      background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 12,
      padding: "14px 20px", marginBottom: 16,
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <div>
        <div style={{ fontFamily: MO, fontSize: 11, color: T.tx2, marginBottom: 4, fontWeight: 600 }}>
          포트폴리오 FlowScore
        </div>
        <div style={{ fontFamily: MO, fontSize: 11, color: T.tx2 }}>
          보유 종목 가중평균
        </div>
        {alerts.length > 0 && (
          <div style={{ fontFamily: MO, fontSize: 11, color: T.dn, marginTop: 6 }}>
            ⚠ {alerts.map(h => h.name).join(", ")} 주의 구간
          </div>
        )}
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: FT, fontSize: 32, fontWeight: 900,
          color, lineHeight: 1,
        }}>{avg}</div>
        <div style={{
          fontFamily: MO, fontSize: 11, fontWeight: 700,
          color,
          background: `${color}18`,
          borderRadius: 4, padding: "2px 8px", marginTop: 4,
        }}>
          {avg >= 70 ? "매수" : avg >= 45 ? "관망" : "주의"}
        </div>
      </div>
    </div>
  );
}

function fmtPrice(price: number, market: Holding["market"]): string {
  if (market === "kospi") return `${Math.round(price).toLocaleString("ko-KR")}원`;
  if (price >= 1000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

function fmtAmt(amt: number, market: Holding["market"]): string {
  if (market === "kospi") {
    if (Math.abs(amt) >= 100_000_000) return `${(amt / 100_000_000).toFixed(1)}억원`;
    if (Math.abs(amt) >= 10_000) return `${(amt / 10_000).toFixed(0)}만원`;
    return `${Math.round(amt).toLocaleString("ko-KR")}원`;
  }
  if (Math.abs(amt) >= 1_000_000) return `$${(amt / 1_000_000).toFixed(2)}M`;
  if (Math.abs(amt) >= 1_000) return `$${(amt / 1_000).toFixed(1)}K`;
  return `$${amt.toFixed(2)}`;
}

// 매수 추가 모달
function AddHoldingModal({
  onAdd,
  onClose,
  allStocks,
}: {
  onAdd: (h: Omit<Holding, "addedAt">) => void;
  onClose: () => void;
  allStocks: StockData[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StockData | null>(null);
  const [qty, setQty] = useState("");
  const [buyPrice, setBuyPrice] = useState("");

  const results = query.length >= 1
    ? allStocks.filter((s) =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.symbol.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : [];

  function handleAdd() {
    if (!selected || !qty || !buyPrice) return;
    onAdd({
      id: selected.coinId ?? selected.symbol,
      name: selected.name,
      symbol: selected.symbol,
      market: selected.market,
      qty: parseFloat(qty),
      buyPrice: parseFloat(buyPrice),
    });
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 16,
        padding: "24px 20px", width: "100%", maxWidth: 400,
      }}>
        <div style={{ fontFamily: FT, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          보유 종목 추가
        </div>

        {/* 종목 검색 */}
        {!selected ? (
          <>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="종목명 또는 심볼 검색…"
              style={{
                width: "100%", boxSizing: "border-box",
                background: T.sfEl, border: `1px solid ${T.bd}`,
                borderRadius: 8, padding: "9px 12px",
                fontFamily: MO, fontSize: 13, color: T.tx, outline: "none", marginBottom: 8,
              }}
            />
            {results.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {results.map((s) => (
                  <button key={s.coinId ?? s.symbol}
                    onClick={() => {
                      setSelected(s);
                      setBuyPrice(String(s.price));
                    }}
                    style={{
                      background: T.sfEl, border: `1px solid ${T.bd}`, borderRadius: 8,
                      padding: "10px 12px", cursor: "pointer", textAlign: "left",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}
                  >
                    <div>
                      <span style={{ fontFamily: FT, fontSize: 13, color: T.tx }}>{s.name}</span>
                      <span style={{ fontFamily: MO, fontSize: 11, color: T.tx2, marginLeft: 6 }}>{s.symbol}</span>
                    </div>
                    <span style={{ fontFamily: MO, fontSize: 12, color: T.tx2 }}>{s.priceStr}</span>
                  </button>
                ))}
              </div>
            )}
            {query.length >= 1 && results.length === 0 && (
              <div style={{ fontFamily: MO, fontSize: 12, color: T.tx2, padding: "8px 0" }}>
                검색 결과 없음
              </div>
            )}
          </>
        ) : (
          <>
            {/* 선택된 종목 */}
            <div style={{
              background: T.sfEl, border: `1px solid ${T.bd}`, borderRadius: 8,
              padding: "10px 12px", marginBottom: 16,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <span style={{ fontFamily: FT, fontSize: 13, color: T.tx }}>{selected.name}</span>
                <span style={{ fontFamily: MO, fontSize: 11, color: T.tx2, marginLeft: 6 }}>{selected.symbol}</span>
              </div>
              <button
                onClick={() => { setSelected(null); setQuery(""); }}
                style={{ background: "none", border: "none", color: T.tx2, cursor: "pointer", fontSize: 14 }}
              >✕</button>
            </div>

            {/* 수량 */}
            <label style={{ fontFamily: MO, fontSize: 11, color: T.tx2, display: "block", marginBottom: 4 }}>
              수량
            </label>
            <input
              autoFocus
              type="number"
              min="0"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="예: 10"
              style={{
                width: "100%", boxSizing: "border-box",
                background: T.sfEl, border: `1px solid ${T.bd}`,
                borderRadius: 8, padding: "9px 12px", marginBottom: 12,
                fontFamily: MO, fontSize: 13, color: T.tx, outline: "none",
              }}
            />

            {/* 평균 매수가 */}
            <label style={{ fontFamily: MO, fontSize: 11, color: T.tx2, display: "block", marginBottom: 4 }}>
              평균 매수가 {selected.market === "kospi" ? "(원)" : "(USD)"}
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder={selected.market === "kospi" ? "예: 75000" : "예: 3200"}
              style={{
                width: "100%", boxSizing: "border-box",
                background: T.sfEl, border: `1px solid ${T.bd}`,
                borderRadius: 8, padding: "9px 12px", marginBottom: 16,
                fontFamily: MO, fontSize: 13, color: T.tx, outline: "none",
              }}
            />

            <button
              onClick={handleAdd}
              disabled={!qty || !buyPrice || parseFloat(qty) <= 0}
              style={{
                width: "100%", fontFamily: FT, fontSize: 14, fontWeight: 700,
                color: T.bg, background: T.pri, border: "none", borderRadius: 10,
                padding: "12px 0", cursor: "pointer",
                opacity: (!qty || !buyPrice || parseFloat(qty) <= 0) ? 0.4 : 1,
              }}
            >추가하기</button>
          </>
        )}

        <button
          onClick={onClose}
          style={{
            width: "100%", marginTop: 8, fontFamily: MO, fontSize: 13,
            color: T.tx2, background: "none", border: "none", cursor: "pointer", padding: "8px 0",
          }}
        >취소</button>
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const router = useRouter();
  const portfolio = usePortfolio();
  const [showAdd, setShowAdd] = useState(false);
  const [allStocks, setAllStocks] = useState<StockData[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editBuyPrice, setEditBuyPrice] = useState("");

  // 전체 종목 목록 + 현재가 로드
  useEffect(() => {
    async function loadPrices() {
      try {
        const [kospi, us, crypto] = await Promise.all([
          fetch("/api/kospi").then((r) => r.json()),
          fetch("/api/us").then((r) => r.json()),
          fetch("/api/crypto").then((r) => r.json()),
        ]);
        const stocks: StockData[] = [
          ...(Array.isArray(kospi) ? kospi : kospi.stocks ?? []),
          ...(Array.isArray(us) ? us : us.stocks ?? []),
          ...(Array.isArray(crypto) ? crypto : crypto.stocks ?? []),
        ];
        setAllStocks(stocks);
        const priceMap: Record<string, number> = {};
        for (const s of stocks) {
          priceMap[s.coinId ?? s.symbol] = s.price;
        }
        setPrices(priceMap);
      } catch { /* 무시 */ }
    }
    loadPrices();
  }, []);

  const holdingsWithPrice: HoldingWithPrice[] = portfolio.holdings.map((h) => {
    const stock = allStocks.find(s => (s.coinId ?? s.symbol) === h.id);
    const cp = prices[h.id];
    if (cp === undefined) return { ...h, score: stock?.score, grade: stock?.grade };
    const evalAmt = cp * h.qty;
    const costAmt = h.buyPrice * h.qty;
    const pnlAmt = evalAmt - costAmt;
    const pnlPct = costAmt > 0 ? (pnlAmt / costAmt) * 100 : 0;
    return {
      ...h,
      currentPrice: cp,
      priceStr: fmtPrice(cp, h.market),
      pnlAmt,
      pnlPct: Math.round(pnlPct * 10) / 10,
      evalAmt,
      score: stock?.score,
      grade: stock?.grade,
    };
  });

  // 통화별 합산
  const krwHoldings = holdingsWithPrice.filter((h) => h.market === "kospi");
  const usdHoldings = holdingsWithPrice.filter((h) => h.market !== "kospi");
  const totalKRW = krwHoldings.reduce((s, h) => s + (h.evalAmt ?? 0), 0);
  const totalKRWCost = krwHoldings.reduce((s, h) => s + h.buyPrice * h.qty, 0);
  const totalUSD = usdHoldings.reduce((s, h) => s + (h.evalAmt ?? 0), 0);
  const totalUSDCost = usdHoldings.reduce((s, h) => s + h.buyPrice * h.qty, 0);
  const totalPnlKRW = totalKRW - totalKRWCost;
  const totalPnlUSD = totalUSD - totalUSDCost;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.tx }}>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 16px 80px" }}>

        {/* 뒤로 */}
        <button
          onClick={() => router.back()}
          style={{
            fontFamily: MO, fontSize: 12, color: T.tx2,
            background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4,
            padding: "4px 0", marginBottom: 24,
          }}
        >← 돌아가기</button>

        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontFamily: FT, fontSize: 20, fontWeight: 800 }}>
            내 포트폴리오
          </div>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              fontFamily: FT, fontSize: 13, fontWeight: 700,
              color: T.bg, background: T.pri, border: "none",
              borderRadius: 8, padding: "8px 16px", cursor: "pointer",
            }}
          >+ 종목 추가</button>
        </div>

        {/* 자산 배분 + 포트폴리오 FlowScore */}
        {portfolio.holdings.length > 0 && (
          <>
            <AllocationBar holdings={holdingsWithPrice} />
            <PortfolioFlowScore holdings={holdingsWithPrice} />
          </>
        )}

        {/* 요약 카드 */}
        {portfolio.holdings.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
            {totalKRW > 0 && (
              <div style={{ background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ fontFamily: MO, fontSize: 11, color: T.tx2, marginBottom: 6 }}>국내 평가금액</div>
                <div style={{ fontFamily: FT, fontSize: 20, fontWeight: 700 }}>{fmtAmt(totalKRW, "kospi")}</div>
                <div style={{ fontFamily: MO, fontSize: 12, color: changeColor(totalPnlKRW), marginTop: 4 }}>
                  {totalPnlKRW >= 0 ? "+" : ""}{fmtAmt(totalPnlKRW, "kospi")}
                  {totalKRWCost > 0 && (
                    <span style={{ marginLeft: 4 }}>
                      ({totalPnlKRW >= 0 ? "+" : ""}{Math.round((totalPnlKRW / totalKRWCost) * 1000) / 10}%)
                    </span>
                  )}
                </div>
              </div>
            )}
            {totalUSD > 0 && (
              <div style={{ background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ fontFamily: MO, fontSize: 11, color: T.tx2, marginBottom: 6 }}>해외·코인 평가금액</div>
                <div style={{ fontFamily: FT, fontSize: 20, fontWeight: 700 }}>{fmtAmt(totalUSD, "us")}</div>
                <div style={{ fontFamily: MO, fontSize: 12, color: changeColor(totalPnlUSD), marginTop: 4 }}>
                  {totalPnlUSD >= 0 ? "+" : ""}{fmtAmt(totalPnlUSD, "us")}
                  {totalUSDCost > 0 && (
                    <span style={{ marginLeft: 4 }}>
                      ({totalPnlUSD >= 0 ? "+" : ""}{Math.round((totalPnlUSD / totalUSDCost) * 1000) / 10}%)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 보유 종목 리스트 */}
        {portfolio.holdings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
            <div style={{ fontFamily: FT, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>보유 종목이 없습니다</div>
            <div style={{ fontFamily: MO, fontSize: 13, color: T.tx2, marginBottom: 24 }}>
              종목을 추가해 수익률을 추적하세요.
            </div>
            <button
              onClick={() => setShowAdd(true)}
              style={{
                fontFamily: FT, fontSize: 14, fontWeight: 700,
                color: T.bg, background: T.pri, border: "none",
                borderRadius: 10, padding: "12px 28px", cursor: "pointer",
              }}
            >+ 첫 종목 추가</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {holdingsWithPrice.map((h) => (
              <div key={h.id} style={{
                background: T.sf, border: `1px solid ${T.bd}`, borderRadius: 12, padding: "14px 16px",
              }}>
                {editingId === h.id ? (
                  // 편집 모드
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontFamily: FT, fontSize: 14, fontWeight: 600 }}>{h.name}</div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontFamily: MO, fontSize: 11, color: T.tx2, display: "block", marginBottom: 3 }}>수량</label>
                        <input
                          type="number" min="0" step="any"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          style={{
                            width: "100%", boxSizing: "border-box",
                            background: T.sfEl, border: `1px solid ${T.bd}`, borderRadius: 6,
                            padding: "7px 10px", fontFamily: MO, fontSize: 13, color: T.tx, outline: "none",
                          }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontFamily: MO, fontSize: 11, color: T.tx2, display: "block", marginBottom: 3 }}>
                          평균 매수가 {h.market === "kospi" ? "(원)" : "(USD)"}
                        </label>
                        <input
                          type="number" min="0" step="any"
                          value={editBuyPrice}
                          onChange={(e) => setEditBuyPrice(e.target.value)}
                          style={{
                            width: "100%", boxSizing: "border-box",
                            background: T.sfEl, border: `1px solid ${T.bd}`, borderRadius: 6,
                            padding: "7px 10px", fontFamily: MO, fontSize: 13, color: T.tx, outline: "none",
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => {
                          if (editQty && editBuyPrice) {
                            portfolio.update(h.id, parseFloat(editQty), parseFloat(editBuyPrice));
                          }
                          setEditingId(null);
                        }}
                        style={{
                          flex: 1, fontFamily: FT, fontSize: 13, fontWeight: 700,
                          color: T.bg, background: T.pri, border: "none", borderRadius: 8,
                          padding: "8px 0", cursor: "pointer",
                        }}
                      >저장</button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{
                          flex: 1, fontFamily: MO, fontSize: 13, color: T.tx2,
                          background: "transparent", border: `1px solid ${T.bd}`, borderRadius: 8,
                          padding: "8px 0", cursor: "pointer",
                        }}
                      >취소</button>
                    </div>
                  </div>
                ) : (
                  // 보기 모드
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 12 }}>
                    <Link
                      href={`/stock/${encodeURIComponent(h.id)}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: FT, fontSize: 14, fontWeight: 600 }}>{h.name}</span>
                        {h.score !== undefined && (
                          <span style={{
                            fontFamily: MO, fontSize: 10, fontWeight: 700,
                            color: scoreColor(h.score),
                            background: `${scoreColor(h.score)}18`,
                            borderRadius: 4, padding: "1px 6px",
                          }}>
                            {h.score}
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: MO, fontSize: 11, color: T.tx2, marginTop: 2 }}>
                        {h.qty}주 · 매수 {fmtPrice(h.buyPrice, h.market)}
                        {h.priceStr && <span style={{ marginLeft: 6 }}>→ 현재 {h.priceStr}</span>}
                      </div>
                    </Link>

                    <div style={{ textAlign: "right" }}>
                      {h.evalAmt !== undefined && (
                        <div style={{ fontFamily: MO, fontSize: 13 }}>{fmtAmt(h.evalAmt, h.market)}</div>
                      )}
                      {h.pnlPct !== undefined && (
                        <div style={{
                          fontFamily: MO, fontSize: 12,
                          color: changeColor(h.pnlPct),
                        }}>
                          {h.pnlPct >= 0 ? "+" : ""}{h.pnlPct}%
                          {h.pnlAmt !== undefined && (
                            <span style={{ marginLeft: 4 }}>
                              ({h.pnlAmt >= 0 ? "+" : ""}{fmtAmt(h.pnlAmt, h.market)})
                            </span>
                          )}
                        </div>
                      )}
                      {h.currentPrice === undefined && (
                        <div style={{ fontFamily: MO, fontSize: 11, color: T.tx2 }}>가격 로드 중…</div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <button
                        onClick={() => {
                          setEditingId(h.id);
                          setEditQty(String(h.qty));
                          setEditBuyPrice(String(h.buyPrice));
                        }}
                        style={{
                          fontFamily: MO, fontSize: 11, color: T.tx2,
                          background: "transparent", border: `1px solid ${T.bd}`,
                          borderRadius: 5, padding: "3px 8px", cursor: "pointer",
                        }}
                      >수정</button>
                      <button
                        onClick={() => { if (confirm(`${h.name} 삭제?`)) portfolio.remove(h.id); }}
                        style={{
                          fontFamily: MO, fontSize: 11, color: T.dn,
                          background: "transparent", border: `1px solid ${T.dn}44`,
                          borderRadius: 5, padding: "3px 8px", cursor: "pointer",
                        }}
                      >삭제</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 면책 */}
        <div style={{ marginTop: 40, textAlign: "center", fontFamily: MO, fontSize: 11, color: T.tx2 }}>
          포트폴리오는 브라우저에만 저장됩니다. 투자 결정은 본인 책임입니다.
        </div>
      </div>

      {showAdd && (
        <AddHoldingModal
          onAdd={portfolio.add}
          onClose={() => setShowAdd(false)}
          allStocks={allStocks}
        />
      )}
    </div>
  );
}
