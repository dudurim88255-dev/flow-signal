# FlowSignal — 프로젝트 전체 컨텍스트

> Claude AI와 대화 시 이 파일을 첨부하면 프로젝트 전체 현황을 정확히 파악할 수 있습니다.
> 마지막 업데이트: 2026-04-13

---

## 1. 개요

**FlowSignal** — 한국 개인 투자자용 주식·코인 AI 시그널 SaaS  
URL: https://flow-signal-v2.vercel.app (라이브)  
경로: `C:\Users\윤중현\flow-signal`  
프레임워크: Next.js 15 App Router, Turbopack  
로컬 실행: `npm run dev -- -p 3002`

## 2. 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 15 App Router |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS |
| 캐시/DB | Upstash Redis (REST) |
| 배포 | Vercel (GitHub push → 자동 배포) |
| AI | @ai-sdk/anthropic (claude-haiku-4.5) |
| 데이터 | CoinGecko, Binance Futures, alternative.me, Yahoo Finance |
| 분석 | Vercel Analytics |

---

## 3. 핵심 아키텍처

### 신호 평가 흐름

```
사용자 요청
  → GET /api/score/[market]/[ticker]  (SSE 스트리밍)
  → evaluateSignals(market, ticker)   (lib/signals/index.ts)
  → fetchCryptoData / fetchKoreaData / fetchUSData  (lib/signals/fetcher.ts)
  → computeOhlcvIndicators  (기술지표 계산)
  → computeCryptoSignals / computeKoreaSignals / computeUsSignals
  → getCurrentRegime → getRegimeWeights  (레짐별 가중치 적용)
  → flowScore(signals) → { score, label }
  → Redis 캐시 10분 저장
  → savePrediction (비동기 fire-and-forget)
```

### Cron 파이프라인 (매일 UTC 기준)

| 시간 | Cron | 역할 |
|------|------|------|
| 00:00 | warm-stocks | 전체 종목 API 캐시 워밍 |
| 00:30 | regime | 시장별 레짐(bull/bear/chop) 감지 후 Redis 저장 |
| 01:00 | harvest | 상위 30종목 자동 평가 + Risk Gate 적용 후 예측 저장 |
| 02:00 | verify | 5일/14일 후 예측 결과 검증 (correct/wrong/neutral) |
| 03:00 (일) | evolve | Bayesian 가중치 진화 + Walk-forward shadow 실행 |
| 04:00 (일) | narrate | 주간 AI 리포트 생성 (claude-haiku-4.5) |

---

## 4. 신호 엔진

### 시장별 신호 수 (ID는 의도적으로 공개하지 않음)

- **Crypto**: C1~C13 = **13개** (온체인·파생·심리·기술적 분석) — 일부 live, 일부 추정
- **Korea**: K1~K12 = **12개** (수급·리스크·기술적 분석) — 공개 API 한계로 일부 neutral
- **US**: U1~U12 = **12개** (모멘텀·기술적·시장맥락) — 전부 Yahoo Finance 기반

### FlowScore 체계

- 0~100점, 50 = neutral
- ≥70: 강매수 / 55~69: 매수 / 45~54: 관망 / 30~44: 주의 / <30: 위험
- 각 신호에 weight 부여, 가중합 산출

### 레짐(Regime) 시스템

```
감지 기준:
  crypto: BTC 60d MA 대비 현재가 + 30d 변동성
  korea:  KOSPI 20d MA 대비 현재가 + 20d 변동성
  us:     SPY 50d MA 대비 현재가 + 20d 변동성

Redis 키:
  regime:{market}:current    (1h TTL — 실시간 평가용)
  regime:{market}:{YYYY-MM-DD}  (365d TTL — 이력 보존)

가중치 키:
  weights:{market}:{regime}  (bull/bear/chop 각각 독립 학습)
  wf:result:{market}         (walk-forward 결과, 7d TTL)
```

### Risk Gate (harvest 시 적용)

예측 저장 전 6개 체크, 실패 시 score=50 / label="리스크차단"으로 억제:

1. **데이터 신선도** — evaluatedAt이 6시간 이내인지
2. **거래량 붕괴** — 최근 거래량이 30일 평균의 20% 미만이면 차단
3. **레짐 전환** — 최근 3일 내 레짐이 2번 이상 바뀌면 불안정으로 차단
4. **신호 합의** — 신호들의 표준편차가 너무 크면(혼재) 차단
5. **WF 성능** — Walk-forward 정확도가 45% 미만이면 차단
6. **샘플 부족** — 검증된 예측이 10개 미만이면 차단 (cold start)

### Walk-forward 검증

```
bootstrap 모드 (≤180일 데이터): train=60d / test=14d / step=14d
mature 모드 (>180일):           train=180d / test=30d / step=30d

결과: wf:result:{market} Redis (7d TTL)
실행: evolve cron 끝에 shadow로 실행 (점수에 영향 없음)
공식 채택: 6개월 데이터 누적 후 (2026-10월 예상)
```

---

## 5. 데이터 소스

### Crypto
| 데이터 | 소스 | 비고 |
|--------|------|------|
| OHLC 90일 | CoinGecko `/coins/{id}/ohlc?days=90` | 무료 |
| 일별 거래량 31일 | CoinGecko `/coins/{id}/market_chart?days=31&interval=daily` | 무료, 2026-04-13 수정 |
| 시가총액·24h 변화 | CoinGecko `/coins/markets` | 무료 |
| 펀딩비·OI·L/S비율 | Binance Futures API | 무료 공개 |
| 강제청산 24h | Binance `/fapi/v1/allForceOrders` | 무료 공개 |
| 공포탐욕지수 | alternative.me | 무료 |
| 온체인(고래·MVRV 등) | 미구현 — neutral(50) 처리 | CoinGecko 무료 한계 |

### Korea / US
- Yahoo Finance (`yahoo-finance2` v3) — 120일 일봉 OHLCV + 시가총액
- `new (YahooFinanceClass as any)()` 방식으로 인스턴스화 (`lib/yahoo.ts`)
- 외인/기관 수급 데이터: 미구현 — neutral 처리

### 거시경제 (Macro Context)
- BTC 도미넌스, DXY, 미국10Y, VIX, KOSPI변동성, KRW/USD
- 모두 Yahoo Finance 기반, 30분 Redis 캐시

---

## 6. 주요 파일 구조

```
flow-signal/
├── app/
│   ├── page.tsx                      # 메인 대시보드 (탭: KOSPI/US/Crypto)
│   ├── layout.tsx                    # 글로벌 레이아웃
│   ├── pricing/page.tsx              # 요금제 페이지
│   ├── report/page.tsx               # 주간 AI 리포트 페이지 (현재 인증 없음)
│   ├── score/[market]/[ticker]/
│   │   └── page.tsx                  # 종목 상세 페이지 (SSE 스트리밍)
│   └── api/
│       ├── score/[market]/[ticker]/route.ts  # SSE 평가 API (10분 캐시)
│       ├── macro-context/route.ts    # 거시경제 지표 (30분 캐시)
│       ├── report/route.ts           # 주간 리포트 조회
│       └── cron/
│           ├── warm-stocks/route.ts  # 캐시 워밍
│           ├── regime/route.ts       # 레짐 감지
│           ├── harvest/route.ts      # 자동 예측 수집
│           ├── verify/route.ts       # 예측 검증
│           ├── evolve/route.ts       # 가중치 진화
│           └── narrate/route.ts      # 주간 리포트 생성
├── lib/
│   ├── signals/
│   │   ├── index.ts        # evaluateSignals 진입점
│   │   ├── fetcher.ts      # 시장별 데이터 수집
│   │   ├── compute.ts      # RSI, MACD, 볼린저 등 기술지표
│   │   ├── crypto.ts       # 크립토 신호 계산
│   │   ├── korea.ts        # 한국 신호 계산
│   │   ├── us.ts           # 미국 신호 계산
│   │   ├── regime.ts       # 레짐 감지/저장/조회
│   │   ├── riskgate.ts     # Risk Gate 6개 체크
│   │   └── walkforward.ts  # Walk-forward 검증
│   ├── predictions.ts      # 예측 저장/조회/가중치 관리 (Redis)
│   ├── stocks.ts           # 종목 목록 (KOSPI/KOSDAQ/US/Crypto)
│   ├── redis.ts            # Upstash Redis 클라이언트
│   ├── yahoo.ts            # yahoo-finance2 인스턴스
│   ├── alerts.ts           # 알림 설정 (localStorage)
│   ├── portfolio.ts        # 포트폴리오 (localStorage)
│   └── watchlist.ts        # 관심종목 (localStorage)
└── vercel.json             # Cron 스케줄 설정
```

