# Phase A 완료 보고

**Date**: 2026-04-24  
**Branch**: `master`  
**Base**: `bab5da8` (Stage 2 복구 후)  
**HEAD**: `5686d99`

---

## 커밋 목록

| 단계 | Hash | 메시지 |
|---|---|---|
| ADR | `44d71f6` | docs(adr-005): record actual scope of Stage 2 commit |
| setup | `0e382bc` | chore: add vitest for unit tests |
| **P0** | `5ad4b8d` | fix(p0): split confidence into score(number) + label(high\|med\|low) |
| **P1** | `c814cdc` | feat(p1): add daysOperational to risk_flags logging for analysis |
| **P2** | `3aeb389` | fix(p2): add NaN/null guard to C13; spin off full refactor as RFC |
| **P3** | `5686d99` | refactor(p3): unify return calculation via shared calcReturnNd util |

---

## 변경 파일 요약

### P0 — confidence 두 필드 분리
| 파일 | 변경 |
|---|---|
| `lib/signals/types.ts` | **신규** — `ConfidenceLabel`, `confidenceScoreToLabel()` |
| `lib/signals/types.test.ts` | **신규** — 10 cases (경계값/NaN/Infinity) |
| `lib/signals/index.ts` | `EvalResult.confidence`/`confidence_reason` → `coverageLabel`/`coverageReason` rename |
| `app/api/score/[market]/[ticker]/route.ts` | `confidenceScore` + `confidenceLabel` 두 필드 주입, JSON.stringify 덮어쓰기 버그 해결, 캐시 히트 폴백 |
| `lib/predictions.ts` | `Prediction.confidenceScore?`, `Prediction.confidenceLabel?` 추가 |
| `app/score/[market]/[ticker]/page.tsx` | `confidence: number` → `confidenceScore: number`, UI 렌더 업데이트 |

### P1 — daysOperational 추가
| 파일 | 변경 |
|---|---|
| `lib/signals/riskgate-loader.ts` | `MarketRiskData.daysOperational` 필수 필드 추가, `allPreds` 최소 날짜로 계산 |
| `lib/predictions.ts` | `Prediction.daysOperational?` 추가 |
| `app/api/score/[market]/[ticker]/route.ts` | savePrediction에 `daysOperational` 전달 |
| `app/api/cron/harvest/route.ts` | 페널티 로그에 `daysOperational` 병기, savePrediction에 전달, fallback 객체 보강 |

### P2 — C13 가드 + RFC
| 파일 | 변경 |
|---|---|
| `lib/signals/crypto.ts` | `c13LiquidationSpike` 에 NaN/Infinity/음수 가드 추가 |
| `lib/signals/c13.test.ts` | **신규** — 11 cases (정상/결측/음수/0) |
| `docs/rfc/signal-function-signature.md` | **신규** — 전체 signal 함수 `{value,confidence,reason}` 구조 개편 RFC 초안 |

### P3 — 공통 수익률 유틸
| 파일 | 변경 |
|---|---|
| `lib/signals/returns.ts` | **신규** — `calcReturnNd(prices, n): ReturnResult` (forward-fill + confidence) |
| `lib/signals/returns.test.ts` | **신규** — 12 cases (정상/1일·4일·5일 결측/n=0/start=0/음수/regression) |
| `lib/signals/compute.ts` | `returnPct` → `calcReturnNd(...).value` 위임 (동등성 보장) |
| `docs/refactor-p3-diff.md` | **신규** — 수식 동등성 증명 + 교체 범위 제한 사유 문서화 |

### 부속
| 파일 | 변경 |
|---|---|
| `docs/decisions/005-stage2-scope.md` | **신규** — Stage 2 실제 범위 기록 (confidence 통일 미구현 사실) |
| `package.json` + `pnpm-lock.yaml` | vitest dev dep + `test` / `test:watch` 스크립트 |
| `vitest.config.ts` | **신규** — `@/*` alias + `lib/**/*.test.ts` include |

---

## 검증 결과

| 항목 | 결과 |
|---|---|
| `pnpm tsc --noEmit` | **OK** (0 errors) |
| `pnpm build` | **OK** (Compiled successfully, 모든 라우트 정상) |
| `pnpm test` | **OK** (33 passed / 33 total, 3 test files) |
| `git log bab5da8..HEAD` | 6 commits (ADR + setup + P0~P3) |

### 유닛 테스트 상세 (추가된 총 33건)

- `lib/signals/types.test.ts` — 10건
- `lib/signals/c13.test.ts` — 11건
- `lib/signals/returns.test.ts` — 12건

### harvest 로컬 curl

로컬 dev 서버 기동 + Redis `CRON_SECRET` 인증이 필요해 **본 보고서 작성 시점에는 미실행**. 프로덕션 배포 전 검증 체크리스트에 포함 필요.

---

## 발견된 추가 이슈 (진단 문서에 없던 항목)

1. **Stage 2 커밋 메시지 과장**  
   `89613f3` 커밋 제목에 "confidence type unification"이 포함됐으나 실제 변경은 `risk_flags` 추가뿐이었다. Phase A P0 가 실제 구현을 대체. → `docs/decisions/005-stage2-scope.md` 로 기록.

