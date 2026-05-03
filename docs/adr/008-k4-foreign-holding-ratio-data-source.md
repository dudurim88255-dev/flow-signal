# ADR 008 — K4 (외국인 보유율 Δ) 데이터 출처

**Status**: Proposed (흥권 검토 후 Accepted)
**Date**: 2026-05-04
**Deciders**: 흥권
**Supersedes**: ADR 006 §Decision §1 K4 부분 + ADR 007 §Decision 4 (별 cycle 분리 결정)
**Trigger**: ADR 007 Decision 4 = (라) 별 cycle 분리 채택 — K4 출처 결정의 검증 cycle 비용 + ADR 007 의 KIS 7 신호 + KRX K12 박제 진행 미블로커 정합.

---

## Context

### K4 신호 정의

K4 = **외국인 보유율 Δ** (외국인 보유 주식 수 / 발행 주식 수, 일별 변화).
한국 시장 weight 100 중 K4 = **8 점**. K1~K8 중 K4 만 안전한 출처 부재.

### K4 출처 부재 catch 흐름

| Cycle | 결과 |
|---|---|
| ADR 006 (2026-04-25) | K4 → KRX OPEN API 가정 (추정 명시) |
| research-kis (2026-04-25) | KIS K4 약함, KRX `MDCSTAT02201` (정보데이터시스템 OTP+CSV) 권장 |
| ADR 006 §Decision §2 | K4 → KRX OPEN API 결정 박제 |
| 흥권 portal 실측 (2026-05-04) | KRX OPEN API 31개 endpoint = OHLCV/시세만, K4 미제공 catch |
| research-krx (2026-05-04) | ADR 006 §Decision §2 부정 |
| ADR 007 (2026-05-04) | K4 분기 시도 후 (라) 별 cycle 분리 — 본 ADR 008 트리거 |

### K4 의 안전 출처 부재 본질

| 후보 | 상태 |
|---|---|
| KIS Open API 직접 | ❌ 외국인 보유율 직접 endpoint 부재 (research-kis §2-K4) |
| KIS 간접 (`frgnmem-pchs-trend` 누적) | ⚠️ 정확도 낮음 (스타팅 포인트 누적 오차) |
| KRX OPEN API | ❌ 31개 endpoint 모두 OHLCV/시세 (research-krx §1-2) |
| KRX 정보데이터시스템 OTP+CSV | ❌ ADR 006 §1-4 운영 금지 (IP 차단 정책) |
| 금투협 freesis | ⚠️ 시장 전체만, 종목별 부재 (research-korea §3) |
| DART (금융감독원 전자공시) | 🟡 외국인 보유 공시 가능 — 본 ADR 008 의제 |
| 일반 크롤링 (Naver Finance / 증권사 사이트 등) | 🔴 ToS 위반 가능, 차단 위험 |

→ K4 의 정확 + 안전 출처 0개. 모든 옵션이 trade-off.

---

## Decision Options

흥권 결정 대기 (TBD). 5 옵션 박제:

### K4-A — 폐기 (live: false 영구)

| 항목 | 값 |
|---|---|
| 출처 | 없음 |
| 정확도 | — |
| 리스크 | 0 |
| weight 영향 | -8 (K4 weight 영구 손실) |
| 박제 비용 | 0 (lib/signals/index.ts evaluateKorea 의 K4Live=false 강제만) |
| 권장도 | 🟡 안전, 손실 명확 |

**근거**: 검증 안된 출처로 점수 산출하느니 미사용이 안전. ADR 003 `live` flag 정책 정합 (라이브 0 신호는 가중합 제외).

### K4-B — DART (금융감독원 전자공시) 추정

