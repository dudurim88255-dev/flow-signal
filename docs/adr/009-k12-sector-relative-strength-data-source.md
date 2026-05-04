# ADR 009 — K12 (업종 상대강도) 데이터 출처

**Status**: Proposed (흥권 검토 + 검증 결과 read 후 Accepted)
**Date**: 2026-05-04
**Deciders**: 흥권
**Supersedes**:
- ADR 006 §Open Q #8 (정식 supersede — KRX 산업별지수 가정 + 종목→업종 매핑 미확정)
- ADR 007 §D3 (부분 부정 + supersede — "K12 → KRX OPEN API 지수 카테고리" 가정 위 결정)
**Trigger**: 흥권 KRX OPEN API portal 실측 결과 "지수" 카테고리 5개 endpoint 에 산업별지수 명시적 미발견 catch. ADR 007 D3 정식 검증 cycle 도착.

---

## Context

### K12 신호 정의

```ts
// lib/signals/korea.ts:70
k12RelativeStrength = clip(50 + (stockRet20d - sectorRet20d) * 200, 0, 100)
```

- 입력 1: `stockRet20d` — 종목 20영업일 수익률 (Yahoo OHLCV 박제 완료)
- 입력 2: `sectorRet20d` — **종목이 속한 업종지수의 20영업일 수익률** (출처 미확정)
- weight: 8 (한국 시장 weight 100 중)

### 현 박제 상태 (lib/signals/index.ts:266, 271)

```ts
sectorRet20d: 0,            // 더미값
K12: true,                  // 업종 상대강도 (partially — sector는 neutral)
```

→ K12Live=true 인데 sectorRet20d=0 더미 → 점수 산출 시 `k12 ≈ k9 (stockRet20d × 200 + 50)` 변질. **K12 의미 사실상 0**. weight 8 중복 산정.

### catch 흐름

| Cycle | 결과 |
|---|---|
| ADR 006 §추가 결정 (2026-04-25) | "K12 sectorRet20d 동시 활성화 — KRX 산업별지수 fetcher" 가정 |
| ADR 007 §D3 (2026-05-04) | "K12 → KRX OPEN API 지수 카테고리" 결정 (가정 유지) |
| 흥권 portal 실측 (2026-05-04) | "지수" 카테고리 5개 endpoint 산업별지수 **명시적 미발견** |
| research-k12 docs (2026-05-04) | KIS docs grep sector/industry 0건 + KRX 산업별지수 미박제 |
| **ADR 009 (본 ADR)** | **K12 출처 결정 분기 4 옵션 박제** |

### K4 catch 패턴 동형

ADR 008 (K4) 와 동일 패턴 — 추측 위 결정 → portal 실측 검증 → 부정 시 별 ADR cycle.

---

## Decision Options

흥권 결정 대기 (TBD). 4 옵션 박제 (흥권 명시 분기):

### K12-A — KIS 산업별지수

| 항목 | 값 |
|---|---|
| 출처 | KIS Open API 산업별지수 endpoint + 종목→업종 매핑 endpoint |
| 박제 상태 | KIS docs grep sector/industry 0건 (research-k12 §2-1) |
| 정확도 | TBD (KIS portal 박제 후 확정) |
| 리스크 | KIS App Key 의존도 ↑ (이미 K1~K3, K5~K8 7 신호 의존) — 단일점 의존 가중 |
| weight 영향 | 정확 (가능 시 high confidence) |
| 박제 비용 | 중 — KIS portal 박제 + endpoint 신설 + 종목→업종 매핑 fetcher |
| 권장도 | 🟡 KIS portal 박제 후 확정 가능 시 정공법 |

**조사 필요 항목** (Decision 전):
- KIS Developers portal endpoint 카탈로그 — "지수" / "업종" / "산업" 키워드 검색
- 공식 SDK https://github.com/koreainvestment/open-trading-api/tree/main/examples_llm/domestic_stock — 폴더 grep
- `inquire-price` (종목 시세) 응답의 `bstp_kor_isnm` (업종 한글명) 필드 확인
- 산업별지수 시계열 (closes 배열) endpoint 가능성

