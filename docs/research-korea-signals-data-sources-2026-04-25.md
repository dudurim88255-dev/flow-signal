# 한국 시장 K1~K8 데이터 소스 종합 비교 조사

**Date**: 2026-04-25  
**Scope**: 조사 only. 코드 무변경, 실 API 호출 X, 인증키 발급 X.  
**Predecessor docs**:
- `docs/diagnosis-korea-signals-2026-04-25.md` (K1~K8 비활성 원인 진단)
- `docs/research-kis-data-endpoints-2026-04-25.md` (KIS Open API 단독 조사)

---

## Executive Summary (한 줄)

후보 4개(KRX OPEN API · KRX 정보데이터 OTP+CSV · 금투협 freesis · KIS Open API) 중 **KRX OPEN API + KIS Open API 하이브리드(안 A)** 가 안정성·법적 명확성·매핑 완결성에서 우위. **KRX OTP+CSV (pykrx 류)는 운영 환경에서 사용 금지** — KRX 가 비공식 스크래핑에 대해 IP 차단을 진행 중.

---

## Section 1: KRX 정보데이터시스템 (data.krx.co.kr) — 비공식 OTP+CSV

### 1-1. 인증/접근 방식

- 패턴: `POST /comm/fileDn/GenerateOTP.cmd` (쿼리 → OTP) → `POST /comm/fileDn/download_csv/download.cmd` (OTP → CSV)
- 세션/쿠키 + **Referer 헤더 필수** (없으면 봇 판정, 데이터 미반환)
- 인증키 없음, 무료
- 자동화: Vercel Edge runtime 가능 (fetch 가능). GitHub Actions 가능. 단 ↓ 1-4 참조.

### 1-2. K1~K8 매핑 가능 데이터

`MDCSTAT*` screenId 기반 화면별 다운로드:

| screenId 군 | 데이터 |
|---|---|
| `MDCSTAT02302` 류 | 외국인 매매 일별 (K1) |
| (동일 screen) | 기관 매매 일별 (K2) |
| `MDCSTAT11102` 류 | 프로그램매매 (K3) |
| `MDCSTAT02201` | 외국인 보유율 (종목별 일별) — **K4 의 1차 출처** |
| `MDCSTAT300` 류 (short.krx 통합) | 공매도 잔고 (K5) |
| `MDCSTAT30101` 류 | 대차거래 (K6) |
| `MDCSTAT09001` 류 | 회원사별 매매 (K8) |

> screenId 정확값은 KRX UI에서 메뉴별로 다르며, 본 조사에서는 카테고리 매핑까지만 확정.

### 1-3. 갱신 주기

- 거의 모든 데이터: 장 마감(15:30) 후 **저녁 6시 이후** 일별 데이터 확정
- 공매도 잔고: T+2 (보고의무 시점 기준 2영업일 후)
- 과거 데이터: 종목별 1~수년치 조회 가능 (메뉴별 상이)

### 1-4. Rate Limit / TOS — **운영 사용 시 주요 리스크**

