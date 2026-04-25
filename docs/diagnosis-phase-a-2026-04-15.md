# FlowSignal Phase A 통합 진단 보고서
**작성일**: 2026-04-15  
**진단 범위**: harvest cron 미작동 원인 + P0~P3 재검증 + 상호의존성 매핑  
**목적**: 4/27 baseline 측정 전 시스템 무결성 확보  
**원칙**: 수정 금지 · 추측 금지 · 코드+데이터+로그 기반 사실만 기재

---

## 요약 (Executive Summary)

| 항목 | 상태 | 심각도 |
|------|------|--------|
| harvest cron 실행 여부 | **미실행 추정** (Scenario A 유력) | P0 |
| Risk Gate #6 (샘플부족) | **항시 차단** (verified=0) | P0 |
| cascade failure | **확인** (verify→evolve→narrate 전체 무력화) | P0 |
| EvalResult.confidence 타입 충돌 | **현재도 활성** | P1 |
| /score 경로 Risk Gate 미적용 | **현재도 활성** | P1 |
| K12 sectorRet20d 하드코딩 | **현재도 활성** | P2 |
| confidence 수치 불일치 노출 | **현재도 활성** | P2 |
| C13 default 불일치 | 잠재적 (현재 무영향) | P3 |
| C11/C12 default true | 잠재적 (현재 무영향) | P3 |

**핵심 결론**: harvest는 Hobby plan cron 개수 제한(Scenario A)으로 호출 자체가 안 될 가능성이 높다. 설령 호출되더라도 Risk Gate #6 샘플부족 체크로 30개 종목 전부 `score=50, label="리스크차단"`으로 저장된다. 두 문제가 동시에 존재하며 서로 독립적이다.

---

## Section 1: harvest Cron 미작동 원인 추적

### 1-A. vercel.json cron 설정 현황

**파일**: `vercel.json` (28줄)

```json
"crons": [
  { "path": "/api/cron/warm-stocks", "schedule": "0 0 * * *" },   // #1
  { "path": "/api/cron/regime",      "schedule": "30 0 * * *" },  // #2
  { "path": "/api/cron/harvest",     "schedule": "0 1 * * *" },   // #3  ← 대상
  { "path": "/api/cron/verify",      "schedule": "0 2 * * *" },   // #4
  { "path": "/api/cron/evolve",      "schedule": "0 3 * * 0" },   // #5
  { "path": "/api/cron/narrate",     "schedule": "0 4 * * 0" }    // #6
]
```

