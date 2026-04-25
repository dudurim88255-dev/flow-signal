# Stage 2: Risk Gate 페널티 모드 전환 — 설계 문서

> **작성일**: 2026-04-15  
> **브랜치**: `stage-2-riskgate-penalty` (Step 3 착수 시 생성)  
> **전제**: `docs/stage-2-diagnosis-2026-04-15.md` 완료  
> **근거 데이터**: `/api/score` 샘플 10종목 실측 + 응답 시간 측정

---

## 추가 검토 1: judgeOutcome neutral 구간 영향

### 1-1. raw score 분포 측정 결과

| 종목 | 시장 | raw score | 구간 |
|------|------|-----------|------|
| 삼성전자(005930) | korea | 67.4 | 60+ 🟢 |
| SK하이닉스(000660) | korea | 72.4 | 60+ 🟢 |
| LG에너지솔루션(373220) | korea | 55.2 | **40~59 🟡** |
| 삼성SDI(006400) | korea | 70.0 | 60+ 🟢 |
| LG화학(051910) | korea | 65.3 | 60+ 🟢 |
| AAPL | us | 55.9 | **40~59 🟡** |
| MSFT | us | 60.3 | 60+ 🟢 |
| NVDA | us | 66.9 | 60+ 🟢 |
| GOOGL | us | 65.7 | 60+ 🟢 |
| AMZN | us | 70.4 | 60+ 🟢 |

**결과**: 40~59 구간(neutral 판정) → 10개 중 2개 = **20%**

### 1-2. 20% neutral이 의미하는 바

페널티 모드 전환 후:
- 80%의 종목은 `judgeOutcome` → correct/wrong → `verifiedCount` 증가
- 20%의 종목은 `judgeOutcome` → neutral (40~59 구간) → evolve 제외

> **핵심 구분**: 이 20% neutral은 "점수가 자연스럽게 40~59인 종목"이다.  
> 과거 deadlock은 `checkSampleSufficiency` 실패로 **모든 종목**이 인위적으로 score=50을 강요받아 **전체가** neutral이 되던 문제였다.  
> 페널티 모드 후 20% neutral은 알고리즘이 정직하게 "이 종목은 방향 판단이 어렵다"고 표현하는 것.

### 1-3. 옵션별 결정

| 옵션 | 내용 | 복잡도 | 결론 |
|------|------|--------|------|
| **A (채택)** | judgeOutcome 그대로 유지 | 무변경 | ✅ |
| B | neutral 구간을 45~55로 축소 | 중 | 4주 모니터링 후 검토 |
| C | risk_flags 있는 예측 가중치 0.5 부여 | 고 | 미채택 |

**결정: 옵션 A**

근거:
1. 20% neutral은 알고리즘 정직성의 표현 — 억지로 확장하면 noise 학습
2. Deadlock 해소 = 이미 80% 종목이 정상 학습 → verifiedCount 5→10 도달 예상 기간: **2~4주**
3. 4주 후 verifiedCount 분포 모니터링 → 필요 시 옵션 B 재검토
4. `judgeOutcome` 변경은 기존 verify 결과와 불일치 발생 → 데이터 무결성 리스크

---

## 추가 검토 2: /api/score Risk Gate 적용 (옵션 A 상세)

### 2-1. 응답 시간 영향

| 상태 | 현재 응답 시간 | Risk Gate 추가 후 | 오버헤드 |
|------|-------------|------------------|---------|
| **캐시 히트** | 311ms | 311ms (캐시 반환 전 Risk Gate 미실행) | 0ms |
| **미캐시 (풀 계산)** | ~22.7s | ~22.75s (+50ms Redis 병렬 조회) | <0.3% |

`loadRiskGateData` 내부 Redis 호출 구조:
```
Promise.all([
  getHistoricalRegime(market, date-2),  // Redis GET × 1
  getHistoricalRegime(market, date-1),  // Redis GET × 1
  getHistoricalRegime(market, date-0),  // Redis GET × 1
  getWalkforwardResult(market),          // Redis GET × 1
  getAllPredictions(market),             // Redis SCAN + GET × N
])
```
→ 병렬 실행, 실측 RTT ~10~50ms 예상. 22.7초 대비 무시 가능.

SSE 스트리밍에서 Risk Gate는 `evaluateSignals()` **완료 후** 실행:
```
[신호 스트림 시작] → 12개 signal 이벤트 (사용자에게 즉시 표시) → [evaluateSignals 완료]
→ runRiskGate() (~1ms CPU) → result 이벤트 전송
```
→ 사용자가 체감하는 신호 스트리밍 속도에 영향 없음.

