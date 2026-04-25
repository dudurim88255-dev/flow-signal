# KIS Open API — 시세/수급 데이터 엔드포인트 조사

**Date**: 2026-04-25  
**Scope**: 조사 only. 코드 수정 X, 실제 API 호출 X.  
**Trigger**: `docs/diagnosis-korea-signals-2026-04-25.md` 후속. K1~K8 데이터 공급 옵션으로 KIS Open API 가능성 검토.

> **FlowSignal 정체성 재확인**: 시그널 제공 서비스. 매매 집행 X. KIS API는 **데이터 수집용으로만** 검토. 주문 엔드포인트(`/uapi/domestic-stock/v1/trading/order-cash` 등)는 본 조사 범위 외이며 영원히 사용 안 함.

---

## TL;DR

K1~K8 중 **K4(외국인 보유율 변화) 1개를 제외한 7개**가 KIS Open API의 무료 시세/시세분석 엔드포인트로 직접 매핑 가능. 인증은 OAuth2 client_credentials, rate limit 초당 20건 (계좌당). K4는 KIS 직접 제공 약함 → **KIS + KRX(`MDCSTAT02201`) 하이브리드**가 안정적.

---

## 1. KIS Open API 기본 정보

| 항목 | 내용 | 근거 |
|---|---|---|
| 포털 | https://apiportal.koreainvestment.com/apiservice | 공식 |
| 공식 SDK | https://github.com/koreainvestment/open-trading-api | Python 샘플 (`examples_llm/domestic_stock/`) |
| 인증 | OAuth2 client_credentials (App Key + App Secret → access_token, 24h 유효) | 검색 결과 + 공식 SDK |
| 토큰 재발급 | **1분당 1회** 제한 | hky035 블로그, python-kis 라이브러리 README |
| Rate limit | **초당 20건** (실전 계좌). 모의투자 계좌는 더 낮음 | 위와 동일 |
| 무료 여부 | **무료**. 단 KIS 증권 계좌 개설 + Open API 서비스 신청 필요 | apiportal 안내 |
| 주문 엔드포인트 사용 | **불필요** — 본 조사는 시세/수급 read-only 한정 | FlowSignal 정체성 |
| HTTP 메서드 | GET (시세 read-only) | 공식 SDK 코드 패턴 |
| 응답 형식 | JSON (`output` / `output1` + `output2` 두 패턴) | 샘플 코드 확인 |
| 공통 헤더 | `authorization: Bearer {token}`, `appkey`, `appsecret`, `tr_id`, `custtype` | 공식 SDK |

### URL 패턴

`/uapi/domestic-stock/v1/quotations/{kebab-case-endpoint}`

예시 (직접 확인됨):
- `/uapi/domestic-stock/v1/quotations/inquire-investor` (TR_ID `FHKST01010900`)
- `/uapi/domestic-stock/v1/quotations/daily-short-sale` (TR_ID `FHPST04830000`)
- `/uapi/domestic-stock/v1/quotations/comp-program-trade-daily` (TR_ID `FHPPG04600001`)

### 계좌 개설 + API 신청 절차 (운영 측면)

