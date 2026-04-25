# 한국 시장 K1~K8 live=false 진단

**Date**: 2026-04-25  
**Scope**: 진단 only. `lib/signals/` / fetcher 코드 수정 금지.  
**Trigger**: 삼성전자(005930) 실측 응답에서 K1~K8 모두 `live=false` 확인.

---

## 결론 한 줄

K1~K8 은 **데이터 소스가 ADR 004 에 정의되어 있지 않음**. fetcher 미구현 → `evaluateKorea()` 가 더미 상수를 전달 → `computeKoreaSignals()` 호출 시 `live` 플래그 미주입 → 기본값 `false` 적용. 의도적으로 비활성화된 게 아니라 **공급망 자체가 없음**.

---

## 1. K1~K12 정의 (`lib/signals/korea.ts`)

| ID | 이름 | 측정 대상 | 계산식 (요지) | weight |
|----|------|----------|---------------|:--:|
| K1 | 외국인 순매수 | 5일 누적 외국인 순매수액 ÷ 시총 | `clip(50 + (net5d/mcap)·100·30)` | 14 |
| K2 | 기관 순매수 | 5일 누적 기관 순매수액 ÷ 시총 | 동일 식 | 12 |
| K3 | 프로그램 매매 | 5일 누적 프로그램 순매수 (외국인 선행) | 동일 + 계수 35 | 10 |
| K4 | 외국인 보유율 Δ | 현재 보유율 vs 20일 전 보유율 | `clip(50 + (curr − pct20)·25)` | 8 |
| K5 | 공매도 잔고 (역) | 공매도 잔고 / 시총 | `clip(80 − pct·12)` | 8 |
| K6 | 대차잔고 Δ (역) | 대차잔고 vs 20일 MA | `clip(50 − changePct·2)` | 6 |
| K7 | 신용잔고율 (역) | 신용잔고 / 시총 | `clip(80 − pct·8)` | 5 |
| K8 | 외국계 창구 집중도 | 상위 외국계 창구 매수 비중 | `clip(share·100)` | 6 |
| K9 | 거래량+OBV | volZ + OBV/price slope 정합 | OHLCV 파생 | 7 |
| K10 | 모멘텀 | RSI + MACD hist | OHLCV 파생 | 10 |
| K11 | 이평선 정배열 | price vs MA5/MA20/MA60 | OHLCV 파생 | 6 |
| K12 | 업종 상대강도 | 종목 20d return − 섹터 20d return | OHLCV + (섹터 미공급) | 8 |

K1~K8 weight 합 = **69**, K9~K12 weight 합 = **31**. **즉 한국 시장 전체 가중치의 약 70 % 가 현재 비라이브 상태로 평가에서 제외됨.** (`flowScore` 가 `live: false` 를 가중합에서 제외하므로 실제 점수는 K9~K12 31 점으로만 결정됨.)

---

## 2. `live=false` 가 되는 조건

### 코드 흐름

`lib/signals/korea.ts:88~104` — `computeKoreaSignals(input, liveFlags?)`:
```ts
{ id: "K1", ..., live: live.K1 ?? false },   // ← K1~K8 default false
...
{ id: "K9", ..., live: live.K9 ?? true },    // ← K9~K12 default true
```

`lib/signals/index.ts:243~272` — `evaluateKorea()` 호출:
```ts
computeKoreaSignals({
  foreignNet5d: 0,            // ← 더미 상수
  marketCap: mcapKrw || 1,
  instNet5d: 0,                // ← 더미
  programNet5d: 0,             // ← 더미
  foreignHoldingCurr: 30,      // ← 더미 (30 %)
  foreignHolding20dAgo: 30,    // ← 더미 (동일값 → K4 score = 50)
  shortBalancePct: 1,          // ← 더미
  loanBalanceCurr: 100,        // ← 더미 (curr == ma20 → K6 score = 50)
  loanBalanceMa20: 100,
  creditPctOfMcap: 1,          // ← 더미
  topForeignBuyShare: 0.3,     // ← 더미
  ...
  // 아래는 OHLCV 기반 — Yahoo data 에서 실제 계산
  volumeZ: ind.volZ,
  obvSlope14d: ind.obvSlopeVal,
  ...
}, {
  K9: true, K10: true, K11: true, K12: true,   // ← K1~K8 미명시 → default false
});
```

### 진단

| 가설 | 판정 |
|---|---|
| (a) 데이터 자체가 없음 (fetcher 미구현) | **TRUE** — `fetchKoreaData()` 가 Yahoo OHLCV + marketCap 만 반환 (`lib/signals/fetcher.ts:200~253`). KRX 수급 데이터 fetcher **함수 자체가 존재하지 않음** |
| (b) 데이터는 있는데 가공이 안 됨 | FALSE |
| (c) 의도적 비활성화 | 부분 TRUE — `live` 기본값을 `false` 로 설정한 건 의도적 (ADR 003 의 "더미값 사용 중" 정책). 비활성화 자체가 목적이 아니라 **데이터 소스 부재의 결과** |

