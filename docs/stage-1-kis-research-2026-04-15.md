# Stage 1: KIS API 사전 조사 보고서

> **작성일**: 2026-04-15  
> **목적**: K12 신호(`sectorRet20d`) 실제 데이터 연결을 위한 KIS Developers API 사전 조사  
> **수정 대상**: `lib/signals/index.ts:260` — `sectorRet20d: 0` 하드코딩 제거

---

## 조사 항목 요약

| 항목 | 상태 | 결과 |
|------|------|------|
| 1-A: KIS 가입 절차 | ✅ 확인 | 앱키/앱시크릿 발급 절차 파악 |
| 1-B: 업종지수 엔드포인트 | ✅ 확인 | TR_ID, 파라미터, 응답 필드명 확인 |
| 1-C: 인증 방식 | ✅ 확인 | OAuth URL, 실전 서버 URL, Rate Limit |
| 1-D: 대안 데이터 소스 | ✅ 확인 | KIS만 실용적 — 대안 불가 |

---

## 1-A: KIS Developers 가입 절차

### 개요

- **포털 URL**: https://apiportal.koreainvestment.com
- **운영사**: 한국투자증권 (Korea Investment & Securities)
- REST API + WebSocket, GitHub 샘플 코드, AI 지원(ChatGPT) 제공

### 발급 절차 (요약)

1. 한국투자증권 계좌 개설 (실전투자 권장 — 모의투자는 rate limit 낮음)
2. KIS Developers 포털 로그인 → "API 신청"
3. 서비스 유형 선택(국내주식 시세 → 업종지수 포함)
4. **앱키(App Key)** + **앱시크릿(App Secret)** 발급
5. 이후 아래 OAuth 흐름으로 액세스 토큰 발급

> ⚠️ **중요**: 포털 직접 접근이 제한되어 있어 세부 UI 절차는 실제 로그인 후 확인 필요.  
> Rate Limit: 실전 계좌 > 모의투자 계좌 (EGW00201 = 초당 제한 초과 에러)

---

## 1-B: KOSPI 업종지수 엔드포인트

### 주요 API 2종

#### (B-1) 업종 일자별 지수 — 핵심 사용 API

```
GET /uapi/domestic-stock/v1/quotations/inquire-index-daily-price
```

| 파라미터 | 값 | 설명 |
|---------|-----|------|
| `FID_PERIOD_DIV_CODE` | `"D"` | 일별 (W=주별, M=월별) |
| `FID_COND_MRKT_DIV_CODE` | `"U"` | 업종 구분 |
| `FID_INPUT_ISCD` | `"0028"` 등 | KOSPI 업종 코드 |
| `FID_INPUT_DATE_1` | `"20250101"` | 조회 시작일 (YYYYMMDD) |

**TR_ID**: `FHPUP02120000`

**응답 output1 주요 필드**:
```
bstp_nmix_prpr  → 업종 지수 현재가 (종가)
bstp_nmix_prdy_vrss → 전일 대비
stck_bsop_date  → 영업일자
```

**페이지네이션**: 응답 헤더 `tr_cont` = "M"(더 있음) / "F"(마지막)

#### (B-2) 업종 카테고리별 현재가 — 전체 업종 목록 조회용

```
GET /uapi/domestic-stock/v1/quotations/inquire-index-category-price
```

| 파라미터 | 값 | 설명 |
|---------|-----|------|
| `FID_COND_MRKT_DIV_CODE` | `"U"` | 업종 |
| `FID_MRKT_CLS_CODE` | `"K"` | KOSPI (Q=코스닥, K2=코스피200) |
| `FID_BLNG_CLS_CODE` | `"0"` | 전업종 (1=기타, 2=자본금, 3=업종별) |
| `FID_COND_SCR_DIV_CODE` | `"20214"` | 고정값 |

**TR_ID**: `FHPUP02140000`

응답 필드:
```
hts_kor_isnm  → 업종명 (한글)
bstp_nmix_prpr → 업종 지수 현재가
```

