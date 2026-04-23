# RFC — Unify Signal Function Return Type

**Status**: Draft  
**Authors**: Phase A P2 spillover (2026-04-24)  
**Blocks**: full refactor of `lib/signals/{crypto,korea,us}.ts`

---

## Motivation

진단 문서 P2 항목 원안은 다음 구조를 모든 시그널 계산 함수에 적용하려 했다:

```ts
type SignalOutput = {
  value: number | null;
  confidence: "high" | "med" | "low";
  reason: string; // 예: "insufficient_data"
};
```

Phase A 재진단 결과 이 구조는 C13 한 함수만 바꿔서는 의미가 없고, **25개 이상의 signal 계산 함수 시그너처 + SignalScore 타입 + flowScore 집계 + 모든 호출 사이트 + Redis 캐시 포맷을 동시에 고쳐야** 한다. Phase A 한 커밋으로 안전하게 수행하기 어렵다.

Phase A P2에서는 **C13 한 함수의 NaN/Infinity/음수 입력 방어**만 적용했다 (`c13LiquidationSpike`). 이 RFC는 **전체 시그너처 통일을 별도 작업으로 기획**한다.

## 현재 상태

| 구간 | 형태 |
|---|---|
| 개별 signal 함수 (`c1…c13`, `k1…k12`, `us…`) | `(…params) => number` (0~100 직반환) |
| 집계 표현 | `SignalScore = { id, name, score: number, weight, live }` |
| flowScore | `(scores: SignalScore[]) => { score, label }` — live=false 제외 가중합 |
| 데이터 부족 처리 | 호출 사이트에서 `live: false` 또는 함수 내부에서 50 fallback |

## 제안 구조

```ts
type Confidence = "high" | "med" | "low";

type SignalOutput = {
  value: number | null;    // null = 산출 불가
  confidence: Confidence;
  reason?: string;         // low 일 때 사람이 읽는 근거
};

type SignalScore = {
  id: string;
  name: string;
  value: number | null;
  confidence: Confidence;
  reason?: string;
  weight: number;
  live: boolean;            // 유지 — null 이어도 live 가능 (관측 문제 vs 데이터 부재)
};
```

## 도입 시 영향 범위

1. `lib/signals/crypto.ts` — 13개 함수 + `computeCryptoSignals` 집계
2. `lib/signals/korea.ts` — 12개 함수 + `computeKoreaSignals`
3. `lib/signals/us.ts` — us 함수 집합
4. `lib/signals/crypto.ts` 내 `flowScore` — null 가중치 제외 로직
5. `lib/signals/index.ts` — 3개 evaluate\* 함수의 SignalScore 매핑
6. `app/api/score/[market]/[ticker]/route.ts` — SSE signal 이벤트 페이로드
7. `app/api/cron/harvest/route.ts` — savePrediction signals 필드
8. `lib/predictions.ts` — Prediction.signals 스키마 확장
9. `app/score/[market]/[ticker]/page.tsx` — UI 렌더 (null/low일 때 표시 규칙)
10. Redis 캐시 하위호환 — 구 score(number) 키와 신 value(number|null) 혼재 기간

## 마이그레이션 단계 (초안)

1. `SignalOutput`, 확장 `SignalScore` 타입 추가 (하위호환 위해 `score: number` 유지, `value` optional 도입)
2. 신규 시그널부터 새 구조 사용, 기존 시그널은 어댑터로 매핑 (`value = score`, `confidence` 기본값 "med", `reason` 없음)
3. 개별 함수 단위 리팩토링 — 커밋 당 max 3개 시그널
4. flowScore를 `value === null` 시그널 제외하도록 수정
5. UI/Prediction/Redis 이주 완료 후 기존 `score: number` 필드 제거

## 테스트 전략

- 각 시그널의 "정상 / 결측 / 엣지" 3종 유닛 테스트
- flowScore가 null 시그널을 weight에서 제외하는지 속성 테스트
- Prediction 역직렬화 시 구 스키마(없는 `value`)에서도 동작하는지 호환성 테스트

## Open Questions

1. `null`과 `value: 50` + `confidence: "low"`의 차이를 코드 레벨에서 강제할 것인가? (둘 다 "정보 없음" 의미지만 flowScore 영향 다름)
2. `reason` 키에 표준 enum을 둘 것인가 (`insufficient_data`, `api_error`, `stale_cache`), 아니면 자유 문자열?
3. 단일 시그널이 `live: true` + `value: null`인 경우 — Risk Gate에서 어떻게 처리할 것인가?

---

*Phase A P2에서는 위 구조를 도입하지 않음. C13 함수만 NaN/Infinity/음수 방어 가드 추가.*  
*이 RFC가 승인되면 후속 이슈 `signal-signature-refactor` 로 등록해 커밋 단위로 진행.*
