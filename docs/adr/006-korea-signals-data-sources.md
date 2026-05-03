# ADR 006 — Korea Market Signals Data Sources

**Status**: Accepted (2026-05-04 흥권 키 등록 완료, Phase 2 부분 진입)
**Date**: 2026-04-25
**Accepted**: 2026-05-04
**Deciders**: 흥권
**Supersedes**: ADR 004 부분 수정 — "한국 주식: Yahoo Finance" 단일 소스 정책에 KRX OPEN API + KIS Open API 추가

---

## Context

### 발견된 문제

`docs/diagnosis-korea-signals-2026-04-25.md` 진단 결과:
- KOSPI 종목(예: 005930 삼성전자)에서 K1~K8 모두 `live=false`
- `lib/signals/index.ts:243-254` 의 `evaluateKorea()` 가 외국인/기관/프로그램매매/보유율/공매도/대차/신용/거래원 raw 값 8개를 **상수 더미**로 주입
- `fetchKoreaData()` (`lib/signals/fetcher.ts:200-253`) 는 Yahoo OHLCV + marketCap 만 반환, KRX/KIS/금투협 호출 0줄
- **한국 시장 weight 합 100 중 K1~K8 가 차지하는 69 점이 죽어있는 상태** — `flowScore` 가 `live: false` 를 가중합에서 제외하므로 한국 종목 점수는 K9~K12 (31 점) 만으로 산출됨

### 조사 결과 요약

`docs/research-korea-signals-data-sources-2026-04-25.md` 종합 비교:

| 후보 | 평가 |
|---|---|
| KRX OPEN API (`openapi.krx.co.kr`) | 공식 API, JSON/XML, 회원가입+1일 승인. 안정성 높음. K1~K6/K8 1차 출처 |
| KRX OTP+CSV (`data.krx.co.kr`) | **KRX 가 공식적으로 IP 차단 진행 중** (pykrx 류) — 운영 부적합. 차단 시 40일 다운타임 |
| 금투협 freesis | 공공데이터포털 — 시장 전체 추이만, 종목별 신용잔고 미제공 |
| KIS Open API | 공식 API, OAuth2, 초당 20건. 종목별 신용잔고 명확 (`daily-credit-balance`). 흥권님 KIS 계좌 보유 |

---

## Decision

본 ADR 은 다음 7개 결정을 확정한다.

| # | 항목 | 결정 |
|---|---|---|
| 1 | 데이터 소스 조합 | **안 A 하이브리드**: KRX OPEN API + KIS Open API |
| 2 | K1, K2, K3, K4, K5, K6, K8 출처 | **KRX OPEN API** (`openapi.krx.co.kr`) — 1차 공식 출처 |
| 3 | K7 (종목별 신용잔고) 출처 | **KIS Open API** (`/uapi/domestic-stock/v1/quotations/daily-credit-balance`) |
| 4 | 금지 경로 | **KRX OTP+CSV / pykrx 류 운영 사용 금지** — KRX 명시적 IP 차단 정책 |
| 5 | 인프라 | **GitHub Actions** 로 harvest 이전 — Vercel Hobby `maxDuration` 10s · cron 2개 한도 회피 |
| 6 | KIS 계좌 종류 | **모의투자 우선** + ACNT_PWD 미등록 룰 + 만료 알림 자동화 (상세는 §Q6 Decision Detail 참조) |
| 7 | 종목 확장 | **30 → 100 단계적**, 1000 은 baseline (10/24) 통과 후 |

추가 결정:
- **K12 sectorRet20d 동시 활성화**: KRX 산업별지수 fetcher 를 K1~K8 fetcher 와 같은 PR 에 신설
- **유료화/SaaS TOS 검토**: 2026-10-24 무료 베타 종료 후 KRX/KIS 데이터사업부 직접 문의 (본 ADR 범위 외)

---

## Consequences

### Positive

