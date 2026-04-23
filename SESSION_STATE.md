# SESSION_STATE.md — FlowSignal

> 세션 인계 문서. 작업 시작 전 반드시 읽고, 미검증 가정 먼저 검증할 것.
> 마지막 업데이트: 2026-04-24

---

## 마지막 커밋

```
브랜치: master
HEAD:   5686d99  refactor(p3): unify return calculation via shared calcReturnNd util
```

## Phase A (2026-04-24) 완료

- 완료 보고서: `docs/phase-a-completion-2026-04-24.md`
- 커밋: `44d71f6` (ADR-005) → `0e382bc` (vitest) → `5ad4b8d` (P0) → `c814cdc` (P1) → `3aeb389` (P2) → `5686d99` (P3)
- 검증: `pnpm tsc --noEmit` 0 errors / `pnpm build` OK / `pnpm test` 33 passed
- Dashboard 코드 무변경 (지시서 절대 원칙 1 준수)
- **다음 세션 첫 확인 항목**: 프로덕션 배포 후 `/api/score/crypto/bitcoin` 에서 `confidenceScore` + `confidenceLabel` 두 필드 수신 확인

### P 판정 요약

| P | 결과 | 비고 |
|---|---|---|
| P0 | ✅ confidence 두 필드 분리 완료 | Stage 2 커밋 메시지 주장 실체화 |
| P1 | ✅ daysOperational 분석용 추가 | penalty 모드가 warmup 대체 (옵션 B 채택) |
| P2 | ✅ C13 NaN/음수 가드 | 전체 signal 구조 개편은 RFC 로 분리 |
| P3 | ✅ `calcReturnNd` 유틸 + `returnPct` 위임 | 값 변화 0, 롤백 없음 |

## 이전 세션 (보존)

---

## 실제 확인된 사실 ✅ (증거 있음)

### 코드 레벨
- `riskBlocked` 문자열: 소스 코드 0건 (grep 확인). docs 폴더 문서에만 존재
- `risk_flags?: string[]`: `lib/predictions.ts` Prediction 타입에 추가됨 (옵셔널, backwards-compat)
- `loadRiskGateData()`: `lib/signals/riskgate-loader.ts`로 분리됨 (harvest + score 양쪽 import 확인)
- harvest 페널티 모드: `score=50 강제` 로직 제거됨. `riskFlags = failedChecks.length > 0 ? failedChecks : undefined` 패턴
- `/api/score` SSE: Risk Gate 적용됨. `risk_flags: riskFlags` result 이벤트에 포함
- 프론트엔드 오렌지 배지: `result.risk_flags?.map(...)` 렌더링 코드 존재
- TypeScript: `npx tsc --noEmit` 에러 없음 (컴파일 통과)
- 브랜치 push: `origin/stage-2-riskgate-penalty` 원격 존재 확인

### 인프라
- Vercel 배포 URL: https://flow-signal-v2.vercel.app/ (라이브, Stage 2 머지 전 상태)
- Upstash Redis: 연결됨 (기존 예측 데이터 존재)
- Vercel Hobby cron 2개 사용 중 (harvest, verify — 한도 2개)

---

## 미검증 가정 ⚠️ (코드만 확인, 실제 실행 미확인)

| # | 가정 | 검증 방법 |
|---|------|---------|
| A1 | 페널티 모드 전환 후 harvest가 실제로 `risk_flags` 포함한 예측을 Redis에 저장하는지 | Stage 2 머지 후 KST 10:00 harvest 실행 → Vercel 로그 `[harvest] 리스크 페널티` 라인 확인 |
| A2 | `/api/score` SSE result 이벤트에 실제로 `risk_flags` 필드가 내려오는지 | `curl https://flow-signal-v2.vercel.app/api/score/crypto/BTC` 실행 후 data 파싱 |
| A3 | 기존 Redis 예측 데이터(차단 모드 시절 `score=50`)가 verify/evolve에 미치는 영향 | Day 5 verifiedCount 변화 추적 |
| A4 | verifiedCount가 실제로 0인지, 아니면 이미 일부 누적되어 있는지 | `redis-cli GET wf:result:crypto` 또는 loadRiskGateData 반환값 로그 확인 |
| A5 | 프론트엔드 오렌지 배지가 실제 브라우저에서 렌더링되는지 | 배포 후 risk_flags 있는 종목 상세 페이지 접속하여 육안 확인 |
| A6 | `riskgate-loader.ts`의 `loadRiskGateData()`가 score route에서 SSE 스트리밍 지연 없이 동작하는지 | 실제 `/api/score` 호출 시 latency 측정 (Redis 3개 병렬 조회 추가됨) |

