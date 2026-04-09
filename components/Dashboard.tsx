"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { T, FT, MO, scoreColor, changeColor } from "@/lib/theme";
import type { StockData } from "@/app/api/kospi/route";
import StockRow from "./StockRow";
import SectorHeatmap from "./SectorHeatmap";
import AlertModal from "./AlertModal";
import { useWatchlist } from "@/lib/watchlist";
import { useAlerts, checkAlerts } from "@/lib/alerts";

type Tab = "kospi" | "us" | "crypto" | "watchlist";

interface MarketState {
  data: StockData[];
  loading: boolean;
  error: string | null;
  updatedAt: Date | null;
}

const EMPTY: MarketState = { data: [], loading: false, error: null, updatedAt: null };

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: FT,
        fontSize: 14,
        fontWeight: active ? 700 : 400,
        color: active ? T.tx : T.tx2,
        background: active ? T.sf : "transparent",
        border: `1px solid ${active ? T.bd : "transparent"}`,
        borderRadius: 8,
        padding: "6px 16px",
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function SignalBadge({ signal, color }: { signal: string; color: string }) {
  return (
    <span style={{
      fontFamily: MO,
      fontSize: 11,
      background: `${color}22`,
      color,
      borderRadius: 4,
      padding: "2px 7px",
      whiteSpace: "nowrap",
    }}>
      {signal}
    </span>
  );
}

function LiveDot() {
  return (
    <span style={{
      display: "inline-block",
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: T.ok,
      animation: "pulse-dot 1.8s ease-in-out infinite",
      flexShrink: 0,
    }} />
  );
}

function LoadingSpinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        border: `3px solid ${T.bd}`,
        borderTopColor: T.pri,
        animation: "spin 0.7s linear infinite",
      }} />
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{
      background: `${T.dn}18`,
      border: `1px solid ${T.dn}44`,
      borderRadius: 10,
      padding: "16px 20px",
      fontFamily: MO,
      fontSize: 13,
      color: T.dn,
      textAlign: "center",
    }}>
      ⚠ {msg}
    </div>
  );
}

// 전체 시장에서 상위 시그널 수집
function collectTopSignals(markets: Record<Exclude<Tab, "watchlist">, MarketState>) {
  const result: { name: string; signal: string; score: number; market: Exclude<Tab, "watchlist"> }[] = [];
  for (const tab of ["kospi", "us", "crypto"] as Exclude<Tab, "watchlist">[]) {
    for (const stock of markets[tab].data.slice(0, 5)) {
      for (const sig of stock.signals.slice(0, 1)) {
        result.push({ name: stock.name, signal: sig, score: stock.score, market: tab });
      }
    }
  }
  return result.sort((a, b) => b.score - a.score).slice(0, 8);
}

const TAB_LABELS: Record<Tab, string> = {
  kospi: "🇰🇷 코스피",
  us: "🇺🇸 미국",
  crypto: "🪙 코인",
  watchlist: "⭐ 관심",
};

const API_PATHS: Record<Exclude<Tab, "watchlist">, string> = {
  kospi: "/api/kospi",
  us: "/api/us",
  crypto: "/api/crypto",
};

type SortKey = "score" | "change1d" | "p7d" | "p30d" | "volRatio";