---

## 3. 데이터 소스 분류

| K | 필요 raw 데이터 | 표준 소스 | 갱신 주기 | 인증 | 현재 시스템 보유? |
|---|----------------|----------|----------|------|:---:|
| K1 | 외국인 순매수액 (종목별 일자별) | KRX 정보데이터시스템 (data.krx.co.kr) `/dbms/MDC/STAT/standard/MDCSTAT02302` 등 / KIS Open API 종목별 외국인 매매 | 일별 (T+0 장 종료 후) | KRX 무인증 (rate-limited) / KIS 인증 필요 | ❌ |
| K2 | 기관 순매수액 (종목별, 보험·연기금·자산운용 합산) | KRX 정보데이터시스템 동일 페이지 / KIS | 일별 | 동일 | ❌ |
| K3 | 프로그램매매 순매수 (종목별) | KRX `/MDC/STAT/standard/MDCSTAT11102` 류 | 일별 | KRX 무인증 | ❌ |
| K4 | 외국인 보유율 (현재 + 20영업일 전) | KRX `/MDC/STAT/standard/MDCSTAT02201` (외국인 보유 종목별) | 일별 | KRX 무인증 | ❌ |
| K5 | 공매도 잔고 / 시총 | KRX 공매도 종합포털 (short.krx.co.kr) `/contents/SRT/02/02010100/...` | 영업일 +2 (T+2 공시) | KRX 무인증 | ❌ |
| K6 | 대차잔고 + 20일 MA | KRX 정보데이터 `/MDC/STAT/standard/MDCSTAT30101` (대차거래) | 일별 | KRX 무인증 | ❌ |
| K7 | 신용잔고 (종목별) / 시총 | 금융투자협회 freesis.kofia.or.kr / KRX | 일별 (다음 영업일 발표) | 무인증 | ❌ |
| K8 | 상위 외국계 창구 매수 점유율 | KRX 거래원별 매매 `/MDC/STAT/standard/MDCSTAT09001` (회원사별) | 일별 | KRX 무인증 | ❌ |

### 추가 메모

- KRX 정보데이터시스템은 form-data POST + `OTP` 토큰 발급 후 csv 다운로드 패턴. fetcher 신규 구현 필요.
- KIS Open API 는 OAuth2 + 계정당 호출제한. ADR 004 에 미정의 → 도입 시 별도 ADR 필요.
- 대안: pykrx (Python) / krx-python 같은 비공식 래퍼 — 운영 환경에 Python 설치 + 별도 마이크로서비스 필요.

---

## 4. K9~K12 대조군

| K | 데이터 | 출처 | 비고 |
|---|--------|------|------|
| K9 | volumeZ, OBV slope, price slope | `computeOhlcvIndicators(closes, highs, lows, volumes)` | Yahoo OHLCV → `compute.ts` |
| K10 | RSI, MACD hist | 동일 | Yahoo OHLCV |
| K11 | price, MA5/20/60 | 동일 | Yahoo OHLCV |
| K12 | 종목 20d return, 섹터 20d return | 종목분: Yahoo / 섹터분: **0 하드코딩** | Phase A P3 진단 시 확인됨. K12 는 절반만 라이브 (실제로는 섹터=0 이라 K12 score 가 절대 수익률만 반영) |

**K1~K8 과의 차이**: K9~K12 는 **종목 OHLCV 만 있으면 산출 가능**. 외부 KRX 수급 API 가 필요 없음. 그래서 Yahoo 한 군데에서 다 나옴.

---

## 5. ADR 참조

### ADR 003 — 신호 평가 엔진 v3

> live 플래그: 신호별 `live: true/false` 는 "실제 API 데이터를 쓰는가"를 의미.  
> **`live: false` 신호는 데이터 미수급(온체인 등)으로 현재 더미값 사용 중.**  
> 점수 계산에는 포함되지만 UI에서 "라이브 N/총 N" 형태로 노출.

→ K1~K8 의 `live: false` 는 ADR 003 정책의 정상 적용. 다만 ADR 003 본문은 "온체인 등" 만 예시로 들어 한국 수급 신호도 같은 카테고리임이 명시되지 않음.

### ADR 004 — 시장별 데이터 소스

> ### 미국 주식 / 한국 주식
> - **Yahoo Finance** (`lib/yahoo.ts`): OHLCV, 시총, 재무지표
> - 이유: 무료, API 키 불필요, US·KOSPI·KOSDAQ 모두 커버

→ **한국 시장 데이터 소스가 Yahoo Finance 단일**로 정의됨. KRX/KIS/금투협 등 수급 데이터 소스가 **ADR에 일절 등장하지 않음**. 이게 핵심 원인.

---

## 6. 신호별 종합 표

