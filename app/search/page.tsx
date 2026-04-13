"use client";

/**
 * /search — 종목 검색 페이지
 * 검색창 → 자동완성 → /score/[market]/[ticker] 이동
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type SearchResult = {
  market: "crypto" | "korea" | "us";
  ticker: string;
  name: string;
  sector: string;
};

const MARKET_LABEL: Record<string, string> = {
  crypto: "코인",
  korea: "국내",
  us: "미국",
};

const MARKET_COLOR: Record<string, string> = {
  crypto: "text-yellow-400",
  korea: "text-blue-400",
  us: "text-emerald-400",
};

const PLACEHOLDERS = [
  "삼성전자 검색…",
  "Bitcoin 검색…",
  "NVDA 검색…",
  "카카오 검색…",
  "Ethereum 검색…",
  "TSLA 검색…",
];

export default function SearchPageWrapper() {
  return (
    <Suspense>
      <SearchPage />
    </Suspense>
  );
}

function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState(-1);
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 플레이스홀더 순환
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      i = (i + 1) % PLACEHOLDERS.length;
      setPlaceholder(PLACEHOLDERS[i]);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  // 검색 디바운스
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setSelected(-1);
      } catch {
        setResults([]);
      }
    }, 200);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const navigateTo = (r: SearchResult) => {
    if (r.market === "crypto") {
      router.push(`/score/crypto/${encodeURIComponent(r.ticker)}`);
    } else if (r.market === "korea") {
      router.push(`/score/korea/${encodeURIComponent(r.ticker)}`);
    } else {
      router.push(`/score/us/${encodeURIComponent(r.ticker)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((s) => Math.max(s - 1, -1)); }
    if (e.key === "Enter" && selected >= 0) { e.preventDefault(); navigateTo(results[selected]); }
    if (e.key === "Escape") { setFocused(false); inputRef.current?.blur(); }
  };

  // 자동 포커스
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* 상단 네비 */}
      <nav className="flex items-center gap-4 px-6 py-4 border-b border-gray-900">
        <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          ← 대시보드
        </Link>
      </nav>

      {/* 상단 영역 */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-24">
        {/* 로고 */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black tracking-tight mb-2">
            Flow<span className="text-emerald-400">Signal</span>
          </h1>
          <p className="text-gray-400 text-sm">
            AI가 실시간으로 분석하는 투자 시그널
          </p>
        </div>

        {/* 검색창 */}
        <div className="w-full max-w-xl relative">
          <div
            className={`flex items-center bg-gray-900 border rounded-2xl px-4 py-3 transition-all duration-200 ${
              focused ? "border-emerald-500 shadow-lg shadow-emerald-900/20" : "border-gray-800"
            }`}
          >
            <svg className="w-5 h-5 text-gray-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 bg-transparent outline-none text-white placeholder-gray-600 text-base"
              autoComplete="off"
            />
            {query && (
              <button onClick={() => { setQuery(""); setResults([]); }} className="text-gray-600 hover:text-gray-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>

          {/* 자동완성 드롭다운 */}
          {focused && results.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl z-10">
              {results.map((r, i) => (
                <button
                  key={`${r.market}-${r.ticker}`}
                  onMouseDown={() => navigateTo(r)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                    i === selected ? "bg-gray-800" : "hover:bg-gray-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium ${MARKET_COLOR[r.market]}`}>
                      {MARKET_LABEL[r.market]}
                    </span>
                    <span className="font-medium">{r.name}</span>
                    <span className="text-gray-500 text-sm">{r.ticker}</span>
                  </div>
                  <span className="text-xs text-gray-400">{r.sector}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 빠른 접근 칩 */}
        <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-xl">
          {[
            { market: "crypto", ticker: "bitcoin", name: "비트코인" },
            { market: "korea",  ticker: "005930",  name: "삼성전자" },
            { market: "us",     ticker: "NVDA",    name: "엔비디아" },
            { market: "crypto", ticker: "ethereum", name: "이더리움" },
            { market: "korea",  ticker: "000660",  name: "SK하이닉스" },
            { market: "us",     ticker: "TSLA",    name: "테슬라" },
          ].map((item) => (
            <button
              key={`${item.market}-${item.ticker}`}
              onClick={() => {
                if (item.market === "crypto") {
                  router.push(`/score/crypto/${encodeURIComponent(item.ticker)}`);
                } else if (item.market === "korea") {
                  router.push(`/score/korea/${encodeURIComponent(item.ticker)}`);
                } else {
                  router.push(`/score/us/${encodeURIComponent(item.ticker)}`);
                }
              }}
              className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-full text-sm text-gray-300 hover:text-white transition-colors"
            >
              <span className={`text-xs mr-1 ${MARKET_COLOR[item.market]}`}>
                {MARKET_LABEL[item.market]}
              </span>
              {item.name}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