1. **한국 시장 weight 100 중 92 점 활성화** — 현재 K9~K12 (31 점) 만 살아있는 상태에서 K1~K8 (69 점) 추가, K7 까지 포함 시 100 점 모두 라이브. flowScore 정확도 본질적 향상.
2. **공식 API 양쪽 사용 → 합법성·안정성 확보** — KRX/KIS 양쪽 모두 SLA 명시는 없으나 차단 정책은 인증키 한도 내에서만 적용. pykrx 식 IP 블록 위험 제거.
3. **K4 외국인 보유율 정확 충족** — KRX 가 1차 출처. KIS 단독으로는 간접 추정만 가능했음.
4. **K12 sectorRet20d 도 동시 살아남** — Phase A P3 에서 hardcoded 0 으로 식별된 문제. 산업별지수 fetcher 가 같은 PR 에 들어가므로 K12 도 100% live.
5. **GitHub Actions 이전으로 인프라 한계 해소** — `maxDuration` 6시간 / cron 무제한 → 종목 100개·1000개 확장 시에도 동일 인프라 유지.
6. **흥권님 KIS 키 종속도 최소화** — K7 한 신호만 KIS 사용 → BYOK 모델 도입 시 영향 범위 작음.

### Negative / Trade-offs

1. **두 인증 체계 운영** — KRX 인증키(헤더) + KIS App Key/Secret(OAuth2 토큰). secrets 관리 복잡도 증가.
2. **KRX 인증키 발급 1일 대기** — Phase 1 시작 후 첫 fetch 호출까지 최소 24h 갭.
3. **KRX OPEN API 정확한 endpoint 목록 사전 미확인** — 회원가입+승인 후에만 노출. K7 KRX 제공 여부도 미확정. ADR §Open Questions 에 명시.
4. **GitHub Actions 이전 = harvest 라우트 유지하되 Vercel cron 제외** — vercel.json `crons` 에서 harvest 항목 제거. /api/cron/harvest 경로는 유지하되 외부 트리거는 GitHub Actions 가 담당. 코드 변경 점이 두 곳 (workflow + vercel.json).
5. **baseline 분리 운영** — 더미값 시기와 실값 시기 prediction 의 outcome 평가 트랙 분리 필수 (§Baseline Impact 참조).
6. **SaaS 재배포 라이선스 미확정** — 무료 베타 기간(~2026-10-24)에는 본인 사용으로 간주. 유료화 시 KRX/KIS 데이터사업부 문의 필요.

### Risks

| 위험 | 가능성 | 영향 | 완화 방안 |
|---|:--:|:--:|---|
| KRX OPEN API 인증키 승인 거부/지연 | 낮음 | 중 | KRX 데이터사업부 02-3774-8904 직접 문의. 그동안 K9~K12 만 라이브로 유지 (현 상태) |
| KIS 모의투자 시세 데이터 부정확 | 중 | 중 | Phase 1 직후 실측 1회 → 부정확 시 실전 계좌로 전환. 실전 키 노출 시 주문 권한 노출 — Vercel/GHA secrets 관리 강화 |
| KRX OPEN API endpoint 가 K7 종목별 신용잔고 제공 | 가능성 무관 | 양호 | 제공 시 KIS 의존도 더 줄어드는 방향. 미제공이어도 본 결정(KIS 사용) 유지 |
| GitHub Actions cron 지연/실패 | 낮음 | 낮음 | Actions 자체 SLA 99%. 실패 시 다음 cron 에서 회복 (raw 데이터 캐시 24h TTL) |
| KRX/KIS 동시 장애 | 매우 낮음 | 높음 | last-good-known 24h fallback + `risk_flags` 부착. 24h 초과 시 K1~K8 `live: false` 자동 전환 |
| Phase 4 live 활성화 시 점수 분포 변화로 진화엔진 weight 가 급격히 흔들림 | 중 | 중 | Phase 4 시작 시점 prediction 부터 새 baseline track. evolve cron 의 학습 데이터 컷오프 명시 |

---

## Implementation Plan

각 Phase 는 별도 PR 로 분리한다.

### Phase 1 — 인증키 발급 (흥권님 직접, Claude Code 작업 아님)

