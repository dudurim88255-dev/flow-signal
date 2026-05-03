# ADR 007 — Korea Market Signals Data Sources (Revision)

**Status**: Proposed (흥권 검토 후 Accepted)
**Date**: 2026-05-04
**Deciders**: 흥권
**Supersedes**: ADR 006 §Decision §1, §2 (부분 supersede — KRX OPEN API 의 K1~K8 매핑 가정 부정)
**Trigger**: 흥권 KRX OPEN API portal 실측 (`docs/research-krx-openapi-endpoints-2026-05-04.md`) — KRX OPEN API 31개 endpoint 전체가 OHLCV/시세 데이터만 제공, K1~K8 (외국인/기관/공매도/대차/신용/거래원) 0건 미제공 catch.

---

## Context

### ADR 006 의 KRX 측 가정

ADR 006 §Decision §2 = "K1, K2, K3, K4, K5, K6, K8 출처 → KRX OPEN API". research-korea-signals §2-4 에 매핑 추정 명시:

> "OPEN API 의 정확한 endpoint 목록은 인증키 발급 후 로그인 상태에서만 열람 가능 → 본 조사 범위에서 Konfirm 불가. 추정 (KRX 정보데이터시스템과 동일 데이터 풀 기반이라는 가정)"

ADR 006 §Open Q #2 도 동일 우려 명시:
> "KRX OPEN API 가 K7 (종목별 신용잔고) 제공하는가 — KRX 인증키 발급 후 endpoint 목록 (`/contents/OPP/USES/service/OPPUSES002_S1.cmd`) 에서 확인."

→ ADR 006 의 KRX 결정은 **추정** 위에 작성. 검증 cycle 자연 결과.

### 검증 cycle 결과 (2026-05-04 흥권 portal 실측)

`docs/research-krx-openapi-endpoints-2026-05-04.md` §1, §2:

| 카테고리 | endpoint 수 |
|---|---:|
| 지수 | 5 |
| 주식 | 8 |
| 증권상품 | 3 |
| 채권 | 3 |
| 파생상품 | 6 |
| 일반상품 | 3 |
| ESG | 3 |
| **합계** | **31** |

**전부 OHLCV / 종목기본정보 / 시세 데이터.** K1~K8 데이터 범주 (외국인/기관/공매도/대차/신용/거래원) **0건 미제공.**

→ ADR 006 §Decision §2 부정. K1~K8 의 KRX OPEN API 출처 가능성 0.

### 사용 가능 출처 정합 확인

`docs/research-kis-data-endpoints-2026-04-25.md` §5 박제 (KIS 단독 조사):

| K | 신호 | KIS 제공 | 출처 |
|---|---|:--:|---|
| K1 | 외국인 순매수 | ✅ | `inquire-investor` (FHKST01010900) |
| K2 | 기관 순매수 | ✅ | `inquire-investor` (외국인+기관 함께 반환) |
| K3 | 프로그램매매 | ✅ | `comp-program-trade-daily` (FHPPG04600001) |
| K4 | 외국인 보유율 Δ | ⚠️ 간접만 | `frgnmem-pchs-trend` 누적 산출 (스타팅 포인트 오차) |
| K5 | 공매도 잔고 | ✅ | `daily-short-sale` (FHPST04830000) |
| K6 | 대차잔고 | ✅ | `daily-loan-trans` |
| K7 | 신용잔고 | ✅ | `daily-credit-balance` |
| K8 | 외국계 창구 | ✅ | `frgnmem-trade-trend` + `inquire-member-daily` |

→ K4 외 7개 KIS 직접 제공. **K4 만 안전한 출처 부재** (research-kis §5 의 KRX `MDCSTAT02201` 권장은 KRX 정보데이터시스템 OTP+CSV — ADR 006 §1-4 운영 금지 정책 위반).

---

## Decision

다음 8개 결정 확정 (흥권 승인 후 Accepted):

### Decision 1 — 데이터 소스 조합 재정비

**ADR 006 안 A "KRX OPEN API + KIS 하이브리드" 부정.** 새 조합:

