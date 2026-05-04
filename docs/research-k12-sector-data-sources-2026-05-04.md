# K12 (업종 상대강도) 데이터 출처 박제 — KIS / KRX 검증

**Date**: 2026-05-04
**Trigger**: ADR 007 D3 = "K12 → KRX OPEN API 지수 카테고리" 결정의 정식 검증 cycle. 흥권 portal 실측에서 "지수" 카테고리 5개에 산업별지수 명시적 미발견 catch.
**Scope**: 박제 only. 코드 변경 X. ADR 009 PROPOSAL 트리거.
**Predecessor docs**:
- `docs/adr/007-korea-signals-data-sources-revision.md` §D3 (검증 대상)
- `docs/research-kis-data-endpoints-2026-04-25.md` (KIS K1~K8 박제 — K12 미조사)
- `docs/research-krx-openapi-endpoints-2026-05-04.md` (KRX 31 endpoint 박제 — "지수" 5개 명세 미박제)

---

## TL;DR

**K12 (업종 상대강도) 출처 미확정 catch.**

- KIS Open API: K12 산업별지수 + 종목→산업 매핑 endpoint **박제 0건** (research-kis docs grep 결과).
- KRX OPEN API: "지수" 카테고리 5개 endpoint = 흥권 portal 실측에서 산업별지수 **명시적 미발견**.
- ADR 007 D3 = KRX OPEN API "지수" 카테고리 가정 위 결정. portal 실측 이후 검증 미완.
- 종목→산업 매핑 endpoint 도 양쪽 모두 박제 0건.

→ K4 catch (ADR 007 → ADR 008) 와 동형 패턴. ADR 009 PROPOSAL 신설로 정식 해결.

---

## 1. K12 신호 정의 (lib/signals/korea.ts)

```ts
// K12. 업종 상대강도
export const k12RelativeStrength = (stockRet20d: number, sectorRet20d: number) =>
  clip(50 + (stockRet20d - sectorRet20d) * 200, 0, 100);
```

**입력 2개**:
- `stockRet20d` — 종목 20영업일 수익률 (Yahoo OHLCV 기반, 박제 완료)
- `sectorRet20d` — 종목이 속한 **업종 지수** 의 20영업일 수익률 (출처 미확정)

**Weight**: 8 (한국 시장 100 weight 중)

### 현 박제 상태 (lib/signals/index.ts:266)

```ts
sectorRet20d: 0,
// ...
K12: true, // 업종 상대강도 (partially — sector는 neutral)
```

→ **sectorRet20d 더미 0** + K12Live=true. 점수 산출 시 `50 + (stockRet20d - 0) * 200` = 종목 20일 수익률 × 200 + 50 (clip 0~100). 즉 K12 가 K9 (stockRet20d) 와 사실상 동일 신호로 변질됨. **현재 K12 의미 없음.**

ADR 006 §추가 결정 + ADR 007 §D3 = K12 fetcher 신설로 sectorRet20d 실값 활성화 의제 — 본 박제로 출처 미확정 catch.

---

## 2. KIS Open API K12 endpoint 박제 검증

### 2-1. research-kis-data-endpoints-2026-04-25.md grep 결과

| 키워드 | 매치 |
|---|---:|
| `sector` | 0 |
| `industry` | 0 |
| `산업` | 0 |
| `업종` | 0 |
| `K12` | 0 |
| `sectorRet` | 0 |

**0/6 매치.** research-kis 박제 시점 (2026-04-25) 에 K12 산업별지수 + 종목→산업 매핑 endpoint 미조사.

### 2-2. KIS 가능성 추정 (박제 X)

추측 박제 X 정신 따라 확정 안 함. 다음 항목은 **portal / 공식 SDK 박제 후만 확정 가능**:

| 항목 | 추정 | 박제 필요 |
|---|---|---|
| KIS 산업별지수 endpoint | 가능성 있음 (KOSPI 시장지수 외 업종지수 endpoint 존재 가능) | ✅ |
| 종목 → 업종 매핑 endpoint | 가능성 있음 (종목기본정보 응답에 업종코드 포함 가능) | ✅ |
| KIS 공식 SDK `examples_llm/domestic_stock/` 폴더 | "industry_*" 또는 "sector_*" 폴더 가능 | ✅ |