### 2-2. 캐시 키 전략

| 옵션 | 내용 | 기존 캐시 처리 | 권장 |
|------|------|-------------|------|
| **A (채택)** | 키 유지 (`score:v3:`) | 기존 캐시: risk_flags=undefined → 프론트 표시 없음. TTL 만료 후 자동 포함. | ✅ |
| B | 일괄 플러시 | 즉시 전체 재계산 | 서버 부하 급등 |
| C | 키 버전 분리 (`score:v4:`) | 즉시 전체 재계산 | 동일 문제 |

**결정: 옵션 A (키 유지)**

근거:
- CACHE_TTL_SEC = 600초 (10분) → 자연 마이그레이션 10분 이내 완료
- `risk_flags?: string[]` optional → 프론트엔드 `undefined` 처리 기본 안전
- 배포 직후 일부 사용자는 risk_flags 없는 캐시 응답 수신 → UX 영향 없음 (배지만 미표시)

### 2-3. SSE 인터페이스 변경

`ResultMeta` 타입 변경 (page.tsx 클라이언트 측):
```typescript
// 추가 필드
risk_flags?: string[];  // ["샘플부족", "레짐전환", ...] | undefined(통과)
```

`/api/score` route의 `result` SSE 이벤트에 `risk_flags` 추가:
```typescript
// 기존
enqueue("result", { score, label, ..., cached: false });

// 변경 후
enqueue("result", { score, label, ..., risk_flags: riskResult.failedChecks, cached: false });
// pass=true 시 → riskResult.failedChecks = [] (빈 배열)
```

캐시 저장 시 `risk_flags` 포함:
```typescript
await redis.set(cacheKey, JSON.stringify({
  ...result,
  modelVersion: MODEL_VERSION,
  confidence,
  risk_flags: riskResult.failedChecks,  // 추가
}), { ex: CACHE_TTL_SEC });
```

캐시 반환 시 (기존 캐시에 risk_flags 없는 경우):
```typescript
enqueue("result", {
  ...
  risk_flags: parsed.risk_flags ?? [],  // undefined → 빈 배열 fallback
  cached: true,
});
```

---

## 2-A. 변경 사양

### 변경 개요

| 항목 | 변경 전 | 변경 후 |
|------|--------|--------|
| harvest 차단 동작 | score=50, label="리스크차단" | score=원본값, label=원본값 |
| risk_flags 저장 | 없음 | `Prediction.risk_flags?: string[]` |
| /api/score Risk Gate | 미적용 | 적용 (risk_flags 포함) |
| 프론트엔드 배지 | 없음 | ⚠ 플래그명 배지 표시 |

### 파일별 변경 상세

#### (1) `lib/predictions.ts` — 타입 확장

```typescript
// 변경 전
export type Prediction = {
  ...
  scoreVersion?: string;
};

// 변경 후
export type Prediction = {
  ...
  scoreVersion?: string;
  risk_flags?: string[];   // ← 추가 (optional, backwards-compatible)
};
```

`savePrediction` 함수 시그니처 — 변경 없음 (타입 확장만).

---

#### (2) `app/api/cron/harvest/route.ts` — 핵심 수정

```typescript
// ── 변경 전 (lines 95~120) ──
// 게이트 실패 시 점수 50(중립), 레이블 "리스크차단"으로 억제
const finalScore = riskResult.pass ? result.score : 50;
const finalLabel = riskResult.pass ? result.label : "리스크차단";

if (!riskResult.pass) {
  console.log(`[harvest] ${market}/${ticker} 리스크차단: ${riskResult.failedChecks.join(", ")}`);
}

await savePrediction({
  market, ticker, name,
  date: today(),
  score: finalScore,
  label: finalLabel,
  signals: result.signals.map(...),
  priceAtPrediction: result.price,
  outcome5d: "pending",
  outcome14d: "pending",
  scoreVersion: "v3.1",
});

// ── 변경 후 ──
// 게이트 실패 시 점수 유지, risk_flags 배지로 기록 (페널티 모드)
if (!riskResult.pass) {
  console.log(`[harvest] ${market}/${ticker} 리스크 페널티: ${riskResult.failedChecks.join(", ")}`);
}

await savePrediction({
  market, ticker, name,
  date: today(),
  score: result.score,               // ← 원본 유지 (50 강제 제거)
  label: result.label,               // ← 원본 유지 ("리스크차단" 제거)
  signals: result.signals.map(...),
  priceAtPrediction: result.price,
  outcome5d: "pending",
  outcome14d: "pending",
  scoreVersion: "v3.1",
  risk_flags: riskResult.failedChecks.length > 0   // ← 추가
    ? riskResult.failedChecks
    : undefined,
});
```

