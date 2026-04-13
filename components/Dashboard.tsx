"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { T, FT, MO, scoreColor, changeColor } from "@/lib/theme";
import type { StockData } from "@/app/api/kospi/route";
import StockRow from "./StockRow";
import SectorHeatmap from "./SectorHeatmap";
import AlertModal from "./AlertModal";
import { useWatchlist } from "@/lib/watchlist";
import { useAlerts, checkAlerts, requestNotificationPermission, fireNotification } from "@/lib/alerts";

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
  const [notifPermission, setNotifPermission] = useState<string>("default");
  const watchlist = useWatchlist();
  const alerts = useAlerts();

  // 앱 로드 시 알림 권한 상태 동기화
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

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

  // 발동된 알림이 생기면 브라우저 알림 push
  const prevTriggeredRef = useRef<string[]>([]);
  useEffect(() => {
    if (triggeredAlerts.length === 0) return;
    const newIds = triggeredAlerts
      .map(t => t.alert.id)
      .filter(id => !prevTriggeredRef.current.includes(id));

    if (newIds.length > 0) {
      newIds.forEach(id => {
        const t = triggeredAlerts.find(x => x.alert.id === id)!;
        const isScore = t.alert.type.startsWith("score");
        const typeLabel = t.alert.type.endsWith("above") ? "이상" : "이하";
        const body = isScore
          ? `FlowScore ${t.alert.value}점 ${typeLabel} 도달 (현재 ${Math.round(t.currentValue)}점)`
          : `가격 ${t.alert.value.toLocaleString()} ${typeLabel} 도달 (현재 ${t.currentValue.toLocaleString()})`;
        fireNotification(`🔔 ${t.alert.name}`, body);
      });
      prevTriggeredRef.current = triggeredAlerts.map(t => t.alert.id);
    }
  }, [triggeredAlerts]);

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

      {/* 알림 권한 요청 배너 (허용 안 된 경우) */}
      {notifPermission === "default" && alerts.alerts.length > 0 && (
        <div style={{
          background: `${T.pri}10`,
          border: `1px solid ${T.pri}33`,
          borderRadius: 12,
          padding: "10px 16px",
          marginBottom: 12,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 14 }}>🔔</span>
          <span style={{ fontFamily: MO, fontSize: 12, color: T.tx2, flex: 1 }}>
            알림을 받으려면 브라우저 알림을 허용하세요
          </span>
          <button
            onClick={async () => {
              const granted = await requestNotificationPermission();
              setNotifPermission(granted ? "granted" : "denied");
            }}
            style={{
              fontFamily: MO, fontSize: 12, color: T.pri,
              background: `${T.pri}18`, border: `1px solid ${T.pri}44`,
              borderRadius: 6, padding: "4px 10px", cursor: "pointer",
            }}
          >
            허용
          </button>
        </div>
      )}

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
      <div style={{ marginBottom: 20 }}>
        {/* 로고 행 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: FT, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
              Flow<span style={{ color: T.pri }}>Signal</span>
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: `${T.ok}18`, border: `1px solid ${T.ok}44`, borderRadius: 20, padding: "3px 10px" }}>
              <LiveDot />
              <span style={{ fontFamily: MO, fontSize: 11, color: T.ok }}>AI 분석 중</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {updatedStr && (
              <span style={{ fontFamily: MO, fontSize: 11, color: T.tx2 }}>
                {updatedStr} 기준
              </span>
            )}
            <Link href="/portfolio" style={{
              fontFamily: MO, fontSize: 12, color: T.tx2,
              background: T.sf,
              border: `1px solid ${T.bd}`,
              borderRadius: 6, padding: "5px 12px",
              textDecoration: "none", whiteSpace: "nowrap",
            }}>
              포트폴리오
            </Link>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                fontFamily: MO, fontSize: 12,
                color: refreshing ? T.tx2 : T.tx,
                background: T.sf,
                border: `1px solid ${T.bd}`,
                borderRadius: 6, padding: "5px 12px",
                cursor: refreshing ? "default" : "pointer",
                transition: "all 0.15s",
              }}
            >
              {refreshing ? "갱신 중…" : "↻ 새로고침"}
            </button>
          </div>
        </div>

      </div>

      {/* AI 시그널 피드 */}
      {topSignals.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: MO, fontSize: 11, color: T.tx2, marginBottom: 8, letterSpacing: 0.3 }}>
            ✦ FlowSignal AI가 실시간으로 분석하는 투자 시그널
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {topSignals.map((s, i) => {
              const color = scoreColor(s.score);
              const marketEmoji = TAB_LABELS[s.market].split(" ")[0];
              return (
                <Link
                  key={i}
                  href={`/score/${s.market}/${encodeURIComponent(s.name)}`}
                  style={{ textDecoration: "none", flexShrink: 0 }}
                >
                  <div style={{
                    background: T.sf,
                    border: `1px solid ${T.bd}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    minWidth: 120,
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                      <span style={{ fontSize: 11 }}>{marketEmoji}</span>
                      <span style={{ fontFamily: MO, fontSize: 10, color: T.tx2 }}>
                        {s.market === "kospi" ? "코스피" : s.market === "us" ? "미국" : "코인"}
                      </span>
                    </div>
                    <div style={{ fontFamily: FT, fontSize: 13, fontWeight: 700, color: T.tx, marginBottom: 5, whiteSpace: "nowrap" }}>
                      {s.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{
                        fontFamily: MO, fontSize: 11,
                        background: `${color}22`, color,
                        borderRadius: 4, padding: "2px 7px",
                        whiteSpace: "nowrap",
                      }}>
                        {s.signal}
                      </span>
                      <span className="tabular-nums" style={{ fontFamily: MO, fontSize: 12, fontWeight: 700, color }}>
                        {s.score}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
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
              <div>"{query}" 검색 결과 없음</div>
              <Link
                href={`/search?q=${encodeURIComponent(query)}`}
                style={{ color: T.pri, fontSize: 12, marginTop: 8, display: "inline-block", textDecoration: "none" }}
              >
                전체 종목에서 검색 →
              </Link>
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
      <div style={{ marginTop: 40, padding: "20px 16px", textAlign: "center", fontFamily: MO, fontSize: 11, color: T.tx2, borderTop: `1px solid ${T.bd}`, lineHeight: 1.8 }}>
        <div style={{ marginBottom: 6, color: "#3FB950", fontSize: 10 }}>🚀 베타 기간 무료 서비스</div>
        본 서비스는 베타 기간 무료로 제공되며, 정보 제공 목적의 데이터 서비스입니다.<br />
        투자자문이나 투자권유가 아니며, 모든 투자 결정과 그에 따른 책임은 사용자 본인에게 있습니다.<br />
        <span style={{ fontSize: 10 }}>FlowSignal © 2025 · 문의: dudurim88255-dev</span>
        <span style={{ fontSize: 10, color: "#6e7681", float: "right" }}>v3.1 (2026-04-13)</span>
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