총 6개 cron 정의. harvest는 배열 인덱스 기준 **세 번째(#3)**.

### 1-B. Vercel 플랜 확인

`.env.local` VERCEL_OIDC_TOKEN JWT payload 디코딩 결과:

```json
{ "plan": "hobby", ... }
```

**현재 플랜: Hobby**.  
Vercel Hobby plan의 공식 cron 제한: **cron job 2개**까지 활성화.  
vercel.json에 6개를 선언해도 Vercel 대시보드에서 실제 등록되는 수는 플랜 상한까지다.

### 1-C. 시나리오별 원인 분류

#### Scenario A — cron이 애초에 호출되지 않음 (★ 최유력)

- **근거**: Hobby plan 제한 2개. harvest는 3번째 → 대시보드에서 비활성 처리될 가능성 높음
- **확인 방법**: Vercel 대시보드 → 프로젝트 → Settings → Cron Jobs 탭에서 등록된 job 목록 직접 확인
- **현재 확인 상태**: 대시보드 접근 불가 (CLI 미설치 환경) → **확인 불가**. 단, OIDC JWT의 `"plan":"hobby"` 는 실증적 증거임

#### Scenario B — maxDuration 초과로 강제 종료

- **근거**:
  - `harvest/route.ts` line 19: `export const maxDuration = 300`
  - Hobby plan function timeout: 10초 (Vercel 공식 문서 기준)
  - `maxDuration = 300` 선언은 Pro/Enterprise에서만 존중됨; Hobby는 10초 상한
  - 30개 종목 × 배치 5개 × 배치당 ~5초 + 딜레이 5×4초 = **최소 50초 이상** 소요
  - 로컬 테스트: `curl .../api/cron/harvest --max-time 15` → exit code 28 (timeout at 15s)
- **가능성**: Scenario A와 독립적으로 성립. cron이 호출된다 해도 10초 내에는 완료 불가 → 중단됨
- **판정**: **Scenario A와 B는 동시에 성립**. A가 해소되어도 B가 남음

#### Scenario C — Risk Gate #6으로 예측이 전부 차단됨 (★ 확실히 발생)

- **근거**: `lib/signals/riskgate.ts` 확인
  - Check #6: `if (verifiedCount < 5) return { ... failedChecks: ["샘플부족"] }`
  - `loadRiskGateData()` → `getAllPredictions(market)` → `.filter(p => p.outcome14d === "correct" || p.outcome14d === "wrong").length`
  - 현재 Redis에 prediction 데이터 없음 (harvest 미실행이므로) → `verifiedCount = 0`
  - 0 < 5 → Check #6 항상 실패
- **결과**: harvest가 실행되어도 30개 종목 전부 `score=50, label="리스크차단"`으로 저장됨
- **자가봉쇄 구조**: harvest가 실행되어야 prediction이 쌓이고, prediction이 5개 이상 verified 되어야 Risk Gate 통과 → verify cron이 outcome을 업데이트하려면 최소 5일치 harvest + verify 실행 필요 → 현재 0에서 시작 시 최소 5일간은 모든 harvest 결과가 차단됨
- **다른 check 현황**:
  - Check #3 (regime stability): `recentRegimes.length < 2 → return true` → 현재 패스 (레짐 이력 없음)
  - Check #5 (WF): `wfResult === null → return true` → 현재 패스 (WF 결과 없음)

#### Scenario D — Redis 연결 실패

- **근거**: `.env.local` 확인
  - `KV_REST_API_URL="https://prepared-boa-93147.upstash.io"` (단일 인스턴스)
  - `lib/redis.ts` lazy singleton 정상 구현 확인
  - `/score` SSE curl 테스트: BTC `confidence:76` 반환 (cached:true) → Redis 정상 동작 확인
- **판정**: Redis 연결 실패는 **현재 아님**. /score가 캐시를 정상 반환하므로 Redis는 alive

#### Scenario E — 인증 실패

- **근거**: `harvest/route.ts` line 138:
  ```typescript
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`)
  ```
  - Vercel cron이 호출할 때 `Authorization: Bearer {CRON_SECRET}`을 자동 주입함
  - `.env.local`: `CRON_SECRET="b05447267f4c83c060959d6616e291ea787e911c3497582e5db77a2dfed0fb29"` 존재
  - Vercel 대시보드에 동일 값이 환경변수로 설정되어 있다면 인증은 통과함
- **판정**: 대시보드 환경변수 설정 여부 **확인 불가**. 단, 코드 자체의 인증 로직은 정상

### 1-D. 시나리오 우선순위 및 판정

| 시나리오 | 판정 | 확실도 |
|----------|------|--------|
| A — cron 미호출 (Hobby 제한) | **최유력** | 높음 (OIDC JWT 증거, Hobby plan 문서) |
| B — maxDuration 초과 | **확실** | 높음 (로컬 테스트 timeout 실증) |
| C — Risk Gate 차단 | **확실** | 확정 (코드 논리상 100%) |
| D — Redis 연결 실패 | **아님** | 높음 (/score 정상 동작으로 반증) |
| E — 인증 실패 | 가능성 있음 | 낮음 (Vercel 자동 주입 설계상 정상) |

### 1-E. harvest 미작동의 하류 영향

`harvest → verify → evolve → narrate` 전체 파이프라인이 harvest 없이는 무의미하다.

- **verify** (`/api/cron/verify`): `getAllPredictions(market)` → 현재 0건 → 아무것도 업데이트 안 함
- **evolve** (`/api/cron/evolve`): verified prediction 0건 → weight 업데이트 없음
- **narrate** (`/api/cron/narrate`): prediction 0건 → 내러티브 생성 불가

전체 cron 파이프라인 **현재 완전 정지 상태**.

### 1-F. 해소 시 예상 동작 (참고, 수정 아님)

Scenario A 해소 (Pro 업그레이드 또는 다른 cron 제거) 후에도:
1. Scenario B (timeout) 로 harvest가 중간에 잘릴 수 있음 → 배치 수 조정 또는 함수 분리 필요
2. Scenario C (Risk Gate #6) 로 최소 5일간은 리스크차단 라벨 유지 → 의도적 설계이나 시동 로직(부트스트랩 모드) 부재

---

## Section 2: P0~P3 5건 재검증

*전일(2026-04-14) 진단 이후 해당 파일에 커밋 없음. 재검증은 코드 재확인으로 수행.*

### 2-A. P0 — EvalResult.confidence 타입 충돌

**파일**: `lib/signals/index.ts`

`EvalResult` 타입 선언 (lines 24-43):
```typescript
confidence: 'high' | 'medium' | 'low'
```

실제 런타임 동작 (lines 388-407): coverage 비율 계산 후 문자열 'high'/'medium'/'low' 반환 → `result.confidence`에 저장.

`app/api/score/[market]/[ticker]/route.ts`:
```typescript
const confidence = calcConfidence(result.signals);  // → 0~100 숫자
await redis.set(cacheKey, JSON.stringify({ ...result, confidence }), ...);
// result.confidence = 'high'|'medium'|'low' (문자열)
// confidence = 0~100 (숫자)
// JSON.stringify 시 confidence 키가 숫자로 덮어씌워짐
```

캐시된 데이터 구조:
- `result.confidence` (문자열) → `...result` spread로 포함
- `confidence` (숫자) → 동일 키로 덮어씌움 → **최종적으로 숫자가 저장됨**

SSE result 이벤트 전송:
```typescript
enqueue("result", { ..., confidence, ... });  // 숫자만 전송, 문자열 버려짐
```

**curl 실증** (2026-04-15 측정):
- BTC: `"confidence":76` (숫자)
- 삼성전자: `"confidence":70` (숫자)

**재검증 결론**: P0 **여전히 활성**. 타입 선언은 string, 전송되는 값은 number. TypeScript 컴파일 단계에서 오류는 발생하지 않음(spread 시 타입 체크 우회). 기능상 number가 전달되므로 프론트엔드가 number를 그대로 사용하고 있다면 현재 동작은 일관됨. 그러나 `EvalResult` 타입을 신뢰하는 코드는 잘못된 타입 가정을 하게 됨.

**H1 검증**: `Prediction` 타입(`lib/predictions.ts`) 확인 결과 `confidence` 필드 없음. `savePrediction()` 호출 시 confidence 관련 런타임 에러 없음. → P0가 harvest 실패를 유발한다는 H1 = **FALSE**.

### 2-B. P1 — /score 경로에 Risk Gate 미적용

**파일**: `app/api/score/[market]/[ticker]/route.ts`

`runRiskGate` import 없음. 호출 없음. `evaluateSignals()` 결과를 직접 Redis에 저장하고 SSE로 전송.

반면 `app/api/cron/harvest/route.ts`:
```typescript
import { runRiskGate } from "@/lib/signals/riskgate";
const riskResult = runRiskGate({ ... });
const finalScore = riskResult.pass ? result.score : 50;
```

**재검증 결론**: P1 **여전히 활성**. /score는 Risk Gate 없이 raw score 전달. harvest는 Risk Gate 적용. 두 경로의 점수 체계가 다름. 4/27 baseline 측정을 /score API로 수행할 경우 harvest 예측값과 비교 불가능한 기준선이 생성됨 → H2 = **TRUE**.

### 2-C. P2-C13 — crypto.ts C13 default 불일치

**파일**: `lib/signals/crypto.ts` (lines 130-159)  
`lib/signals/index.ts` (line 201)

`computeCryptoSignals()` 호출:
- `crypto.ts` 함수 시그니처: `live.C13 ?? false` → default FALSE
- `index.ts` line 201: `computeCryptoSignals(data, live, { C13: true, ... })` → 명시적으로 TRUE

호출 사이트 grep 결과: `computeCryptoSignals` 는 `lib/signals/index.ts` 단 한 곳에서만 호출됨.

**재검증 결론**: P2-C13 **잠재적, 현재 무영향**. 유일한 호출 사이트에서 `{ C13: true }`를 명시하므로 default는 실질적으로 사용되지 않음. 독립 단위 테스트 또는 미래 호출 사이트 추가 시 위험 발생 가능.

### 2-D. P2-K12 — sectorRet20d 하드코딩

**파일**: `lib/signals/index.ts` (line 260)

```typescript
const K12score = computeKoreaSignals(data, live, {
  sectorRet20d: 0,  // ← 하드코딩
  ...
});
```

K12 신호는 종목 20일 수익률과 섹터 20일 수익률을 비교해 상대강도를 측정하는 것이 설계 의도. `sectorRet20d: 0` 이면 K12는 섹터 대비 상대강도가 아니라 절대 수익률 양음(+/-)을 측정하게 됨.

K12 `live: true` (harvest 대상 신호)이므로 harvest가 실행되면 왜곡된 K12 값이 예측에 포함됨.

**재검증 결론**: P2-K12 **여전히 활성**. harvest 미실행 상태이므로 아직 evolve 오염은 없으나, harvest 재개 후 즉시 잘못된 K12 학습 시작됨.

### 2-E. P3 — C11/C12 live default true

**파일**: `lib/signals/crypto.ts`

```typescript
C11: { live: live.C11 ?? true, ... }  // default true (비표준)
C12: { live: live.C12 ?? true, ... }  // default true (비표준)
C13: { live: live.C13 ?? false, ... } // default false
```

일반적으로 new signal은 `live: false`로 시작하고 검증 후 활성화하는 것이 표준 절차. C11/C12는 기본값이 true.

호출 사이트 (`index.ts` line 201)에서 `live` 파라미터를 전달하므로 실제 default 사용 여부는 `live` 파라미터에 `C11`, `C12` 키가 있는지에 달림.

grep 결과 `index.ts`에서 `live` 파라미터 구성 확인: `computeCryptoSignals(data, live, ...)` — `live` 객체가 어떻게 구성되는지는 시그널 설정 파일에 의존.

**재검증 결론**: P3 **잠재적**. 실제 영향은 `live` 파라미터 구성에 달려 있어 코드만으로는 완전 판단 불가. 현재 단독 호출 없으므로 무영향.

---

## Section 3: 상호의존성 매핑

### 3-A. 5×5 의존성 매트릭스

행 = 원인, 열 = 영향을 받는 대상

|  | harvest 재개 | /score 정확도 | evolve 학습 | baseline 측정 | 사용자 신뢰도 |
|--|:--:|:--:|:--:|:--:|:--:|
| **Scenario A** (cron 미호출) | ★차단 | 무관 | ★차단 | 무관 | 간접↓ |
| **Scenario B** (timeout) | ★차단 | 무관 | ★차단 | 무관 | 간접↓ |
| **Risk Gate #6** (샘플부족) | 리스크차단 | 무관 | 리스크차단 | 무관 | 간접↓ |
| **P0** (confidence 타입) | 무관 | 혼란 | 무관 | 혼란 | ↓ |
| **P2-K12** (sectorRet20d) | 무관 | K12 왜곡 | ★오염 | K12 왜곡 | 잠재↓ |

### 3-B. H1 — P0 confidence 타입 충돌이 harvest 실패를 유발하는가

**검증**:
- `savePrediction()` 함수 시그니처: `confidence` 파라미터 없음
- `Prediction` 타입: `confidence` 필드 없음
- harvest에서 `savePrediction()` 호출 시 confidence 값 전달 없음

**판정**: **H1 = FALSE**. P0의 타입 충돌은 /score SSE 응답과 Redis 캐시에 영향을 주지만, harvest → savePrediction 경로에는 전달되지 않음. P0가 harvest 실패의 원인이 아님.

### 3-C. H2 — Risk Gate 분리가 baseline을 오염시키는가

**검증**:
- /score 경로: Risk Gate 없음 → raw signal 합산 점수 직접 전달
- harvest 경로: Risk Gate 있음 → 통과 못하면 score=50 저장
- 4/27 baseline 측정을 /score API 기반으로 한다면, Risk Gate가 차단할 종목도 "raw score"로 측정됨
- harvest 이력(리스크차단 라벨)과 baseline(/score raw score)은 근본적으로 다른 기준

**판정**: **H2 = TRUE**. 두 경로의 점수 체계가 다르다. /score로 측정한 baseline을 harvest 예측값과 비교하면 시스템적 편향 발생.

### 3-D. H3 — K12 거짓 라이브가 evolve 학습을 오염시키는가

**검증**:
- K12: `live:true`, `sectorRet20d=0` (하드코딩)
- evolve cron: verified prediction의 신호별 score를 학습해 weight 조정
- K12가 live=true로 분류되므로 evolve는 K12 score를 실제 섹터상대강도 신호로 취급
- 실제로는 절대수익률 기반 신호 → evolve가 학습하는 신호 특성이 잘못됨

**현재 상태**: harvest 미실행이므로 evolve 입력 데이터 없음. 오염 미발생.

**판정**: **H3 = 잠재적 TRUE**. harvest 재개 후 첫 evolve 실행부터 K12 왜곡값이 학습됨. 현재는 harvest 정지로 보호되고 있지만, harvest 부활과 동시에 위험 활성화.

### 3-E. H4 — confidence 수치 불일치가 사용자를 오도하는가

**검증**:
- index.ts coverage 계산:
  - 삼성전자: live 신호 4개 (K7 K8 K9 K10), 전체 12개 → coverage = 31% → 'low'
  - BTC: live 신호 다수, coverage 계산값 불명 (직접 코드 확인)
- route.ts calcConfidence():
  - 삼성전자 curl 결과: `"confidence":70` (stddev 기반 숫자)
  - BTC curl 결과: `"confidence":76` (stddev 기반 숫자)
- 사용자가 보는 값: 70, 76 → "중간~높은 신뢰도" 인상
- 실제 live 신호 coverage: 31% (삼성전자 기준) → 'low'가 올바른 표현

**판정**: **H4 = 확인**. stddev 기반 confidence는 신호 간 일관성(표준편차)을 반영하며, live 신호 coverage를 반영하지 않는다. 70%의 신호가 미검증(live:false)인 종목도 confidence:70으로 표시될 수 있다.

### 3-F. H5 — harvest 정지가 cron 파이프라인 전체를 cascade 실패시키는가

**검증**:

```
harvest → prediction:market:ticker:date 키 생성
verify  → prediction:market:ticker:date 읽어 outcome 업데이트 → verifiedCount 증가
evolve  → verified prediction 읽어 weight 학습
narrate → prediction 읽어 내러티브 생성
```

현재 상태:
- `redis.keys("prediction:*")` → 0건 (harvest 미실행)
- verify: 업데이트할 대상 없음 → 실행되어도 아무것도 안 함
- evolve: verified 0건 → weight 변경 없음
- narrate: prediction 0건 → 내러티브 없음

**판정**: **H5 = TRUE**. harvest가 정지되면 전체 파이프라인이 기능하지 않음. 현재 시스템 상태는 /score SSE API 만 동작하는 단독 모드이며, 자율 학습 · 예측 추적 · 내러티브 생성 기능은 전부 정지됨.

---

## 종합 판정 및 조치 우선순위 (수정 제안 아님, 정보 제공)

### 조치 필요 항목 (우선순위 순)

1. **[긴급] Vercel 대시보드에서 harvest cron 등록 여부 확인** (Scenario A 검증)
   - 경로: Vercel Dashboard → 프로젝트 → Settings → Cron Jobs
   - 확인 포인트: `/api/cron/harvest` 가 목록에 있는지, Next Execution 시간이 표시되는지
   
2. **[긴급] Hobby → Pro 플랜 업그레이드 또는 cron 개수 축소 검토** (Scenario A 해소)
   - Hobby 제한이 확인되면 cron을 2개 이하로 줄이거나 플랜 업그레이드 필요

3. **[긴급] maxDuration 초과 대응 검토** (Scenario B 해소)
   - Hobby 제한 해소 후에도 harvest가 10초 내 완료 불가
   - 30개 → 소수 종목으로 축소하거나, 배치 분리 API 구성 필요

4. **[높음] Risk Gate #6 부트스트랩 로직 검토** (Scenario C)
   - `verifiedCount < 5` 조건으로 시스템 시동 불가 상태
   - 초기 N일간 check #6 스킵 또는 임계값 하향 검토 필요

5. **[중간] P2-K12 sectorRet20d 실제 데이터 공급** (harvest 재개 전 필수)
   - harvest 부활 전 수정하지 않으면 evolve 오염 시작됨

6. **[낮음] P0 EvalResult.confidence 타입 정렬**
   - 기능 영향 없으나 타입 시스템 신뢰성 저하

### 회귀 위험 평가

| 수정 항목 | 다른 기능에 미치는 영향 |
|-----------|------------------------|
| Scenario A 해소 (cron 활성화) | Scenario B, C 노출 → 별도 대응 필요 |
| Scenario B 해소 (배치 축소) | harvest 종목 수 감소 → 다양성 저하 |
| Scenario C 해소 (#6 임계값 조정) | 초기 노이즈 prediction으로 evolve 오염 위험 |
| P2-K12 수정 | Korea 점수 분포 변화 → 기존 cached 점수와 불일치 발생 가능 |
| P0 수정 | Redis 캐시 스키마 변경 → 기존 캐시 무효화 필요 |

---

## 첨부: 진단 근거 파일 목록

| 파일 | 관련 항목 |
|------|-----------|
| `vercel.json` | Scenario A, cron 설정 |
| `.env.local` | Hobby plan 확인, CRON_SECRET |
| `app/api/cron/harvest/route.ts` | Scenario B, C, E |
| `lib/signals/riskgate.ts` | Scenario C (Risk Gate #6) |
| `lib/predictions.ts` | H1 (FALSE 확인) |
| `lib/signals/index.ts` | P0, P2-K12, H4 |
| `lib/signals/crypto.ts` | P2-C13, P3 |
| `app/api/score/[market]/[ticker]/route.ts` | P0, P1, H2 |
| `lib/redis.ts` | Scenario D (무영향 확인) |
| `lib/stocks.ts` | 30개 harvest 대상 확인 |

**curl 실증 데이터**:
- `GET /api/score/crypto/bitcoin` → `event:result` `{"confidence":76,"cached":true,...}`
- `GET /api/score/korea/005930` → `event:result` `{"confidence":70,"cached":false,...}`
- `GET /api/cron/harvest` (로컬, max-time 15) → exit code 28 (timeout)

---

*이 보고서는 수정 없이 코드·데이터·로그 기반으로 작성된 순수 진단 문서입니다.*  
*다음 단계: 각 항목별 수정 여부를 사용자가 판단 후 승인된 항목만 수정 진행.*