`harvestOne` 반환값도 `finalScore/finalLabel` 변수 제거:
```typescript
return {
  ticker,
  score: result.score,           // 원본 score
  label: result.label,           // 원본 label
  riskBlocked: !riskResult.pass, // ← 유지 (로깅용)
  failedChecks: riskResult.failedChecks,
  ok: true,
};
```

---

#### (3) `app/api/score/[market]/[ticker]/route.ts` — Risk Gate 적용

`evaluateSignals()` 완료 후 Risk Gate 실행 추가:

```typescript
// import 추가
import { runRiskGate } from "@/lib/signals/riskgate";
import { loadRiskGateData } from "@/app/api/cron/harvest/route";  // 함수 export 필요
// 또는 동일 로직을 별도 lib/riskgate-loader.ts 로 추출
```

> **주의**: `loadRiskGateData` 를 harvest route에서 export하거나 `lib/` 로 추출해야 함.  
> 권장: `lib/signals/riskgate-loader.ts` 로 추출 (harvest + score 양쪽에서 import).

```typescript
// evaluateSignals 완료 후
const result = await evaluateSignals(market, ticker, (signal) => {
  collectedSignals.push(signal);
  enqueue("signal", signal);
});

// Risk Gate 추가 (loadRiskGateData는 lib/signals/riskgate-loader.ts에서 import)
const riskData = await loadRiskGateData(market);
const riskResult = runRiskGate({
  evaluatedAt: result.evaluatedAt,
  signals: result.signals,
  recentVolume: result.recentVolume,
  avgVolume30d: result.avgVolume30d,
  recentRegimes: riskData.recentRegimes,
  wfResult: riskData.wfResult,
  verifiedPredictionCount: riskData.verifiedCount,
});

// 캐시 저장에 risk_flags 추가
await redis.set(cacheKey, JSON.stringify({
  ...result,
  modelVersion: MODEL_VERSION,
  confidence,
  risk_flags: riskResult.failedChecks.length > 0 ? riskResult.failedChecks : undefined,
}), { ex: CACHE_TTL_SEC });

// result SSE에 risk_flags 추가
enqueue("result", {
  ...
  risk_flags: riskResult.failedChecks.length > 0 ? riskResult.failedChecks : undefined,
  cached: false,
});
```

캐시 반환 경로도 risk_flags 포함:
```typescript
enqueue("result", {
  ...
  risk_flags: parsed.risk_flags ?? undefined,
  cached: true,
});
```

---

#### (4) `app/score/[market]/[ticker]/page.tsx` — 배지 표시

`ResultMeta` 타입 확장:
```typescript
type ResultMeta = {
  // ... 기존 필드
  cached: boolean;
  risk_flags?: string[];  // ← 추가
};
```

신뢰도 바 영역(line 764~783)에 배지 추가:
```tsx
{/* 신뢰도 바 */}
{result && (
  <div className="px-5 py-3 bg-gray-900 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
    <div className="flex items-center gap-3">
      <span>
        신뢰도 <span className="text-gray-200 font-bold">{result.confidence}%</span>
      </span>
      <span>
        실시간 <span className="text-gray-200 font-bold">{result.liveCount}/{result.totalCount}</span>
      </span>
    </div>
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {result.cached && <span className="text-gray-400">캐시됨</span>}
      {/* risk_flags 배지 — 추가 */}
      {result.risk_flags?.map((flag) => (
        <span
          key={flag}
          className="text-[10px] px-1.5 py-0.5 bg-orange-950 border border-orange-900 text-orange-400 rounded font-semibold"
        >
          ⚠ {flag}
        </span>
      ))}
      <span className={`text-xs px-2 py-0.5 rounded-md border font-semibold ${scoreToBg(result.score)}`}>
        {result.label}
      </span>
    </div>
  </div>
)}
```

---

#### (5) `lib/signals/riskgate-loader.ts` — 신규 추출 (harvest 공용 함수)