| 신호 그룹 | 출처 |
|---|---|
| K1, K2, K3, K5, K6, K7, K8 | **KIS Open API** (단일) |
| K4 | **결정 분기** (Decision 4) |
| K12 (산업별지수) | **KRX OPEN API** (지수 카테고리) |
| OHLCV (Yahoo Finance 대체 검토) | **결정 분기** (Decision 5) |

### Decision 2 — KIS 우선 정합

K1~K8 중 7개 KIS 직접 제공. ADR 006 의 KRX 가정 부정 후 KIS 단일이 최단경로. KIS App Key/Secret 1쌍 + access_token Redis 캐시로 7 신호 동시 활성.

### Decision 3 — K12 KRX OPEN API 유지

K12 sectorRet20d = "지수" 카테고리 5개 endpoint 중 산업별지수 endpoint 활용. ADR 006 §추가 결정 정합. `lib/signals/fetchers/krx/sector.ts` 박제 가능.

### Decision 4 — K4 결정 분기 (흥권 결정 필수)

| 옵션 | 설명 | weight 영향 | 리스크 | 권장도 |
|---|---|---|---|---|
| **K4-A** | live: false (영구 포기) | -8 (K4 weight 손실) | 0 | 🟡 안전, 손실 명확 |
| **K4-B** | KIS `frgnmem-pchs-trend` 간접 누적 + confidence="low" | 부분 (confidence low 가중) | 정확도 낮음 (스타팅 포인트 누적 오차) | 🟡 시도 가치, 검증 cycle 필요 |
| **K4-C** | KRX OTP+CSV `MDCSTAT02201` 강행 + IP 차단 모니터링 | 정확 | 40일 다운타임 + ADR 006 §1-4 정책 위반 | 🔴 위험 |
| **K4-D** | 금투협 freesis / 공공데이터포털 재조사 | TBD | TBD | 🟢 조사 후 결정 가능 |
| **K4-E** | KRX 데이터사업부 02-3774-8904 직접 문의 (보유율 별 endpoint 가능 여부) | TBD | 0 | 🟢 정공법 |

**Claude 권고**: **K4-E 우선** (KRX 직접 문의) → 가능 시 OPEN API 출처 확정, 불가 시 K4-D (금투협 재조사) → 최종 미발견 시 K4-A 또는 K4-B.

### Decision 5 — OHLCV 출처 결정 분기

KRX OPEN API "주식" 카테고리 8개 endpoint = OHLCV / 종목기본정보 / 시가총액 등 제공. **Yahoo Finance 대체 가능성** 검토 의제.

| 옵션 | 설명 | 권장도 |
|---|---|---|
| **OHLCV-A** | Yahoo Finance 유지 (현 상태) | 🟢 단순, 추가 작업 0 |
| **OHLCV-B** | KRX OPEN API "주식" 카테고리로 일부 대체 (정확도 ↑ 가능) | 🟡 검증 cycle 필요 |
| **OHLCV-C** | KRX 단일 (Yahoo Finance 폐기) | 🔴 휴장일/시간대 처리 추가 부담 |

**Claude 권고**: **OHLCV-A 유지** (단순). KRX OPEN API "주식" 카테고리는 본 ADR 범위 외 별 cycle 검토 (Phase 5 모니터링 후).

### Decision 6 — KIS 키 의존도 (재정비 후 ↑)

K1~K3, K5~K8 모두 KIS = KIS App Key/Secret 1쌍 의존도 100%. ADR 006 §6 의 모의투자 우선 정책 + ACNT_PWD 미등록 룰 유지.

추가 보호:
- KIS access_token Redis 캐시 (`kis:access_token` TTL 24h, distributed lock `kis:token_lock`) — ADR 006 §Cache Strategy 정합
- KIS API 장애 시 last-good-known 24h fallback — ADR 006 §Fallback Policy 정합 (KRX 측 fallback 항목은 K12 + sector 만 적용)
- KIS rate limit 초당 20 (실전) / 더 낮음 (모의) → 100 종목 × 7 신호 = 700 호출/일, 35초 내 완료 (실전), 모의 실측 필요

### Decision 7 — Phase 2 재구성

