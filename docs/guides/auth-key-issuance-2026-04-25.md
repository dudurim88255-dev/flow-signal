# 인증키 발급 가이드 — KRX OPEN API + KIS Open API

**Date**: 2026-04-25  
**Audience**: 흥권 (직접 클릭하면서 진행)  
**Linked ADR**: `docs/adr/006-korea-signals-data-sources.md` (Phase 1)

---

## ⚠️ 시작 전 절대 주의사항

| # | 주의 |
|---|---|
| 1 | **App Secret / 인증키는 발급 직후 1회만 화면에 표시되는 경우가 많다**. 텍스트 파일에 즉시 복붙 후 1Password/Bitwarden 같은 비밀번호 관리자에 저장. |
| 2 | **재발급 시 기존 키는 즉시 무효화**된다. 운영 중 재발급하면 서비스 다운. 발급은 안정된 시점 1회만. |
| 3 | **GitHub repo, Slack, ChatGPT 어디에도 키 본문 붙여넣기 금지**. 본 가이드도 키 입력 후 본인 컴퓨터에만 보관. |
| 4 | **KIS App Key 는 주문 권한도 포함**. 모의투자 키부터 발급하고 시세 동작 확인 후에만 실전 키 검토. |
| 5 | 키 입력 시 **앞뒤 공백 / 줄바꿈** 따라붙지 않게 주의 (특히 복붙 시). |

---

## 1. KRX OPEN API 인증키 발급

### 1-A. 사전 준비

- 본인인증 수단: 휴대폰 본인인증 또는 카카오/네이버 소셜로그인
- 사업자등록증은 **개인 사용에는 불필요** (개인 회원가입 가능)
- 예상 소요: 회원가입 5분 + 인증키 신청 5분 + **승인 대기 약 1영업일**

### 1-B. 단계별 진행

#### Step 1. KRX Data Marketplace 회원가입

1. https://data.krx.co.kr/ 접속
2. 우측 상단 **로그인** → 하단 **회원가입** 클릭
3. 약관 동의 4개 모두 체크 → **다음**
4. 가입 유형 선택: **개인회원**
5. 휴대폰 본인인증 또는 소셜 로그인
6. 가입정보 입력:
   - 아이디 (영문+숫자 6~12자)
   - 비밀번호
   - 이메일 (인증키 승인 알림 수신용 — 자주 보는 메일로)
   - 닉네임
7. **가입완료** 클릭

> 📸 **스크린샷 시점**: 가입 완료 화면 (아이디 + 가입일 표시되는 페이지)

#### Step 2. KRX Open API 포털 로그인

1. https://openapi.krx.co.kr/ 접속
2. 우측 상단 **로그인** — Step 1 의 Data Marketplace 계정 그대로 사용 (단일 SSO)
3. 로그인 후 좌측 또는 상단 **마이페이지** 클릭

#### Step 3. 인증키 신청

1. 마이페이지 > **API 인증키 신청** 메뉴 클릭
2. 신청 양식 입력:

| 필드 | 입력 예시 | 비고 |
|---|---|---|
| 사용 목적 | "주식 신호 분석 서비스 운영" | 상세 작성하면 승인 빠름 |
| 사용 데이터 | 주식 카테고리 (외국인/기관 매매, 프로그램매매, 보유율, 공매도, 대차거래, 거래원, 산업별지수) | 카테고리별 체크박스가 있으면 K1~K8+K12 관련 항목 모두 체크 |
| 서비스명 | "FlowSignal" | |
| 서비스 URL | `https://flow-signal-v2.vercel.app` | 필수 입력이면 현재 배포 URL |
| 일일 예상 호출 건수 | "약 500건" | 100종목 × 5엔드포인트 + 여유 |

3. **신청** 버튼 클릭

> 📸 **스크린샷 시점**: 신청 완료 페이지 ("승인 대기 중" 상태 표시)

#### Step 4. 승인 대기 (~1영업일)

- 평일 신청 시 보통 **다음 영업일 오전 중** 승인
- 승인 시 가입 이메일로 알림 발송
- 토/일요일 신청 시 월요일 처리

#### Step 5. 발급된 인증키 확인 + 저장

1. 승인 메일 수신 후 https://openapi.krx.co.kr/ 다시 로그인
2. 마이페이지 > **API 인증키 발급내역** 또는 **인증키 관리**
3. 발급된 인증키 (보통 32~64자 영숫자) **복사**
4. 즉시 비밀번호 관리자에 저장:

```
서비스: KRX OPEN API
키 이름: KRX_API_KEY
값: (복사한 인증키)
발급일: 2026-MM-DD
용도: FlowSignal Phase A K1~K8 fetcher
```