```typescript
// lib/signals/riskgate-loader.ts
// harvest와 /api/score 양쪽에서 사용할 공용 데이터 로더

import { getHistoricalRegime, type Regime } from "@/lib/signals/regime";
import { getWalkforwardResult, type WalkforwardResult } from "@/lib/signals/walkforward";
import { getAllPredictions, type Market as PredMarket } from "@/lib/predictions";

export type MarketRiskData = {
  recentRegimes: Regime[];
  wfResult: WalkforwardResult | null;
  verifiedCount: number;
};

export async function loadRiskGateData(market: PredMarket): Promise<MarketRiskData> {
  const now = new Date();
  const dates = [2, 1, 0].map((n) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  });

  const [regimeResults, wfResult, allPreds] = await Promise.all([
    Promise.all(dates.map((d) => getHistoricalRegime(market, d))),
    getWalkforwardResult(market),
    getAllPredictions(market),
  ]);

  const recentRegimes = regimeResults.filter((r): r is Regime => r !== null);
  const verifiedCount = allPreds.filter(
    (p) => p.outcome14d === "correct" || p.outcome14d === "wrong"
  ).length;

  return { recentRegimes, wfResult, verifiedCount };
}
```

> harvest/route.ts 에서는 기존 `loadRiskGateData` 함수를 삭제하고 이 파일에서 import.

---

## 2-B. 마이그레이션 전략

### Redis 데이터 변경

| 키 | 변경 | 처리 |
|----|------|------|
| `prediction:{market}:{ticker}:{date}` | `risk_flags` 필드 추가 (optional) | 신규 harvest 실행 시 자동 포함. 기존 키 터치 불필요. |
| `score:v3:{market}:{ticker}` | `risk_flags` 필드 추가 | TTL 600초 → 10분 내 자연 마이그레이션 |
| `weights:{market}:{regime}` | 무변경 | - |
| `kis:*` (Stage 1) | 무변경 | - |

### 배포 순서

```
1. lib/signals/riskgate-loader.ts 생성
2. lib/predictions.ts 타입 확장
3. app/api/cron/harvest/route.ts 수정 (핵심)
4. app/api/score/.../route.ts 수정 (Risk Gate 추가)
5. app/score/.../page.tsx 수정 (배지 표시)
6. 배포
7. harvest cron 다음 실행 확인 (KST 10:00 = UTC 01:00)
```

### 롤백 계획

- 배포 후 이상 감지 시: `harvest/route.ts` 의 `score: result.score` → `score: riskResult.pass ? result.score : 50` 로 원복
- Prediction 데이터: risk_flags=undefined인 기존 데이터는 자동 복원 (optional 필드이므로 롤백 시 무시됨)

---

## 2-C. 관리자/디버그 표시

`harvestOne` 반환값에 `riskBlocked` 이미 존재 → harvest API 응답에 포함:

```typescript
// harvest GET 응답 (기존 구조 유지, 필드명만 명확화)
{
  "ticker": "005930",
  "score": 67,          // 원본 score (변경 후)
  "label": "긍정",      // 원본 label (변경 후)
  "riskBlocked": false, // Risk Gate 실패 여부
  "failedChecks": [],   // 실패한 체크 목록
  "ok": true
}
```

Vercel Function 로그에 출력 (이미 구현됨):
```
[harvest] korea/005930 리스크 페널티: 샘플부족, 레짐전환
```

별도 `/admin` 페이지 구현은 이번 Stage 2에서 제외. Vercel 로그로 충분.

---

## 2-D. 프론트엔드 디자인

### risk_flags 배지 디자인 결정

- **위치**: 히어로 카드 하단 "신뢰도 바" 영역 (confidence/liveCount 오른쪽)
- **스타일**: 오렌지 계열 (`orange-950/900/400`) — 위험을 나타내지만 에러(red)는 아님
- **표시 조건**: `result.risk_flags?.length > 0` (undefined 또는 빈 배열 → 표시 없음)
- **텍스트**: ⚠ + 한국어 플래그명 (`"샘플부족"`, `"레짐전환"` 등)

기존 `scoreColor` / `scoreToBg` 함수 — 변경 없음. risk_flags는 별도 오렌지 고정 스타일.

### Dashboard/StockRow — 이번 단계 제외

- `StockData` 타입에 `risk_flags` 미추가
- `/api/kospi` route에 `risk_flags` 미추가
- 이유: 대시보드는 "스캐닝" UI → 플래그 배지가 많아지면 시각 복잡도 급증
- Phase 2에서 별도 아이콘(⚠ 작은 표시) 방식으로 검토

---