---

## 7. Redis 키 구조

```
score:v3:{market}:{ticker}        — SSE 평가 캐시 (10분)
regime:{market}:current           — 현재 레짐 (1h)
regime:{market}:{YYYY-MM-DD}      — 레짐 이력 (365d)
weights:{market}                  — 글로벌 가중치
weights:{market}:{regime}         — 레짐별 가중치
wf:result:{market}                — Walk-forward 결과 (7d)
pred:{market}:{ticker}:{date}     — 예측 데이터 (365d)
preds:{market}                    — 시장별 예측 목록
oi:{binanceSymbol}                — OI 변화 추적 (6h)
macro:context:{market}            — 거시경제 캐시 (30분)
report:weekly:{YYYY-WW}           — 주간 리포트 (8d)
```

---

## 8. 현재 상태 및 미구현 항목

### 구현 완료
- [x] KOSPI 15 / KOSDAQ 추가 / US 10 / Crypto 상위 10 종목 대시보드
- [x] FlowScore 신호 엔진 (crypto 13신호 / korea 12신호 / us 12신호)
- [x] SSE 스트리밍 실시간 평가
- [x] 예측 저장 → 검증 → 가중치 진화 파이프라인
- [x] Regime 감지 + 레짐별 독립 가중치
- [x] Walk-forward shadow 검증
- [x] Risk Gate 6개 체크
- [x] 주간 AI 리포트 (narrate cron)
- [x] 거시경제 맥락 카드
- [x] 포트폴리오 / 관심종목 / 알림 (localStorage 기반)
- [x] 크립토 거래량 실데이터 (CoinGecko market_chart, 2026-04-13)

### 미구현 (의도적)
- [ ] 온체인 데이터 (고래, MVRV, 스테이블코인 유입) — CoinGecko 무료 한계, neutral 처리
- [ ] 외인/기관 수급 (한국) — 공개 API 없음, neutral 처리
- [ ] 구독 결제 (토스페이먼츠) — 사업자 신고 후 구현 예정 (2026년 하반기)
- [ ] 리포트 페이지 유료화 게이트 — 결제 연동 후 추가 예정
- [ ] Walk-forward 공식 채택 — 6개월 데이터 누적 후 (2026-10월 예상)

---

## 9. 종목 목록

### KOSPI (15종목)
삼성전자, SK하이닉스, LG에너지솔루션, 삼성바이오로직스, 현대차, 기아, POSCO홀딩스, 셀트리온, KB금융, 신한지주, 삼성SDI, LG화학, 카카오, NAVER, 현대모비스

### Crypto (10종목)
Bitcoin, Ethereum, Solana, BNB, XRP, Cardano, Avalanche, NEAR, SUI, TON

### US (10종목)
NVDA, AAPL, MSFT, AMZN, GOOGL, META, TSLA, JPM, V, UNH

---

## 10. 주요 설계 결정

1. **신호 ID 비공개**: C1~C13 등 신호 구성을 UI에서 숨겨 경쟁자 복사 방지
2. **온체인 = neutral**: CoinGecko 무료 한계, 유료 API 없이는 neutral(50) 처리
3. **Yahoo Finance**: 한국/미국 주가 데이터 — v3 방식 `new (YahooFinanceClass as any)()`
4. **예측 TTL 365일**: Walk-forward 180일 윈도우 지원 위해 30일에서 확장
5. **레짐별 가중치**: 같은 신호라도 bull/bear/chop 국면에 따라 다른 가중치 적용
6. **Risk Gate는 harvest에만 적용**: 사용자 실시간 조회에는 미적용 (UX 고려)