| 신호 | 측정 대상 | 필요 데이터 | 현재 상태 | 막힌 원인 | 해결 난이도 |
|------|----------|------------|----------|----------|:--:|
| K1 | 외국인 5일 순매수 / 시총 | KRX 외국인 매매 일별 | `live=false`, `foreignNet5d=0` | KRX fetcher 미구현 + ADR 미정의 | **중** (KRX OTP+CSV 파싱) |
| K2 | 기관 5일 순매수 / 시총 | KRX 기관 매매 (보험·연기금·운용 합) | 동일 | 동일 | **중** (K1 파이프라인 재사용) |
| K3 | 프로그램매매 5일 순매수 | KRX 프로그램매매 | 동일 | 동일 | **중** |
| K4 | 외국인 보유율 변화 | KRX 외국인 보유 (T+0 + T-20) | `live=false`, curr=20d=30 (Δ=0) | 동일 + 20일 전 데이터 캐싱 필요 | **중상** (히스토리 누적 필요) |
| K5 | 공매도 잔고 / 시총 | KRX short.krx.co.kr (T+2 지연) | `live=false`, pct=1 | 별 도메인 (short.krx) — 별도 OTP 흐름 | **중상** |
| K6 | 대차잔고 + 20MA | KRX 대차거래 일별 | `live=false`, curr=ma20=100 | KRX fetcher 미구현 + 20일 MA 계산용 히스토리 필요 | **중** |
| K7 | 신용잔고 / 시총 | 금투협 freesis 또는 KRX | `live=false`, pct=1 | 금투협은 별도 API 도메인 | **중상** |
| K8 | 외국계 창구 집중도 | KRX 회원사별 매매 (top broker share) | `live=false`, share=0.3 | 회원사 매핑 테이블 필요 (외국계 vs 국내) | **상** (분류 메타 추가) |

### 공통 막힘 사유

1. **fetcher 함수 부재** — `fetchKoreaData()` 가 Yahoo OHLCV + marketCap 만 반환. KRX 호출 코드 0줄.
2. **ADR 미정의** — ADR 004 가 한국 시장을 Yahoo 단일로 못박음. KRX/KIS 도입은 ADR 추가가 선행되어야 함.
3. **하드코딩 더미** — `lib/signals/index.ts:243~254` 에서 8개 raw 값을 상수로 주입. 이 라인이 fetcher 결과로 교체되어야 함.
4. **`liveFlags` 미주입** — `computeKoreaSignals` 호출 시 K9~K12 만 `true` 로 명시. K1~K8 은 default `false` 로 자동 전환.

### 해결 난이도 평가 기준

- **중**: KRX 정보데이터 OTP+CSV 파싱 한 종류만 추가하면 K1/K2/K3/K6 동시 해결 가능 (같은 도메인·같은 인증 패턴).
- **중상**: 별도 도메인 (short.krx.co.kr, freesis.kofia.or.kr) 또는 히스토리 캐싱 필요.
- **상**: 회원사 분류 메타 테이블이 추가로 필요한 K8.

---

## 7. 후속 작업 제안 (수정은 별도 승인 후)

1. **새 ADR (006-korea-flow-data-sources)** 작성 — KRX/KIS/금투협 도입 결정. 인증 패턴, rate limit, 캐시 전략, 장애 대응(폴백 = 더미 유지) 정의.
2. **`lib/signals/fetcher.ts` 에 `fetchKoreaFlowData(ticker)`** 함수 신설 — K1~K8 raw 값 8개를 객체로 반환. 실패 시 현재 더미와 동일 fallback.
3. **`computeKoreaSignals` 호출부 업데이트** — fetch 결과를 input 으로 전달, `liveFlags` 에 K1~K8 도 `true` 로 명시 (단, fetch 실패 시 해당 K만 `false`).
4. **Phase A P2 의 RFC `signal-function-signature.md`** 와 정합성 검토 — `{value, confidence, reason}` 구조가 도입되면 부분 결측에도 `confidence: low + live: true` 패턴이 가능해져 K8 같은 "데이터 일부만 있음" 케이스를 더 정교하게 표현 가능.
5. **모니터링** — 도입 후 `verify` cron 의 outcome 정확도가 개선되는지 추적. 만약 K1~K8 도입 후 정확도가 저하되면 weight 진화엔진이 자동으로 가중치 하향 → 자기교정.

---

## 8. 진단 범위 외이지만 함께 발견한 사항

- **K12 sectorRet20d 도 `0` 하드코딩** (`index.ts:266`). Phase A P3 보고서(`docs/refactor-p3-diff.md`) 에서 이미 기록. K1~K8 fetcher 신규 구축 시 섹터 closes 도 동시에 공급해 K12 도 완전 라이브화 가능.
- **`liveCount/totalCount` 표시 의미** — 현재 한국 종목은 SSE 응답에 `liveCount=4, totalCount=12` 로 나갈 것. 사용자에게는 "12개 신호 중 4개만 실시간" 으로 비춰지나, 진실은 "**가중치 31/100 만 점수에 반영**". UI 표기와 실제 영향력 사이의 gap 도 검토 대상.

---

*이 보고서는 코드를 수정하지 않은 진단 문서입니다. 다음 단계는 흥권님 승인 후 새 ADR + fetcher 구현으로 진행.*
