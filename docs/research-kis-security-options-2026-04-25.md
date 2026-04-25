# KIS Open API 보안 옵션 조사

**Date**: 2026-04-25  
**Scope**: 조사 only. 코드 수정 X, 인증키 발급 X, 실 API 호출 X.  
**Trigger**: ADR 006 Q6 (모의투자 vs 실전 키) 재검토용.  
**Linked**:
- `docs/adr/006-korea-signals-data-sources.md` (Open Question 1, 7)
- `docs/research-kis-data-endpoints-2026-04-25.md` (TR_ID 조사)
- `docs/guides/auth-key-issuance-2026-04-25.md` (발급 절차)

---

## TL;DR

**KIS App Key + Secret 단독 노출만으로는 자산 탈취 불가.**

KIS API 의 보안은 **3-Layer 구조**:
1. **App Key + Secret** → Bearer Token 발급 가능 → **시세/조회 가능**
2. **+ 계좌번호 + 계좌 비밀번호 (`ACNT_PWD`)** → **주문 가능** (HTTP body 에 평문 추가 전송)
3. **+ OTP / 보안카드 / 생체인증** → **출금/이체 가능** (API 외부, KIS 본 사이트 보안 매체)

FlowSignal 은 시세/수급 조회만 하므로 Layer 1만 사용. **계좌 비밀번호를 secrets 에 넣지 않는 한 키 노출 시 주문 불가.**

→ **ADR 006 Q6 권고 변경**: "모의투자 우선" → **"실전 키 단일, 단 계좌 비밀번호 절대 secrets 미등록"** 도 안전 옵션.

---

## 1. IP 화이트리스트 — **❌ 미제공**

### 조사 결과

- KIS Developers 공식 페이지 (`apiportal.koreainvestment.com/about-howto`, `/faq`, `/howto-use`) 검색 — IP 화이트리스트 / 허용 IP / 등록 IP 관련 옵션 **명시 없음**
- 알려진 Python/Java/JS wrapper 어디에도 IP 등록 절차 없음
- KIS 신청 양식에 "콜백 URL/도메인" 필드는 있으나 **호출 IP 제한과 무관** (도메인은 메타정보)

### 결론

KIS Open API 는 **IP 화이트리스트 기능을 제공하지 않는다**. App Key + Secret 만 있으면 어디서든 호출 가능.

→ **운영 측면 영향**: GitHub Actions runner 의 outbound IP 가 매번 바뀌어도 무관. 동시에 키 노출 시 공격자가 본인 PC 에서 호출해도 막을 수단 없음 → Layer 2/3 (계좌 비번, OTP) 가 사실상 마지막 방어선.

---

## 2. 조회 전용 권한 모드 — **❌ 미제공**

### 조사 결과

- KIS App Key 발급 시 **권한 분리 시스템 부재**. 단일 키가 시세 + 주문 양쪽 호출 가능
- TR_ID 별 권한 분리 옵션 없음. App Key 자체에 scope 개념 없음
- 발급 양식에 "사용 서비스 카테고리" 체크박스가 있을 수 있으나 (시세만 / 주문 포함), **체크 안 한 카테고리도 호출 시 차단되는지 명문 미발견** — 운영상 유효성 불확실

### 결론

KIS 는 **Read-Only Key 옵션이 없다**. App Key + Secret 가 있으면 주문 엔드포인트도 호출 가능 (단, Layer 2 통과 필요).

→ **사실상 안전망은 계좌 비밀번호** — 주문 본문에 `ACNT_PWD` 필수 파라미터로 평문 전달 필요. 이게 없으면 주문 자체가 reject 됨.

---

## 3. 실전 키 시세 전용 사용 TOS

### 조사 결과

- KIS Developers 약관에서 "주문 가능 키를 시세 조회에만 사용해도 무방" 식 명문 발견 못함. 그러나 **금지 조항도 없음** — 사용자 재량.
- 공식 Postman 컬렉션, GitHub SDK 모두 시세 호출만 하는 예제 다수 (e.g. `inquire-investor`, `daily-short-sale`) 존재 → KIS 가 시세 단독 사용을 사실상 정상 케이스로 인정
- 호출 한도 (rate limit) 는 키별 적용. 시세 전용으로 써도 한도 동일

### 결론

**실전 키 → 시세/수급 단독 사용 허용**. TOS 위반 아님. 단:
- App Key + Secret + 계좌번호를 한 secrets 풀에 모아 두면 노출 시 주문 권한도 함께 노출
- 계좌번호는 환경변수에 두되, **계좌 비밀번호는 절대 secrets / env / 코드에 두지 않음** → 자동 매매 불가능 = 공격자도 주문 불가

---

## 4. 모의투자 vs 실전투자 비교