1. **KRX Data Marketplace** 회원가입 (개인: 본인인증/소셜로그인) → '마이페이지 > API 인증키 신청' → 관리자 승인 (~1일)
2. **KIS Developers** 가입 → 모의투자 신청 → App Key + App Secret 발급
3. 발급 후 secrets 등록:
   - GitHub repo Settings > Secrets and variables > Actions
   - Vercel Project Settings > Environment Variables (Phase 4 의 `/api/score` 라우트에서도 KIS/KRX 사용 가능성 대비)
   - 키: `KRX_API_KEY` (2026-05-04 박제 ground truth — Vercel Production+Preview / GHA Secrets / .env.local 3곳 동시 박제), `KIS_APP_KEY`, `KIS_APP_SECRET`, `KIS_ACCOUNT_TYPE` (`mock` | `real`)
4. Phase 1 완료 신호: 흥권님이 키 등록 후 ADR Status 를 "Accepted" 로 변경하며 Phase 2 PR 트리거

### Phase 2 — fetcher 신설 (Claude Code 작업)

신규 디렉토리 구조:

```
lib/signals/fetchers/
├── krx/
│   ├── auth.ts        — 인증키 헤더 생성, 환경변수 read
│   ├── flow.ts        — K1, K2, K3, K4, K5, K6, K8 raw 데이터 조회
│   ├── sector.ts      — K12 sectorRet20d 용 산업별지수 closes 배열
│   └── types.ts       — 응답 타입 정의
├── kis/
│   ├── oauth.ts       — OAuth2 token 발급/갱신, Redis 캐시 + distributed lock
│   ├── credit.ts      — K7 daily-credit-balance 조회
│   └── types.ts
└── index.ts           — 통합 export
```

기존 `lib/signals/fetcher.ts` 의 `fetchKoreaData()` 는 유지 (OHLCV + marketCap). Phase 4 에서 `evaluateKorea()` 가 `fetchKoreaData()` + `krx/flow.ts` + `kis/credit.ts` 를 병렬 호출하도록 변경.

각 fetcher 는 실패 시 Phase A P2 RFC (`docs/rfc/signal-function-signature.md`) 의 `{value, confidence, reason}` 패턴에 부분 적용 — `null` 반환 + `risk_flags` 메타데이터.

테스트: `lib/signals/fetchers/krx/flow.test.ts` 등에 mocked HTTP fixture 기반 unit test. 실 API 호출은 manual integration test 만.

### Phase 3 — GitHub Actions 이전 (Claude Code 작업)

신규 워크플로:

```
.github/workflows/harvest.yml      — daily harvest, cron '0 12 * * *' UTC = KST 21:00 (KRX 데이터 18시 확정 이후 안전 마진)
.github/workflows/verify.yml       — 5d/14d outcome 검증
.github/workflows/evolve.yml       — 주간 weight 진화
.github/workflows/regime.yml       — daily regime 판정
```

`vercel.json` `crons` 배열에서 위 4개 항목 제거. `/api/cron/*` 라우트는 보존 (GitHub Actions 가 HTTP POST 로 호출하는 형태로도 사용 가능). 인증은 기존 `CRON_SECRET` 헤더 동일.

GitHub Actions 환경변수: `KRX_API_KEY`, `KIS_APP_KEY`, `KIS_APP_SECRET`, `KIS_ACCOUNT_TYPE`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `CRON_SECRET`, `ANTHROPIC_API_KEY` (narrate 용).

### Phase 4 — live 활성화 (Claude Code 작업)

`lib/signals/index.ts` 변경 (대략):

```ts
async function evaluateKorea(meta: TickerMeta, onStep?: StepCallback) {
  const [data, flow, credit, sectorCloses] = await Promise.all([
    fetchKoreaData(meta.yahooSymbol!),
    fetchKrxFlow(meta.ticker),       // K1~K6, K8
    fetchKisCredit(meta.ticker),     // K7
    fetchKrxSector(meta.sectorCode), // K12
  ]);
  // ...
  const signals = computeKoreaSignals({
    foreignNet5d: flow.foreignNet5d,
    instNet5d: flow.instNet5d,
    programNet5d: flow.programNet5d,
    foreignHoldingCurr: flow.foreignHoldingCurr,
    foreignHolding20dAgo: flow.foreignHolding20dAgo,
    shortBalancePct: flow.shortBalancePct,
    loanBalanceCurr: flow.loanBalanceCurr,
    loanBalanceMa20: flow.loanBalanceMa20,
    creditPctOfMcap: credit.pctOfMcap,
    topForeignBuyShare: flow.topForeignBuyShare,
    // ...OHLCV
    sectorRet20d: calcReturnNd(sectorCloses, 20).value,
  }, {
    K1: flow.K1Live, K2: flow.K2Live, /* ... */ K8: flow.K8Live,
    K9: true, K10: true, K11: true, K12: true,
  });
  // ...
}
```