2. **Next.js 16.2.2 확인**  
   `AGENTS.md`가 경고한 "NOT the Next.js you know"의 실체는 Turbopack default, async `params`, `middleware` → `proxy` rename, PPR 재설계 등. 이번 P0~P3 변경 대상 (`lib/signals/*`, `lib/predictions.ts`, route handlers)은 async `params` 가 이미 반영되어 있어 추가 영향 없음.

3. **P3 리팩토링 범위 실측 결과**  
   지시서는 K12/C11/C12 세 지표의 "계산 방식 통일"을 요구했으나 코드 분석 결과 C11(RSI/MACD)과 C12(Volume Z)는 returns 를 사용하지 않음. K12 sectorRet20d 는 index.ts:260 에서 `0` 하드코딩 — 데이터 공급 파이프라인 자체가 없어 "재구현" 대상 부재. 실효 변경은 `returnPct` 위임 (stockRet20d / ret7d / ret30d 경로) 에 한정. → `docs/refactor-p3-diff.md` 에서 근거 제시.

4. **테스트 인프라 부재**  
   프로젝트에 테스트 러너가 없었음. Vitest 4.1.5 도입 (`pnpm add -D vitest`, `vitest.config.ts`). tsconfig path alias (`@/*`) 는 Vitest가 자동 인식하지 않아 `resolve.alias` 수동 매핑 필요.

---

## 미해결 / 추가 판단 필요

### 1. K12 sectorRet20d 실제 데이터 공급

**현 상태**: `index.ts:260`에서 `sectorRet20d: 0` 하드코딩. K12 가 절대 수익률(종목 단독) 부호 판단으로 축소됨.

**권고**: 후속 이슈로 등록.
- KOSPI 섹터별 지수 (KRX 섹터 ETF 또는 FnGuide 섹터 가격)의 closes 배열을 fetcher 에 추가
- `calcReturnNd(sectorCloses, 20).value` 로 `sectorRet20d` 공급
- `calcReturnNd` 의 `confidence !== "high"` 일 때 K12 `live: false` 전환 검토

### 2. Signal function signature RFC 추진 여부

**RFC**: `docs/rfc/signal-function-signature.md`  
지시서 P2의 원안 (`{value, confidence, reason}` 구조) 은 25+개 함수 + SignalScore + flowScore + Redis + UI 동시 변경이 필요. 최소 가드만 적용하고 RFC 로 분리.

**판단 포인트**:
- 승인 후 후속 브랜치로 단계별 마이그레이션
- 승인 없으면 C13 외 지표는 현재 `number` 반환 유지

### 3. Redis 캐시 TTL 전환 기간

P0 로 캐시 스키마가 `confidence: number` → `confidenceScore: number` + `confidenceLabel: string` 으로 변경됐다. `CACHE_TTL_SEC = 60 * 10` (10분) 이라 배포 직후 10분간 구 키 `parsed.confidence` 도 폴백 경로로 지원 (route.ts:91-95 참조). **이 폴백은 1개월 후 제거 권장** — `grep -R "parsed.confidence\b"` 로 찾아 삭제.

### 4. Harvest의 confidence 통일 (선택)

`app/api/cron/harvest/route.ts` 의 `savePrediction` 은 현재 `confidenceScore`/`confidenceLabel` 을 전달하지 않는다 (score route 만 전달). harvest 도 공통화하려면 `calcConfidence` 를 공용 파일로 추출 후 import. **현재 Prediction 분석 경로가 주로 `/score` 라 당장 지장 없음**. RFC 신호 구조 개편 시 함께 정리.

### 5. Risk Gate #6 warmup 로직

**결정 사항 (지시서 옵션 B)**: penalty 모드가 상위 해법이라 warmup 스킵. `daysOperational` 필드만 분석용 추가. 단, 본 결정이 향후 재논의될 가능성 있음:
- verifiedCount < 5 인 초기 30일 구간의 prediction 은 `risk_flags: ["샘플부족"]` 플래그가 모든 ticker 에 찍혀 noise 유발.
- 플래그 전파를 억제하려면 `daysOperational < N` 조건으로 `failedChecks` 에서 "샘플부족" 을 숨기는 로직을 추가할 수 있음 (여전히 게이팅 X, 단순 표시 억제).

---

## 중단 조건 체크

| 조건 | 발생 여부 |
|---|---|
| 진단 문서와 현재 코드 불일치 | 발생 (ef25638 → bab5da8 drift) → 사용자 승인으로 옵션 1 (재진단) 선택, 정상 진행 |
| P3 수치 변화 10% 이상 | **미발생** — 수식 동등성 입증 |
| 빌드 실패 2회 연속 | **미발생** — 모든 커밋 전 빌드 OK |
| Dashboard 코드 수정 필요 | **미발생** — `app/dashboard/*` 에 confidence 참조 없음 |
| Vercel Hobby cron 2개 제한 | 본 Phase A 범위 외 (진단 문서 Scenario A) |

---

## 다음 세션 시작 시 확인

1. 프로덕션 배포 후 `/api/score/crypto/bitcoin` curl → `confidenceScore` + `confidenceLabel` 두 필드 모두 수신되는지 확인
2. Redis 의 prediction 레코드에 `confidenceScore`, `confidenceLabel`, `daysOperational` 세 필드가 기록되는지 샘플 확인
3. harvest cron 호출 시 로그에 `daysOperational=N` 이 함께 찍히는지 (현재 Hobby plan cron 제한 문제 별도 — 진단 문서 Scenario A)
4. RFC `signal-function-signature.md` 승인 여부 결정
