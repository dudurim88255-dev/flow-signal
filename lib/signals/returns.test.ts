import { describe, it, expect } from "vitest";
import { calcReturnNd } from "./returns";

describe("calcReturnNd — Phase A P3 shared util", () => {
  // ── 정상 경로 ─────────────────────────────────────────────
  it("정상: 결측 없음 → confidence=high, 값 일치", () => {
    // 5일 수익률 — (110 / 100 - 1) = 0.1
    const prices = [100, 101, 102, 105, 108, 110];
    const r = calcReturnNd(prices, 5);
    expect(r.confidence).toBe("high");
    expect(r.value).toBeCloseTo(0.1, 10);
    expect(r.reason).toBeUndefined();
  });

  it("정상: N=1 → 직전 대비 수익률", () => {
    const r = calcReturnNd([100, 110], 1);
    expect(r.confidence).toBe("high");
    expect(r.value).toBeCloseTo(0.1, 10);
  });

  // ── 결측 (forward-fill) ───────────────────────────────────
  it("결측 1일 → confidence=med, ffill_gap=1", () => {
    const prices = [100, 101, null, 105, 108, 110];
    const r = calcReturnNd(prices, 5);
    expect(r.confidence).toBe("med");
    expect(r.reason).toMatch(/ffill_gap=1d/);
    expect(r.value).toBeCloseTo(0.1, 10);
  });

  it("결측 4일 (연속) → confidence=med (threshold=5 미만)", () => {
    const prices = [100, null, null, null, null, 110];
    const r = calcReturnNd(prices, 5);
    expect(r.confidence).toBe("med");
    expect(r.reason).toMatch(/ffill_gap=4d/);
  });

  it("결측 5일 이상 연속 → confidence=low", () => {
    const prices = [100, null, null, null, null, null, 110];
    const r = calcReturnNd(prices, 6);
    expect(r.confidence).toBe("low");
    expect(r.reason).toMatch(/ffill_gap=5d/);
  });

  it("NaN / undefined 도 결측 취급", () => {
    const prices = [100, NaN, undefined as unknown as number, 105, 108, 110];
    const r = calcReturnNd(prices, 5);
    expect(r.confidence).toBe("med");
    expect(r.reason).toMatch(/ffill_gap=2d/);
  });

  // ── 엣지 ──────────────────────────────────────────────────
  it("엣지: 길이 부족 → value=0, confidence=low, reason=insufficient_data", () => {
    const r = calcReturnNd([100, 110], 5);
    expect(r).toEqual({
      value: 0,
      confidence: "low",
      reason: "insufficient_data",
    });
  });

  it("엣지: n=0 → insufficient_data", () => {
    const r = calcReturnNd([100, 110], 0);
    expect(r.confidence).toBe("low");
    expect(r.reason).toBe("insufficient_data");
  });

  it("엣지: start=0 → missing_or_zero_start", () => {
    const prices = [0, 10, 20, 30, 40, 50];
    const r = calcReturnNd(prices, 5);
    expect(r.confidence).toBe("low");
    expect(r.reason).toBe("missing_or_zero_start");
    expect(r.value).toBe(0);
  });

  it("엣지: 첫 값부터 결측으로 start 복구 불가 → missing_or_zero_start", () => {
    const prices = [null, null, null, null, null, 100];
    const r = calcReturnNd(prices, 5);
    expect(r.confidence).toBe("low");
    expect(r.reason).toBe("missing_or_zero_start");
  });

  it("엣지: 음수 가격(원자재 등)도 단순 (end/start - 1) 로 계산", () => {
    // WTI -37$ 같은 케이스. 비즈니스 상 드물지만 수식적 일관성 확인.
    const prices = [-10, -10, -10, -10, -10, -5];
    const r = calcReturnNd(prices, 5);
    expect(r.confidence).toBe("high");
    expect(r.value).toBeCloseTo(-0.5, 10); // -5/-10 -1 = -0.5
  });

  // ── returnPct 위임 동등성 ──────────────────────────────────
  it("regression: 기존 returnPct 수식 (end/start - 1) 과 동일", () => {
    const prices = [100, 105, 110, 108, 112, 120];
    const r = calcReturnNd(prices, 5);
    const legacy = (120 / 100) - 1; // 기존 로직 직접 계산
    expect(r.value).toBeCloseTo(legacy, 12);
  });
});