### K12-B — KRX 산업별지수 (krx_dd_trd 검증 후)

| 항목 | 값 |
|---|---|
| 출처 | KRX OPEN API "주식" 카테고리 krx_dd_trd 응답 + "지수" 카테고리 산업별지수 (가능 시) |
| 박제 상태 | krx_dd_trd 응답 schema 미박제, "지수" 카테고리 산업별지수 portal 미발견 |
| 정확도 | TBD (KRX portal 박제 후 확정) |
| 리스크 | 0 (이미 KRX_API_KEY 박제 완료) |
| weight 영향 | 가능 시 정확 |
| 박제 비용 | 중 — KRX portal 박제 + sector.ts 박제 + 종목→업종 매핑 |
| 권장도 | 🟡 KRX portal 박제 후 krx_dd_trd 결과 + 지수 카테고리 명세 read 후 확정 |

**조사 필요 항목**:
- KRX OPEN API "주식" 카테고리 8개 endpoint 중 종목별 업종코드 포함 응답 (krx_dd_trd 또는 동등)
- "지수" 카테고리 5개 endpoint 의 정확 spec — 산업별지수 endpoint 존재 여부
- 산업별지수 미존재 시 → KOSPI 200 / KOSDAQ 시장지수 만 가능 (K12-C 분기)

### K12-C — KOSPI 200 단일 (의미 약화)

| 항목 | 값 |
|---|---|
| 출처 | Yahoo Finance `^KS11` (KOSPI) 또는 `^KS200` (KOSPI 200) 시계열 |
| 박제 상태 | Yahoo Finance 박제 완료 — fetchKoreaData 확장만 필요 |
| 정확도 | 🟡 의미 약화 — 모든 종목이 동일 sector ret (시장지수) 사용 |
| 리스크 | 0 |
| weight 영향 | 부분 (K12 가 시장 대비 종목 상대강도 = 시장 베타 측정에 가까움) |
| 박제 비용 | 낮음 (Yahoo Finance fetcher 확장만) |
| 권장도 | 🟢 단순, 즉시 박제 가능 (의미 약화 수용 시) |

**의미 약화 명세**:
- 본래 K12 = "종목이 속한 업종 대비 종목 상대강도"
- KOSPI 200 단일 = "전체 시장 대비 종목 상대강도" (= K9 stockRet20d 의 weighted scaling 으로 해석 가능)
- K12 의 차별성 약화. 하지만 weight 8 = 활성화 (live: true) + sectorRet20d 더미 0 보다는 의미 있음

### K12-D — 폐기 (live: false 영구)

| 항목 | 값 |
|---|---|
| 출처 | 없음 |
| 정확도 | — |
| 리스크 | 0 |
| weight 영향 | -8 (K12 weight 영구 손실) |
| 박제 비용 | 0 (lib/signals/index.ts 의 K12: true → false 만) |
| 권장도 | 🟡 안전, 손실 명확 |

**근거**: ADR 003 `live` flag 정책 정합 (라이브 0 신호는 가중합 제외). K4-A 와 동형 — 검증 안된 출처로 점수 산출 X.

---

## Decision (TBD)

흥권 결정 대기. 본 ADR 박제 시점 (2026-05-04) 미결정.

**Claude 권고 시퀀스** (참고용, 흥권 결정 우선):
1. **KIS portal + KRX portal 박제 우선** — K12-A 와 K12-B 동시 검증.
2. **KIS portal 발견 + KIS sector endpoint 가능 시** → K12-A 채택. KIS 단일 (K1~K8 + K12) 운영 단순화.
3. **KIS 미발견 + KRX 발견 시** → K12-B 채택. krx_dd_trd 응답 schema 박제 후 fetcher 진입.
4. **양쪽 모두 미발견 시** → K12-C 채택 (KOSPI 200 단일 의미 약화 수용) 또는 K12-D (폐기).
5. **시간 우선 시** → K12-C 즉시 박제 (Yahoo Finance fetcher 확장만, K12 활성화 의미 부분 회복).

---