---

## 현재 PR 상태

- **PR 미생성**: `gh` CLI 미설치
- **생성 방법**:
  - 브라우저: https://github.com/dudurim88255-dev/flow-signal/pull/new/stage-2-riskgate-penalty
  - 또는: `winget install --id GitHub.cli -e` → `gh auth login` → Claude Code에서 자동 생성
- **PR 제목**: `feat(risk-gate): 차단 모드 → 페널티 모드 전환 (Chicken-Egg 데드락 해소)`
- **base**: `main` ← **compare**: `stage-2-riskgate-penalty`

---

## 다음 세션 시작 시 먼저 확인할 것

### 즉시 (5분)
1. PR이 생성/머지됐는지 확인 → 안 됐으면 먼저 생성
2. 머지 됐으면 Vercel 배포 상태 확인

### 머지 후 Day 1 (KST 10:00 이후)
3. Vercel 로그에서 harvest 실행 결과 확인
   - `[harvest] 완료 — N/30 성공 (리스크 페널티: M개)` 출력 여부
   - `M`이 0이면: 모든 종목 Risk Gate 통과 (정상) 또는 미검증 가정 A4 확인 필요
4. `curl https://flow-signal-v2.vercel.app/api/score/crypto/BTC` 실행 → `risk_flags` 필드 확인

### 4주 모니터링 체크리스트
- [ ] Day 5: verifiedCount ≥ 1 (자가 치유 시작)
- [ ] Day 14: neutral 비율 < 30% 확인
- [ ] Day 28: judgeOutcome Option B 전환 여부 결정

---

## 대기 중인 작업 (우선순위 순)

| 순위 | 작업 | 상태 | 비고 |
|------|------|------|------|
| 1 | Stage 2 PR 생성 및 머지 | **사용자 액션 필요** | gh CLI 설치 또는 브라우저 |
| 2 | Stage 3: GitHub Actions cron 마이그레이션 | 미착수 | Vercel Hobby cron 2개 한도 해소 |
| 3 | Stage 1 Step 2: KIS 클라이언트 설계 | 미착수 | Stage 3과 병렬 가능 |
| 4 | Stage 1 Step 3: KIS 실데이터 연결 | **사용자 액션 필요** | KIS 앱키/시크릿 발급 blocking |
| 5 | `/score/[market]/[ticker]/page.tsx` 디자인 재작업 | 미착수 | 현재 임시 화면 수준 |

---

## 알려진 기술 부채

- **Vercel Hobby cron 2개 제한**: harvest(01:00 UTC), verify(02:00 UTC) 사용 중. regime(00:30), evolve(03:00 일요일) 미등록 상태. → Stage 3에서 GitHub Actions로 이전 예정
- **judgeOutcome neutral zone**: score 40~59 → neutral (알고리즘적으로 정상이나, 차단 모드 시절 score=50 강제로 인한 neutral 누적이 학습 편향 가능성 있음) → Day 28에 Option B(구간 축소) 전환 여부 결정
- **기존 neutral 예측**: Redis에 `outcome14d="neutral"` 데이터 잔존. evolve 필터로 제외되어 학습에 반영 안 됨 → 신규 예측부터 자가 치유 시작, 기존 데이터는 TTL(365일) 만료까지 잔존