## 2-E. 테스트 시나리오

| ID | 시나리오 | 입력 | 기대 결과 | 검증 방법 |
|----|---------|------|----------|---------|
| T1 | **페널티 모드 기본** | harvest → verifiedCount=0 (샘플부족) | score=원본값, label=원본값, risk_flags=["샘플부족"] | Redis에서 Prediction 확인 |
| T2 | **Risk Gate 전체 통과** | harvest → 모든 체크 pass | score=원본값, risk_flags=undefined | Prediction에 risk_flags 없음 |
| T3 | **다중 체크 실패** | harvest → 거래량붕괴 + 레짐전환 | risk_flags=["거래량붕괴","레짐전환"] | 로그 + Redis |
| T4 | **자가 치유 시뮬레이션** | T1 후 14일 경과 → verify 실행 | outcome14d="correct"\|"wrong" (NOT neutral) | verify API 직접 호출 |
| T5 | **/api/score risk_flags 포함** | GET /api/score/korea/005930 | result SSE에 `risk_flags` 필드 존재 | curl 출력 확인 |
| T6 | **캐시 히트 시 risk_flags** | 두 번째 요청 (캐시 상태) | `risk_flags` 포함 + `cached: true` | curl 반복 호출 |
| T7 | **프론트 배지 표시** | risk_flags=["샘플부족"] | ⚠ 샘플부족 오렌지 배지 표시 | 브라우저 확인 |
| T8 | **risk_flags=[] 시 배지 없음** | risk_flags=[] | 배지 미표시 | 브라우저 확인 |

---

## 2-F. 환경변수 영향

**없음.**

이번 변경은 코드 로직 변경만이며 새 환경변수 추가 없음.  
기존: `CRON_SECRET`, `UPSTASH_REDIS_*`, `KIS_*` (Stage 1) — 무변경.

---

## 2-G. PR 체크리스트

```
## Risk Gate 페널티 모드 전환

### 변경 파일
- [ ] lib/signals/riskgate-loader.ts (신규) — 공용 데이터 로더 추출
- [ ] lib/predictions.ts — Prediction 타입에 risk_flags?: string[] 추가
- [ ] app/api/cron/harvest/route.ts — 차단→페널티 모드 전환 (핵심)
- [ ] app/api/score/[market]/[ticker]/route.ts — Risk Gate 적용 + risk_flags SSE
- [ ] app/score/[market]/[ticker]/page.tsx — risk_flags 배지 표시

### 기능 검증
- [ ] T1: 페널티 모드 — verifiedCount=0 시 원본 score 저장 확인
- [ ] T2: 통과 시 risk_flags=undefined 확인
- [ ] T3: 다중 체크 실패 시 risk_flags 배열 확인
- [ ] T4: verify → outcome14d="correct"|"wrong" (NOT neutral) 확인
- [ ] T5: /api/score SSE result 이벤트에 risk_flags 포함 확인
- [ ] T6: 캐시 히트 시 risk_flags 포함 확인
- [ ] T7~T8: 프론트 배지 정상 표시/미표시 확인

### 회귀 검증
- [ ] 기존 Prediction Redis 데이터 읽기 정상 (risk_flags=undefined)
- [ ] evolve cron — 기존 verified 예측 학습 정상 동작
- [ ] verify cron — 기존 pending 예측 판정 정상 동작
- [ ] Dashboard StockRow — score 표시 무변경 확인

### 배포 후 모니터링 (4주)
- [ ] Week 1: harvest 로그에서 riskBlocked 비율 확인
- [ ] Week 2: verifiedCount (korea/us/crypto) 증가 추세 확인
- [ ] Week 4: 40~59 neutral 비율 재측정 → 옵션 B 필요성 판단
```

---

## 설계 요약

| 항목 | 결정 |
|------|------|
| judgeOutcome 변경 | ❌ 유지 (옵션 A). 4주 후 재검토. |
| /api/score Risk Gate | ✅ 적용 (옵션 A). 응답 시간 영향 <0.3%. |
| 캐시 키 버전 | ✅ `score:v3:` 유지. 자연 마이그레이션 10분. |
| Dashboard 배지 | ❌ Phase 1 제외. |
| 환경변수 | ❌ 추가 없음. |
| 신규 파일 | ✅ `lib/signals/riskgate-loader.ts` (공용 추출) |
| 수정 파일 | 4개 |

---

*설계 작성: Claude Sonnet 4.6 | 설계 기준일: 2026-04-15*