**조사 트리거** (Decision 진행 시):
- KIS Developers portal (https://apiportal.koreainvestment.com) 의 endpoint 카탈로그 → "지수" / "업종" / "산업" 키워드 검색
- 공식 SDK https://github.com/koreainvestment/open-trading-api/tree/main/examples_llm/domestic_stock → 폴더 grep
- `inquire-price` (종목 시세) 응답 schema 의 업종 필드 (output 의 `bstp_kor_isnm` 등) 확인

---

## 3. KRX OPEN API K12 endpoint 박제 검증

### 3-1. 흥권 portal 실측 결과

`docs/research-krx-openapi-endpoints-2026-05-04.md` §1 — 31개 endpoint 카테고리 분포:

| 카테고리 | endpoint 수 |
|---|---:|
| 지수 | 5 |
| 주식 | 8 |
| 기타 | 18 |

**"지수" 카테고리 5개 = 흥권 portal 실측에서 KRX 산업별지수 명시적 미발견.**

가능 매핑 (추정, portal 박제 후 확정):
- KOSPI / KOSDAQ / KOSPI 200 / KRX 100 등 시장지수 위주
- 산업별지수 별 endpoint 미존재 가능성 (한국 산업별지수 = KRX 가 별 시리즈로 운영하지만 OPEN API 미공개 가능)

### 3-2. krx_dd_trd 응답 안 산업별지수 포함 가능성

흥권 박제 가설: **"주식" 카테고리 8개 endpoint 중 `krx_dd_trd` (또는 동등 이름) 의 응답 schema 에 종목별 업종코드 포함 가능.**

근거:
- 한국 주식 시장 구조상 종목기본정보 응답 = 업종코드 (KOSPI 200 / KOSPI / KOSDAQ + 세부 업종) 표준 메타.
- KRX 정보데이터시스템 (`MDCSTAT*`) 의 종목기본정보 시리즈는 업종코드 포함 — OPEN API 가 동일 schema 기반이면 포함 가능.
- 하지만 산업별지수의 closes 배열 (20영업일 시계열) 은 별 endpoint (지수 카테고리) 만 제공.

### 3-3. KRX 산업별지수 시계열 출처 가능성

| 출처 | 가능성 | 박제 상태 |
|---|---|---|
| KRX OPEN API "지수" 카테고리 5개 중 산업별지수 endpoint | 낮음 (portal 미발견) | portal 박제 후 확정 |
| KRX OPEN API "주식" 카테고리 krx_dd_trd 의 업종코드 + KOSPI 200 시계열 결합 | 가능 (간접) | portal 박제 후 확정 |
| KRX 정보데이터시스템 OTP+CSV (`MDCSTAT00301` 류 산업별지수) | 정확 | ❌ ADR 006 §1-4 운영 금지 (IP 차단) |
| Yahoo Finance 한국 업종지수 ticker (`^KS11`, `^KQ11` 외 업종) | 미확정 | 검증 필요 |

---

## 4. 종목 → 업종 매핑 출처

K12 산정에 필수: **종목 ticker → 업종 분류 매핑.** 출처 분기:

| 출처 | 박제 상태 |
|---|---|
| KIS `inquire-price` 응답의 `bstp_kor_isnm` (업종 한글명) | 추정 가능, KIS portal 박제 필요 |
| KRX OPEN API "주식" 카테고리 krx_dd_trd 응답의 업종코드 | 추정 가능, KRX portal 박제 필요 |
| `lib/stocks.ts` 의 KOSPI 종목 정의에 업종 메타 수동 박제 | 정합 (ADR 006 §Phase 4 명시) — 100 종목 수동 가능, 1000 종목 부담 |
| Yahoo Finance `quoteSummary` 의 `assetProfile.industry` | 박제 필요 (영문 업종명) |

→ **수동 박제 (`lib/stocks.ts`) = 가장 안전.** 100 종목까지 1회 박제로 영구. 1000 종목 확장 시 자동화 필요 (별 cycle).

---

## 5. ADR 007 D3 정합 검증 결론

ADR 007 D3 = "K12 → KRX OPEN API 지수 카테고리" 결정 = **가정 위 결정**.

| 가정 | 검증 결과 |
|---|---|
| KRX OPEN API "지수" 카테고리에 산업별지수 endpoint 존재 | 🔴 흥권 portal 실측 명시적 미발견 |
| KRX OPEN API 가 종목→업종 매핑 제공 | 🟡 추정 (krx_dd_trd 검증 후 확정) |

→ **ADR 007 D3 부분 부정.** ADR 009 PROPOSAL 신설로 정식 해결.

---

## 6. ADR 009 트리거 의제

본 박제는 ADR 009 의 검증 근거. ADR 009 박제 항목:

| 옵션 | 출처 |
|---|---|
| K12-A | KIS 산업별지수 (KIS portal 박제 후 확정) |
| K12-B | KRX 산업별지수 (krx_dd_trd 검증 후 확정) |
| K12-C | KOSPI 200 단일 (의미 약화 — 모든 종목 동일 sector ret 사용) |
| K12-D | 폐기 (live: false 영구) |

→ ADR 009 본문 박제.

---

## 7. 본 박제 정신

### 7-1. K4 catch 패턴 동형

| Cycle | K4 | K12 |
|---|---|---|
| ADR 006 (가정) | KRX OPEN API 가정 | KRX OPEN API 가정 |
| portal 실측 (2026-05-04) | KRX OPEN API K1~K8 미제공 catch | KRX OPEN API "지수" 카테고리 산업별지수 미발견 catch |
| ADR 007 (부분 supersede) | K4 분기 → ADR 008 별 cycle | D3 = KRX OPEN API "지수" 카테고리 (재가정) |
| 검증 cycle | research-k4 + ADR 008 PROPOSAL | research-k12 (본 docs) + ADR 009 PROPOSAL |

→ **추측 위 결정 → portal 실측 검증 → 부정 시 별 ADR cycle.** ADR 정신 정합 영원 박제.

### 7-2. ADR 007 D3 의 부분 부정 의미

ADR 007 D3 = "K12 → KRX OPEN API 지수 카테고리" 부정 가능성 박제. 단 ADR 007 의 다른 Decision (D1, D2, D4, D5, D6, D7, D8) 은 정합 유지.

D7 의 `lib/signals/fetchers/krx/sector.ts` 박제 = ADR 009 결정 후 출처 정확화 후 진행. `1eabbe7` (auth.ts 골격) 은 K12 출처가 KRX 일 경우 재활용 가능.

---

## 8. 다음 단계

### 흥권 작업
1. **KIS portal 박제** — endpoint 카탈로그 sector/industry/지수/업종 검색
2. **KRX portal 박제** — "지수" 카테고리 5개 정확 명세 + "주식" 카테고리 krx_dd_trd 응답 schema (업종코드 포함 여부)
3. **ADR 009 결정** — K12-A/B/C/D 채택 (KIS portal + KRX portal 박제 결과 read 후)

### Claude 작업 (본 cycle)
1. ✅ research-kis docs grep (sector/industry 0건 박제)
2. ✅ research-k12-sector-data-sources-2026-05-04.md 박제 (본 docs)
3. **다음**: ADR 009 PROPOSAL 박제 (K12-A/B/C/D 4 옵션)
4. **다음**: ADR 007 D3 부정 박제 + Phase 2-A 보류 + Phase 2-B 우선
5. **commit** — 흥권 명시 msg

---

## References

### 본 박제 trigger
- ADR 007 D3 — "K12 → KRX OPEN API 지수 카테고리" 결정의 검증 의무
- 흥권 portal 실측 (2026-05-04) — "지수" 카테고리 산업별지수 명시적 미발견

### 연관 문서
- `docs/adr/007-korea-signals-data-sources-revision.md` §D3 — 본 박제로 부분 부정
- `docs/adr/008-k4-foreign-holding-ratio-data-source.md` — K4 catch 패턴 동형 (참조)
- `docs/research-krx-openapi-endpoints-2026-05-04.md` — KRX 31 endpoint 박제
- `docs/research-kis-data-endpoints-2026-04-25.md` — KIS K1~K8 박제 (K12 미조사)
- `docs/research-korea-signals-data-sources-2026-04-25.md` §335 — K12 sectorRet20d 동시 활성화 의제 (KRX 산업별지수 가정)

### 코드 박제
- `lib/signals/korea.ts:69-71` — k12RelativeStrength 공식
- `lib/signals/index.ts:266, 271` — 현 sectorRet20d=0 더미 + K12Live=true
- `lib/signals/returns.ts:4` — calcReturnNd (K12 입력 산정)

---

*박제 only. ADR 009 PROPOSAL 박제 트리거.*