이 API로 **전체 KOSPI 업종 코드 목록**을 동적으로 조회 가능.

### KOSPI 업종 코드 매핑 (예상, 확인 필요)

harvest 대상 10종목(`KOSPI_STOCKS.slice(0,10)`)의 섹터:

| 종목 | 내부 섹터 | KIS 업종명 (예상) | KIS 코드 (예상) |
|------|----------|------------------|---------------|
| 삼성전자 (005930) | 반도체 | 전기전자 | `0028` |
| SK하이닉스 (000660) | 반도체 | 전기전자 | `0028` |
| LG에너지솔루션 (373220) | 2차전지 | 전기전자 | `0028` |
| 삼성SDI (006400) | 2차전지 | 전기전자 | `0028` |
| LG화학 (051910) | 화학 | 화학 | `0010` |
| 삼성바이오로직스 (207940) | 바이오 | 의약품 | `0011` |
| 셀트리온 (068270) | 바이오 | 의약품 | `0011` |
| 현대차 (005380) | 자동차 | 운수장비 | `0026` |
| 기아 (000270) | 자동차 | 운수장비 | `0026` |
| 현대모비스 (012330) | 자동차 | 운수장비 | `0026` |

> ⚠️ **업종 코드는 KIS 포털 "업종코드 다운로드" 또는 `inquire-index-category-price` 호출로 확인 필요**.  
> 위 코드는 일반적으로 알려진 값이나, 실제 KIS 코드와 다를 수 있음.

**Step 2에서 설계 시**: `inquire-index-category-price` 를 앱 초기화 시 1회 호출해 전체 업종 코드 목록을 로드한 뒤, `hts_kor_isnm`(업종명)으로 매핑하는 방식이 코드 유지보수에 유리.

---

## 1-C: 인증 방식 (OAuth 2.0)

### 서버 URL

| 환경 | REST API BASE URL |
|------|-------------------|
| **실전투자** | `https://openapi.koreainvestment.com:9443` |
| **모의투자** | `https://openapivts.koreainvestment.com:29443` |

### 토큰 발급 흐름

```
POST https://openapi.koreainvestment.com:9443/oauth2/tokenP

Content-Type: application/json

{
  "grant_type": "client_credentials",
  "appkey":    "발급받은 앱키",
  "appsecret": "발급받은 앱시크릿"
}
```

응답:
```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

> **토큰 TTL**: `expires_in` 공식 문서 미확인. 업계 표준 기준 **24시간(86400초)**으로 추정.  
> Step 3 구현 시 실제 응답으로 확인 후 확정.

### API 요청 헤더 구조

```http
GET /uapi/domestic-stock/v1/quotations/inquire-index-daily-price HTTP/1.1
Host: openapi.koreainvestment.com:9443
Content-Type: application/json
authorization: Bearer {access_token}
appkey: {YOUR_APP_KEY}
appsecret: {YOUR_APP_SECRET}
tr_id: FHPUP02120000
```

### Rate Limit

- **에러 코드 EGW00201** = 초당 요청 횟수 초과
- 실전 계좌 > 모의투자 계좌 (정확한 수치 미공개)
- 안전 기준: **초당 1회** (연속 호출 시 `smart_sleep()` 사용 권장)
- FlowSignal 적용 시: 업종 수 ≤ 5개, 1회 호출로 충분 → rate limit 문제 없음

### Vercel 캐싱 전략

```
Upstash Redis 키: `kis:sector:{업종코드}:{YYYYMMDD}`
TTL: 86400초 (1일 — 장 마감 후 데이터 고정)
토큰 캐시 키: `kis:token`
토큰 TTL: 82800초 (23시간 — 24시간 토큰 기준 1시간 여유)
```

---

## 1-D: 대안 데이터 소스 평가

### Yahoo Finance (현재 사용 중)

- ✅ 개별 종목 OHLCV 지원 (이미 `fetchKoreaData`에서 사용)
- ❌ **KOSPI 업종지수 데이터 미지원** — 업종별 세분화 지수 없음
- ❌ KOSPI 종합지수(`^KS11`)만 가능 → K12 섹터 상대강도 계산 불가

### FinanceDataReader

- ✅ `KRX/INDEX/LIST`로 KRX 전체 지수 목록 조회 가능
- ✅ `fdr.DataReader('KS11', '2020')`으로 KOSPI 종합 조회 가능
- ❌ **Python 전용** (100% Python, Node.js 래퍼 없음) → FlowSignal(Node.js)에서 직접 사용 불가
- ❌ KOSPI 세부 업종지수 조회 가능 여부 불명확

### KRX 정보데이터시스템 (data.krx.co.kr)

- ❌ **서버 Internal Server Error** 반복 발생 → 안정성 낮음
- ❌ 공개 REST API 없음 (웹 스크래핑 의존)
- ❌ 스크래핑은 Vercel Edge/Serverless 환경에서 불안정
- → 실 서비스 사용 불적합

### 결론: KIS API가 유일한 실용적 소스

```
KIS API
  - 실시간 + 일별 KOSPI 업종지수 지원 ✅
  - REST API (JSON) ✅
  - Node.js fetch() 사용 가능 ✅
  - 인증 필요 (앱키/시크릿) — 1회 세팅 후 토큰 캐싱으로 관리 가능 ✅
