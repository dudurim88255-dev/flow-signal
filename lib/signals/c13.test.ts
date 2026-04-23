import { describe, it, expect } from "vitest";
import { c13LiquidationSpike } from "./crypto";

describe("c13LiquidationSpike — Phase A P2 guards", () => {
  // 정상 경로
  it("short-side dominant (>65%) → 72 (bullish)", () => {
    expect(c13LiquidationSpike(3_000_000, 7_000_000)).toBe(72);
  });

  it("long-side dominant (<35% short) → 28 (bearish)", () => {
    expect(c13LiquidationSpike(7_000_000, 3_000_000)).toBe(28);
  });

  it("balanced → 50 (neutral)", () => {
    expect(c13LiquidationSpike(5_000_000, 5_000_000)).toBe(50);
  });

  it("total < 1M → 50 (negligible volume)", () => {
    expect(c13LiquidationSpike(300_000, 400_000)).toBe(50);
  });

  // NaN / non-finite 가드 (P2 신규)
  it("NaN longLiq → 50", () => {
    expect(c13LiquidationSpike(NaN, 5_000_000)).toBe(50);
  });
  it("NaN shortLiq → 50", () => {
    expect(c13LiquidationSpike(5_000_000, NaN)).toBe(50);
  });
  it("both NaN → 50", () => {
    expect(c13LiquidationSpike(NaN, NaN)).toBe(50);
  });
  it("Infinity → 50", () => {
    expect(c13LiquidationSpike(Infinity, 5_000_000)).toBe(50);
  });

  // 음수 가드 (API 버그 방어)
  it("negative longLiq → 50", () => {
    expect(c13LiquidationSpike(-1, 5_000_000)).toBe(50);
  });
  it("negative shortLiq → 50", () => {
    expect(c13LiquidationSpike(5_000_000, -1)).toBe(50);
  });

  // 0 + 0
  it("zero + zero → 50", () => {
    expect(c13LiquidationSpike(0, 0)).toBe(50);
  });
});