각 K{N}Live 는 fetch 결과의 confidence 가 "high"|"med" 이면 true, "low" 또는 fetch 실패면 false. confidence 와 reason 은 Prediction.risk_flags 에 부착.

기존 `lib/stocks.ts` 의 KOSPI 종목 정의에 `sectorCode` 추가 필요 (KRX 산업별지수 ID 매핑). 이 메타 추가도 Phase 4 PR 에 포함.

### Phase 5 — 모니터링 + 검증

1. 각 신호별 일별 live 비율 메트릭: Redis `metrics:korea:live_ratio:{date}` (1년 TTL)
2. Phase 4 활성화 직후 1주일간 K1~K8 score 분포 모니터링 — 더미 시기 대비 차이 정량화
3. KRX/KIS API 장애 폴백 동작 (last-good-known) 검증 — staging 에서 인위적 401/500 주입
4. 휴장일 처리: KRX `chk-holiday` 또는 자체 캘린더 `holidays:2026` Redis 키 (1년 TTL)
5. T+2 지연 데이터 (공매도) 의 `confidence: "low"` 자동 부착 검증
6. **KIS 모의 키 만료 자동 알림** — `KIS_MOCK_ISSUED_AT` 환경변수 기반. GitHub Actions cron 이 발급일 +80일부터 일별 체크. 만료 7일 전부터 알림 발송: ①GitHub Issue 자동 생성 (제목: "[ALERT] KIS mock key expires in N days") + ②워크플로 실패 처리 → GitHub Mobile 앱 푸시 알림 자동 전달. 만료일 도래 시 K7 자동 `live: false` 전환 + `risk_flags: ["kis_mock_expired"]`.
7. **ACNT_PWD 정기 grep 검증** — Phase 2 PR review 시 + GitHub Actions 주간 cron 으로 코드베이스 전체 grep. 발견 시 즉시 알림 + PR 차단.

---

## Cache Strategy

| Redis 키 | TTL | 용도 | 비고 |
|---|---|---|---|
| `kis:access_token` | 24h | KIS OAuth2 토큰 | 23h 경과 시 갱신. 1분 재발급 제한 회피 위해 `kis:token_lock` distributed lock |
| `kis:flow:{ticker}:{date}` | 24h | KIS K7 raw 응답 | Phase 4 cron 1회 fetch → harvest/score 모두 read-only 재사용 |
| `krx:flow:{ticker}:{date}` | 24h | KRX K1~K6, K8 raw 응답 | 동일 |
| `krx:sector:{sector_code}:{date}` | 24h | K12 산업별지수 closes 배열 | sector_code 별 하나 — 종목 100개여도 sector 는 ~30개 |
| `holidays:{year}` | 1y | 휴장일 캘린더 | 연초 1회 fetch |
| `score:v3:korea:{ticker}` | 10min | 기존 캐시 | 자연 흡수, 변경 없음 |
| `metrics:korea:live_ratio:{date}` | 1y | Phase 5 모니터링 | 일별 live=true 비율 |

---

## Fallback Policy

