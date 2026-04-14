# FlowSignal Baseline Schedule — v3.1 Complexity Wedge 측정 일정

> 기준 논문: Didisheim et al. (2023) NBER WP 31689
> 이론 틀: Wedge = u_IS − u_OOS = Overfit + Limits to Learning
> 측정 단위: 5d 주 / 14d 보조, 하이브리드 IS (A primary + B reference)

---

## 체크포인트 마스터 캘린더

| # | 날짜 | 경과일 | 5d n | 5d SE | 상태 | 액션 |
|---|---|---|---|---|---|---|
| 0 | **2026-04-27 (월) 19:00** | 0 | 0 | — | 🔴 baseline 저장 | `baseline-capture.ts` 실행, evolve 재개 |
| 1 | 2026-05-12 (화) | 15 | 3 | 0.71 | 🟡 초기 | `wedge.ts` 1차 실행, 방향성 감지용 |
| 2 | 2026-05-27 (수) | 30 | 6 | 0.50 | 🟡 1차 추정 | wedge 수치 기록, 저신뢰 플래그 |
| 3 | 2026-06-26 (금) | 60 | 12 | 0.35 | 🟢 2차 추정 | 쐐기 ≥0.7 유의미 |
| 4 | **2026-07-21 (화)** | **85** | **17** | **0.30** | 🟢 **실용 신뢰 수준 도달** | 첫 해석 가능 결론 |
| 5 | 2026-08-25 (화) | 120 | 24 | 0.25 | 🟢 4차 | 쐐기 ≥0.5 유의미 |
| 6 | **2026-10-24 (토)** | **180** | **36** | **0.20** | 🟢 **강한 결론** | v3.1→v3.2 공식 승인/롤백 판정 |

**반복 항목**: Google Calendar에 6개 일정 등록 (흥권님이 직접, 또는 Claude에 요청)

---

## 체크포인트 0 — 2026-04-27 (월) 19:00 ⭐

### 사전 준비 (4/27 낮까지)
- [ ] upstash-kv-lime-lamp Redis 상태 확인 (ideal-wahoo-82696은 건드리지 말 것)
- [ ] BTC COIN_TO_BINANCE 맵 정상 동작 확인
- [ ] `/score/crypto/bitcoin`, `/score/korea/005930`, `/score/us/NVDA` 3종 수동 테스트
- [ ] Cron 7일 정상 가동 확인 (harvest/verify/evolve 로그)

### 19:00 실행
```bash
# 1. baseline 저장
pnpm tsx scripts/baseline-capture.ts \
  --tickers bitcoin,005930,NVDA \
  --output docs/baseline-v3.1-2026-04-27-pre.json \
  --mode pre-evolve

# 2. 저장 결과 검증
cat docs/baseline-v3.1-2026-04-27-pre.json | jq '.per_ticker | keys'
# 예상: ["bitcoin", "005930", "NVDA"]

# 3. git 커밋
git add docs/baseline-v3.1-2026-04-27-pre.json
git commit -m "baseline: v3.1 pre-evolve snapshot (BTC/삼성/NVDA)"

# 4. evolve 재개
# (Cron은 매일 03:00 자동. 4/27 밤 03:00에 첫 재개 확인)
```

### 체크리스트
- [ ] JSON의 `complexity_params.c_current` 값이 0.17~0.25 범위
- [ ] `in_sample_metrics.primary.n_obs_5d`가 12 (WF bootstrap 60일 가정)
- [ ] `in_sample_metrics.reference`도 채워져 있음 (하이브리드 검증)
- [ ] `out_of_sample_metrics.*` 전부 `null`
- [ ] `wedge_estimate.*` 전부 `null`
- [ ] git 커밋 완료
- [ ] evolve cron 다음 실행 시간 캘린더에 기록 (4/28 03:00)

---

## 체크포인트 1 — 2026-05-12 (화) 15일차

### 목적
첫 OOS 수치 주입. SE 0.71이라 신뢰도는 낮지만, 파이프라인이 동작하는지 검증.

### 실행
```bash
# wedge 계산 (pre-evolve baseline 갱신)
pnpm tsx -e "
import { computeWedge } from './lib/metrics/wedge';
await computeWedge('docs/baseline-v3.1-2026-04-27-pre.json');
"

# post-evolve baseline도 함께 생성 (evolve 재개 후 2주 경과)
pnpm tsx scripts/baseline-capture.ts \
  --tickers bitcoin,005930,NVDA \
  --output docs/baseline-v3.1-2026-05-12-post.json \
  --mode post-evolve
```

### 체크리스트
- [ ] pre-evolve baseline의 `out_of_sample_metrics.sharpe_5d`에 값 존재
- [ ] pre-evolve baseline의 `wedge_estimate.total_wedge`에 값 존재
- [ ] post-evolve baseline 신규 생성
- [ ] 3종목 모두 신호 수 변화 없음 (c 값 동일)
- [ ] 두 JSON 전부 git 커밋

### 해석 노트 (저신뢰 단계, 신중)
이 시점의 수치는 방향성 참고용. `total_wedge > 2 × SE`여야 유의미. 대부분 노이즈일 것.

---

## 체크포인트 2 — 2026-05-27 (수) 30일차

### 실행
체크포인트 1과 동일, `2026-05-27` 날짜만 교체.

