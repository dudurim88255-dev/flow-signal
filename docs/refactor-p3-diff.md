# Phase A P3 — 리팩토링 전후 값 비교

**Date**: 2026-04-24  
**Scope**: `compute.ts::returnPct` → `returns.ts::calcReturnNd.value` 위임

## 수식 동등성 증명

### 기존 구현

```ts
export const returnPct = (closes: number[], nDays: number): number => {
  const len = closes.length;
  if (len < nDays + 1) return 0;
  const start = closes[len - 1 - nDays];
  const end = closes[len - 1];
  return start === 0 ? 0 : (end / start - 1);
};
```

### 신규 위임

```ts
export const returnPct = (closes: number[], nDays: number): number =>
  calcReturnNd(closes, nDays).value;
```

### 분기별 동등성

| 조건 | 기존 반환 | calcReturnNd.value | 동등 |
|---|---|---|---|
| `len < n+1` | `0` | `0` (reason=`insufficient_data`) | ✓ |
| `n <= 0` | 의도치 않은 동작 (`len-1-n >= len`) | `0` (reason=`insufficient_data`) | 안전 강화 |
| `start === 0` | `0` | `0` (reason=`missing_or_zero_start`) | ✓ |
| `start`/`end` 정상 | `end/start - 1` | `end/start - 1` | ✓ |
| `closes` 에 `null/undefined/NaN` 포함 | 런타임 `NaN` 전파 | forward-fill 후 계산 | **신규 경로** (기존 호출 사이트는 `number[]` 타입이라 발생 안 함) |

## 실제 호출 사이트 영향

현재 `returnPct` 를 호출하는 3개 지점 (`lib/signals/index.ts:218,219,282,283,335,336`):

```ts
ret7d: returnPct(data.closes, 7),
ret30d: returnPct(data.closes, 30),
```

- `data.closes` 는 `fetcher.ts` 의 `fetchCryptoData / fetchKoreaData / fetchUSData` 가 반환.
- 각 fetcher 는 Yahoo/Binance 응답의 `close` 배열을 그대로 또는 필터링된 `number[]` 로 전달.
- **결측 경로에 진입하지 않음** → `returnPct` 의 출력 값은 기존과 수식적 동일.

## 값 변화 diff

- 합성 샘플 10건 (returns.test.ts 의 "regression" 케이스 포함) → 12자리 소수 정밀도까지 일치.
- 실제 Redis 의 prediction 레코드 재계산 비교는 환경 접근 제한으로 본 커밋에서 수행 안 함.
- **결론: 수치 차이 0.** 롤백 조건 (동일 ticker 동일 날짜 10% 이상 차이) 에 해당하지 않음.

## K12 sectorRet20d / C11 / C12 교체 범위

지시서는 세 지표를 공통 유틸로 재구현하도록 요구했으나, 실제 현재 코드 분석 결과:

| 지표 | 현재 구현 | 공통 유틸 적용 가능? |
|---|---|---|
| K12 sectorRet20d | `index.ts:260` 에서 `0` 하드코딩 — 실제 섹터 closes 배열 fetcher 없음 | 데이터 공급 파이프라인 미구현이라 **재구현 대상 없음** |
| K12 stockRet20d | `computeOhlcvIndicators` 내부의 `ret20d` (ticker 자체 closes 로 계산) | 이미 returnPct 경로 → 간접 `calcReturnNd` 사용 |
| C11 momentum | `c11Momentum(rsi, macdHist, macdHistPrev)` — RSI/MACD, returns 미사용 | **해당 없음** |
| C12 volume | `c12Volume(volToday, history30d, priceUp)` — Volume Z-score, returns 미사용 | **해당 없음** |

따라서 P3 리팩토링 범위는:
- `calcReturnNd` 유틸 신설 ✓
- `returnPct` → `calcReturnNd` 위임 ✓ (간접적으로 K12 stockRet20d 등 전 구간 수익률이 공통 유틸 경유)
- K12 sectorRet20d 실제 계산 도입: **미수행** — 섹터 closes 데이터 공급이 선행되어야 함 (후속 이슈)
- C11, C12 returns 통일: **해당 없음** (returns 미사용 지표)

## 후속 작업 제안

1. fetcher 에 섹터 인덱스 (KOSPI 섹터별 지수, SPY 섹터 ETF 등) closes 배열 공급 추가 → `calcReturnNd(sectorCloses, 20).value` 로 K12 sectorRet20d 실제 계산.
2. 결측 감지(`confidence !== "high"`) 시 해당 신호의 `live: false` 자동 전환. RFC `signal-function-signature.md` 에서 SignalScore 구조 확장과 함께.
