"use client";
import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "flowsignal:portfolio:v1";

export interface Holding {
  id: string;        // coinId 또는 symbol
  name: string;
  symbol: string;    // 표시용 (BTC, 삼성전자 등)
  market: "kospi" | "us" | "crypto";
  qty: number;       // 수량
  buyPrice: number;  // 평균 매수가 (USD 또는 KRW)
  addedAt: number;   // timestamp
}

function load(): Holding[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(holdings: Holding[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
  } catch { /* 무시 */ }
}

export function usePortfolio() {
  const [holdings, setHoldings] = useState<Holding[]>([]);

  useEffect(() => {
    setHoldings(load());
  }, []);

  const add = useCallback((h: Omit<Holding, "addedAt">) => {
    setHoldings((prev) => {
      // 이미 있으면 수량/매수가 업데이트 (평균단가 계산)
      const idx = prev.findIndex((p) => p.id === h.id);
      let next: Holding[];
      if (idx >= 0) {
        const existing = prev[idx];
        const totalQty = existing.qty + h.qty;
        const avgBuy = (existing.buyPrice * existing.qty + h.buyPrice * h.qty) / totalQty;
        next = [...prev];
        next[idx] = { ...existing, qty: totalQty, buyPrice: Math.round(avgBuy * 10000) / 10000 };
      } else {
        next = [...prev, { ...h, addedAt: Date.now() }];
      }
      save(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setHoldings((prev) => {
      const next = prev.filter((h) => h.id !== id);
      save(next);
      return next;
    });
  }, []);

  const update = useCallback((id: string, qty: number, buyPrice: number) => {
    setHoldings((prev) => {
      const next = prev.map((h) => h.id === id ? { ...h, qty, buyPrice } : h);
      save(next);
      return next;
    });
  }, []);

  const has = useCallback((id: string) => holdings.some((h) => h.id === id), [holdings]);

  return { holdings, add, remove, update, has };
}
