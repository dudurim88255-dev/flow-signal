# ADR 003 — 신호 평가 엔진 v3

**날짜**: 2026-04  
**상태**: 확정

## 결정

`evaluateSignals(market, ticker, onStep?)` 하나로 3개 시장을 통합 평가한다.  
SSE 스트리밍을 위해 신호별 콜백(`StepCallback`)을 지원한다.

## v2 → v3 변경 이유

`lib/flowscore.ts`의 v2는 closes/volumes만 받아 4개 컴포넌트(모멘텀·기술·거래량·추세)로 단순 채점.  
v3는 시장별 특화 신호(온체인, 펀딩레이트, 외국인수급 등)를 추가하고 가중치를 Redis에서 동적으로 적용.

> `lib/flowscore.ts`는 레거시. `app/stock/` 페이지 일부에서 아직 사용 중.  
> 신규 기능은 `lib/signals/` 계열만 사용할 것.

## 신호 가중치 진화

1. 매일 `cron/harvest` → 예측 저장
2. `cron/verify` → 5일/14일 후 예측 결과 검증
3. `cron/evolve` → 정답률 높은 신호의 가중치 상향, Redis 저장
4. `evaluateSignals()` 호출 시 Redis 가중치 로드 → 점수 재계산

## live 플래그

신호별 `live: true/false` 는 "실제 API 데이터를 쓰는가"를 의미.  
`live: false` 신호는 데이터 미수급(온체인 등)으로 현재 더미값 사용 중.  
점수 계산에는 포함되지만 UI에서 "라이브 N/총 N" 형태로 노출.

## SSE 스트리밍

`onStep` 콜백이 있으면 각 신호 계산 직후 호출.  
`app/api/score/[market]/[ticker]/route.ts`에서 ReadableStream으로 변환해 클라이언트에 전송.