```

---

## Step 2 설계를 위한 핵심 결정사항

### 환경변수 설계 (안)

```bash
# .env.local (절대 커밋 금지)
KIS_APP_KEY=발급받은_앱키
KIS_APP_SECRET=발급받은_앱시크릿
KIS_BASE_URL=https://openapi.koreainvestment.com:9443
```

### 구현 파일 구조 (안)

```
lib/data/
  sectorIndex.ts        # KOSPI 업종지수 조회 + 20일 수익률 계산
  kisToken.ts           # OAuth 토큰 발급 + Redis 캐싱
```

### K12 수정 위치 확정

```typescript
// lib/signals/index.ts:260 — 수정 전
const K12score = computeKoreaSignals(data, live, {
  sectorRet20d: 0,  // ← 하드코딩

// 수정 후
  sectorRet20d: await fetchSectorRet20d(ticker),  // KIS API
```

### 에러 처리 원칙

- KIS API 실패 시 → `sectorRet20d: 0` fallback (현재 동작 유지)
- `live: false`로 마킹하지 않음 — K12는 기술적 신호이므로 partial 허용
- 토큰 발급 실패 시 → Redis에 이전 토큰 없으면 fallback

---

## 조사 한계 및 미확인 사항

| 미확인 항목 | 확인 방법 | Step 2 영향 |
|------------|----------|------------|
| 토큰 TTL 정확한 값 | 실제 API 호출 후 `expires_in` 확인 | 토큰 캐시 TTL 조정 |
| KOSPI 업종 코드 정확한 값 | `inquire-index-category-price` 호출 또는 KIS 포털 다운로드 | 섹터 매핑 하드코딩 vs 동적 로드 결정 |
| Rate limit 정확한 수치 | KIS 포털 문서 또는 테스트 | 캐시 TTL 결정에 영향 |
| 가입 절차 UI 상세 | 실제 KIS 포털 로그인 후 확인 | Step 3 전 자격증명 준비 시 필요 |

---

## 권고사항

**Step 2 진행 전 사용자 액션 필요**:
1. KIS Developers 포털(apiportal.koreainvestment.com) 가입
2. 앱키 + 앱시크릿 발급
3. `KIS_APP_KEY`, `KIS_APP_SECRET` 환경변수 준비

Step 2는 이 자격증명 없이도 설계 문서 작성 가능.  
Step 3(구현) + Step 4(테스트)는 자격증명 필수.

---

*보고서 작성: Claude Sonnet 4.6 | 조사 기준일: 2026-04-15*