| 상황 | 처리 | risk_flags 추가 |
|---|---|---|
| KRX API 일시 장애 (5xx, timeout) | last-good-known 24h 캐시 사용 | `["krx_stale"]` |
| KRX 인증키 만료/거부 (401/403) | 해당 신호 `live: false` 강제 | `["krx_unavailable"]` |
| KIS OAuth 토큰 발급 실패 | last-good-known 사용, 다음 cron 재시도 | `["kis_token_failed"]` |
| KIS API 5xx | last-good-known | `["kis_stale"]` |
| KIS 401 (키 만료) | K7 `live: false` | `["kis_unavailable"]` |
| 휴장일 (KRX 캘린더 매칭) | T-1 데이터 사용 — 정상 동작 | (없음) |
| T+2 지연 (공매도 잔고) | confidence="low" + reason="t_plus_2_delay" | `["t_plus_2_delay"]` (정보용) |
| 신규 상장 종목, 데이터 없음 | 모든 K1~K8 `live: false` + warmup 모드 | `["new_listing"]` |
| 데이터 fetch 성공했으나 값이 비정상 (NaN, 음수) | 해당 신호만 `live: false` (Phase A P2 패턴) | `["{Kn}_invalid"]` |

24h 초과 last-good-known 은 사용 금지 — 그 경우 `live: false` 강제.

---

## Baseline Impact

> 현재 baseline 측정(BTC·005930·NVDA, 2026-04-27 시작 예정)은 한국 종목의 K1~K8 더미값 기준이다.  
> Phase 4 live 활성화 시점부터 005930 의 점수 산출 로직이 본질적으로 변하므로 evolve cron 의 학습 데이터에 단절이 생긴다.

**대응**:

- **Track A (더미 baseline)**: 4/27 ~ Phase 4 활성화 직전. 기존 더미값 기준 prediction 의 outcome 평가 — **참고용으로만 유지**, 강결론(10/24) 평가 제외.
- **Track B (실값 baseline)**: Phase 4 활성화일 ~ 10/24. K1~K8 실값 + K12 산업별지수 실값 기준. **강결론은 Track B 만으로 평가**.
- **트랙 식별 방법**: `Prediction.scoreVersion` 을 `v3.1` (현재) → Phase 4 시작 시 `v3.2` 로 bump. evolve cron 이 학습 시 같은 scoreVersion 끼리만 묶도록 필터.
- **활성화 일자 기록**: Phase 4 머지 커밋 해시 + 첫 production 호출 timestamp 를 ADR 끝(또는 SESSION_STATE) 에 기록.

KOSPI 외 종목 (BTC, NVDA) 은 영향 받지 않으므로 Track 분리 무관.

---

## 종목 확장 마일스톤

| 종목 수 | 시점 | 조건 | 인프라 영향 |
|---|---|---|---|
| 35 (현재) | 즉시 | KOSPI 15 + US 10 + Crypto 10 | Vercel Hobby 한도 내, 단 maxDuration 10 s 곧 초과 임박 |
| 50 (KOSPI 30) | Phase 4 완료 후 | live 활성화 + KRX/KIS 안정성 1주 모니터링 통과 | GitHub Actions 이전 필수 |
| 100 (KOSPI 80) | 6/26 체크포인트 | baseline 중간 평가 + Track B 정확도 50% 이상 | KIS rate limit 35 s 처리 (초당 20) — GHA 충분 |
| 1000 | 10/24 강결론 통과 후 | 데이터 질 검증 + 유료화 결정 정합 | KIS 5.8 분 / KRX 117 분 (호출 분산 + 캐시 강화 필요) |

---

## Alternatives Considered

### 안 B — KIS Open API 단일 (거절)

- 거절 사유: K4 외국인 보유율을 KIS 가 직접 제공하지 않음. `frgnmem-pchs-trend` 로 누적 추정 시 시작점 부정확으로 신뢰성 ↓. K4 weight=8 손실 또는 부정확.
- 추가 거절 사유: 흥권님 KIS 개인 키 단일 점단위 의존 — BYOK 모델 도입 전까지 키 노출 시 주문 권한까지 노출.

### 안 C — KRX OTP+CSV + 금투협 (거절)

- 거절 사유 1: KRX 가 pykrx 식 비공식 스크래핑에 대해 IP 차단 정책을 명시적으로 운영. Vercel/GHA outbound IP 차단 시 40일 다운타임 가능.
- 거절 사유 2: 금투협 freesis 의 신용잔고 API 는 시장 전체 추이만 — K7 종목별 충족 불가.
- 거절 사유 3: SaaS 재배포 시 비공식 경로 라이선스 위험 큼.

