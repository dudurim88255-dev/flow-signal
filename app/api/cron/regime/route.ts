/**
 * GET /api/cron/regime
 * 시장별 레짐 감지 및 Redis 저장
 * Vercel Cron: 매일 00:30 UTC (한국 09:30 KST — 장 시작 직전)
 *
 * 실행 순서: regime(00:30) → harvest(01:00) → verify(02:00) → evolve(03:00 일요일)
 * regime이 먼저 실행되어야 harvest에서 레짐 스코어 감쇠를 적용할 수 있음
 */

import { NextRequest, NextResponse } from "next/server";
import yahooFinance from "@/lib/yahoo";
import { saveRegime, detectCryptoRegime, detectKoreaRegime, detectUsRegime, type Regime } from "@/lib/signals/regime";

export const runtime = "nodejs";
export const maxDuration = 60;

const TODAY = new Date().toISOString().slice(0, 10);

/** BTC 90일 종가 조회 (CoinGecko OHLC) */
async function fetchBtcCloses(): Promise<number[]> {
  const url = "https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=usd&days=90";
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data: number[][] = await res.json();
  return data.map((d) => d[4]); // [timestamp, open, high, low, close]
}

/** Yahoo Finance 종가 배열 조회 */
async function fetchYahooCloses(symbol: string, period1?: string): Promise<number[]> {
  const startDate = period1 ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  })();

  const historical = await yahooFinance.historical(symbol, {
    period1: startDate,
    interval: "1d",
  });

  return (historical as Array<{ close?: number | null }>)
    .filter((d) => d.close != null)
    .map((d) => d.close as number);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(`[regime] 레짐 감지 시작 ${TODAY}`);

  const report: Record<string, { regime: Regime; error?: string }> = {};

  // ── Crypto 레짐 ──────────────────────────────────────────────────────────
  try {
    const btcCloses = await fetchBtcCloses();
    const regime = detectCryptoRegime(btcCloses);
    await saveRegime("crypto", regime, TODAY);
    report.crypto = { regime };
    console.log(`[regime] crypto = ${regime} (BTC ${btcCloses.length}일 데이터)`);
  } catch (err) {
    console.error("[regime] crypto 실패:", err);
    report.crypto = { regime: "chop", error: String(err) };
    // 실패 시 안전한 기본값 chop 저장
    await saveRegime("crypto", "chop", TODAY).catch(() => {});
  }

  // ── Korea 레짐 ───────────────────────────────────────────────────────────
  try {
    const kospiCloses = await fetchYahooCloses("^KS11");
    const regime = detectKoreaRegime(kospiCloses);
    await saveRegime("korea", regime, TODAY);
    report.korea = { regime };
    console.log(`[regime] korea = ${regime} (KOSPI ${kospiCloses.length}일 데이터)`);
  } catch (err) {
    console.error("[regime] korea 실패:", err);
    report.korea = { regime: "chop", error: String(err) };
    await saveRegime("korea", "chop", TODAY).catch(() => {});
  }

  // ── US 레짐 ─────────────────────────────────────────────────────────────
  try {
    const spyCloses = await fetchYahooCloses("SPY");
    const regime = detectUsRegime(spyCloses);
    await saveRegime("us", regime, TODAY);
    report.us = { regime };
    console.log(`[regime] us = ${regime} (SPY ${spyCloses.length}일 데이터)`);
  } catch (err) {
    console.error("[regime] us 실패:", err);
    report.us = { regime: "chop", error: String(err) };
    await saveRegime("us", "chop", TODAY).catch(() => {});
  }

  console.log(`[regime] 완료 — crypto:${report.crypto?.regime} korea:${report.korea?.regime} us:${report.us?.regime}`);
  return NextResponse.json({ date: TODAY, report });
}
