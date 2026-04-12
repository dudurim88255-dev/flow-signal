# ADR 004 — 시장별 데이터 소스

**날짜**: 2026-04  
**상태**: 확정

## 확정된 소스 구성

### 미국 주식 / 한국 주식
- **Yahoo Finance** (`lib/yahoo.ts`): OHLCV, 시총, 재무지표
- 이유: 무료, API 키 불필요, US·KOSPI·KOSDAQ 모두 커버
- 한계: 비공식 API라 언제든 차단 가능. 대안: `yfinance` Python 래퍼나 유료 Polygon.io

### 암호화폐 가격·지표
| 소스 | 사용 데이터 | 비고 |
|------|------------|------|
| CoinGecko | OHLCV, 시총, MVRV | 무료 플랜, rate limit 있음 |
| Binance | 펀딩레이트, OI, L/S ratio | 공개 엔드포인트, 인증 불필요 |
| alternative.me | Fear & Greed Index | 단일 숫자, 일 1회 업데이트 |

### 온체인 데이터 (현재 미연동)
고래 순매수(`whaleNet24h`), 거래소 순유출(`exchangeNetOut`), 스테이블코인 유입(`stablecoinIn24h`)은  
현재 더미값(`live: false`). 실데이터 연동 시 Glassnode 또는 CryptoQuant API 필요 (유료).

### SPY 60일 수익률 (US 상대강도용)
Yahoo Finance에서 별도 fetch (`fetchSpyReturn60d`).  
US 종목 신호 K12에서 종목 수익률과 비교.

## API 키 없이 동작하는 범위

현재 Yahoo Finance + CoinGecko 무료 플랜 + Binance 공개 API 조합으로  
**US·KOSPI·Crypto 전체 평가**가 외부 API 키 없이 동작한다.  
(Anthropic API 키는 `ai-comment` 기능 전용)