### 단일 데이터 소스 vs 하이브리드 (선택: 하이브리드)

- 단일 KRX 만 = K7 종목별 신용잔고 미확정 (KRX OPEN API endpoint 미공개)
- 단일 KIS 만 = K4 부정확
- → 양쪽 강점 결합한 하이브리드가 매핑 완결성 최고

### Vercel Pro 업그레이드 vs GitHub Actions (선택: GitHub Actions)

- Vercel Pro $20/월 — Hobby cron 한도 + maxDuration 60s 해소되지만 100/1000 종목 시 60s 도 부족
- GitHub Actions = 무료 (public repo) + 6시간 maxDuration + cron 무제한
- 단점: Vercel 통합 메트릭에서 분리 — 별도 모니터링 필요. 본 ADR §Phase 5 에 포함.

---

## Q6 Decision Detail — KIS 계좌 종류 (2026-04-25 갱신)

본 항목은 `docs/research-kis-security-options-2026-04-25.md` 조사 결과 반영.

### KIS 3-Layer 보안 구조

| Layer | 필요 조건 | 가능 작업 |
|---|---|---|
| 1 | App Key + Secret | Bearer Token 발급 → 시세/조회 |
| 2 | + 계좌번호 + ACNT_PWD | 주문 가능 (HTTP body 평문) |
| 3 | + OTP/보안카드/생체 | 출금/이체 (API 외부) |

### 핵심 보안 룰 (절대 위반 금지)

**ACNT_PWD 절대 secrets 미등록 룰:**
- 환경변수에 `KIS_*_ACNT_PWD` 형식의 변수 등록 금지
- 코드베이스(commit/working tree)에 계좌 비밀번호 평문/암호화 모두 등장 금지
- 정기 grep 으로 강제: `grep -r "ACNT_PWD\|acnt_pwd\|account_password" .` 결과 0건 유지
- 본 룰만 지키면 App Key 노출돼도 자산 위험 0

### 결정 트리 (Phase 1 직후)

```
Phase 1 완료 (모의 + 실전 키 모두 발급) →
↓
[모의투자 시세 1회 실측] (ADR Q1)
↓
├─ 모의 시세 정확 + 100종목 이하 가능 → 모의 단독 (자산 위험 0)
│   └─ 단점: 3개월마다 키 갱신 + 모의 계좌 재발급 필요 → §모의 갱신 자동화
│
└─ 모의 시세 부정확 또는 rate limit 부족 → 실전 단독 + ACNT_PWD 룰
    └─ 보안: ACNT_PWD 미등록만 지키면 자산 위험 0, 시세 조회만 동작
```

### 모의 갱신 자동화 (Phase 5에 포함)

KIS 모의투자 정책: 3개월 만료, 갱신 불가. 새 키 재발급만 가능.

자동 알림 시스템:
- 환경변수: `KIS_MOCK_ISSUED_AT` (발급일 기록)
- GitHub Actions cron: 발급일 +80일부터 매일 체크
- 만료 7일 전부터 알림 (이메일 또는 Slack webhook)
- 만료일 도래 시 K7 신호 자동 `live: false` 전환 + `risk_flags: ["kis_mock_expired"]`
- 다른 신호(K1~K6, K8, K9~K12)는 영향 받지 않음

### 실전 키 사용 시 추가 보호

본 결정 트리에서 실전으로 분기할 경우:
- secrets 노출 모니터링: GitHub secret scanning 활성화 확인
- IP 제한 대안: outbound IP 고정이 필요하면 GitHub Actions 의 IP 범위 또는 Vercel 의 Edge runtime 제약 검토
- 의심 활동 감지: KIS 측 abnormal usage 알림이 흥권님 등록 이메일로 오는지 확인 (Phase 1에서 등록 이메일 검증)

---

## Open Questions

흥권님 후속 결정 또는 인증키 발급 후 실측 필요 항목:

