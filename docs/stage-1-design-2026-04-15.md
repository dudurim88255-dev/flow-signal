# Stage 1: KIS API 연동 설계 문서

> **작성일**: 2026-04-15  
> **목적**: `sectorRet20d: 0` 하드코딩 제거 — KIS API 실데이터 연결  
> **수정 대상**: `lib/signals/index.ts:260`  
> **브랜치**: `stage-1-k12` (Step 3에서 생성)

---

## 1. 모듈 구조

```
lib/data/
  kisAuth.ts        # KIS OAuth 토큰 발급 + Redis 캐싱
  kisSectorMap.ts   # KOSPI ticker → KIS 업종코드 정적 매핑
  sectorIndex.ts    # KIS 업종지수 조회 + 20일 수익률 계산
```

### 의존 관계

```
lib/signals/index.ts
  └─ getSectorRet20dSafe(ticker)        [sectorIndex.ts]
       ├─ kisSectorMap[ticker]           [kisSectorMap.ts]
       ├─ Redis.get(kis:sector:...)      [lib/redis.ts]
       ├─ getKisToken()                  [kisAuth.ts]
       │    └─ Redis.get(kis:token)      [lib/redis.ts]
       └─ fetch KIS API
```

---

## 2. KOSPI 종목 → 업종 코드 매핑

### 정적 매핑 테이블 (lib/data/kisSectorMap.ts)

harvest 대상: `KOSPI_STOCKS.slice(0, 10)`

| ticker | 종목명 | 내부 섹터 | KIS 업종명 (예상) | KIS 코드 | 근거 | 신뢰도 |
|--------|--------|----------|-----------------|---------|------|-------|
| `005930.KS` | 삼성전자 | 반도체 | 전기전자 | `0028` | KRX 업종 분류 공개자료, 반도체 = 전기전자 하위 | ✅ 높음 |
| `000660.KS` | SK하이닉스 | 반도체 | 전기전자 | `0028` | 동일 업종 | ✅ 높음 |
| `373220.KS` | LG에너지솔루션 | 2차전지 | 전기전자 | `0028` | 배터리 = 전기전자 하위 분류 (KRX 관례) | ⚠️ 중간 |
| `006400.KS` | 삼성SDI | 2차전지 | 전기전자 | `0028` | 동일 업종 | ⚠️ 중간 |
| `051910.KS` | LG화학 | 화학 | 화학 | `0010` | KRX 업종 분류 직접 매핑 | ✅ 높음 |
| `207940.KS` | 삼성바이오로직스 | 바이오 | 의약품 | `0011` | KRX 의약품 업종 (바이오 = 의약품 하위) | ✅ 높음 |
| `068270.KS` | 셀트리온 | 바이오 | 의약품 | `0011` | 동일 업종 | ✅ 높음 |
| `005380.KS` | 현대차 | 자동차 | 운수장비 | `0026` | KRX 업종 분류 직접 매핑 | ✅ 높음 |
| `000270.KS` | 기아 | 자동차 | 운수장비 | `0026` | 동일 업종 | ✅ 높음 |
| `012330.KS` | 현대모비스 | 자동차 | 운수장비 | `0026` | 자동차 부품 = 운수장비 하위 | ✅ 높음 |

> ⚠️ **LG에너지솔루션(373220), 삼성SDI(006400)**: KRX는 배터리 업체를 전기전자(0028)로 분류하는 것이 일반적이나,  
> KIS 포털에서 `inquire-index-category-price` 호출로 실제 코드를 반드시 검증해야 함.  
> Step 3 구현 시 첫 호출에서 응답의 `hts_kor_isnm` 필드를 로그로 출력하여 확인.

### 확장성 설계

현재 범위 외 종목(KOSPI_STOCKS[10+])은 매핑 없음 → `KisSectorMapError` throw.  
추후 확장 시 kisSectorMap.ts에 항목 추가만 하면 됨 (동적 API 로드 불필요).

---

## 3. KIS API 클라이언트 인터페이스

### 3-A. lib/data/kisAuth.ts

