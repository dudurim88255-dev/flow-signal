"use client";
import { useState, useEffect } from "react";
import type { StockData } from "@/app/api/kospi/route";

export interface Alert {
  id: string;
  stockId: string;          // coinId 또는 symbol
  name: string;
  symbol: string;
  market: "kospi" | "us" | "crypto";
  type: "price_above" | "price_below" | "score_above" | "score_below";
  value: number;
  createdAt: number;
}

export interface TriggeredAlert {
  alert: Alert;
  currentValue: number;
}

const KEY = "flowsignal:alerts:v1";

function load(): Alert[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Alert[]) : [];
  } catch {
    return [];
  }
}

function save(list: Alert[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    setAlerts(load());
  }, []);

  function add(a: Omit<Alert, "id" | "createdAt">) {
    const next: Alert = {
      ...a,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
    };
    setAlerts(prev => {
      const updated = [...prev, next];
      save(updated);
      return updated;
    });
  }

  function remove(id: string) {
    setAlerts(prev => {
      const updated = prev.filter(a => a.id !== id);
      save(updated);
      return updated;
    });
  }

  function hasFor(stockId: string): boolean {
    return alerts.some(a => a.stockId === stockId);
  }

  function getFor(stockId: string): Alert[] {
    return alerts.filter(a => a.stockId === stockId);
  }

  return { alerts, add, remove, hasFor, getFor };
}

// 현재 시세 데이터와 알림 조건 비교 → 발동된 알림 목록 반환 (render 중 useMemo에서 호출)
export function checkAlerts(alerts: Alert[], stocks: StockData[]): TriggeredAlert[] {
  return alerts.flatMap(alert => {
    const stock = stocks.find(s => (s.coinId ?? s.symbol) === alert.stockId);
    if (!stock) return [];
    const current = alert.type.startsWith("score") ? stock.score : stock.price;
    const hit =
      alert.type === "price_above" || alert.type === "score_above"
        ? current >= alert.value
        : current <= alert.value;
    return hit ? [{ alert, currentValue: current }] : [];
  });
}