`lib/signals/fetchers/` 신규 구조 (재정비):

```
lib/signals/fetchers/
├── kis/                       — 우선 박제
│   ├── auth.ts                — App Key/Secret + OAuth2 token 발급/갱신
│   ├── oauth.ts               — Redis 토큰 캐시 + distributed lock
│   ├── flow.ts                — K1, K2, K3, K5, K6, K8 raw 데이터 (inquire-investor + comp-program-trade + daily-short-sale + daily-loan-trans + frgnmem-trade-trend)
│   ├── credit.ts              — K7 daily-credit-balance
│   ├── foreign-holding.ts     — K4 (옵션 K4-B 채택 시 frgnmem-pchs-trend 간접)
│   └── types.ts
├── krx/                       — 부분 박제 (K12 만)
│   ├── auth.ts                — ✅ 이미 박제 (commit 1eabbe7, 재활용)
│   ├── sector.ts              — K12 산업별지수 (지수 카테고리 endpoint 박제 후)
│   └── types.ts
└── index.ts                   — 통합 export
```

**ADR 006 §Phase 2 vs ADR 007 §Decision 7 차이**:
- KRX `flow.ts` (K1~K6, K8) 박지 X — 의미 X (KRX OPEN API 미제공)
- KIS 디렉토리 신설 (ADR 006 §Phase 2 의 `kis/` 와 동일 구조 + flow.ts 추가)

### Decision 8 — Phase 진행 순서 재정비

ADR 006 §Phase 2 → 4 순서 변경:

1. **Phase 2-A (KRX K12)**: `krx/auth.ts` 재활용 + `krx/sector.ts` 박제 — 흥권 portal docs 박제 후 (지수 카테고리 endpoint 확정)
2. **Phase 2-B (KIS K1~K3, K5~K8)**: `kis/` 디렉토리 신설 — 흥권 KIS 키 등록 후
3. **Phase 2-C (K4)**: Decision 4 결정 후 박제 (또는 K4-A 시 박제 X)
4. **Phase 3 (GHA 이전)**: ADR 006 §Phase 3 정합 유지
5. **Phase 4 (live 활성화)**: KIS + KRX K12 통합, ADR 006 §Phase 4 의 `evaluateKorea()` 변형
6. **Phase 5 (모니터링)**: ADR 006 §Phase 5 정합 유지

ADR 006 §Phase 1 (인증키 발급) 정합 유지 — 흥권 KRX 등록 완료. KIS 미등록.

---

## Consequences

### Positive

1. **데이터 출처 정확성** — 추정 위 결정 (ADR 006) → portal 실측 후 정확 매핑 (ADR 007). 검증 cycle 자연 진행.
2. **KIS 단일 (가까이)** — 운영 단순화. 1쌍 키 + access_token 캐시로 7 신호 활성. KRX OPEN API 는 K12 + (선택) OHLCV 만 사용.
3. **`1eabbe7` 재활용** — KRX `auth.ts` 골격 (commit `1eabbe7`) 그대로 K12 sector fetcher 에 사용. 폐기 X.
4. **K4 정공법 트리거** — KRX 데이터사업부 직접 문의 (Decision 4 K4-E) = ADR 006 §Open Q #6 의 SaaS 라이선스 문의 와 묶음 처리 가능 (한 번에 02-3774-8904).
5. **GHA / 모의투자 / KIS 보안 정책 (ADR 006 §3, §5, §6)** 모두 유지 — 부분 supersede 의 가치.

### Negative / Trade-offs