```typescript
/**
 * KIS OAuth 액세스 토큰 발급 및 캐싱
 * 캐시 키: kis:token (Redis TTL 23시간)
 * 만료 시 자동 재발급
 */
export async function getKisToken(): Promise<string>
// - Redis hit → 즉시 반환
// - Redis miss → POST /oauth2/tokenP → Redis 저장(TTL 82800초) → 반환
// - 네트워크 실패 → throw KisAuthError

export class KisAuthError extends Error {}
```

**토큰 발급 요청**:
```
POST {KIS_API_BASE}/oauth2/tokenP
Content-Type: application/json

{ "grant_type": "client_credentials", "appkey": "...", "appsecret": "..." }
```

**캐시 전략**:
- Redis 키: `kis:token`
- TTL: 82800초 (23시간) — 24시간 토큰 기준 1시간 여유

---

### 3-B. lib/data/sectorIndex.ts

```typescript
/**
 * KOSPI 업종지수 20일 수익률 조회
 * ticker: yahoo finance 심볼 (예: "005930.KS")
 */
export async function getSectorRet20d(ticker: string): Promise<number>
// 처리 흐름:
//   1. kisSectorMap에서 ticker → 업종코드 (없으면 throw KisSectorMapError)
//   2. Redis 확인: kis:sector:{코드}:{YYYYMMDD} (TTL 86400초)
//   3. 캐시 히트 → 즉시 반환
//   4. 캐시 미스 → getKisToken() → KIS API 호출
//   5. 응답 closes 배열 → returnPct(closes, 20) 계산
//   6. Redis 저장 후 반환

export async function getSectorRet20dSafe(ticker: string): Promise<number | null>
// getSectorRet20d() 래퍼
// 모든 에러(KisAuthError, KisSectorMapError, 네트워크 등) → null 반환
// 에러 내용은 console.warn으로 기록

export class KisSectorMapError extends Error {}
```

**KIS API 요청**:
```
GET {KIS_API_BASE}/uapi/domestic-stock/v1/quotations/inquire-index-daily-price
  ?FID_PERIOD_DIV_CODE=D
  &FID_COND_MRKT_DIV_CODE=U
  &FID_INPUT_ISCD={업종코드}
  &FID_INPUT_DATE_1={30일 전 YYYYMMDD}

Headers:
  authorization: Bearer {token}
  appkey: {KIS_APP_KEY}
  appsecret: {KIS_APP_SECRET}
  tr_id: FHPUP02120000
  Content-Type: application/json
```

**응답 파싱**:
```typescript
// output2 배열: [{ stck_bsop_date, bstp_nmix_prpr }, ...]
// 날짜 오름차순 정렬 후 closes 추출
// returnPct(closes, 20) → (closes[n-1] / closes[n-21] - 1)
```

**캐시 전략**:
- Redis 키: `kis:sector:{업종코드}:{YYYYMMDD}`
- TTL: 86400초 (1일) — 장 마감 후 데이터 고정, 다음날 갱신

---

## 4. 환경변수 설계

### 신규 환경변수 4종

```bash
# .env.local (절대 커밋 금지)
KIS_APP_KEY=발급받은_앱키
KIS_APP_SECRET=발급받은_앱시크릿
KIS_API_BASE=https://openapi.koreainvestment.com:9443
KIS_ACCOUNT_TYPE=real
# real = 실전투자 서버, paper = 모의투자 서버
```

### .env.example 업데이트 항목

```bash
# KIS Developers API (한국투자증권)
# 발급: https://apiportal.koreainvestment.com → API 신청
KIS_APP_KEY=
KIS_APP_SECRET=
KIS_API_BASE=https://openapi.koreainvestment.com:9443
KIS_ACCOUNT_TYPE=real
```

### KIS_ACCOUNT_TYPE 용도

| 값 | 서버 URL | 비고 |
|----|---------|------|
| `real` | `https://openapi.koreainvestment.com:9443` | 실전투자 (Rate limit 높음) |
| `paper` | `https://openapivts.koreainvestment.com:29443` | 모의투자 (테스트용) |

> `KIS_API_BASE`를 직접 설정하므로 `KIS_ACCOUNT_TYPE`은 문서용.  
> 실제 분기는 `KIS_API_BASE` 값으로 제어.

