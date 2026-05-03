# KRX OPEN API endpoint 박제 — Phase 1 키 발급 후 portal 실측 (2026-05-04)

**Date**: 2026-05-04
**Trigger**: ADR 006 §Open Q #2 — "OPEN API 의 정확한 endpoint 목록은 인증키 발급 후 로그인 상태에서만 열람 가능" → 흥권 키 발급 완료 (2026-05-04) 후 portal 실측 박제.
**Scope**: 박제 only. 코드 수정 X. ADR 006 전제 검증 결과 박제 + 후속 ADR PROPOSAL 트리거.
**Predecessor docs**:
- `docs/adr/006-korea-signals-data-sources.md` (가설 기반, K1~K8 → KRX OPEN API 매핑 추정)
- `docs/research-korea-signals-data-sources-2026-04-25.md` (조사 보고, ADR 006 의 매핑은 추정 명시)
- `docs/research-kis-data-endpoints-2026-04-25.md` (KIS 단독 조사 — K1~K8 중 7개 KIS 제공 박제)

---

## TL;DR

**ADR 006 전제 fundamental 오류 catch.**

흥권 portal 실측 결과: KRX OPEN API 31개 endpoint 전체가 **OHLCV / 종목기본정보 / 시세 데이터** 만 제공.
ADR 006 가 가정한 "K1~K8 (외국인/기관/공매도/대차/신용/거래원) → KRX OPEN API" 매핑은 **0건 미제공**.
→ KRX OPEN API 의 K1~K8 활용 가능성은 **K12 (산업별지수)** 한 가지만 남음.

**결과**: ADR 006 안 A "KRX OPEN API + KIS Open API 하이브리드" 결정의 KRX 측 가정 부정 → ADR PROPOSAL 재정비 필요 (별 docs).

---

## 1. KRX OPEN API 31개 endpoint 카테고리 분포

