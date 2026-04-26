import { describe, it, expect } from 'vitest';
import { calculateEntryZone } from './entryZone';

/**
 * EntryZone 테스트 8케이스 — 점수 5밴드 × in/pending + 에지케이스.
 */

// 헬퍼: 일정한 가격 20개
const flatPrices = (price: number, n = 20) => Array(n).fill(price);

// 헬퍼: 평균 100, σ ≈ 5 인 가격 시리즈 (95, 100, 105 반복)
const variedPrices = (): number[] => {
  const arr: number[] = [];
  for (let i = 0; i < 20; i++) {
    arr.push(95 + (i % 3) * 5); // 95, 100, 105, 95, ...
  }
  return arr;
};

describe('calculateEntryZone', () => {
  it('점수 ≥80 + 현재가 = MA20 → in_zone (강매수)', () => {
    const prices = variedPrices();
    const ma20 = prices.reduce((s, x) => s + x, 0) / 20;
    const r = calculateEntryZone({ score: 88, prices, currentPrice: ma20 });
    expect(r.status).toBe('in_zone');
    expect(r.lower).toBeLessThanOrEqual(ma20);
    expect(r.upper).toBeGreaterThanOrEqual(ma20);
    expect(r.reason).toContain('즉시 진입권');
  });

  it('점수 ≥80 + 현재가 +5σ 위 → pending_pullback (INTC 케이스)', () => {
    const prices = variedPrices();
    const ma20 = prices.reduce((s, x) => s + x, 0) / 20;
    // 현재가를 MA20 보다 훨씬 위로 — 한참 밖
    const r = calculateEntryZone({ score: 88, prices, currentPrice: ma20 * 1.5 });
    expect(r.status).toBe('pending_pullback');
    expect(r.reason).toContain('되돌림 대기');
    expect(r.reason).toContain('위');
  });

  it('점수 60~79 + 현재가 = MA20 - 0.8σ → in_zone (매수, 약 -1σ ~ +0.5σ)', () => {
    const prices = variedPrices();
    const ma20 = prices.reduce((s, x) => s + x, 0) / 20;
    const sigma = Math.sqrt(
      prices.reduce((s, x) => s + (x - ma20) ** 2, 0) / 20
    );
    const r = calculateEntryZone({
      score: 70,
      prices,
      currentPrice: ma20 - 0.8 * sigma,
    });
    expect(r.status).toBe('in_zone');
  });

  it('점수 40~59 → no_recommendation', () => {
    const prices = variedPrices();
    const r = calculateEntryZone({ score: 50, prices, currentPrice: 100 });
    expect(r.status).toBe('no_recommendation');
    expect(r.lower).toBeNull();
    expect(r.upper).toBeNull();
    expect(r.reason).toContain('관망');
  });

  it('점수 20~39 + 현재가 +0.7σ 위 → in_zone (매도, +0.5σ ~ +1.0σ)', () => {
    const prices = variedPrices();
    const ma20 = prices.reduce((s, x) => s + x, 0) / 20;
    const sigma = Math.sqrt(
      prices.reduce((s, x) => s + (x - ma20) ** 2, 0) / 20
    );
    const r = calculateEntryZone({
      score: 30,
      prices,
      currentPrice: ma20 + 0.7 * sigma,
    });
    expect(r.status).toBe('in_zone');
  });

  it('점수 <20 + 현재가 = MA20 → pending_pullback (강매도, 영역은 위쪽)', () => {
    const prices = variedPrices();
    const ma20 = prices.reduce((s, x) => s + x, 0) / 20;
    const r = calculateEntryZone({ score: 10, prices, currentPrice: ma20 });
    expect(r.status).toBe('pending_pullback');
    // 현재가가 lower(+0.5σ) 보다 아래 — 아래쪽
    expect(r.reason).toContain('아래');
  });

  it('prices.length < 20 → throw', () => {
    expect(() =>
      calculateEntryZone({ score: 80, prices: [100, 101, 102], currentPrice: 100 })
    ).toThrow(/must be ≥ 20/);
  });

  it('가격 일정 (sigma=0) → lower=upper=MA20, 현재가=MA20 면 in_zone', () => {
    const prices = flatPrices(50);
    const r = calculateEntryZone({ score: 88, prices, currentPrice: 50 });
    expect(r.sigma).toBe(0);
    expect(r.lower).toBe(50);
    expect(r.upper).toBe(50);
    expect(r.status).toBe('in_zone');
  });
});