---

## 5. lib/signals/index.ts:260 수정 방안

### 현재 코드

```typescript
// lib/signals/index.ts:258-264 (대략)
const K12score = computeKoreaSignals(data, live, {
  stockRet20d: ind.ret20d,
  sectorRet20d: 0,          // ← 260번 줄 하드코딩
  ...
```

### 옵션 A: await + null 처리 (추천 ✅)

```typescript
// getSectorRet20dSafe는 에러 시 null 반환
const sectorRet = await getSectorRet20dSafe(ticker);

const K12score = computeKoreaSignals(data, live, {
  stockRet20d: ind.ret20d,
  sectorRet20d: sectorRet ?? 0,   // null이면 이전 동작(=0) 유지
  ...
```

**장점**:
- 에러 시 현재 동작 그대로 유지 (downgrade 없음)
- K12 신호 partial 허용 — `live: false` 없음
- 코드 변경 최소

**단점**:
- `sectorRet20d: 0` fallback이 "API 연동 성공"인지 "fallback"인지 외부에서 구분 불가
- 디버깅 시 null vs 0 혼동 가능

### 옵션 B: live 플래그 연동

```typescript
const sectorRet = await getSectorRet20dSafe(ticker);
const sectorLive = sectorRet !== null;

const K12score = computeKoreaSignals(data, live && sectorLive, {
  stockRet20d: ind.ret20d,
  sectorRet20d: sectorRet ?? 0,
  ...
```

**장점**: K12 신호가 live인지 명시적으로 표현

**단점**:
- KIS API 실패 시 K12 신호 전체가 `live: false` → 점수 신뢰도 표시 변동
- K12는 기술적 신호 — partial 허용이 합리적 (신호 자체를 무력화할 이유 없음)

### 추천: **옵션 A**

K12는 기술적 신호이므로 KIS API 실패 시 이전 동작(neutral) 유지가 적절.  
사용자가 별도로 live 구분이 필요하다고 판단하면 옵션 B로 전환.

---

## 6. 에러 처리 정책

### 에러 계층 구조

```
KisAuthError        — 토큰 발급/갱신 실패 (네트워크, 자격증명 오류)
KisSectorMapError   — ticker 매핑 없음 (지원 외 종목)
KisApiError         — API 응답 오류 (HTTP 4xx/5xx, 파싱 실패)
```

### 에러별 동작 정책

| 에러 | getSectorRet20d | getSectorRet20dSafe | lib/signals 동작 |
|------|----------------|-------------------|----------------|
| KisAuthError | throw | null 반환 | `sectorRet20d: 0` fallback |
| KisSectorMapError | throw | null 반환 | `sectorRet20d: 0` fallback |
| KisApiError (HTTP 5xx) | throw | null 반환 | `sectorRet20d: 0` fallback |
| KisApiError (HTTP 429) | throw | null 반환 | `sectorRet20d: 0` fallback |
| 데이터 부족 (< 21일) | throw | null 반환 | `sectorRet20d: 0` fallback |

**원칙**:
- K12 신호 계산 실패 → **K12만 neutral(0 기준)**, 나머지 K1~K11 정상 평가
- harvest 전체 skip 금지 — KIS API 실패가 다른 신호에 영향 없음
- `getSectorRet20dSafe`에서 `console.warn` 필수 (에러 추적용)

### Rate Limit (EGW00201) 처리

harvest 대상 업종: 최대 4개 (0028, 0010, 0011, 0026)  
→ 동시에 4개 섹터 데이터 요청 시 초당 1~2회 수준 → Rate limit 문제 없음.  
단, 연속 호출 시 50ms 간격 권장.

---

## 7. 테스트 전략

### Step 4 테스트 시나리오

#### T1: 환경변수 누락 시 graceful fallback

```bash
# .env.local에서 KIS_APP_KEY 주석 처리 후
# /api/score/korea/005930.KS 호출
# 기대값: K12 신호 score=50(neutral), 나머지 K1~K11 정상
```

#### T2: 삼성전자 (005930.KS) baseline 검증