1. **KIS 키 의존도 100%** — App Key 노출 시 주문 권한 노출. ACNT_PWD 미등록 룰 + 모의투자 우선이 핵심 보호.
2. **K4 손실 가능성** — 옵션 K4-A 채택 시 weight 8 영구 손실. 옵션 K4-B 채택 시 confidence low (정확도 낮음).
3. **KIS rate limit 모의** — 모의 계좌 한도 명시 부재. 실측 필요 (ADR 006 §Open Q #1).
4. **KRX OPEN API 활용 축소** — 31개 중 K12 1개 + (선택) "주식" 8개 OHLCV. 대부분 미사용. 인증키 발급 1일 대기는 K12 활성화에만 의미.
5. **Phase 2 재진행** — ADR 006 § Phase 2 의 KRX `flow.ts` 가정 박제 X (`1eabbe7` 의 auth.ts 만 유효). 일부 사전 작업 무의미화.

### Risks

| 위험 | 가능성 | 영향 | 완화 방안 |
|---|:--:|:--:|---|
| KIS 모의투자 시세 데이터 부정확 | 중 | 중 | Phase 2-B 직후 1회 실측 → 부정확 시 실전 키로 전환 (ADR 006 §6 정합) |
| KIS App Key 노출 | 낮음 | 높음 | Vercel/GHA secrets + ACNT_PWD 미등록 룰 + GitHub secret scanning 활성화 |
| K4 결정 지연 (Decision 4 미정) | 중 | 중 | K4-A (포기) 단기 채택 + K4-D/E 병행 조사 |
| KRX OPEN API K12 endpoint 미존재 | 낮음 | 낮음 | 흥권 portal 박제 후 검증 — 미존재 시 K12 도 KIS 단일 로 fallback (KIS 시장지수 endpoint 가능성 검토) |

---

## Implementation Plan

### Phase 1.5 — KIS 키 등록 (흥권 직접 작업)

ADR 006 §Phase 1 의 KIS 부분 진행:
1. KIS Developers 가입 (https://apiportal.koreainvestment.com)
2. 모의투자 신청 (KIS 본 사이트)
3. App Key + App Secret 발급
4. secrets 등록 (GHA Secrets + .env.local + Vercel 3곳, 변수명 ADR 006 §Phase 1 §3 정합):
   - `KIS_APP_KEY`
   - `KIS_APP_SECRET`
   - `KIS_ACCOUNT_NUMBER`
   - `KIS_ACCOUNT_TYPE` (`mock` | `real`)
   - `KIS_BASE_URL` (모의: `https://openapivts.koreainvestment.com:29443`, 실전: `https://openapi.koreainvestment.com:9443`)
5. `KIS_MOCK_ISSUED_AT` 박제 (만료 80일 자동 알림 트리거)
6. ADR 007 Status `Proposed` → `Accepted` 변경 + Phase 2 트리거

### Phase 2-A — KRX K12 sector fetcher (Claude 작업, 흥권 portal docs 박제 후)

선결 조건:
- `docs/research-krx-openapi-endpoints-2026-05-04.md` §3 screenshot 9건 path 박제
- "지수" 카테고리 5개 endpoint 정확 명세 박제 (URL/params/schema/headers)

박제 항목:
- `lib/signals/fetchers/krx/sector.ts` — 산업별지수 closes 배열 fetcher
- `lib/signals/fetchers/krx/types.ts` — 응답 타입
- `lib/signals/fetchers/krx/auth.ts` 정정 — 인증 헤더 이름 + base URL 정합 검증
- Vitest fixture (sector.test.ts)

### Phase 2-B — KIS K1~K3, K5~K8 fetcher (Claude 작업, 흥권 KIS 키 등록 후)

박제 항목:
- `lib/signals/fetchers/kis/auth.ts` — App Key/Secret read + KrxAuthError 동형
- `lib/signals/fetchers/kis/oauth.ts` — OAuth2 token 발급/갱신 + Redis 캐시 + distributed lock
- `lib/signals/fetchers/kis/flow.ts` — K1, K2, K3, K5, K6, K8 (5 endpoint 호출, 일부는 inquire-investor 1회 호출 2 신호)
- `lib/signals/fetchers/kis/credit.ts` — K7 daily-credit-balance
- `lib/signals/fetchers/kis/types.ts` — 응답 타입 (KIS output / output1+output2 패턴)
- Vitest fixture (각 endpoint 별)

### Phase 2-C — K4 (Decision 4 결정 후)

| 결정 | 박제 항목 |
|---|---|
| K4-A | 박제 X (live: false 강제, lib/signals/index.ts evaluateKorea 변경) |
| K4-B | `lib/signals/fetchers/kis/foreign-holding.ts` (frgnmem-pchs-trend 간접) |
| K4-D/E | 별 cycle 조사 후 결정 |

### Phase 3 — GHA 이전 (ADR 006 §Phase 3 정합)

변경 X.

### Phase 4 — live 활성화 (ADR 006 §Phase 4 정합 + KIS 우선 변형)

`lib/signals/index.ts` 의 `evaluateKorea` 변경:

```ts
async function evaluateKorea(meta: TickerMeta, onStep?: StepCallback) {
  const [data, kisToken] = await Promise.all([
    fetchKoreaData(meta.yahooSymbol!),
    getKisAccessToken(), // Redis 캐시 우선
  ]);
  const [flow, credit, sectorCloses] = await Promise.all([
    fetchKisFlow(meta.ticker, kisToken),       // K1, K2, K3, K5, K6, K8
    fetchKisCredit(meta.ticker, kisToken),     // K7
    fetchKrxSector(meta.sectorCode),           // K12 (KRX OPEN API)
  ]);
  // K4: 결정 분기에 따라 fetchKisForeignHolding 호출 또는 live: false
  // ...
}
```

### Phase 5 — 모니터링 (ADR 006 §Phase 5 정합)

변경 X.

---

## Open Questions

1. **K4 결정** (Decision 4) — 흥권 결정 필수. K4-E (KRX 데이터사업부 직접 문의) 우선 권장. 미해결 시 K4-A 단기 채택.
2. **KIS 모의 시세 정확도** — Phase 2-B 직후 1회 실측 필요. ADR 006 §Open Q #1 정합 유지.
3. **KRX OPEN API "지수" 카테고리 5개 정확 endpoint** — 흥권 portal docs 박제 후 (research-krx-openapi-endpoints-2026-05-04.md §3 screenshot 9건 + 31개 명세).
4. **OHLCV 대체 결정** (Decision 5) — Phase 5 모니터링 후 별 cycle.
5. **KRX/KIS SaaS 재배포 라이선스** — ADR 006 §Open Q #6 정합 유지 (무료 베타 ~2026-10-24 종료 전 양쪽 직접 문의).
6. **KIS rate limit 모의 계좌 정확 한도** — Phase 2-B 직후 실측.

---

## Compliance check (PR 머지 전 흥권 점검 항목)

- [ ] 흥권 본 ADR 결정 분기 (Decision 4, 5) 답변
- [ ] PR 본문에 "supersedes ADR 006 §Decision §1, §2 partial" 인용
- [ ] ADR 006 본문에 cross-reference 추가 (`Status: Accepted (2026-05-04, partial supersede by ADR 007)`)
- [ ] research-krx-openapi-endpoints-2026-05-04.md 의 §3 screenshot path + §2 31개 endpoint 명세 박제

---

## Related

- ADR 006 — 본 ADR 가 §Decision §1, §2 부분 supersede. 다른 결정 (§3, §5, §6, §7) 유지.
- ADR 003 — 신호 평가 엔진 v3 (`live` flag 정책)
- ADR 004 — 시장별 데이터 소스 (한국 시장 부분 ADR 006 + ADR 007 가 차례로 보완)
- ADR 005 — Stage 2 actual scope

### 외부

- KRX OPEN API portal — https://openapi.krx.co.kr/
- KIS Developers — https://apiportal.koreainvestment.com
- KRX 데이터사업부 — 02-3774-8904 (K4 보유율 endpoint + SaaS 라이선스 묶음 문의)

### 박제 docs

- `docs/research-krx-openapi-endpoints-2026-05-04.md` — 흥권 portal 실측 (본 ADR trigger)
- `docs/research-kis-data-endpoints-2026-04-25.md` — KIS K1~K8 매핑 (Decision 1, 2 근거)
- `docs/research-korea-signals-data-sources-2026-04-25.md` — 4 후보 종합 비교 (ADR 006 trigger)

---

*Status: Proposed (2026-05-04). 흥권 검토 후 "Accepted" 변경 + Phase 1.5 KIS 키 등록 + Phase 2-A/2-B/2-C 진입.*