### 체크리스트
- [ ] pre/post baseline 동시 갱신
- [ ] SE ≈ 0.50 기록 확인
- [ ] 처음으로 ΔSharpe_OOS 계산 (post − pre)
- [ ] 1차 해석표 대조 (complexity-wedge-notes.md § 3.7)

### 해석 노트
쐐기가 1.0 이상이면 유의미, 0.5~1.0은 힌트, 0.5 이하는 노이즈.

---

## 체크포인트 3 — 2026-06-26 (금) 60일차

### 목적
두 번째 baseline 생성 60일 경과. SE 0.35로 진입. 쐐기 ≥0.7이면 유의미.

### 체크리스트
- [ ] pre/post baseline 4번째 갱신 (pre는 5월부터 2번째)
- [ ] `in_sample_metrics`의 WF 60일 샘플이 새 데이터로 롤링됨 (주의: IS도 시간에 따라 변함)
- [ ] 14d 지표도 의미 있는 n에 도달 (4~8 관측)
- [ ] 5d vs 14d 괴리 첫 기록 — 과적합 진단 지표
- [ ] `admin/wedge/page.tsx` 그래프에 4점 플롯 (4/27, 5/12, 5/27, 6/26)

### 해석 노트
이 시점에서 ΔSharpe_OOS 방향이 음수면 warning. 3/4 체크포인트에서 지속적으로 음수면 evolve 롤백 고려.

---

## 체크포인트 4 — 2026-07-21 (화) 85일차 🎯

### 목적
**첫 실용 신뢰 수준**. SE 0.30, 쐐기 0.6 이상이면 해석 가능.

### 추가 작업
- [ ] 모든 체크포인트 데이터를 종합한 **중간 리포트** 작성
  - 파일: `docs/wedge-interim-report-2026-07-21.md`
  - 포함: pre/post 5개 시점의 샤프 변화 그래프, 쐐기 추이, 5d vs 14d 괴리, 종목별 비교
- [ ] FlowSignal 공식 블로그/README에 중간 결과 공개 여부 결정
- [ ] v3.3 (Risk Gate 페널티 전환) 설계 시작 가능 — baseline이 있으니 사전/사후 비교 가능해짐

### 해석 노트
이 시점부터 "v3.1의 샤프는 얼마다"를 숫자로 말할 수 있음. 이전까지는 noise zone.

---

## 체크포인트 5 — 2026-08-25 (화) 120일차

### 체크리스트
- [ ] pre/post baseline 갱신
- [ ] SE 0.25 진입
- [ ] 쐐기 ≥0.5 유의미 검정
- [ ] 14d 단독으로도 의미 있는 n (8+ 관측)
- [ ] 5d와 14d가 **서로 다른 결론**을 주면 즉시 알림 (과적합 신호)

---

## 체크포인트 6 — 2026-10-24 (토) 180일차 🏆

### 목적
**강한 결론**. SE 0.20, 쐐기 ≥0.4면 유의미. v3.1 평가 공식 종결.

### 최종 작업
- [ ] **최종 리포트**: `docs/wedge-final-report-2026-10-24.md`
- [ ] evolve 공식 승인/롤백 결정 (§3.7 해석표 기반)
- [ ] v3.2 공식 릴리스 (쐐기 해석 인프라 포함) 또는 v3.1 유지
- [ ] v3.3 설계 공식 착수 (Risk Gate 페널티 전환)
- [ ] FlowSignal 공식 한국어 블로그 포스트 — KOSPI 시장에서 복잡도 이론 검증한 최초 사례 (논문 4.3 참조: Kelly-Xiu는 국제 시장 데이터 부족을 한계로 지적)
- [ ] 이 시점의 JSON 전부 `docs/archive/v3.1-wedge-measurement/` 로 이동

### 해석 노트
mature(180/30/30) WF의 공식 채택도 이 시점(2026년 10월) 예정이었으므로 자연스럽게 맞물림.

---

## 변수 이벤트 대응

### 체크포인트 중간에 evolve가 망가지면
1. Cron 로그 확인 → evolve 어느 단계에서 실패했는지
2. 최근 2일 간 가중치 백업 복원
3. 해당 체크포인트는 **post-evolve baseline 생성 건너뛰기** (pre만 갱신)
4. `docs/baseline-event-log.md`에 사건 기록

### 신호 수가 바뀌면 (예: C14 신호 추가)
1. **새 측정 세션 시작**. 기존 baseline은 동결
2. 새 파일명: `baseline-v3.2-2026-XX-XX-pre.json`
3. 체크포인트 0부터 재시작 (이전 데이터와 혼합 금지 — c 값이 달라지므로 이론적으로 비교 불가)

### 시장 충격으로 수익률 분포 급변 (예: -30% 조정)
1. 해당 체크포인트는 측정하되 `wedge_estimate.note`에 이벤트 기록
2. 해석 시 outlier로 처리, 전후 체크포인트 추세 우선

---

## 작업 원칙

1. **Dashboard 코드는 절대 건드리지 않는다** (2026-04-14 롤백 경험)
2. **`/score/` API만 호출한다** (Server Component 직접 호출 OK)
3. **baseline JSON은 git으로 관리**, Redis 저장 금지
4. **R²는 기록하지 않는다** (Kelly-Malamud-Zhou JoF 2024 원칙)
5. **5d가 주, 14d가 보조**. 괴리는 진단 정보
6. **SE를 항상 JSON에 박아둔다** — 과해석 방지
