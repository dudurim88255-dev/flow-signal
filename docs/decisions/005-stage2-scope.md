# ADR 005 — Stage 2 Actual Scope

**Date**: 2026-04-24  
**Status**: Accepted  
**Authors**: Phase A 재진단 (bab5da8 기준)

## Context

2026-04-16 merge된 커밋 `89613f3 feat: Stage 2 - Risk Gate penalty mode + confidence type unification (#1)`의 제목에는 두 가지 변경이 명시되어 있다:

1. Risk Gate penalty mode (차단 모드 → 페널티 모드 전환)
2. Confidence type unification (confidence 타입 통일)

그러나 2026-04-24 Phase A 재진단 결과, **2번 항목은 실제로 구현되지 않았다**.

## 실측 결과

### 2-A. 실제로 구현된 것 (Risk Gate penalty mode)

- `lib/signals/riskgate-loader.ts` 신설 (31 LOC)
- `lib/predictions.ts`에 `risk_flags?: string[]` 추가
- `app/api/cron/harvest/route.ts`에서 게이트 실패 시 `score=50/"리스크차단"` 덮어쓰기 제거
- `app/api/score/[market]/[ticker]/route.ts`에 Risk Gate 적용
- 데드락(샘플부족 → neutral → verifiedCount 증가 불가) 해소

### 2-B. 실제로 미구현 (Confidence type unification)

커밋 메시지가 주장한 내용과 실제 코드의 gap:

| 위치 | 커밋 메시지 기대 | 실제 상태 |
|---|---|---|
| `lib/signals/index.ts:41` | `"high"\|"med"\|"low"` 통일 | `'high' \| 'medium' \| 'low'` (여전히 `"medium"` 변종) |
| `app/api/score/.../route.ts:113` | 단일 타입 일관 | `calcConfidence(signals)`가 숫자(0~100) 반환 |
| `route.ts:131` | 타입 일관 저장 | `JSON.stringify({ ...result, confidence })` — `result.confidence`(문자열)를 숫자가 덮어씌움 |
| `lib/predictions.ts` | Prediction에 confidence 필드 | 필드 자체 **없음** (risk_flags만 추가됨) |

## Decision

Phase A **P0**에서 confidence 타입을 두 필드(`confidenceScore: number` + `confidenceLabel: "high"\|"med"\|"low"`)로 분리하여 실제 구현을 완료한다.

## Consequences

### Positive
- Stage 2 커밋 메시지와 실제 코드의 불일치가 해소된다.
- Dashboard UI는 숫자(`confidenceScore`)를 그대로 표시할 수 있다.
- Risk Gate 로그와 MEMORY 기록은 문자열 라벨(`confidenceLabel`)을 사용해 사람이 읽을 수 있다.

### Negative
- 커밋 메시지의 신뢰성이 일시적으로 낮아진다 → 이 ADR로 보완.
- Redis 캐시가 새 구조로 바뀌므로 기존 캐시 TTL(10분) 경과까지 혼재 가능. TTL 짧아 영향 미미.

## Lessons

- "unification" 같은 추상어를 커밋 메시지에 쓸 때는 변경된 파일 목록과 구체 diff를 함께 확인해야 한다.
- 멀티 커밋 PR(`89613f3` 같은)에서 각 sub-commit 메시지와 최종 squash 메시지가 다를 경우, **diff 기반 재검증**이 필수.