> 변수명 `KRX_API_KEY` (KRX_OPEN_API_KEY 아님) — 흥권 박제 ground truth, ADR 006 Phase 1 §3 정합 (2026-05-04 update).

> 📸 **스크린샷 시점**: 인증키 표시 화면 (단, **이미지 자체에 키 본문이 보이면 절대 공유 금지**. 본인 1Password 첨부 정도만)

### 1-C. KRX 키 운영 주의사항

- **만료 정책**: 본 가이드 작성 시점 기준 명시 미발견 → 정기적으로 myasset 또는 데이터사업부에 확인 권장
- **재발급**: 분실 시 마이페이지에서 재발급 가능. **재발급 시 이전 키 즉시 무효화**.
- **차단 정책**: 공식 API 라 호출 한도 위반 시에만 일시 정지. data.krx.co.kr 의 OTP+CSV 와 다른 정책 (별 시스템).
- **TOS / 재배포**: 본 시점 명문 정책 미발견. 무료 베타(~2026-10-24) 종료 전 KRX 데이터사업부 **02-3774-8904** 또는 `krxdata@krx.co.kr` 직접 문의.

---

## 2. KIS Open API App Key 발급

### 2-A. 사전 준비

- KIS 증권 계좌 (이미 보유 — 흥권님 확인 완료)
- 보안카드 또는 OTP (모의투자 신청 시 본인 인증)
- 예상 소요: 모의투자 신청 5분 + 키 발급 즉시

### 2-B. 단계별 진행 — 모의투자 키 (우선)

#### Step 1. KIS Developers 가입

1. https://apiportal.koreainvestment.com/intro 접속
2. 우측 상단 **로그인** → **회원가입**
3. KIS 증권 계좌 보유자로 가입 — 본인의 KIS 계좌번호 + 이름 + 휴대폰 인증
4. 약관 동의 → 가입 완료

> 📸 **스크린샷 시점**: 가입 완료 → "KIS Developers" 마이페이지 첫 화면

#### Step 2. 모의투자 신청 (시세만 받을 거지만 절차 동일)

1. https://securities.koreainvestment.com 본 사이트에서 **모의투자** 메뉴 검색
2. 또는 KIS HTS / MTS 에서 모의투자 참가 신청
3. 모의투자 계좌가 생성되면 **모의투자 계좌번호 9자리** 메모 (예: `50068923-01`)

> ⚠️ 모의투자 신청은 KIS 본 사이트에서, App Key 발급은 KIS Developers 에서. 두 곳 분리됨.

#### Step 3. KIS Developers — Open API 신청

1. https://apiportal.koreainvestment.com/ 다시 로그인
2. 마이페이지 또는 상단 **앱 등록** / **Open API 신청** 메뉴
3. 신청 양식:

| 필드 | 입력 예시 | 비고 |
|---|---|---|
| 앱 이름 (App Name) | `flowsignal-mock` | 모의투자용임을 알 수 있게 |
| 앱 설명 | "FlowSignal 시세 데이터 수집 (모의투자)" | |
| 환경 (실전/모의) | **모의투자** 선택 | 이번 단계는 모의 |
| 계좌번호 | Step 2 의 모의투자 계좌번호 | |
| 사용 서비스 | 국내주식 시세 (체크박스로 선택 가능하면 시세 카테고리만) | 주문 카테고리는 체크 X |
| 콜백 URL / 도메인 | (필수면) `https://flow-signal-v2.vercel.app` | |

4. **신청** 클릭

#### Step 4. App Key + App Secret 발급 ⚠️ 중요

1. 신청 직후 또는 마이페이지 > **앱 관리** 에서 발급된 키 표시
2. 화면에 표시되는 항목:
   - **App Key**: 보통 36자 영숫자
   - **App Secret**: 더 긴 문자열 (180자 내외 base64)
3. **Secret 은 발급 시 1회만 표시되는 경우가 많음**. 즉시 비밀번호 관리자에 저장:

```
서비스: KIS Open API (모의투자)
KIS_APP_KEY: (복사값)
KIS_APP_SECRET: (복사값)
KIS_ACCOUNT_NUMBER: 50068923-01 (예시)
KIS_ACCOUNT_TYPE: mock
KIS_BASE_URL: https://openapivts.koreainvestment.com:29443
발급일: 2026-MM-DD
용도: FlowSignal Phase A K7 신용잔고 fetcher
```

> 📸 **스크린샷 시점**: App Key + Secret 표시 화면 (이미지 보관 시 마스킹 필수, Secret 영역 검은 사각형으로 가리고 캡처)

#### Step 5. (선택) 실전 키 발급 — Phase 1 모의 검증 후