KRX 공식 입장 (pykrx 이슈 #151 인용):
> pykrx 라이브러리 등을 이용한 과도한 접속이 발생하여 정보데이터시스템 서비스 제공에 지장을 주어 다수의 서비스 이용자에게 불편을 초래하게 되어 **접속차단 조치가 취해졌다**. 향후에도 지속적인 차단조치를 시행할 예정.

- 1초 이상 딜레이 권고 (커뮤니티 컨벤션, 공식 명시 없음)
- 차단 시 **40일 자동 해제** 또는 KRX 데이터사업부 직접 문의
- **Vercel serverless outbound IP 가 차단되면 다른 서비스에도 영향 (IP shared)**
- **상업적 / SaaS 재배포 정책 명시 문서 미발견**. 직접 문의: **KRX 데이터사업부 02-3774-8904**

### 1-5. 알려진 라이브러리

| 라이브러리 | 언어 | 상태 |
|---|---|---|
| `pykrx` (sharebook-kr) | Python | 가장 활발, 커버리지 ↑, **차단 위험 명시** |
| `mr-yoo/pykrx` | Python | 포크, 비활성 |
| `krx-quant-dataloader` | Python | 별 라이브러리 |
| `Shin-JaeHeon/krx-stock-api` (npm) | Node.js | **커버리지 매우 제한적** — Stock 가격 + institutionalInvestor Ask/Bid 정도. 외국인/공매도/대차/신용 등 K1~K8 핵심 미커버 |

**결론**: Node.js / TypeScript 환경에서 pykrx 수준의 커버리지를 가진 npm 라이브러리는 **존재하지 않음**. 직접 fetcher 구현 필요.

---

## Section 2: KRX OPEN API (openapi.krx.co.kr) — **공식 API** ★

### 2-1. 본 조사에서 신규 발견된 핵심

진단 보고서(`diagnosis-korea-signals-2026-04-25.md`)에는 **OTP+CSV 만 언급**됐으나, 별도 도메인 `openapi.krx.co.kr` 에 **KRX 가 공식 OPEN API 를 운영 중**임을 본 조사에서 확인.

### 2-2. 인증/접근

- KRX Data Marketplace 회원가입 (개인: 본인인증/소셜로그인, 법인: 사업자등록증)
- '마이페이지 > API 인증키 신청' → 관리자 승인 (**약 1일**)
- 무료 (본 조사 시점 기준)
- **JSON / XML 응답** — Vercel/Node 와 잘 맞음

### 2-3. 카테고리

페이지에 노출된 카테고리 (정확한 endpoint 목록은 인증키 발급 후 `/contents/OPP/USES/service/OPPUSES002_S1.cmd` 등에서 확인 가능):

- 주식
- 지수
- 증권상품
- 채권
- 파생상품
- 일반상품
- ESG

### 2-4. K1~K8 매핑 — **추정**

OPEN API 의 정확한 endpoint 목록은 **인증키 발급 후 로그인 상태에서만 열람 가능** → 본 조사 범위에서 Konfirm 불가.

추정 (KRX 정보데이터시스템과 동일 데이터 풀 기반이라는 가정):

| K | KRX OPEN API 매핑 가능성 |
|:--:|---|
| K1 외국인 매매 | 매우 높음 (주식 카테고리에 투자자 매매 통계 노출) |
| K2 기관 매매 | 매우 높음 (K1 과 동일 통계) |
| K3 프로그램매매 | 높음 |
| K4 외국인 보유율 | 높음 (KRX 가 1차 출처) |
| K5 공매도 잔고 | 높음 |
| K6 대차잔고 | 높음 |
| K7 신용잔고 | **불확실** — KRX 통계로 종목별 신용잔고 제공 여부 미확정 |
| K8 회원사별/외국계 창구 | 높음 |

### 2-5. Rate Limit / TOS

- 공식 페이지에 명시 미발견 (인증 후 확인 필요)
- 공식 API라 **OTP+CSV 스크래핑과 달리 차단 정책 다름** — 인증키 발급 조건 내에서 안정 사용 가능
- SaaS 재배포 정책: 본 조사에서 명문 발견 못함. **법적 검토 필요** — 데이터사업부 02-3774-8904 또는 `krxdata@krx.co.kr` 문의

### 2-6. 알려진 wrapper

- `raccoonyy/pykrx-openapi` (Python) — KRX OPEN API 공식 인증키 기반 wrapper. 회원가입/인증키 신청 가이드 포함.

---

## Section 3: short.krx.co.kr (공매도 데이터, K5)

### 3-1. 별도 도메인이지만 사실상 통합

검색 결과 short.krx.co.kr 의 메뉴는 `data.krx.co.kr/comm/srt/srtLoader/index.cmd?screenId=MDCSTAT300` 같이 **data.krx.co.kr 내부로 통합**되어 있다. 인증/접근 패턴 동일 (OTP+CSV).

KRX OPEN API 에서도 공매도 카테고리 별도 노출 가능성 (인증 후 확인).

### 3-2. K5 데이터

- 공매도 잔고 (종목별, 일별) — **T+2 공시 지연**
- 공매도 거래량/거래대금 (T+0 가능)
- 대차거래 (K6와 부분 중복 — 별 메뉴)

### 3-3. 갱신

- 잔고: T+2 (보고 의무)
- 거래량: T+0 장 마감 후

---

## Section 4: 금투협 freesis (K7 신용잔고)

### 4-1. 접근

- **공공데이터포털**(`data.go.kr`) 에 "금융투자협회종합통계정보" API 등록 (8개 operation)
- API 키 발급 (공공데이터포털 회원가입 후 즉시)
- 무료
- 응답: XML/JSON

### 4-2. K7 매핑 — **부분만**

8개 operation 중 신용공여 관련:
- ④ 신용공여 잔고 추이 — **시장 전체 추이만**

**종목별 신용잔고는 freesis API 에서 제공하지 않음** → freesis 는 K7 의 보조 지표(시장 전체 추세)로만 활용. **K7 종목별 신용잔고는 KRX OPEN API 또는 KIS Open API 필요**.

### 4-3. 자동화

- 공공데이터포털 표준 REST. Vercel/Node 친화. 인증키 노출 시 위험 낮음 (read-only).

---

## Section 5: 비교 매트릭스

| 항목 | KRX OPEN API | KRX OTP+CSV (data.krx) | short.krx | 금투협 freesis | KIS Open API |
|---|---|---|---|---|---|
| 인증 난이도 | 중 (회원가입+1일 승인) | 낮음 (Referer만) | 낮음 | 낮음 (공공데이터포털 키) | 중 (계좌+신청+OAuth2) |
| **K1 외국인 매매** | ✅ (추정) | ✅ `MDCSTAT02302` | — | — | ✅ `FHKST01010900` |
| **K2 기관 매매** | ✅ (추정) | ✅ (K1 동일) | — | — | ✅ (K1 동일 호출) |
| **K3 프로그램매매** | ✅ (추정) | ✅ `MDCSTAT11102` 류 | — | — | ✅ `FHPPG04600001` |
| **K4 외국인 보유율** | ✅ (추정, KRX 1차 출처) | ✅ `MDCSTAT02201` | — | — | ⚠️ 간접만 |
| **K5 공매도 잔고** | ✅ (추정) | ✅ `MDCSTAT300` 류 | ✅ (data.krx 통합) | — | ✅ `FHPST04830000` |
| **K6 대차잔고** | ✅ (추정) | ✅ `MDCSTAT30101` 류 | — | — | ✅ `daily-loan-trans` |
| **K7 종목별 신용잔고** | ⚠️ 불확실 (인증 후 확인) | ⚠️ 종목별 제공 미확정 | — | ❌ (시장 전체만) | ✅ `daily-credit-balance` |
| **K8 거래원/외국계 창구** | ✅ (추정) | ✅ `MDCSTAT09001` 류 | — | — | ✅ `frgnmem-trade-trend` |
| Rate limit | 미공개 (인증 후 확인) | 명시 X, 1s 권고. **차단 위험** | 동일 | 공공데이터포털 일/월 한도 (보통 10000/일) | **초당 20건** (실전), 토큰 1분 1회 발급 |
| 갱신 주기 | T+0~T+2 (데이터별) | 동일 | T+2 | 일별 | T+0~T+2 (데이터별) |
| 응답 형식 | JSON/XML | CSV | CSV | XML/JSON | JSON |
| 자동화 (Vercel) | 가능 (fetch + 인증키 헤더) | 가능하나 IP 차단 위험 | 동일 | 가능 | 가능 (OAuth2 토큰 + Redis 캐시) |
| 자동화 (GitHub Actions) | 가능 | **권장** (정적 IP 풀 분리 가능) | 동일 | 가능 | 가능 |
| **SaaS 재배포 가능성** | 명시 미확인. KRX 문의 필요 | 동일. **비공식 경로라 위험 큼** | 동일 | 공공데이터 — 통상 재배포 가능 (조항 확인) | TOS 명시 미확인. KIS 문의 필요 |
| 무료/유료 | 무료 (현 시점) | 무료 (인증키 없음) | 무료 | 무료 | 무료 (계좌 필요) |
| **안정성** | **공식 API → 높음** | **차단 위험 → 낮음** | 동일 | 공공데이터 → 높음 | 공식 API → 높음 |
| 흥권님 종속성 | 낮음 (회사/개인 키 모두 가능) | 없음 | 없음 | 낮음 | **높음** (개인 KIS 계좌 키) |

---

## Section 6: 권장 조합 3안

### 안 A — KRX OPEN API + KIS Open API 하이브리드 ★ 추천

| K | 출처 |
|:--:|---|
| K1, K2, K3, K4, K5, K6, K8 | **KRX OPEN API** (1차 출처, 공식) |
| K7 | **KIS Open API** (`daily-credit-balance` — 종목별 신용잔고 명확) |
| (보조) freesis | 시장 전체 신용공여 추세 — K7 confidence 보강용 |

**장점**:
- 양쪽 다 공식 API → 안정·합법성
- KRX OPEN API 가 1차 출처라 K1~K6, K8 의 정확도 최고
- KIS는 최소한의 fallback 역할 (K7 만)
- 흥권님 KIS 키 종속도 낮음

**단점**:
- 두 인증 체계 (KRX 인증키 + KIS App Key) 운영
- KRX 인증키 발급 1일 대기
- KRX 의 정확한 endpoint 매핑 사전 확인 필요 (인증키 발급 후)

**구현 난이도**: 중. fetcher 2종 신설.  
**비용**: 양쪽 무료. 단 SaaS 재배포 정책은 KRX/KIS 양쪽 모두 별도 검토 필요.

---

### 안 B — KIS Open API 단일

| K | 출처 |
|:--:|---|
| K1, K2, K3, K5, K6, K7, K8 | **KIS Open API** |
| K4 | 일단 0 유지 또는 `frgnmem-pchs-trend` 로 간접 추정 |

**장점**:
- 가장 빠른 도입 (단일 인증)
- 흥권님 이미 KIS 계좌 보유 → App Key 즉시 발급 가능
- 응답 JSON 표준
- 모의투자 키로 시세만 받으면 보안 리스크 최소화 가능 (시세 정확성 실측 1회 필요)

**단점**:
- **K4 외국인 보유율 부정확** (간접 추정 또는 비활성)
- 흥권님 개인 키 종속 → BYOK 모델 도입 시까지는 단일 점단위 의존
- KIS App Key 노출 시 주문 권한 노출 (모의투자 키로 완화)

**구현 난이도**: 낮. fetcher 1종 + 토큰 캐시.  
**비용**: 무료.

---

### 안 C — KRX OTP+CSV + 금투협 (저비용/위험)

| K | 출처 |
|:--:|---|
| K1, K2, K3, K4, K5, K6, K8 | KRX OTP+CSV 스크래핑 |
| K7 | 금투협 freesis (시장 전체로 갈음) |

**장점**:
- 인증키 발급 절차 X (즉시 시작)
- pykrx 등 참고 자료 풍부

**단점**:
- **KRX 가 명시적으로 IP 차단 진행 중** → Vercel outbound IP 차단 시 서비스 마비
- 차단 해제 40일 → SLA 불가
- TOS 모호 (비공식 경로) → SaaS 재배포 시 법적 리스크
- K7 종목별 미제공 (시장 전체로 갈음 → 신호 정확도↓)
- **운영 환경 권장 X** (개인 분석/실험에만 적합)

**구현 난이도**: 중하. CSV 파싱 + Referer/세션 처리.  
**비용**: 무료. 단 차단 발생 시 다운타임 = 40일.

---

## Section 6-2: 흥권님 결정 필요 사항

| # | 결정 사항 | 옵션 | 비고 |
|---|---|---|---|
| 1 | **인증키 발급 의지** | (a) KRX OPEN API 만 / (b) KIS 만 / (c) 둘 다 | 안 A 선택 시 (c). 안 B 선택 시 (b). |
| 2 | **KIS 계좌 종류** | 모의투자 / 실전 | 모의로 시세 가능 여부 1회 실측 필요. 모의가 가능하면 보안 리스크 최소화. |
| 3 | **TOS / SaaS 재배포 위험 감수도** | (a) 공식 API 만 사용 / (b) 사용자별 BYOK 모델 / (c) KRX/KIS 데이터사업부 직접 문의 후 라이선스 협의 | FlowSignal 이 SaaS 화될 경우 (b) 또는 (c) 권장. 본 조사에서 양쪽 명문 정책 미발견. |
| 4 | **K4 의 우선순위** | (a) 정확히 충족 (KRX 사용) / (b) 간접 추정 (KIS frgnmem) / (c) 비활성 유지 | K4 weight=8 (전체 100 중). 충족 시 한국 시장 가중치 8점 추가 활성. |
| 5 | **인프라 마이그레이션 의지** | Vercel Hobby 유지 / Vercel Pro 업그레이드 / GitHub Actions 이전 / 별도 서버 | maxDuration 10 s 한도 + cron 2개 한도 (진단 Scenario A·B) — K1~K8 도입 시 거의 확실히 한 번은 결정 필요. |
| 6 | **비용 부담 의향** | 무료만 / Vercel Pro $20/월 / KRX 데이터 라이선스 협의 | 본 조사 시점 모든 후보 무료. Pro 업그레이드 시 cron 한도 + maxDuration 60 s. |
| 7 | **종목 확장 계획** | 30개 / 100개 / 1000개 | KIS 30종목×7타입=210호출/회 (11s). 1000종목 시 7000호출 → KIS rate limit (초당 20건) 6분. cron 단일 호출에 부담. |

---

## Section 7: 인프라 영향 분석

### 7-1. 호출량 증가

현재 KOSPI 10종목 (`HARVEST_TARGETS` 기준), 신호당 1회 호출 가정:

| 종목 수 | K1~K8 추가 호출/일 | KIS rate (초당 20) | KRX OPEN API (제한 미공개, 1초 간격 가정) |
|---|---|---|---|
| 10 | ~70 | 3.5 s | 70 s |
| 30 | ~210 | 11 s | 210 s |
| 100 | ~700 | 35 s | 700 s |
| 1000 | ~7000 | 350 s = **5.8 분** | **117 분** |

> "타입"은 K1+K2 1콜, K3 1콜, K4 1콜, K5 1콜, K6 1콜, K7 1콜, K8 2콜 가정 = 8콜. K1+K2 합산 호출이라 7~8 콜.

### 7-2. Vercel Hobby 한계와의 충돌

진단 보고서(`diagnosis-phase-a-2026-04-15.md`) Scenario A, B:

- **Cron 2개 한도** (현재 6개 선언, Hobby에서는 2개만 활성) — 이미 P0 진단된 별개 이슈
- **`maxDuration` 10 s 한도** (Hobby) — 30종목 KIS 호출은 11초 → **이미 한도 초과**
- 100종목 이상이면 Vercel Hobby 로 불가능

→ **K1~K8 도입과 동시에 인프라 결정 필요**:

| 옵션 | cron 한도 | maxDuration | 비용 |
|---|---|---|---|
| Vercel Hobby (현재) | 2 | 10 s | $0 |
| Vercel Pro | 무제한 | 60 s (Edge 30 s, Node 60 s, 또는 fluid compute 더 김) | $20/월 |
| GitHub Actions cron | 무제한 (10분 minimum interval) | 6시간 | $0 (public) |
| 별도 worker (Railway, Fly 등) | 무제한 | 무제한 | $5~/월 |

**권장**: 안 A/B 채택 + GitHub Actions 로 harvest 이전. KRX OPEN API 호출이 시간이 더 걸리는 안 A 일수록 GitHub Actions 가 적합.

### 7-3. 캐시 전략 제안

- **KIS access_token**: Redis `kis:access_token` (24h TTL, 23h 경과 시 갱신, distributed lock 으로 1분 재발급 제한 회피)
- **KRX 인증키**: 헤더 토큰만 — 만료 X (단, KRX 정책 변경 가능)
- **일별 raw 데이터**: Redis `kis:flow:{ticker}:{date}` (24h TTL) 또는 `krx:flow:{ticker}:{date}`. cron 1회 fetch → harvest/score 모두 read-only 재사용
- **계산된 K1~K8 score**: 기존 `score:v3:korea:{ticker}` 캐시(10 분)에 자연 흡수
- **장 휴장일 대응**: KIS `chk-holiday` 또는 KRX 캘린더 1회 fetch → `holidays:2026` 키 1년 TTL

---

## Section 8: 다음 단계 제안 — ADR 006 초안 항목

본 보고서가 의사결정의 인풋. 흥권님 결정 후 ADR 006 작성 항목 후보:

1. **데이터 소스 결정** — 안 A / B / C 중 어느 것
2. **인증 발급 절차** — KRX OPEN API 회원가입 + 인증키 신청 / KIS App Key 발급 (모의 vs 실전)
3. **인프라 마이그레이션** — Vercel Hobby 유지 / Pro 업그레이드 / GitHub Actions 이전
4. **fetcher 신설 위치** — `lib/signals/fetcher.ts` 확장 vs `lib/signals/fetchers/{kis,krx}/*.ts` 분리
5. **캐시 키 스키마** — Redis 키 네이밍 규칙
6. **장애 폴백 정책** — fetch 실패 시 last-good-known / 더미 / `live: false` 전환 + risk_flags 부착
7. **휴장일/T+1·T+2 지연 데이터 confidence 표시** — Phase A P2 RFC 와 정합성
8. **SaaS 재배포 라이선스 검토** — KRX/KIS 데이터사업부 문의 결과 정리
9. **K12 sectorRet20d 동시 활성화** — 섹터 closes fetcher (KRX 산업별지수) 신설
10. **마이그레이션 계획** — 기존 dummy 값에서 live 값 전환 시 베이스라인(4/27) 영향. 더미 → 실값 전환 시점 prediction 의 outcome 평가 분리 정책

---

## Section 9: 본 조사가 못 다룬 것 (한계)

- **KRX OPEN API 의 정확한 endpoint 목록**: 회원가입 + 인증키 발급 후에만 노출. 본 조사에서는 카테고리 매핑까지만 확정.
- **KRX/KIS 의 SaaS 재배포 정책**: 양쪽 모두 명문 정책 미발견. 데이터사업부 직접 문의 필요.
- **모의투자 KIS 계좌의 시세 정확도**: 실측 미수행.
- **KIS API 의 정확한 일일 호출 한도**: 초당 20건은 확정. **일별 한도** 명시 미발견.
- **각 후보의 실제 응답 latency / 가용성 (uptime)**: 운영 데이터 없음. 도입 후 모니터링 필요.

---

## Sources (URL + 접근일자 2026-04-25)

### KIS Open API (재참조)
- [KIS Developers 공식 포털](https://apiportal.koreainvestment.com/apiservice)
- [koreainvestment/open-trading-api 공식 SDK](https://github.com/koreainvestment/open-trading-api)
- 본 보고서와 별도: `docs/research-kis-data-endpoints-2026-04-25.md`

### KRX 정보데이터시스템 / OTP+CSV
- [KRX Data Marketplace](https://data.krx.co.kr/)
- [pykrx GitHub](https://github.com/sharebook-kr/pykrx)
- [pykrx Issue #151 — KRX 공식 차단 입장](https://github.com/sharebook-kr/pykrx/issues/151)
- [pykrx Issue #170 — IP 차단 사례](https://github.com/sharebook-kr/pykrx/issues/170)
- [퀀트 쿡북 — OTP+CSV 패턴 설명](https://hyunyulhenry.github.io/quant_cookbook/%EA%B8%88%EC%9C%B5-%EB%8D%B0%EC%9D%B4%ED%84%B0-%EC%88%98%EC%A7%91%ED%95%98%EA%B8%B0-%EA%B8%B0%EB%B3%B8.html)

### KRX OPEN API (공식)
- [KRX OPEN API 포털](https://openapi.krx.co.kr/)
- [서비스 소개](https://openapi.krx.co.kr/contents/OPP/INFO/OPPINFO001.jsp)
- [서비스 이용방법](https://openapi.krx.co.kr/contents/OPP/INFO/OPPINFO003.jsp)
- [주식 카테고리](https://openapi.krx.co.kr/contents/OPP/USES/service/OPPUSES002_S1.cmd) (회원가입 후 endpoint 목록 노출)
- [raccoonyy/pykrx-openapi (공식 API wrapper)](https://github.com/raccoonyy/pykrx-openapi)

### short.krx.co.kr
- [공매도 통계 포털](https://short.krx.co.kr/)
- [개별 종목 공매도 종합정보](https://data.krx.co.kr/comm/srt/srtLoader/index.cmd?screenId=MDCSTAT300&isuCd=033640)

### 금투협 freesis
- [freesis 포털](https://freesis.kofia.or.kr/)
- [신용공여 잔고 추이](https://freesis.kofia.or.kr/stat/FreeSIS.do?parentDivId=MSIS10000000000000&serviceId=STATSCU0100000070)
- [공공데이터포털 — 금투협 종합통계 API](https://www.data.go.kr/data/15094809/openapi.do)

### Node.js / TypeScript 대안
- [Shin-JaeHeon/krx-stock-api (npm) — 커버리지 제한적](https://github.com/Shin-JaeHeon/krx-stock-api/blob/master/README.md)

### 인프라 한계 (재참조)
- 본 보고서와 별도: `docs/diagnosis-phase-a-2026-04-15.md` (Vercel Hobby cron 2개·maxDuration 10s)

---

*조사 only. 결정은 흥권님 → ADR 006 작성 → fetcher 구현 순서.*