1. **KIS 모의투자 시세 정확도** — 모의 vs 실전 키 둘 다 발급해 동일 ticker (예: 005930) 의 K1~K8 raw 값 1주일치 비교. 실측 후 모의 단일 / 실전 단일 / 일부 실전 결정.
2. **KRX OPEN API 가 K7 (종목별 신용잔고) 제공하는가** — KRX 인증키 발급 후 endpoint 목록 (`/contents/OPP/USES/service/OPPUSES002_S1.cmd`) 에서 확인. 제공된다면 KIS 의존을 K7 까지 제거하고 단일 KRX 로 단순화 가능.
3. **GitHub Actions cron 시각** — 본 ADR 은 `0 12 * * *` UTC = KST 21:00 제안 (KRX 데이터 18시 확정 + 안전 마진). 흥권님 다른 운영 시간대 선호 시 조정. 현재 Vercel cron `0 1 * * *` UTC = KST 10:00 은 KRX 일별 데이터 미확정 시각이라 실값 시기에는 부적합.
4. **K8 거래원 분류 — "외국계 창구" 정의** — KRX 회원사 코드 중 외국계 vs 내국계 분류 메타가 필요. KRX OPEN API 응답에 이미 분류 필드가 있는지 / 별도 매핑 테이블 유지가 필요한지 endpoint 확인 후 결정.
5. **K4 의 보유율 기준일** — 현재 코드 `foreignHolding20dAgo` 는 "20영업일 전" 의미. KRX 응답이 영업일 기준인지 자연일 기준인지 확인 필요.
6. **KRX/KIS 양쪽 SaaS 재배포 라이선스** — 무료 베타 종료(2026-10-24) 전까지 KRX 데이터사업부 02-3774-8904 + KIS Developers 양쪽 직접 문의.
7. **KIS Account 모드 전환 트리거** — 모의 → 실전 전환 시 키만 교체하면 동작하는지 (URL 별도 `apivts.koreainvestment.com` vs `openapi.koreainvestment.com`) 확인 필요. fetcher 의 base URL 분기 설계.
8. **모의 키 갱신 알림 채널** — ✅ 결정됨 (2026-04-25): **GitHub Mobile 앱 푸시 알림**. GitHub Actions cron 이 만료 7일 전부터 워크플로 내에서 의도적으로 fail 또는 issue 자동 생성 → GitHub Mobile 앱이 푸시 알림 자동 전달. 추가 secret / 외부 서비스 / 비용 없음. 흥권님 GitHub 계정(dudurim88255-dev)에 이미 설치됨.

---

## References

### 상위 문서

- `docs/research-korea-signals-data-sources-2026-04-25.md` — 4 후보 종합 비교 조사
- `docs/research-kis-data-endpoints-2026-04-25.md` — KIS Open API 단독 조사 + TR_ID 확인
- `docs/diagnosis-korea-signals-2026-04-25.md` — K1~K8 비활성 진단

### 관련 ADR

- ADR 003 — 신호 평가 엔진 v3 (`live` flag 정책 정의)
- ADR 004 — 시장별 데이터 소스 (본 ADR 가 한국 시장 부분 보완)
- ADR 005 — Stage 2 actual scope (Phase A P0 가 정리한 confidence 타입)

### 외부

- KRX OPEN API 포털 — https://openapi.krx.co.kr/
- KRX Data Marketplace — https://data.krx.co.kr/
- KIS Developers — https://apiportal.koreainvestment.com/apiservice
- KIS 공식 SDK — https://github.com/koreainvestment/open-trading-api

### 관련 RFC

- `docs/rfc/signal-function-signature.md` — Phase A P2 spillover. 본 ADR 의 fallback policy 가 부분 적용. 전체 시그너처 개편은 별도.
- `docs/refactor-p3-diff.md` — K12 sectorRet20d 의 산업별지수 fetcher 도입 가능 패턴 (`calcReturnNd(sectorCloses, 20)`)

---

*Status: Accepted (2026-05-04). Phase 1 키 등록 완료 → Phase 2 부분 진입 (auth.ts 골격만, flow/sector 는 portal endpoint docs 박제 후 별 PR).*