| 항목 | 모의투자 | 실전투자 |
|---|---|---|
| Base URL | `https://openapivts.koreainvestment.com:29443` | `https://openapi.koreainvestment.com:9443` |
| WebSocket | `ws://ops.koreainvestment.com:31000` | `ws://ops.koreainvestment.com:21000` |
| App Key/Secret | **별도 발급** (실전과 분리) | 별도 발급 |
| 시세 데이터 정확도 | **검증 미수행 — 본 조사 한계** (실측 필요, ADR 006 Q1) | 정확. 1차 출처. |
| Rate Limit | "낮음" (정확한 수치 명시 미발견, 단일 조회는 가능) | 초당 20건 |
| Token 만료 | 24h (동일) | 24h |
| Token 재발급 제한 | 1분 1회 (동일) | 1분 1회 |
| 이용기간 | 1년 | 1년 |
| 갱신 신청 가능 시점 | 만료 30일 전부터 | 동일 |
| 갱신 시 키 변경 | **App Key + Secret 재발급** (서비스 다운 발생) | 동일 |
| 노출 시 자산 위험 | **0** (가상 자산만) | 계좌 비번 추가 노출 시 위험 |
| 출금/이체 API | 없음 | **없음** (API 자체에서 출금 불가) |
| 시세 외 호출 차단 | 모의 환경이라 주문해도 가상 체결 — 실손실 X | 주문 시 실손실 |
| TLS | TLS 1.2+ (1.0/1.1은 2025-12-12 이후 미지원) | 동일 |

### 핵심 차이

- **자산 안전성**: 모의가 절대 안전. 키 노출돼도 가상 자산만 영향.
- **데이터 정확성**: 실전이 1차. 모의는 시세 데이터를 동일하게 받는지 **본 조사 시점 미검증** → ADR 006 Phase 1 직후 실측 필요 (Q1 그대로 유지).
- **호출 한도**: 실전이 더 관대. 1000종목 확장 시 모의로는 한도 부족 가능성.

---

## 5. 키 노출 시 피해 범위

### 시나리오: App Key + Secret 만 노출 (계좌번호/비번 미노출)

| 공격 가능 작업 | 가능 여부 | 비고 |
|---|:--:|---|
| 시세 조회 (전 종목) | ✅ | rate limit 한도 내 무제한 |
| 본인 계좌 잔고 조회 | ❌ | 계좌번호 + 비밀번호 필요 |
| 매수/매도 주문 | ❌ | `ACNT_PWD` 필수 |
| 출금/이체 | ❌ | API 외부, OTP 필요 |
| 정보 누출 | 시세 데이터만 (공개 정보) | 실손실 0 |
| Rate limit 잠식 | ✅ | **DoS 효과** — 본인 정상 호출도 throttling |

→ **실손실 0**, 단 정상 호출 방해 가능.

### 시나리오: App Key + Secret + 계좌번호 + 계좌 비밀번호 모두 노출

| 공격 가능 작업 | 가능 여부 | 피해 한도 |
|---|:--:|---|
| 본인 계좌 잔고 조회 | ✅ | 정보 노출 |
| 매수/매도 주문 | ✅ | **계좌 잔고 한도까지** 임의 매매 — 손실 무제한 |
| 출금/이체 | ❌ | OTP/보안카드 추가 필요 |
| 자산 탈취 (외부 송금) | ❌ | 출금 차단으로 불가능. 단, 본인 계좌에서 손해는 가능 (의도적 손실 매매) |

→ **자산이 외부로 빠져나가지 않음** (출금 차단). 그러나 **잔고 한도까지 손실 가능** (악의적 매매).

### 시나리오: 모든 정보 + OTP/보안카드까지 노출

→ 출금 가능. **자산 완전 탈취**. KIS 의 마지막 방어선.

→ FlowSignal 운영 환경(Vercel/GitHub Actions secrets) 에는 **OTP/보안카드 자체를 등록할 방법이 없으므로** Layer 3 까지 노출되는 시나리오는 사실상 0. 흥권님 본인 PC/모바일 단말이 별도 해킹돼야 발생.

---

## 6. ADR 006 Q6 재검토

### ADR 006 원안 (Q6)

> KIS 계좌 종류: **모의투자 우선**, 시세 정확성 1회 실측 후 실전 전환 여부 결정

### 본 조사 결과 반영 권고

원안 유지가 **여전히 안전한 default**. 단 다음 두 가지 추가 명시 권장:

1. **계좌 비밀번호 (`ACNT_PWD`) 는 어떤 secrets / env / 코드 / 메모리에도 저장하지 않는다.**
   - FlowSignal 은 주문 호출 0회 → `ACNT_PWD` 변수 자체가 코드베이스에 등장할 일 없음. ADR 006 Phase 2 fetcher 신설 시 KIS oauth/credit 모듈 어디에도 `ACNT_PWD` import / parameter 도입 금지 — 코드 리뷰 룰로 명문화.
   - 이 룰만 지키면 실전 키를 써도 자산 위험 0.

2. **모의 vs 실전 결정 기준**:
   - **시세 정확도** (Q1 실측 결과) — 모의가 정확하면 모의 단독.
   - **rate limit 여유** — 100종목 이상 확장 시 모의 한도 부족 가능 → 실전 전환.
   - **자산 위험** — 위 룰 1 지키면 실전도 안전.