## Consequences

### Positive

1. **ADR 007 D3 정식 해결** — 가정 위 결정의 portal 실측 검증 cycle 자연 진행.
2. **ADR 007 Phase 2-B 진입 미블로커** — K12 결정 분리로 KIS K1~K3, K5~K8 7 신호 박제 즉시 진입 가능.
3. **K4 catch 패턴 정합** — ADR 008 (K4) 와 동형 = 추측 위 결정 → 검증 → 별 cycle 분리.
4. **K12 의미 회복** — 현 sectorRet20d=0 더미 + K12Live=true 변질 상태 영구 해결.
5. **K12-C 단순 옵션 박제** — 즉시 박제 가능 (Yahoo Finance fetcher 확장만) → 시간 우선 결정 시 활용.

### Negative / Trade-offs

1. **ADR 007 Phase 2-A 보류** — KRX K12 sector fetcher 박제는 ADR 009 결정 후. ADR 007 의 D3 = D7 의 `lib/signals/fetchers/krx/sector.ts` 박제 의제 보류.
2. **흥권 의사 결정 부담** — KIS + KRX portal 박제 + 4 옵션 분기 → 결정 cycle 1~2주.
3. **K12 단기 미활용** — 결정 전까지 sectorRet20d=0 더미 유지. K12 점수 의미 X (변질 상태 지속).
4. **KIS 의존도 추가 가능성** — K12-A 채택 시 KIS 의존도 = K1~K3, K5~K8 + K12 = 8 신호. 단일점 위험 ↑.

### Risks

| 위험 | 가능성 | 영향 | 완화 방안 |
|---|:--:|:--:|---|
| KIS + KRX 양쪽 모두 산업별지수 미제공 | 중 | 중 | K12-C (KOSPI 200 단일) 또는 K12-D (폐기) 폴백 |
| K12 결정 영구 보류 | 낮음 | 낮음 | K12-C 즉시 박제 (Yahoo Finance fetcher 확장만) → 단기 활성화 |
| krx_dd_trd 응답 schema 미공개 | 낮음 | 중 | KRX portal 박제 미완 시 K12-A/C/D 분기 |
| KOSPI 200 단일 (K12-C) 의 의미 약화 | 중 | 낮음 | K12 = 시장 베타 측정으로 재정의 + 본래 의미 별 cycle 회복 (10/24 baseline 강결론 후) |

---

## Implementation Plan

### Phase 1 (조사 cycle, Decision 전)

**흥권 작업**:
1. KIS Developers portal — sector/industry/지수/업종 endpoint 검색
2. KRX OPEN API portal — "주식" 카테고리 krx_dd_trd 응답 schema + "지수" 카테고리 5개 정확 명세
3. 결과 docs 박제: research-k12-sector-data-sources-2026-05-04.md §2 + §3 update

**Claude 작업**:
1. 흥권 트리거 시 KIS 공식 SDK grep (`koreainvestment/open-trading-api`)
2. Yahoo Finance `^KS200` ticker 가능성 검증 (K12-C 진입 시)

### Phase 2 (Decision)

흥권 ADR 009 Status `Proposed` → `Accepted` 전환 + Decision K12-A/B/C/D 채택.
ADR 009 본문 update — Decision 채택 + 채택 근거 박제.

### Phase 3 (Implementation, Decision 채택 후)

| 채택 | 박제 항목 |
|---|---|
| K12-A | `lib/signals/fetchers/kis/sector.ts` (KIS 산업별지수) + `lib/signals/fetchers/kis/industry-mapping.ts` (종목→업종) + Vitest fixture |
| K12-B | `lib/signals/fetchers/krx/sector.ts` (KRX 산업별지수, ADR 007 D7 정합) + `lib/signals/fetchers/krx/industry-mapping.ts` + Vitest fixture |
| K12-C | `lib/yahoo.ts` 확장 — `^KS200` (또는 `^KS11`) closes 배열 fetch + lib/signals/index.ts evaluateKorea 의 sectorRet20d 산정 |
| K12-D | `lib/signals/index.ts` 의 K12: true → false 변경 (1 줄) |

