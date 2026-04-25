# Stage 2: Risk Gate 페널티 모드 전환 — 정밀 진단 보고서

> **작성일**: 2026-04-15  
> **목적**: `runRiskGate()` 차단 모드 → 페널티 모드 전환 전 코드 정밀 진단  
> **원칙**: 수정 X, 진단만. 실제 변경은 Step 2(설계) 승인 후 `stage-2-riskgate-penalty` 브랜치에서.

---

## 1-A. 영향 받는 코드 위치 전체 목록

| 파일 | 라인 | 역할 | 수정 필요 여부 |
|------|------|------|--------------|
| `lib/signals/riskgate.ts` | 전체 | Risk Gate 6개 체크 + `runRiskGate()` 통합 | `RiskCheckResult` 반환 타입 변경 |
| `app/api/cron/harvest/route.ts` | 96–97 | `finalScore/finalLabel` 차단 덮어씀 | **핵심 수정 대상** |
| `lib/predictions.ts` | `Prediction` 타입 | `risk_flags` 필드 없음 | 타입 확장 필요 |
| `app/api/cron/verify/route.ts` | `judgeOutcome()` | score=50 → neutral 판정 (deadlock 원인) | 수정 없음 (페널티 모드에서 자동 해소) |
| `app/api/cron/evolve/route.ts` | 필터 조건 | neutral 예측 학습 제외 | 수정 없음 (페널티 모드에서 자동 해소) |
| `app/api/score/[market]/[ticker]/route.ts` | 없음 | `/score` SSE — Risk Gate 미적용 | 선택적 추가 (Step 2 설계에서 결정) |
| `app/score/[market]/[ticker]/page.tsx` | `ResultMeta` 타입 | `risk_flags` 필드 없음 | 프론트엔드 표시용 추가 |

---

## 1-B. Risk Gate 6개 체크 분석

### 현재 `RiskCheckResult` 구조

```typescript
// lib/signals/riskgate.ts
export type RiskCheckResult = {
  pass: boolean;
  failedChecks: string[];   // ["데이터신선도", "거래량붕괴", ...]
  details: Record<string, unknown>;
};
```

### 6개 체크 × 페널티 모드 영향도 분석

| # | 함수명 | failedChecks 문자열 | 현재 동작 (차단) | 페널티 모드 | 데드락 유발? |
|---|--------|--------------------|--------------------|------------|------------|
| 1 | `checkDataFreshness` | `"데이터신선도"` | 48시간 초과 → score=50 | score 유지 + 플래그 | 아니오 (일시적) |
| 2 | `checkVolumeCrash` | `"거래량붕괴"` | recentVol/avgVol30d < 0.2 → score=50 | score 유지 + 플래그 | 아니오 (일시적) |
| 3 | `checkRegimeStability` | `"레짐전환"` | 최근 3일 레짐 불일치 → score=50 | score 유지 + 플래그 | 아니오 (일시적) |
| 4 | `checkSignalConsensus` | `"신호합의없음"` | live 신호 stdDev > 25 → score=50 | score 유지 + 플래그 | 아니오 (일시적) |
| 5 | `checkWalkforwardPerformance` | `"WF성능저하"` | avgAccuracy < 45% → score=50 | score 유지 + 플래그 | 아니오 (evolve로 회복 가능) |
| 6 | `checkSampleSufficiency` | `"샘플부족"` | verifiedCount < 5 → score=50 | score 유지 + 플래그 | **YES — 핵심 데드락** |

### 체크 #6 (샘플부족) 데드락 상세

```
[현재 차단 모드의 chicken-egg 데드락]

verifiedCount = 0
  → checkSampleSufficiency(0) 실패 (5 미달)
  → runRiskGate: pass=false
  → harvest: finalScore = 50, finalLabel = "리스크차단"
  → savePrediction(score=50, ...)
  → verify: judgeOutcome(score=50) → 40~59 범위 → "neutral"
  → Prediction.outcome14d = "neutral"
  → evolve 필터: outcome14d === "correct" | "wrong" 만 학습
  → neutral → 학습 제외
  → verifiedCount 영구 0
  → 체크 #6 영구 실패 → 영구 차단 ♾️

[페널티 모드의 자가 치유]

verifiedCount = 0
  → checkSampleSufficiency(0) 실패
  → runRiskGate: pass=false, failedChecks=["샘플부족"]
  → harvest: finalScore = result.score (원본 유지!), risk_flags=["샘플부족"]
  → savePrediction(score=원본값, risk_flags=["샘플부족"])
  → verify: judgeOutcome(score=원본값) → 60↑ "correct" 또는 40↓ "wrong"
  → outcome14d 정상 기록
  → evolve 학습 포함
  → verifiedCount 점진적 증가
  → verifiedCount ≥ 5 도달 시 → risk_flags 해소 ✅
```

