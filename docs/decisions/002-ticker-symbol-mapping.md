# ADR 002 — 티커 심볼 체계

**날짜**: 2026-04  
**상태**: 확정

## 결정

시장별로 다른 심볼 체계를 사용하며, `findTicker()`가 단일 진입점으로 통합 변환한다.

## 시장별 기준 심볼

| 시장 | 내부 기준 | 예시 |
|------|----------|------|
| crypto | CoinGecko ID | `bitcoin`, `ethereum` |
| korea | 종목코드 (Yahoo `.KS` 제거) | `005930` |
| us | Yahoo Finance 심볼 | `AAPL` |

## 왜 CoinGecko ID를 기준으로?

`stocks.ts`의 `CRYPTO_COINS`가 처음부터 CoinGecko ID를 `symbol` 필드로 씀.  
CoinGecko API 호출 시 ID가 필요하고, 이게 가장 명확한 식별자라 그대로 유지.

## Binance 심볼 역방향 매핑 (2026-04 추가)

`/api/score/crypto/BTC` 같은 URL로 진입 시 `findTicker`가 `BTC`를 인식 못하는 버그 발생.  
`COIN_TO_BINANCE` 맵을 역방향으로 조회해 해결:

```typescript
// lib/signals/index.ts — COIN_TO_BINANCE
bitcoin: "BTC", ethereum: "ETH", ...

// findTicker()에서 역방향 조회
(COIN_TO_BINANCE[c.symbol] ?? "").toLowerCase() === ticker.toLowerCase()
```

새 코인 추가 시 반드시 `COIN_TO_BINANCE`에도 항목 추가할 것.

## 한국 종목 Yahoo 심볼

KOSPI → `{코드}.KS`, KOSDAQ → `{코드}.KQ`.  
`findTicker`에서 자동 판별. 목록에 없는 종목은 `.KS` 기본값 사용 (KOSDAQ 종목 오류 가능성 있음).