### Phase 4 (모니터링, Decision 채택 후 1주)

- K12 score 분포 (sectorRet20d 더미 시기 vs 실값 시기)
- 정확도 검증 (가능 시 다른 출처와 1회 비교 — 검증 cycle 만)

---

## Trigger 조건

본 ADR 진행 시점:
- **(가) ADR 007 Phase 2-B 완료 후** — KIS K1~K3, K5~K8 7 신호 박제 + KIS portal 박제 묶음 처리 후 K12 cycle 진입.
- **(나) 흥권 자유 시점** — ADR 007 진행 중에도 KIS/KRX portal 박제 병행 가능.

**Claude 권고**: (나) 채택 — KIS portal 박제 = ADR 007 Phase 2-B 의 KIS 키 등록 후 자연 발생. KRX portal 박제 = 흥권 다음 세션 작업 (research-krx §3 screenshot 묶음).

---

## Open Questions

1. **KIS 산업별지수 endpoint 박제** — 흥권 KIS portal 박제 + 공식 SDK grep 후 확정.
2. **KRX OPEN API "주식" 카테고리 krx_dd_trd 응답 schema** — 흥권 portal 박제 후 확정.
3. **KRX OPEN API "지수" 카테고리 5개 정확 명세** — 흥권 portal 박제 후 산업별지수 endpoint 존재 여부 확정.
4. **K12-C 채택 시 KOSPI 200 단일의 의미 약화 수용 여부** — 흥권 결정.
5. **종목→업종 매핑 출처 결정** — KIS / KRX / `lib/stocks.ts` 수동 박제 / Yahoo `assetProfile.industry` 분기.
6. **K12 confidence 등급** — K12-A "high" / K12-B "high" / K12-C "med" (의미 약화) / K12-D "live: false". Decision 채택 후 박제.

---

## Compliance check (PR 머지 전 흥권 점검 항목)

- [ ] Decision 채택 (K12-A/B/C/D 중 1)
- [ ] ADR 009 Status `Proposed` → `Accepted`
- [ ] PR 본문에 "ADR 009 K12 Decision = K12-X" 인용
- [ ] K12-A/B/C 채택 시 출처별 fetcher 박제 commit chain 명시
- [ ] research-k12-sector-data-sources-2026-05-04.md 의 §2 (KIS) + §3 (KRX) 박제 결과 update

---

## Related

- **ADR 007 §D3 — 본 ADR 가 부분 부정 + supersede**
- **ADR 008 — K4 catch 패턴 동형 (참조)**
- ADR 006 §Open Q #8 — 본 ADR 가 정식 supersede
- ADR 003 — `live` flag 정책 (K12-D 채택 시 K12Live=false)
- ADR 004 — 시장별 데이터 소스

### 외부

- KIS Developers — https://apiportal.koreainvestment.com (K12-A)
- KIS 공식 SDK — https://github.com/koreainvestment/open-trading-api (K12-A grep)
- KRX OPEN API portal — https://openapi.krx.co.kr/ (K12-B)
- Yahoo Finance `^KS200` — https://finance.yahoo.com/quote/^KS200 (K12-C)

### 박제 docs

- `docs/research-k12-sector-data-sources-2026-05-04.md` — 본 ADR trigger
- `docs/research-krx-openapi-endpoints-2026-05-04.md` — KRX 31 endpoint 박제
- `docs/research-kis-data-endpoints-2026-04-25.md` — KIS K1~K8 박제 (K12 미조사)
- `docs/adr/008-k4-foreign-holding-ratio-data-source.md` — K4 catch 패턴 동형

### 코드 박제

- `lib/signals/korea.ts:69-71` — k12RelativeStrength 공식
- `lib/signals/index.ts:266, 271` — 현 sectorRet20d=0 더미 + K12Live=true 변질 상태

---

*Status: Proposed (2026-05-04). Decision TBD — 흥권 K12-A/B/C/D 채택 대기. 트리거: 흥권 자유 시점 (ADR 007 Phase 2-B 진행 중 병행 가능).*