모의투자 시세가 실전과 동일하면 모의 단독 사용. 다른 경우 실전 키 발급:

1. KIS Developers 마이페이지 > **앱 등록** > 새 앱 추가
2. 환경: **실전** 선택, 본인 실전 계좌번호 입력
3. 앱 이름: `flowsignal-real` (모의와 구분)
4. 발급된 키는 동일 패턴으로 저장 (`KIS_ACCOUNT_TYPE: real`, `KIS_BASE_URL: https://openapi.koreainvestment.com:9443`)

⚠️ **실전 키는 시세뿐 아니라 주문 권한도 포함**. 노출 시 자산 탈취 가능. Vercel/GitHub Actions secrets 외 절대 어디에도 저장 금지.

### 2-C. KIS 키 운영 주의사항

- **App Secret 재발급**: 분실 시 마이페이지에서 재발급 가능. **재발급 시 기존 Secret 즉시 무효화** → 운영 중이면 서비스 다운 시간 발생.
- **Access Token**: App Key + Secret 으로 매번 발급. **24시간 유효** + **1분당 1회 발급 제한**. → Redis 캐시 필수 (ADR 006 §Cache Strategy 참조).
- **Rate Limit**:
  - 실전 계좌: **초당 20건**
  - 모의 계좌: 더 낮음 (정확한 수치 명시 미발견 → 실측 필요)
- **TOS / 재배포**: KIS 본 가이드 시점 명문 정책 미발견. 무료 베타 기간 본인 사용으로 간주. 유료화 전 KIS Developers 문의.

---

## 3. secrets 등록 (키 발급 후)

### 3-A. GitHub Actions secrets

1. https://github.com/dudurim88255-dev/flow-signal 접속
2. **Settings** > **Secrets and variables** > **Actions** > **New repository secret**
3. 다음 항목 등록:

| Name | Value |
|---|---|
| `KRX_API_KEY` | KRX 인증키 |
| `KIS_APP_KEY` | KIS App Key |
| `KIS_APP_SECRET` | KIS App Secret |
| `KIS_ACCOUNT_NUMBER` | KIS 계좌번호 (예: `50068923-01`) |
| `KIS_ACCOUNT_TYPE` | `mock` 또는 `real` |
| `KIS_BASE_URL` | 모의: `https://openapivts.koreainvestment.com:29443`<br>실전: `https://openapi.koreainvestment.com:9443` |

> 📸 **스크린샷 시점**: secrets 목록 페이지 (값은 보이지 않음, 이름만)

### 3-B. Vercel Environment Variables

(Phase 4 의 `/api/score` 라우트가 KIS/KRX 사용 가능성 대비 — 현 단계에서는 선택)

1. https://vercel.com/{user}/flow-signal-v2 접속
2. **Settings** > **Environment Variables**
3. GitHub Actions 와 동일한 6개 항목 등록
4. Environment 는 **Production + Preview + Development** 모두 체크

---

## 4. 발급 확인 체크리스트

흥권님이 이 가이드 따라 작업 후 다음 항목 모두 체크되면 Phase 1 완료:

- [ ] KRX Data Marketplace 회원가입 완료
- [ ] KRX OPEN API 인증키 신청 완료
- [ ] KRX 인증키 승인 (이메일 수신)
- [ ] KRX 인증키 비밀번호 관리자 저장
- [ ] KIS Developers 가입 완료
- [ ] KIS 모의투자 계좌 신청 완료
- [ ] KIS 모의투자 App Key + Secret 발급
- [ ] KIS 키 비밀번호 관리자 저장
- [ ] GitHub Actions secrets 6항목 등록
- [ ] (선택) Vercel Environment Variables 6항목 등록
- [ ] ADR 006 Status 를 "Accepted" 로 변경 (Phase 2 트리거)

---

## 5. 문의처

- **KRX 데이터사업부**: 02-3774-8904, `krxdata@krx.co.kr` (재배포 라이선스, 차단 해제, 인증키 문제)
- **KIS Developers 고객센터**: KIS 증권 본 고객센터 또는 apiportal 내 1:1 문의
- **공공데이터포털 (보조)**: https://www.data.go.kr (금투협 freesis API 추가 발급 시)

---

## 6. 다음 단계

본 가이드 완료 후:
1. ADR 006 (`docs/adr/006-korea-signals-data-sources.md`) Status 를 "Accepted" 로 변경
2. Claude Code 에 "Phase 1 완료, Phase 2 fetcher 신설 시작" 요청 → ADR 006 §Phase 2 진행

---

*키 본문은 본 문서에 절대 기재하지 말 것. 비밀번호 관리자에만 보관.*