```bash
# KIS 자격증명 설정 후
# GET /api/score/korea/005930.KS
# 기대값:
#   - SSE signal 이벤트 중 id="K12" 포함
#   - K12 live=true (sectorRet이 실제 값)
#   - sectorRet20d ≠ 0 (KIS API 연동 확인)
```

#### T3: Redis 캐싱 동작 확인

```bash
# 첫 번째 호출: KIS API 호출됨 (로그 확인)
# 두 번째 호출: Redis hit (로그 확인, 응답 시간 단축)
# Redis CLI: GET "kis:sector:0028:{오늘날짜}" → 값 존재 확인
```

#### T4: 매핑 없는 종목 fallback (옵션 A 검증)

```bash
# 매핑 없는 종목 (예: KOSPI_STOCKS[10]) 호출
# 기대값: K12 신호 score=50(neutral), live 변화 없음
# console.warn에 KisSectorMapError 로그 출력
```

#### T5: 토큰 캐시 TTL 확인

```bash
# Redis CLI: TTL "kis:token"
# 기대값: 82800 ~ 86400 사이 (약 23시간)
```

### 단위 테스트 항목

```typescript
// __tests__/kisSectorMap.test.ts
test('005930.KS → 0028')
test('051910.KS → 0010')
test('알 수 없는 ticker → KisSectorMapError')

// __tests__/sectorIndex.test.ts (Redis/KIS mock)
test('캐시 히트 시 API 미호출')
test('21개 미만 데이터 → KisApiError')
test('getSectorRet20dSafe: 에러 → null')
```

---

## 8. 환경변수 누락 시 동작

### 옵션 A: 런타임 null (추천 ✅)

```typescript
// kisAuth.ts 내부
if (!process.env.KIS_APP_KEY || !process.env.KIS_APP_SECRET) {
  throw new KisAuthError('KIS 환경변수 누락: KIS_APP_KEY, KIS_APP_SECRET 필요');
}
```

→ `getSectorRet20dSafe`가 KisAuthError를 catch → null 반환  
→ `sectorRet20d: 0` fallback → K12 neutral, 서비스 정상 운영  
→ `console.warn`으로 누락 사실 기록

**장점**:
- 환경변수 없어도 서비스 전체 정상 동작
- Vercel 배포 환경에서 점진적 롤아웃 가능 (환경변수 추가 전 배포 먼저)
- KIS 자격증명 미취득 상태에서도 개발/테스트 가능

**단점**:
- 누락 사실이 조용히 fallback되어 눈에 띄지 않음 (warn 로그 필수)

### 옵션 B: 빌드타임 실패

```typescript
// 빌드 시 환경변수 검증 스크립트 추가
// 또는 module-level throw
if (!process.env.KIS_APP_KEY) throw new Error('Missing KIS_APP_KEY');
```

**장점**: 누락 즉시 명확한 에러

**단점**:
- Vercel 빌드 실패 — 환경변수 추가 전 배포 불가
- 기존 서비스 중단 위험 (KIS 자격증명 준비 전까지)
- Next.js 서버 컴포넌트에서 module-level throw는 빌드 타임 실행

### 추천: **옵션 A**

KIS 환경변수는 선택적 기능 강화. 없어도 서비스는 동작해야 함.  
`sectorRet20d: 0` 이 현재 동작이므로, 환경변수 누락 = 현상 유지.

---

## 구현 체크리스트 (Step 3용)

```
[ ] stage-1-k12 브랜치 생성
[ ] .env.local에 KIS 환경변수 4종 추가
[ ] lib/data/kisSectorMap.ts 작성
[ ] lib/data/kisAuth.ts 작성 (getKisToken + Redis 캐싱)
[ ] lib/data/sectorIndex.ts 작성 (getSectorRet20d, getSectorRet20dSafe)
[ ] lib/signals/index.ts:260 수정 (옵션 A)
[ ] .env.example 업데이트
[ ] Step 4 테스트 시나리오 T1~T5 실행
[ ] PR 준비
```

---

*설계 작성: Claude Sonnet 4.6 | 기준일: 2026-04-15*