| 항목 | 값 |
|---|---|
| 출처 | DART OPEN API (https://opendart.fss.or.kr/) |
| 정확도 | 중 (공시 시점 기준, 일별 갱신 지연 가능) |
| 리스크 | 0 (공식 API, 무료, 인증키 발급 가능) |
| weight 영향 | 부분 (confidence="med" 가중) |
| 박제 비용 | 중 — DART API 인증키 발급 + fetcher 신설 + 공시 데이터 → 일별 보유율 추정 로직 |
| 권장도 | 🟢 정공법 후보 |

**근거**:
- DART = 금융감독원 공식 공시 시스템. "외국인 투자 등록 현황" / "주요 주주 변경" 공시에 외국인 보유율 포함.
- OPEN API 공식 제공 (https://opendart.fss.or.kr/intro/main.do).
- 단점: 공시 시점 기준 → 일별 신호로 변환 시 보간 필요. T+1~T+N 지연 가능.

**조사 필요 항목** (Decision 전):
- DART OPEN API 의 외국인 보유율 endpoint 정확 spec
- 일별 갱신 주기
- 100 종목 일별 호출 시 rate limit
- 공시 시점 기준 → 일별 보간 방법

### K4-C — 크롤링 (위반)

| 항목 | 값 |
|---|---|
| 출처 | 비공식 크롤링 (Naver Finance / 증권사 / KRX OTP+CSV) |
| 정확도 | 높음 (공식 데이터와 동일) |
| 리스크 | 🔴 매우 높음 — ToS 위반 + IP 차단 + 법적 리스크 |
| weight 영향 | 정확 |
| 박제 비용 | 낮음 (크롤러 자체는 단순) + 장기 운영 유지보수 비용 |
| 권장도 | 🔴 절대 금지 |

**근거**:
- Naver Finance / 증권사 사이트 = 명시적 ToS 위반.
- KRX OTP+CSV = ADR 006 §1-4 운영 금지 정책 (pykrx 식 IP 차단 위험, 40일 다운타임).
- FlowSignal 정체성 (시그널 SaaS) 정합 X — SaaS 재배포 시 라이선스 위반 명백.

**기각 권고**: 본 옵션 채택 시 ADR 007 의 KRX OTP+CSV 금지 정책과 충돌. 흥권 직접 운영용 (개인 사용) 도 권고 X.

### K4-D — 추가 조사

| 항목 | 값 |
|---|---|
| 출처 | TBD (조사 후 결정) |
| 정확도 | TBD |
| 리스크 | TBD |
| weight 영향 | TBD |
| 박제 비용 | 조사 cycle (1~2주) |
| 권장도 | 🟡 K4-B/E 와 병행 가능 |

**조사 후보**:
- 공공데이터포털 (https://www.data.go.kr) — "외국인 투자" 키워드 검색
- KRX 데이터사업부 외 다른 KRX 기관 (KRX 정보유통팀 등)
- 한국예탁결제원 (KSD) 공식 API 가능성
- FnGuide / 와이즈리포트 등 상용 데이터 벤더 (유료 — FlowSignal 무료 베타 정합 X)
- Yahoo Finance / Alpha Vantage 등 글로벌 데이터 프로바이더의 한국 종목 외국인 보유율 제공 가능성

**근거**: 본 박제 시점에 미발견 출처 있을 가능성. K4-A/B 결정 전 추가 조사 cycle 가치 있음.

### K4-E — KRX 데이터사업부 직접 문의

| 항목 | 값 |
|---|---|
| 출처 | KRX 데이터사업부 02-3774-8904 직접 문의 결과 |
| 정확도 | TBD (가능 시 KRX 공식 출처) |
| 리스크 | 0 (전화/이메일 문의) |
| weight 영향 | 가능 시 정확 |
| 박제 비용 | 흥권 전화 1통 |
| 권장도 | 🟢 정공법 + 묶음 처리 가능 |

**근거**:
- KRX OPEN API portal 에 미노출이지만 별 endpoint / API 가능성 (관리자에게 문의해야 답).
- KRX 정보데이터시스템 (data.krx.co.kr) 의 `MDCSTAT02201` (외국인 보유 일별) 의 OPEN API 화 요청.
- ADR 006 §Open Q #6 의 KRX/KIS SaaS 재배포 라이선스 문의와 묶음 처리 가능 (한 번에 02-3774-8904).

**조사 시 질문 항목**:
1. KRX OPEN API 에 외국인 보유율 종목별 일별 endpoint 가 추가될 가능성?
2. 별 KRX 서비스 (정보데이터시스템 외) 에 종목별 외국인 보유율 API 제공?
3. KRX 회원사/거래소 등록 후 별 데이터 채널 가능?
4. (묶음) FlowSignal 의 SaaS 재배포 라이선스 정책

---

## Decision (TBD)

흥권 결정 대기. 본 ADR 박제 시점 (2026-05-04) 미결정.

**Claude 권고 시퀀스** (참고용, 흥권 결정 우선):
1. **K4-E 우선** — 흥권 KRX 02-3774-8904 전화 (ADR 006 §Open Q #6 SaaS 라이선스 묶음). 1주 내 답변 가능.
2. **K4-E 답변 = 가능 시** — 단일 출처 확정.
3. **K4-E 답변 = 불가 시 → K4-B + K4-D 병행 조사** — DART API 인증키 발급 + 공공데이터포털 추가 조사.
4. **K4-B/D 결과 확인 후** — 최종 출처 결정.
5. **모든 옵션 미발견 시 → K4-A** — 영구 폐기, weight 8 손실 수용.

---

## Consequences

### Positive

1. **ADR 007 진입 미블로커** — K4 결정 분리로 ADR 007 의 KIS 7 신호 + KRX K12 박제 즉시 진입 가능.
2. **검증 cycle 비용 분리** — K4 출처 결정의 1~2주 조사 cycle 이 ADR 007 박제 일정에 영향 X.
3. **별 ADR 의 가치** — K4 단독 결정의 trade-off (정확도 vs 리스크 vs 박제 비용) 가 본 ADR 의 단일 의제 = 명확한 결정 cycle.

### Negative / Trade-offs

1. **K4 단기 미활용** — 결정 전까지 K4Live=false 강제 (ADR 007 §Phase 4 정합). weight 8 단기 비활성.
2. **흥권 의사 결정 부담** — 5 옵션 분기 + 조사 cycle (K4-D, K4-E) → 박제 cycle 1~2주.
3. **Phase 4 live 활성화 시 K4 갭** — ADR 008 미결정 상태에서 Phase 4 진입 시 K4 = false 단기 강제 + ADR 008 Accepted 후 별 cycle 추가. baseline track 의 추가 분기 (K4 활성/비활성 시기) 발생 가능.

### Risks

| 위험 | 가능성 | 영향 | 완화 방안 |
|---|:--:|:--:|---|
| K4 결정 영구 보류 | 낮음 | 낮음 | K4-A (영구 폐기) 단기 채택 → weight 8 손실 수용 |
| DART API 정확도 부족 (K4-B 채택 시) | 중 | 중 | confidence="med" + Phase 4 후 1주 모니터링 → 부정확 시 K4-A 폴백 |
| KRX 데이터사업부 답변 지연 (K4-E) | 중 | 낮음 | K4-B + K4-D 병행 조사로 시간 손실 보완 |
| 크롤링 옵션 (K4-C) 잘못 채택 | 낮음 | 매우 높음 | 본 ADR 의 K4-C 권장도 🔴 명시 + ADR 006 §1-4 운영 금지 정책 정합 |

---

## Implementation Plan

### Phase 1 (조사 cycle, Decision 전)

**흥권 작업**:
1. K4-E: KRX 02-3774-8904 전화 — 외국인 보유율 별 endpoint + SaaS 라이선스 묶음 문의
2. K4-D: 공공데이터포털 / 한국예탁결제원 / 데이터 벤더 추가 조사

**Claude 작업**:
1. K4-B: DART OPEN API 조사 (`docs/research-dart-foreign-holding-2026-MM-DD.md` 박제) — 흥권 트리거 시
2. K4-D 의 일부 (공공데이터포털 검색 자동화) — 흥권 트리거 시

### Phase 2 (Decision)

흥권 ADR 008 Status `Proposed` → `Accepted` 전환 + Decision K4-A/B/D/E 채택.
ADR 008 본문 update — Decision 채택 + 채택 근거 박제.

### Phase 3 (Implementation, Decision 채택 후)

| 채택 | 박제 항목 |
|---|---|
| K4-A | `lib/signals/index.ts` evaluateKorea 의 K4Live=false 단기 강제 → 영구 강제로 박제 명시 |
| K4-B (DART) | `lib/signals/fetchers/dart/auth.ts` + `lib/signals/fetchers/dart/foreign-holding.ts` + Vitest fixture + DART API 키 등록 (.env.local + Vercel + GHA Secrets 3곳) |
| K4-D 결과 출처 | 출처 별 fetcher 신설 (별 cycle 박제) |
| K4-E 결과 KRX endpoint | `lib/signals/fetchers/krx/foreign-holding.ts` + KRX `auth.ts` 재활용 |

### Phase 4 (모니터링, Decision 채택 후 1주)

- K4Live 활성 비율 메트릭
- K4 confidence 분포
- 정확도 검증 (가능 시 KRX 정보데이터시스템 OTP+CSV 결과와 1회 비교 — 검증 cycle 만, 운영 X)

---

## Trigger 조건

본 ADR 진행 시점:
- **(가) ADR 007 Phase 2 완료 후** — KIS 7 신호 + KRX K12 박제 + Phase 3 GHA 이전 완료 후 K4 cycle 진입.
- **(나) 흥권 자유 시점** — ADR 007 진행 중에도 흥권 트리거 시 ADR 008 cycle 병행 가능.

**Claude 권고**: (나) 채택 — K4-E 흥권 전화 1통은 ADR 007 진입 전에도 가능. 답변 기다리는 동안 ADR 007 진행 가능.

---

## Open Questions

1. **DART OPEN API 의 외국인 보유율 endpoint 정확 spec** — Claude 조사 cycle 트리거 시 확정.
2. **KRX 02-3774-8904 답변** — 흥권 전화 1통 후 박제.
3. **공공데이터포털 / 한국예탁결제원 추가 출처** — K4-D 조사 cycle 트리거 시 확정.
4. **K4 confidence 등급 결정** — DART 추정 (K4-B) 시 "med" / KRX 직접 (K4-E 가능 시) "high" / 폐기 (K4-A) "live: false". Decision 채택 후 박제.

---

## Compliance check (PR 머지 전 흥권 점검 항목)

- [ ] Decision 채택 (K4-A/B/D/E 중 1)
- [ ] ADR 008 Status `Proposed` → `Accepted`
- [ ] PR 본문에 "ADR 008 K4 Decision = K4-X" 인용
- [ ] K4-B/D/E 채택 시 출처별 fetcher 박제 commit chain 명시

---

## Related

- **ADR 007 — K4 별 cycle 분리 결정 (본 ADR trigger)**
- ADR 006 §Decision §1 K4 부분 — 본 ADR 가 supersede
- ADR 006 §1-4 — KRX OTP+CSV 운영 금지 정책 (K4-C 기각 근거)
- ADR 003 — `live` flag 정책 (K4-A 채택 시 K4Live=false)
- ADR 004 — 시장별 데이터 소스

### 외부

- KRX 데이터사업부 — 02-3774-8904 (K4-E)
- DART OPEN API — https://opendart.fss.or.kr/ (K4-B)
- 공공데이터포털 — https://www.data.go.kr (K4-D)
- 한국예탁결제원 — https://www.ksd.or.kr (K4-D)

### 박제 docs

- `docs/research-krx-openapi-endpoints-2026-05-04.md` — KRX OPEN API K4 미제공 catch
- `docs/research-kis-data-endpoints-2026-04-25.md` — KIS K4 약함 (간접만)
- `docs/research-korea-signals-data-sources-2026-04-25.md` — 한국 시장 데이터 출처 종합 비교

---

*Status: Proposed (2026-05-04). Decision TBD — 흥권 K4-A/B/D/E 채택 대기 (K4-C 기각). 트리거: 흥권 자유 시점 (ADR 007 진행 중 병행 가능).*