흥권 portal 실측 (2026-05-04, https://openapi.krx.co.kr/ 로그인 후 카테고리별 endpoint 목록 페이지 확인):

| 카테고리 | endpoint 수 | 데이터 종류 |
|---|---:|---|
| 지수 | 5 | 산업별지수 / 시장지수 OHLCV |
| 주식 | 8 | 종목 OHLCV / 종목기본정보 / 시가총액 등 |
| 증권상품 | 3 | ETF/ETN/ELW 시세 |
| 채권 | 3 | 채권 시세 |
| 파생상품 | 6 | 선물/옵션 시세 |
| 일반상품 | 3 | 금/유 시세 |
| ESG | 3 | ESG 평가 / 채권 |
| **합계** | **31** | **모두 OHLCV / 종목기본정보 / 시세** |

### K1~K8 데이터 범주 (외국인/기관/공매도/대차/신용/거래원) 제공 여부

| K | 신호 | KRX OPEN API 제공 | 기존 ADR 006 가정 |
|---|---|:--:|:--:|
| K1 | 외국인 순매수 | ❌ | ✅ (가정) |
| K2 | 기관 순매수 | ❌ | ✅ (가정) |
| K3 | 프로그램매매 | ❌ | ✅ (가정) |
| K4 | 외국인 보유율 Δ | ❌ | ✅ (가정) — ADR §Decision §2 명시 |
| K5 | 공매도 잔고 | ❌ | ✅ (가정) |
| K6 | 대차잔고 | ❌ | ✅ (가정) |
| K7 | 신용잔고 | ❌ | KIS 명시 |
| K8 | 외국계 창구 | ❌ | ✅ (가정) |
| K12 | 산업별지수 (sectorRet20d) | ✅ (지수 카테고리 5개 중) | ✅ |

→ **K1~K8 = 0/8 KRX OPEN API 미제공.** ADR 006 의 KRX 측 매핑 전부 부정.

---

## 2. 31개 endpoint 정확 명세 (박제 미완)

본 박제 시점에 흥권이 제공한 정보는 **카테고리 분포 + 미제공 데이터 범주** 까지. 31개 endpoint 의 정확한 이름 / URL / query parameters / response schema / 인증 헤더 / rate limit 은 **미박제**.

### 박제 필요 항목 (다음 세션 흥권 작업)

각 31개 endpoint 별:
- endpoint 이름
- URL path (예: `/svc/...` 또는 `/v1/...`)
- query parameters (ticker / 기간 / paging 형식)
- response JSON schema (key 이름 + type)
- TR_ID 또는 동등 식별자 (있다면)
- rate limit (호출 간격 / 일별 한도)
- 휴장일 처리 응답

### 박제 우선순위

본 cycle 결정 (ADR PROPOSAL 후) 에 따라 박제 우선순위 변경:
- **K12 활용 결정 시**: "지수" 카테고리 5개 endpoint 우선 박제 (산업별지수 정확 path 식별)
- **OHLCV 활용 결정 시**: "주식" 카테고리 8개 endpoint 우선 박제 (Yahoo Finance 대체 가능성 검토)

---

## 3. screenshot 9건 (흥권 첨부 — path 박제 미완)

흥권 portal 캡처 9건 path 박제 placeholder:

| # | 캡처 대상 | 경로 박제 | 박제 시점 |
|---|---|---|---|
| 1 | 인증키 관리 페이지 | TBD | 다음 세션 |
| 2 | 카테고리 목록 (지수 5) | TBD | |
| 3 | 카테고리 목록 (주식 8) | TBD | |
| 4 | 카테고리 목록 (증권상품 3) | TBD | |
| 5 | 카테고리 목록 (채권 3) | TBD | |
| 6 | 카테고리 목록 (파생상품 6) | TBD | |
| 7 | 카테고리 목록 (일반상품 3) | TBD | |
| 8 | 카테고리 목록 (ESG 3) | TBD | |
| 9 | endpoint 상세 페이지 (대표 1건) | TBD | |

흥권 첨부 후 path 박제 → 본 docs update.

---

## 4. ADR 006 영향 분석

### 4-1. 부정된 결정

| ADR 006 결정 # | 항목 | 결정 | 본 박제 후 상태 |
|:--:|---|---|---|
| 1 | 데이터 소스 조합 | 안 A 하이브리드 (KRX + KIS) | KRX 측 K1~K8 미제공 → 안 A 의 KRX 부분 무의미 |
| 2 | K1, K2, K3, K4, K5, K6, K8 출처 | KRX OPEN API | **부정** (KRX OPEN API 미제공) |
| 3 | K7 출처 | KIS Open API | 유지 (KIS 박제 정합) |
| 4 | KRX OTP+CSV 금지 | 금지 | 유지 (IP 차단 정책) |
| 5 | 인프라 GitHub Actions | 유지 | 유지 |
| 6 | KIS 모의투자 우선 | 유지 | 유지 |
| 7 | 종목 확장 단계 | 유지 | 유지 |

추가 결정:
- **K12 sectorRet20d**: KRX OPEN API "지수" 카테고리 5개 endpoint 중 산업별지수로 매핑 가능 → 유지

### 4-2. K1~K8 데이터 출처 재정비 후보

| K | 신호 | KIS 제공 (기 박제) | 새 권장 |
|---|---|:--:|---|
| K1 | 외국인 순매수 | ✅ `inquire-investor` (FHKST01010900) | KIS |
| K2 | 기관 순매수 | ✅ 동일 호출 (외국인+기관 함께) | KIS |
| K3 | 프로그램매매 | ✅ `comp-program-trade-daily` (FHPPG04600001) | KIS |
| K4 | 외국인 보유율 Δ | ⚠️ 간접만 (`frgnmem-pchs-trend` 누적 산출) | **결정 분기** (§4-3) |
| K5 | 공매도 잔고 | ✅ `daily-short-sale` (FHPST04830000) | KIS |
| K6 | 대차잔고 | ✅ `daily-loan-trans` | KIS |
| K7 | 신용잔고 | ✅ `daily-credit-balance` | KIS (ADR 006 결정 #3 유지) |
| K8 | 외국계 창구 | ✅ `frgnmem-trade-trend` + `inquire-member-daily` | KIS |
| K12 | 산업별지수 | KRX OPEN API "지수" 카테고리 | KRX OPEN API |

### 4-3. K4 결정 분기 (ADR PROPOSAL 핵심 의제)

ADR 006 §Decision §2 + research-kis §2 양쪽 모두 K4 = "KRX `MDCSTAT02201` (정보데이터시스템 OTP+CSV)" 권장. 본 박제 후 KRX OPEN API 미제공 확정 + ADR §1-4 OTP+CSV 운영 금지 정책 → K4 안전한 출처 0건.

| 옵션 | 출처 | 정확도 | 리스크 | weight 영향 |
|---|---|---|---|---|
| **K4-A** | live: false (포기) | — | 0 | -8 (K4 weight 8 손실) |
| **K4-B** | KIS `frgnmem-pchs-trend` 간접 누적 산출 + confidence="low" | 낮음 (스타팅 포인트 누적 오차) | 0 | 부분 (confidence low 가중) |
| **K4-C** | KRX OTP+CSV `MDCSTAT02201` 강행 + IP 차단 모니터링 | 높음 | 높음 (40일 다운타임 + ADR §1-4 정책 위반) | 정확 |
| **K4-D** | 금투협 freesis / 공공데이터포털 재조사 | TBD | TBD | TBD |
| **K4-E** | KRX 데이터사업부 02-3774-8904 직접 문의 (보유율 별 endpoint 가능 여부) | TBD | 0 | TBD |

→ ADR PROPOSAL 에서 흥권 결정 분기.

---

## 5. 본 박제 정신

### 5-1. ADR 006 전제 오류의 가치

ADR 006 §Decision §2 + research-korea §2-4 모두 KRX OPEN API K1~K8 매핑을 **추정 명시** (회원가입 후 미확인 상태에서 결정). 흥권 키 등록 + portal 실측 = 추정 검증 cycle 의 자연 도착.

ADR 006 §Open Q #2 = 본 박제로 정확히 답변. ADR 정신 정합.

### 5-2. 추측 박제 X 정신 정합

ADR 006 박제 시점 (2026-04-25) 의 가정 기반 결정 → portal 실측 (2026-05-04) 후 가정 검증 → 부정 결과 박제 + 후속 PROPOSAL 트리거. **추측 박제 후 검증 cycle** = 본 정신 정합.

### 5-3. 부분 진입 commit (`1eabbe7`) 의 가치

본 PR 직전 commit `1eabbe7` (auth.ts 골격 + ADR Status Accepted + 변수명 정합) 은:
- auth.ts = K12 KRX OPEN API 활용 시 그대로 사용 가능 (재활용)
- ADR Status Accepted = ADR 006 의 부분 결정 (K12, GitHub Actions 이전, KIS K7 등) 은 유지
- 변수명 정합 = KRX OPEN API 사용 시 `KRX_API_KEY` 그대로 활용

→ `1eabbe7` 폐기 X. K12 + KIS K1~K8 재정비 후 그대로 활용.

---

## 6. 다음 단계

### 6-1. 흥권 작업 (다음 세션)

1. **screenshot 9건 path 박제** — 본 docs §3 의 TBD 채움
2. **31개 endpoint 정확 명세 박제** — portal 에서 카테고리별 endpoint 클릭 → URL/params/schema/headers/rate limit 캡처/복붙
3. **K4 결정** (§4-3 옵션 A/B/C/D/E)
4. **ADR PROPOSAL 검토 + 결정**

### 6-2. Claude 작업 (본 cycle)

1. ✅ KIS endpoint research 재read (`docs/research-kis-data-endpoints-2026-04-25.md` — K1~K8 중 7개 KIS 제공 박제)
2. ✅ research-krx-openapi-endpoints-2026-05-04.md 박제 (본 docs)
3. **다음**: ADR 007 (or ADR 006 supersede) PROPOSAL 박제 — KIS 우선 + KRX K12 + K4 분기
4. **commit X** — 흥권 ADR 결정 후 별 cycle 에서 fetcher 박제

---

## References

### 본 박제 trigger
- ADR 006 §Open Q #2 — endpoint 목록 portal 실측 의무
- 흥권 키 발급 (2026-05-04, ADR Status Accepted)

### 연관 문서
- `docs/adr/006-korea-signals-data-sources.md` — 본 박제로 §Decision §1, §2 부정
- `docs/research-korea-signals-data-sources-2026-04-25.md` §2-4 — 매핑 추정 명시 부분 검증
- `docs/research-kis-data-endpoints-2026-04-25.md` — KIS K1~K8 중 7개 직접 제공 박제

### 외부
- KRX OPEN API portal — https://openapi.krx.co.kr/
- KRX 데이터사업부 — 02-3774-8904 (K4 보유율 endpoint 가능 여부 문의)

---

*박제 only. 코드 변경 없음. ADR PROPOSAL 후 흥권 결정 → 별 cycle 에서 fetcher 박제.*