1. KIS 증권 계좌 개설 (비대면 가능)
2. KIS Developers 가입 (https://apiportal.koreainvestment.com)
3. 본인 계좌 연결 → App Key + App Secret 발급
4. 모의투자 신청 (테스트용, 호출제한 낮음)
5. 실전 계좌 신청 (rate limit 초당 20건 풀 적용)

**FlowSignal 운영 시 결정 포인트**: 흥권님 개인 계좌의 App Key를 server env에 보관. 키 노출 시 주문 권한도 함께 노출되므로 (주문은 별도 호출이지만 키는 동일) **read-only 하위 키 발급 옵션 여부 확인 필요** — 현재 KIS는 권한 분리 키를 명시적으로 제공하지 않음. **이게 ADR 결정 시 가장 큰 보안 리스크.**

---

## 2. K1~K8 매핑 표

| K | 신호명 | KIS 엔드포인트 | TR_ID | 매핑 |
|---|---|---|---|:--:|
| K1 | 외국인 순매수 | `inquire-investor` (종목별 투자자) | `FHKST01010900` | ✅ 직접 |
| K1 보조 | 〃 | `investor-trade-by-stock-daily` (종목별 일별) | (폴더 존재, TR_ID 미확인) | ✅ |
| K1 보조 | 〃 | `foreign-institution-total` (외국인+기관 합) | (폴더 존재) | ✅ |
| K2 | 기관 순매수 | `inquire-investor` 동일 (외국인+기관 같이 반환) | `FHKST01010900` | ✅ 직접 |
| K3 | 프로그램매매 | `comp-program-trade-daily` (일별) | `FHPPG04600001` | ✅ 직접 |
| K3 보조 | 〃 | `comp-program-trade-today` (당일) | (폴더 존재) | ✅ |
| K3 보조 | 〃 | `investor-program-trade-today` | (폴더 존재) | ✅ |
| K4 | 외국인 보유율 Δ | `frgnmem-pchs-trend` (외국계 회원사 매수 추이 — 보유율 직접 X) | (폴더 존재) | ⚠️ 간접 |
| K5 | 공매도 잔고 | `daily-short-sale` | `FHPST04830000` | ✅ 직접 |
| K6 | 대차잔고 | `daily-loan-trans` (대차거래 일별) | (폴더 존재, TR_ID 미확인) | ✅ |
| K7 | 신용잔고 | `daily-credit-balance` (신용잔고 일별) | (폴더 존재) | ✅ |
| K7 보조 | 〃 | `credit-balance`, `credit-by-company` | (폴더 존재) | ✅ |
| K8 | 외국계 창구 집중도 | `frgnmem-trade-trend` (외국계 매매 추이) | (폴더 존재) | ✅ |
| K8 보조 | 〃 | `inquire-member-daily` (회원사 일별) | (폴더 존재) | ✅ |

> TR_ID "(폴더 존재)" 표기는 공식 SDK 의 `examples_llm/domestic_stock/{이름}/` 폴더에 샘플 .py 파일이 있어 엔드포인트 자체는 확인됨. 정확한 TR_ID 코드값은 본 조사에서 모든 폴더를 열어보지 않음 (조사 범위 비례). 구현 시점에 각 샘플 파일 1줄로 확인 가능.

### K4 의 한계

KIS Open API 의 외국인 관련 엔드포인트는 모두 **거래·수급 흐름**(매수액, 매도액, 순매수)에 초점. **"외국인 보유 주식 수 / 발행 주식 수"** 비율을 직접 일별 값으로 반환하는 엔드포인트는 본 조사에서 확인되지 않음.

대안:
- **KRX 정보데이터시스템 `MDCSTAT02201`** (외국인 보유 종목별, 일별) — 보유 주식수와 외국인 보유율 직접 제공.
- KIS 의 `frgnmem_pchs_trend` + 이전 보유율 누적 계산으로 간접 산출 — 정확도 낮음 (스타팅 포인트 모르면 누적 오차).

→ **K4 만 KRX, 나머지 K1/K2/K3/K5/K6/K7/K8 은 KIS** 권장.

---

## 3. KIS vs KRX 비교

| 측면 | KIS Open API | KRX 정보데이터 |
|---|---|---|
| 인증 | OAuth2 (App Key + Secret + Token) | 무인증 (OTP 토큰만 1회 발급 후 CSV 다운로드) |
| 응답 형식 | JSON 표준 | CSV (form-data POST 후 다운로드) |
| 안정성 | 높음 (공식 API, 명세서 존재) | 중간 (HTML/CSV 포맷 변경 가능, IP 차단 가능) |
| Rate limit | 명시: 초당 20건 (계좌당) | 명시 없음 (무리하게 호출 시 IP 차단) |
| 응답 속도 | 빠름 (수백 ms) | 중간 (OTP 발급 → CSV 다운로드, 1~3초) |
| 무료 여부 | 무료 (계좌+신청 필요) | 무료 (인증 불필요) |
| 종목별 일별 외국인 매매 | ✅ | ✅ (`MDCSTAT02302`) |
| 종목별 외국인 보유율 | ❌ (간접만) | ✅ (`MDCSTAT02201`) — **KIS 보다 우위** |
| 종목별 신용잔고 | ✅ | ⚠️ KRX 는 시장 전체만 명확. 종목별은 금투협 freesis 필요 |
| 공매도 잔고 | ✅ | ✅ (별 도메인 short.krx.co.kr) |
| 거래원/회원사별 | ✅ | ✅ (`MDCSTAT09001`) |
| 데이터 시점 (T+0/T+1) | T+0 (장중·장 종료 즉시) — 공매도는 T+2 | T+0 ~ T+2 (자료에 따라) |
| 운영 리스크 | App Key 노출 시 주문 권한 함께 노출 가능성 | 인증 키 자체가 없어 노출 리스크 없음 |

### KIS 만 제공 / KRX 만 제공

| 카테고리 | KIS only | KRX only | 양쪽 다 |
|---|---|---|---|
| 외국인/기관 일별 매매 | — | — | 양쪽 |
| 외국인 **보유율** | — | ✅ (`MDCSTAT02201`) | KRX 만 직접 |
| 프로그램매매 | — | — | 양쪽 |
| 공매도 잔고 | — | — | 양쪽 (KRX는 별 도메인) |
| 대차잔고 | — | — | 양쪽 |
| 신용잔고 (종목별) | ✅ | — | KIS 만 (KRX는 시장 전체) |
| 거래원 (회원사) | ✅ | ✅ | 양쪽 |
| 실시간 시세 (호가/체결) | ✅ (WebSocket) | — | KIS 만 |
| 외국계 회원사 별도 분류 | ✅ (`frgnmem_*` prefix) | ⚠️ 회원사 코드 매핑 필요 | KIS 가 더 명확 |

**결론**: 종목별 신용잔고 + 외국계 회원사 분류 측면에서 KIS 가 우위. 외국인 보유율 한 가지 측면에서 KRX 가 우위. **하이브리드 설계가 합리적.**

---

## 4. 운영 시 고려사항

### 1) Rate limit 산정

- 한국 종목 30개 (현재 harvest 대상) × 데이터 종류 7개 (K1~K3, K5~K8) = **210 호출/일**
- 초당 20건 → 11초면 완료. 실전 계좌 한도로 충분.
- 30분 단위 갱신 시도해도 한도 내. 진단 문서의 Vercel cron 1일 1회면 여유.
- harvest 안에서 호출 시 KIS 와 다른 외부 호출(Yahoo, CoinGecko, Binance) 합산 시간 체크 필요. 현재 maxDuration=300, Hobby plan 10초 제약과 별개 이슈.

### 2) 토큰 관리

- access_token 24h 유효 → cron 실행마다 재발급 불필요.
- 1분당 1회 발급 제한 → **Redis 에 토큰 + expires_at 캐싱** 필요 (`kis:access_token`).
- 만료 임박 (예: 23h 경과) 시 갱신.
- 토큰 재발급은 idempotent 가 아니므로 cron 동시 실행 시 race condition 주의.

### 3) 보안

- App Key + App Secret 은 **주문 권한 포함**. 노출 시 자산 탈취 가능.
- Vercel env vars 에 보관, 로그/응답 어디에도 echo 금지.
- **권장**: 별도 모의투자 계좌 키 사용 — 모의투자 키로도 시세는 동일하게 받을 수 있음 (rate limit 만 낮음). 흥권님 개인 자산 보호.
- 모의투자 계좌의 시세 데이터 정확성·딜레이 검증 필요 (구현 전 1회 비교).

### 4) 시장 마감 처리

- 일별 데이터(공매도, 대차, 신용잔고)는 **다음 영업일 새벽** 갱신.
- harvest cron 시각이 KST 10:00 (UTC 01:00) 인데, 일부 일별 데이터는 KST 18시 이후 확정.
- → **하루 지연된 값으로 신호 산출**. 프로덕션 도입 시 명시적 표시 필요 (예: K5 confidence="med" with reason="t+1_data").

### 5) 휴장일

- 주말/공휴일 cron 실행 시 빈 결과 반환 → fetcher 가 last-good-known 값으로 폴백 또는 confidence="low" 처리.
- KIS `chk-holiday` 엔드포인트로 휴장일 판단 가능.

---

## 5. 요약 표 (최종 권고)

| K | 권장 데이터 소스 | 이유 |
|:--:|---|---|
| K1 외국인 순매수 | KIS `inquire-investor` (`FHKST01010900`) | 직접·빠름·JSON |
| K2 기관 순매수 | KIS `inquire-investor` 동일 호출 (외국인+기관 함께 반환) | 1회 호출 2 신호 |
| K3 프로그램매매 | KIS `comp-program-trade-daily` (`FHPPG04600001`) | 직접 |
| K4 외국인 보유율 | **KRX `MDCSTAT02201`** | KIS 직접 제공 약함 |
| K5 공매도 잔고 | KIS `daily-short-sale` (`FHPST04830000`) | 직접 (T+2 지연 양쪽 동일) |
| K6 대차잔고 | KIS `daily-loan-trans` | 직접 |
| K7 신용잔고 | KIS `daily-credit-balance` | 종목별로 KIS 가 더 명확 |
| K8 외국계 창구 | KIS `frgnmem-trade-trend` + `inquire-member-daily` | 외국계 회원사 prefix `frgnmem_*` 가 분류 메타 내장 |

### 도입 시 ADR 006 가 다뤄야 할 항목 (요약, 본 보고는 ADR 작성 X)

1. KIS App Key 보관 위치 + 모의투자 vs 실전 계좌 결정
2. Redis 토큰 캐시 키 스키마 + 동시성
3. KIS 호출 실패 시 폴백 (last-good-known / 더미 / live=false)
4. Rate limit 초과 시 backoff 정책
5. KRX `MDCSTAT02201` (K4 전용) 별도 fetcher 신설
6. 휴장일 / T+1·T+2 지연 데이터의 confidence 표시 규칙
7. (장기) FlowSignal 다중 사용자 확장 시, 각 사용자가 본인 KIS 키를 입력해 본인 데이터로 평가받는 BYOK 모델 가능성 — 본 조사 범위 외

---

## 6. 본 보고서가 다루지 않은 것

- 각 폴더 (`investor_trade_by_stock_daily`, `daily_loan_trans`, `daily_credit_balance` 등) 의 **정확한 TR_ID 값** — 구현 시 샘플 .py 한 줄로 확인 가능. 본 조사는 매핑 가능성 입증에 집중.
- 응답 필드명·타입 명세 — 구현 단계에서 실제 호출 1회로 확인.
- KIS 모의투자 계좌의 시세 데이터 정확성 비교 — 실측 필요.
- KIS 의 WebSocket 실시간 호가/체결 (FlowSignal 일별 cron 모델 에서는 불필요).

---

*조사 only. 코드 변경 없음. 진행 결정은 흥권님 승인 후 ADR 006 작성으로 시작.*

---

## Sources

- [KIS Developers 공식 포털](https://apiportal.koreainvestment.com/apiservice)
- [koreainvestment/open-trading-api (공식 SDK)](https://github.com/koreainvestment/open-trading-api)
- [공식 SDK domestic_stock 샘플 폴더 목록](https://github.com/koreainvestment/open-trading-api/tree/main/examples_llm/domestic_stock)
- [inquire-investor 샘플 (TR_ID FHKST01010900 확인)](https://raw.githubusercontent.com/koreainvestment/open-trading-api/main/examples_llm/domestic_stock/inquire_investor/inquire_investor.py)
- [daily-short-sale 샘플 (TR_ID FHPST04830000 확인)](https://raw.githubusercontent.com/koreainvestment/open-trading-api/main/examples_llm/domestic_stock/daily_short_sale/daily_short_sale.py)
- [comp-program-trade-daily 샘플 (TR_ID FHPPG04600001 확인)](https://raw.githubusercontent.com/koreainvestment/open-trading-api/main/examples_llm/domestic_stock/comp_program_trade_daily/comp_program_trade_daily.py)
- [hky035 블로그 — KIS 쓰로틀링 정책](https://hky035.github.io/web/kis-api-throttling/) (rate limit 초당 20건)
- [python-kis 라이브러리 (Soju06)](https://github.com/Soju06/python-kis) (토큰 재발급 1분 1회 제한)
