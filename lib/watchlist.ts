"use client";
import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "flowsignal:watchlist:v1";

function loadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set<string>(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveIds(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch { /* 무시 */ }
}

export function useWatchlist() {
  const [ids, setIds] = useState<Set<string>>(new Set());

  // 클라이언트 마운트 후 로드
  useEffect(() => {
    setIds(loadIds());
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveIds(next);
      return next;
    });
  }, []);

  const has = useCallback((id: string) => ids.has(id), [ids]);

  return { ids, toggle, has };
}