const SORT_LABELS: Record<SortKey, string> = {
  score: "FlowScore",
  change1d: "1일",
  p7d: "7일",
  p30d: "30일",
  volRatio: "거래량",
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("kospi");
  const [markets, setMarkets] = useState<Record<Exclude<Tab, "watchlist">, MarketState>>({
    kospi: EMPTY,
    us: EMPTY,
    crypto: EMPTY,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [gradeFilter, setGradeFilter] = useState<string>("전체");
  const [alertModalStock, setAlertModalStock] = useState<StockData | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const watchlist = useWatchlist();
  const alerts = useAlerts();

  const fetchMarket = useCallback(async (tab: Exclude<Tab, "watchlist">) => {
    setMarkets(prev => ({
      ...prev,
      [tab]: { ...prev[tab], loading: true, error: null },
    }));
    try {
      const res = await fetch(API_PATHS[tab]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data: StockData[] = Array.isArray(json) ? json : (json.stocks ?? []);
      setMarkets(prev => ({
        ...prev,
        [tab]: { data, loading: false, error: null, updatedAt: new Date() },
      }));
    } catch (e) {
      setMarkets(prev => ({
        ...prev,
        [tab]: { ...prev[tab], loading: false, error: e instanceof Error ? e.message : "오류 발생" },
      }));
    }
  }, []);

  // 초기 로드: 모든 시장 병렬 fetch
  useEffect(() => {
    fetchMarket("kospi");
    fetchMarket("us");
    fetchMarket("crypto");
  }, [fetchMarket]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchMarket("kospi"), fetchMarket("us"), fetchMarket("crypto")]);
    setRefreshing(false);
  };

  const topSignals = collectTopSignals(markets);
  const isWatchlistTab = activeTab === "watchlist";
  const current = isWatchlistTab ? EMPTY : markets[activeTab];

  // 전체 종목 합산 (히트맵, 알림 체크용)
  const allStocks = useMemo(() => [
    ...markets.kospi.data,
    ...markets.us.data,
    ...markets.crypto.data,
  ], [markets.kospi.data, markets.us.data, markets.crypto.data]);

  // 발동된 알림 목록
  const triggeredAlerts = useMemo(
    () => checkAlerts(alerts.alerts, allStocks),
    [alerts.alerts, allStocks]
  );

  // 관심 종목 탭 데이터
  const watchlistData = allStocks.filter((s) => watchlist.has(s.coinId ?? s.symbol));

  // 검색 + 필터 + 정렬
  const filteredData = (isWatchlistTab ? watchlistData : current.data)
    .filter((s) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q);
    })
    .filter((s) => gradeFilter === "전체" || s.grade === gradeFilter)
    .sort((a, b) => b[sortKey] - a[sortKey]);

  const updatedStr = current.updatedAt
    ? current.updatedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "20px 16px 60px" }}>

      {/* 알림 발동 배너 */}
      {triggeredAlerts.length > 0 && !alertDismissed && (
        <div style={{
          background: `${T.pri}18`,
          border: `1px solid ${T.pri}55`,
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>🔔</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FT, fontSize: 13, fontWeight: 700, color: T.pri, marginBottom: 4 }}>
              알림 조건 도달 ({triggeredAlerts.length}개)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {triggeredAlerts.map(({ alert, currentValue }) => {
                const typeLabel =
                  alert.type === "price_above" ? "이상" :
                  alert.type === "price_below" ? "이하" :
                  alert.type === "score_above" ? "점 이상" : "점 이하";
                const isScore = alert.type.startsWith("score");
                const valStr = isScore ? `${alert.value}${typeLabel}` : `${alert.value.toLocaleString()}${typeLabel}`;
                const curStr = isScore ? `현재 ${Math.round(currentValue)}점` : `현재 ${currentValue.toLocaleString()}`;
                return (
                  <div key={alert.id} style={{ fontFamily: MO, fontSize: 12, color: T.tx }}>
                    <span style={{ fontWeight: 600 }}>{alert.name}</span>
                    {" — "}
                    <span style={{ color: T.tx2 }}>{isScore ? "FlowScore " : "가격 "}{valStr} ({curStr})</span>
                  </div>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => setAlertDismissed(true)}
            style={{
              background: "none", border: "none",
              color: T.tx2, cursor: "pointer",
              fontSize: 16, lineHeight: 1, flexShrink: 0,
            }}
          >✕</button>
        </div>
      )}

      {/* 헤더 */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: FT, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
            Flow<span style={{ color: T.pri }}>Signal</span>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: `${T.ok}18`, border: `1px solid ${T.ok}44`, borderRadius: 20, padding: "3px 10px" }}>
            <LiveDot />
            <span style={{ fontFamily: MO, fontSize: 11, color: T.ok }}>LIVE</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {updatedStr && (
            <span style={{ fontFamily: MO, fontSize: 11, color: T.tx2 }}>
              {updatedStr} 기준
            </span>
          )}
          <Link href="/portfolio" style={{
            fontFamily: MO, fontSize: 12, color: T.pri,
            background: `${T.pri}18`,
            border: `1px solid ${T.pri}44`,
            borderRadius: 6, padding: "5px 12px",
            textDecoration: "none", whiteSpace: "nowrap",
          }}>
            📊 포트폴리오
          </Link>
          <Link href="/pricing" style={{
            fontFamily: MO, fontSize: 12, color: T.wn,
            background: `${T.wn}18`,
            border: `1px solid ${T.wn}44`,
            borderRadius: 6, padding: "5px 12px",
            textDecoration: "none", whiteSpace: "nowrap",
          }}>
            ✦ 프리미엄
          </Link>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              fontFamily: MO,
              fontSize: 12,
              color: refreshing ? T.tx2 : T.pri,
              background: "transparent",
              border: `1px solid ${refreshing ? T.bd : T.pri}44`,
              borderRadius: 6,
              padding: "5px 12px",
              cursor: refreshing ? "default" : "pointer",
              transition: "all 0.15s",
            }}
          >
            {refreshing ? "갱신 중..." : "↻ 새로고침"}
          </button>
        </div>
      </div>

      {/* 시그널 피드 */}
      {topSignals.length > 0 && (
        <div style={{
          background: T.sf,
          border: `1px solid ${T.bd}`,
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 20,
        }}>
          <div style={{ fontFamily: FT, fontSize: 12, fontWeight: 700, color: T.tx2, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            🔔 상위 시그널
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {topSignals.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: FT, fontSize: 12, color: T.tx }}>{s.name}</span>
                <SignalBadge signal={s.signal} color={scoreColor(s.score)} />
                <span style={{ fontFamily: MO, fontSize: 10, color: T.tx2 }}>{TAB_LABELS[s.market].split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 섹터 히트맵 */}
      <SectorHeatmap allStocks={allStocks} />

      {/* 탭 버튼 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
        {(["kospi", "us", "crypto", "watchlist"] as Tab[]).map(tab => (
          <TabButton
            key={tab}
            label={tab === "watchlist" && watchlist.ids.size > 0
              ? `⭐ 관심 ${watchlist.ids.size}`
              : TAB_LABELS[tab]}
            active={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          />
        ))}
      </div>

      {/* 검색 + 필터 */}
      {!isWatchlistTab && !current.loading && current.data.length > 0 && (
        <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {/* 검색창 */}
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              fontFamily: MO, fontSize: 13, color: T.tx2, pointerEvents: "none",
            }}>🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="종목명 또는 심볼 검색…"
              style={{
                width: "100%", boxSizing: "border-box",
                background: T.sf, border: `1px solid ${T.bd}`,
                borderRadius: 8, padding: "9px 12px 9px 34px",
                fontFamily: MO, fontSize: 13, color: T.tx,
                outline: "none",
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: T.tx2, cursor: "pointer",
                  fontFamily: MO, fontSize: 14, lineHeight: 1,
                }}
              >✕</button>
            )}
          </div>

          {/* 등급 필터 + 정렬 */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {/* 등급 필터 */}
            {["전체", "매수", "관망", "주의"].map((g) => (
              <button
                key={g}
                onClick={() => setGradeFilter(g)}
                style={{
                  fontFamily: MO, fontSize: 11,
                  color: gradeFilter === g ? T.bg : T.tx2,
                  background: gradeFilter === g
                    ? (g === "매수" ? T.ok : g === "관망" ? T.wn : g === "주의" ? T.dn : T.pri)
                    : "transparent",
                  border: `1px solid ${gradeFilter === g ? "transparent" : T.bd}`,
                  borderRadius: 6, padding: "4px 10px",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >{g}</button>
            ))}

            <div style={{ width: 1, height: 16, background: T.bd, margin: "0 2px" }} />

            {/* 정렬 */}
            <span style={{ fontFamily: MO, fontSize: 10, color: T.tx2 }}>정렬:</span>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setSortKey(k)}
                style={{
                  fontFamily: MO, fontSize: 11,
                  color: sortKey === k ? T.pri : T.tx2,
                  background: sortKey === k ? `${T.pri}18` : "transparent",
                  border: `1px solid ${sortKey === k ? `${T.pri}44` : T.bd}`,
                  borderRadius: 6, padding: "4px 10px",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >{SORT_LABELS[k]}</button>
            ))}
          </div>
        </div>
      )}

      {/* 컨텐츠 */}
      {isWatchlistTab ? (
        watchlistData.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }} className="animate-slide-in">
            {watchlistData.map((stock, i) => (
              <StockRow
                key={stock.coinId ?? stock.symbol}
                stock={stock}
                rank={i + 1}
                isWatched
                onToggleWatch={watchlist.toggle}
                hasAlert={alerts.hasFor(stock.coinId ?? stock.symbol)}
                onSetAlert={setAlertModalStock}
              />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", fontFamily: MO, fontSize: 13, color: T.tx2, padding: "60px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>☆</div>
            관심 종목이 없습니다.<br />
            <span style={{ fontSize: 11, marginTop: 6, display: "block" }}>종목 옆 ☆을 눌러 추가하세요.</span>
          </div>
        )
      ) : (
        <>
          {current.loading && <LoadingSpinner />}
          {current.error && <ErrorBox msg={current.error} />}
          {!current.loading && !current.error && filteredData.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }} className="animate-slide-in">
              {filteredData.map((stock, i) => (
                <StockRow
                  key={stock.coinId ?? stock.symbol}
                  stock={stock}
                  rank={i + 1}
                  isWatched={watchlist.has(stock.coinId ?? stock.symbol)}
                  onToggleWatch={watchlist.toggle}
                  hasAlert={alerts.hasFor(stock.coinId ?? stock.symbol)}
                  onSetAlert={setAlertModalStock}
                />
              ))}
            </div>
          )}
          {!current.loading && !current.error && current.data.length > 0 && filteredData.length === 0 && (
            <div style={{ textAlign: "center", fontFamily: MO, fontSize: 13, color: T.tx2, padding: "40px 0" }}>
              "{query}" 검색 결과 없음
            </div>
          )}
          {!current.loading && !current.error && current.data.length === 0 && (
            <div style={{ textAlign: "center", fontFamily: MO, fontSize: 13, color: T.tx2, padding: "40px 0" }}>
              데이터를 불러오는 중입니다...
            </div>
          )}
        </>
      )}

      {/* 푸터 */}
      <div style={{ marginTop: 40, textAlign: "center", fontFamily: MO, fontSize: 11, color: T.tx2 }}>
        FlowSignal은 투자 참고용 정보를 제공합니다. 투자 결정은 본인 책임입니다.
      </div>

      {/* 알림 설정 모달 */}
      {alertModalStock && (
        <AlertModal
          stock={alertModalStock}
          existingAlerts={alerts.getFor(alertModalStock.coinId ?? alertModalStock.symbol)}
          onAdd={alerts.add}
          onRemove={alerts.remove}
          onClose={() => setAlertModalStock(null)}
        />
      )}
    </div>
  );
}