### `riskgate.ts` 페널티 모드 전환 시 필요한 변경 (최소)

```typescript
// 현재 RiskCheckResult — 변경 불필요 (기존 구조 그대로 활용)
// pass=false + failedChecks 배열이 곧 risk_flags의 원천
```

`riskgate.ts` 자체 수정은 **없음** — 이미 `failedChecks[]` 를 반환하고 있음.  
변경은 `harvest/route.ts` 에서 `riskResult.failedChecks` 를 `risk_flags` 로 저장하도록.

---

## 1-C. `Prediction` 타입 확장 영향

### 현재 타입 (`lib/predictions.ts`)

```typescript
export type Prediction = {
  market: Market;
  ticker: string;
  name: string;
  date: string;
  score: number;
  label: string;
  signals: Array<{ id: string; score: number; weight: number; live: boolean }>;
  priceAtPrediction: number;
  priceAt5d?: number;
  priceAt14d?: number;
  outcome5d?: "correct" | "wrong" | "pending" | "neutral";
  outcome14d?: "correct" | "wrong" | "pending" | "neutral";
  verifiedAt?: string;
  scoreVersion?: string;
  // ← risk_flags 없음
};
```

### 추가할 필드

```typescript
risk_flags?: string[];  // ["샘플부족", "레짐전환", ...] | undefined(=통과)
```

### 영향 받는 호출부

| 파일 | 함수 | risk_flags 영향 |
|------|------|----------------|
| `app/api/cron/harvest/route.ts` | `savePrediction(...)` 호출 | `risk_flags` 인자 추가 |
| `app/api/score/.../route.ts` | `savePrediction(...)` 호출 (line 121~138) | `risk_flags` 없거나 undefined 전달 |
| `app/api/cron/verify/route.ts` | `getPendingPredictions()` | 읽기 전용 — 변경 불필요 |
| `app/api/cron/evolve/route.ts` | `getAllPredictions()` | 학습 시 `risk_flags` 참조 가능 (선택) |

### Redis 호환성

- `savePrediction` 은 `JSON.stringify(prediction)` 후 Redis SET
- `risk_flags` 추가는 **backwards-compatible** — 기존 키에는 필드가 없어도 `undefined` 로 읽힘
- Redis 키 변경 불필요 (`prediction:{market}:{ticker}:{YYYY-MM-DD}`)
- 캐시 플러시 불필요

---

## 1-D. 프론트엔드 영향

### DESIGN.md 유무

```
존재하지 않음 — glob 탐색 결과 없음.
```
디자인 일관성은 기존 `app/score/[market]/[ticker]/page.tsx` 의 배지 패턴 참조.

---

### `/score/[market]/[ticker]` 페이지 분석

#### `ResultMeta` 타입 (클라이언트측 정의, line 38~52)

```typescript
type ResultMeta = {
  score: number;
  label: string;
  liveCount: number;
  totalCount: number;
  evaluatedAt: string;
  modelVersion: string;
  confidence: number;
  price: number;
  ret7d: number | null;
  ret30d: number | null;
  spark: number[];
  name: string;
  cached: boolean;
  // ← risk_flags 없음
};
```

#### risk_flags 배지 최적 표시 위치

**"신뢰도 바" 영역 (line 764~783)** — 이미 "캐시됨" + label 배지가 있는 곳:

```tsx
{/* 현재 구조 */}
<div className="px-5 py-3 bg-gray-900 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
  <div className="flex items-center gap-3">
    <span>신뢰도 <span className="text-gray-200 font-bold">{result.confidence}%</span></span>
    <span>실시간 <span className="text-gray-200 font-bold">{result.liveCount}/{result.totalCount}</span></span>
  </div>
  <div className="flex items-center gap-2">
    {result.cached && <span>캐시됨</span>}
    <span className={...}>{result.label}</span>
    {/* ← risk_flags 배지 추가 위치 */}
  </div>
</div>
```

추가할 배지 예시:
```tsx
{result.risk_flags?.map(flag => (
  <span key={flag} className="text-[10px] px-1.5 py-0.5 bg-orange-950 border border-orange-900 text-orange-400 rounded font-semibold">
    ⚠ {flag}
  </span>
))}
```

#### `/score` 페이지와 Risk Gate의 관계

- `/api/score/[market]/[ticker]/route.ts` 는 **Risk Gate 미적용**
- `harvest` 에서만 Risk Gate 적용 → `risk_flags` 는 Prediction에 저장됨
- `/score` 페이지가 `risk_flags` 를 표시하려면 두 가지 옵션:

| 옵션 | 방법 | 복잡도 | 권장 |
|------|------|--------|------|
| A | `/api/score` SSE 에도 Risk Gate 적용 → result 이벤트에 `risk_flags` 포함 | 중 | ✅ |
| B | `/score` 페이지에서 별도 API로 최신 Prediction의 risk_flags 조회 | 고 | ❌ |
| C | `/score` 페이지에 risk_flags 표시 안 함 (harvest 데이터에만 저장) | 저 | 최소 범위 |

**권장 옵션 A**: `/api/score` route 의 `evaluateSignals()` 후 `runRiskGate()` 호출 → result SSE 이벤트에 `risk_flags` 포함 → 프론트엔드 배지 표시.

---

### Dashboard / StockRow 분석

- `components/Dashboard.tsx` — risk/리스크 관련 코드 없음 (grep 결과 없음)
- `components/StockRow.tsx` — `stock.score` → `FlowScoreRing` 으로만 표시
- 현재 `StockData` 타입에 `risk_flags` 없음 → 대시보드 카드는 **Phase 1에서 변경 불필요**
- **권장**: Dashboard는 이번 Stage 2에서 변경 제외 (최소 범위 원칙)

---

## 1-E. 진단 요약 및 수정 범위 확정

### 핵심 문제

1. **Chicken-egg 데드락**: `checkSampleSufficiency` 실패 → score=50 차단 → neutral 판정 → verifiedCount 증가 불가 → 영구 차단
2. **점수 체계 불일치**: `/score`(Risk Gate 없음) vs `harvest`(Risk Gate 차단) → 사용자에게 다른 점수 표시
3. **evolve 학습 손실**: 차단된 예측(score=50→neutral)은 학습 데이터에서 제외 → 신호 품질 향상 기회 상실

### 페널티 모드 전환 후 해소 메커니즘

```
[페널티 모드]
pass=false → score 원본 유지 + risk_flags=["샘플부족", ...]
→ judgeOutcome(원본 score) → correct/wrong (정상 판정)
→ evolve 학습 포함
→ verifiedCount 증가
→ risk_flags 점진적 해소 (자가 치유)
```

### 수정 대상 파일 (최소 범위, Step 2 설계 후 확정)

| 파일 | 변경 내용 | 우선순위 |
|------|----------|---------|
| `lib/predictions.ts` | `Prediction` 타입에 `risk_flags?: string[]` 추가 | P0 |
| `app/api/cron/harvest/route.ts` | lines 96–97: `finalScore/finalLabel` 덮어씀 제거 → `risk_flags` 저장 | P0 |
| `app/api/score/.../route.ts` | Risk Gate 적용 + result SSE에 `risk_flags` 포함 (옵션 A) | P1 |
| `app/score/.../page.tsx` | `ResultMeta` 에 `risk_flags?` 추가 + 배지 표시 | P1 |

### 수정 불필요 파일

| 파일 | 이유 |
|------|------|
| `lib/signals/riskgate.ts` | `failedChecks[]` 이미 반환 중 — 구조 변경 불필요 |
| `app/api/cron/verify/route.ts` | 페널티 모드에서 자동 해소 — `judgeOutcome` 수정 불필요 |
| `app/api/cron/evolve/route.ts` | 페널티 모드에서 neutral 감소 → 자동 학습 포함 |
| `components/Dashboard.tsx` | Phase 1에서 제외 (최소 범위) |
| `components/StockRow.tsx` | Phase 1에서 제외 |

### verifiedCount 기준값 불일치 (참고 사항)

| 파일 | 기준 | 의미 |
|------|------|------|
| `riskgate.ts` `checkSampleSufficiency` | ≥ 5 | Risk Gate 통과 최소 샘플 |
| `evolve/route.ts` `MIN_SAMPLE` | ≥ 10 | 가중치 업데이트 최소 샘플 |

→ verifiedCount 5~9 구간: Risk Gate 통과 + evolve 미학습. 정상 동작. 별도 수정 불필요.

---

## Step 2 진행을 위한 확정 결정사항

1. `RiskCheckResult` 구조 변경 없음 — `failedChecks[]` 그대로 `risk_flags`로 매핑
2. `Prediction.risk_flags?: string[]` 추가 (optional — 기존 Redis 데이터 호환)
3. harvest 핵심 수정: `finalScore = result.score`, `finalLabel = result.label` (원본 유지) + `risk_flags = riskResult.failedChecks`
4. `/api/score` route: Risk Gate 옵션 A 적용 권장 (점수 체계 통일)
5. Dashboard/StockRow: Phase 1 제외

---

*진단 작성: Claude Sonnet 4.6 | 진단 기준일: 2026-04-15*