### 권고 — 단계적 결정 트리

```
Phase 1 직후:
  └─ 모의 + 실전 키 둘 다 발급 (시세 동일성 검증용 1회)
       └─ 모의 시세 정확 + KOSPI 100종목 이하?
            ├─ Yes → 모의 단독 (자산 위험 0, 안전)
            └─ No (rate limit 부족 또는 시세 오류) → 실전 단독
                 └─ ACNT_PWD 룰 + 코드 리뷰 + secrets 분리 보관
```

---

## 7. 운영 권고 사항 (ADR 006 보강용)

ADR 006 Phase 1~2 에 다음 운영 룰 추가 명시 권장:

### 7-1. secrets 분리 원칙

- `KIS_APP_KEY`, `KIS_APP_SECRET`: GitHub Actions / Vercel secrets 에 등록 → 시세 호출용
- `KIS_ACCOUNT_NUMBER`: env 에 두되 **App Key 와 다른 시점에 등록** → 단일 leak 시 주문 권한 함께 노출 방지 (큰 효과는 아니지만 약간의 분산)
- `KIS_ACCOUNT_PWD`: **절대 등록 금지**. 코드 grep 으로 정기 확인.

### 7-2. 키 노출 대응 절차

1. KIS Developers 마이페이지 > 즉시 재발급 (기존 키 자동 무효)
2. GitHub Actions / Vercel secrets 새 키로 교체
3. KIS 본 사이트에서 거래내역 확인 → 비정상 주문 있는지
4. (해당 시) KIS 고객센터 신고 + 거래 정정 요청

### 7-3. 정기 점검

- 1년 만료 30일 전 만료 알림 SMS 수신 → 갱신 신청
- 갱신 시 App Key + Secret 재발급되므로 **갱신 시점 = 다운타임** → 사전 PR 준비 후 갱신 동시 deploy
- 분기 1회 secrets 로테이션 권장 (선택 — 보수적 운영)

### 7-4. 모니터링

- KIS API 응답에 401 (인증 실패) 비율 monitoring → 키 무효화 시점 감지
- rate limit 초과 (429 또는 EGW00201 류 에러코드) 빈도 → 의심스러운 패턴 발견 시 키 재발급

---

## 8. 본 조사 한계

1. **IP 화이트리스트 명시 부재 = 미제공** 으로 결론지었으나, 법인 / 기업회원 전용 옵션이 별도 존재할 가능성 0%는 아님. 개인 회원 기준으로는 미제공 확실.
2. **모의 시세 정확도** 미실측. ADR 006 Q1 그대로 유지.
3. **계좌 비번 외 별도 거래 PIN / OTP 의 API 호출 시 적용 여부** — 일부 API 가 OTP 추가 요구하는지 불명. 본 조사는 **시세 호출에 한해서만** ACNT_PWD 불필요 결론. 주문/출금 호출은 검증 안 함 (FlowSignal 미사용).
4. KIS 약관 본문 (`/terms`) 직접 fetch 미수행 — 공식 페이지가 로그인 후 노출 가능성. 흥권님 가입 후 약관 직접 확인 권장.

---

## Sources (URL + 접근일자 2026-04-25)

### KIS 공식

- [KIS Developers 포털](https://apiportal.koreainvestment.com/apiservice)
- [이용 안내](https://apiportal.koreainvestment.com/about-howto)
- [Open API 서비스 소개](https://apiportal.koreainvestment.com/about-open-api)
- [토큰 만료 처리 절차](https://apiportal.koreainvestment.com/provider-doc4)
- [공식 SDK GitHub](https://github.com/koreainvestment/open-trading-api)

### 커뮤니티 / 블로그 (인증 흐름·base URL 확인용)

- [WikiDocs — KIS Developers 소개](https://wikidocs.net/159296)
- [WikiDocs — 한국/미국 주식 자동매매 시스템](https://wikidocs.net/165185)
- [Soju06/python-kis (라이브러리 README)](https://github.com/Soju06/python-kis)
- [hky035 — KIS 쓰로틀링 정책](https://hky035.github.io/web/kis-api-throttling/)
- [한국투자증권 Open API 갱신 절차](https://mg.jnomy.com/howto-kis-openapi-renewal)
- [JAVA Open API 사용 정리 (velog)](https://velog.io/@seon7129/JAVA-%ED%95%9C%EA%B5%AD%ED%88%AC%EC%9E%90%EC%A6%9D%EA%B6%8C-OpenAPI-%EC%82%AC%EC%9A%A9-%EC%A0%95%EB%A6%AC-Rest)

### 본 보고서와 별도 (재참조)

- `docs/adr/006-korea-signals-data-sources.md` — Q6 결정
- `docs/research-kis-data-endpoints-2026-04-25.md` — TR_ID, base URL 확인
- `docs/guides/auth-key-issuance-2026-04-25.md` — 발급 절차 가이드

---

*조사 only. 코드 변경 0건. ADR 006 Q6 결정 보강 입력 자료.*
