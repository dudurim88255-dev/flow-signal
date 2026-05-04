# KRX OPEN API fetcher — 미사용 (archive)

**Status**: Archive (2026-05-04 — KRX 인증키 폐기 결정)
**Last commit**: `1eabbe7` — feat(adr-006): Phase 2 부분 진입 — auth.ts 골격
**Decision**: ADR 006 §Decision §1·2·6 부정 + ADR 007 §D5 부정 + ADR 009 §D3 부정

---

## 폐기 결정 박제

흥권 결정 (2026-05-04): **KRX OPEN API 미사용. 인증키 폐기 + 등록 철회.**

근거:
- KRX OPEN API 31개 endpoint 모두 OHLCV/시세 (research-krx-openapi-endpoints-2026-05-04.md §1) — K1~K8 0건 미제공
- "지수" 카테고리 산업별지수 명시적 미발견 (research-k12-sector-data-sources-2026-05-04.md §3)
- KIS Open API 단일로 K1~K8 중 7개 (K1~K3, K5~K8) 직접 제공 = KRX 의존도 0 으로 운영 단순화 가능
- ADR 007 §D5 = OHLCV-A (Yahoo Finance 유지) 채택 → KRX 주식 카테고리도 미사용
- KRX K12 산업별지수도 portal 미발견 → ADR 009 K12-A (KIS) / K12-C (KOSPI 200 단일) / K12-D (폐기) 분기 — 어느 옵션도 KRX 의존 X (K12-B 만 KRX, 본 폐기로 K12-B = KRX 재발급 분기)

---

## 등록 철회 박제

| 위치 | 변수 | 철회 명령 | 흥권 작업 |
|---|---|---|---|
| GitHub Secrets | `KRX_API_KEY` | `gh secret remove KRX_API_KEY --repo dudurim88255-dev/flow-signal` | PowerShell 실행 |
| Vercel env | `KRX_API_KEY` (production + preview) | `vercel env rm KRX_API_KEY production preview --yes` | PowerShell 실행 |
| .env.local | `KRX_API_KEY=...` 라인 | 라인 제거 (commit 1 본 cycle CC 처리) | — |
| KRX portal | 인증키 자체 | https://openapi.krx.co.kr/ 로그인 → 인증키 폐기 | 흥권 직접 (5분) |

---

## auth.ts 골격 박제 유지 사유

`lib/signals/fetchers/krx/auth.ts` (commit `1eabbe7` 박제) = git history 그대로 유지. **git revert X**.

이유:
- ADR 009 K12-B (KRX 재발급 후 산업별지수) 채택 시 재활성화 가능
- ADR 007 §D5 미래 트리거 (10/24 baseline 강결론 후 OHLCV-B 검토) 진입 시 재활성화 가능
- git history 보존 = 검증 cycle 정신 영원 박제 (추측 → portal 실측 → 폐기 → 재활성화 가능성)

재활성화 조건:
1. 흥권 KRX 사이트 재발급 (회원가입 + 인증키 신청 + 1일 승인)
2. ADR 009 K12-B 또는 ADR 007 §D5 OHLCV-B 채택
3. 환경변수 `KRX_API_KEY` 3곳 (GHA Secrets + Vercel env + .env.local) 재등록
4. auth.ts 골격 그대로 사용 가능 (변수명 정합 박제)

---

## 미래 진입 트리거

본 fetcher 디렉토리 활성화 조건:
- ADR 009 Decision = K12-B (KRX 산업별지수) 채택 → `sector.ts` 박제 + auth.ts 헤더 이름 portal docs 박제 후 정정
- ADR 007 §D5 Decision = OHLCV-B (KRX OPEN API "주식" 카테고리) 채택 → `ohlcv.ts` 박제 (10/24 baseline 강결론 후)

---

## Related

- ADR 006 §Decision §1·2 — KRX OPEN API 가정 부정 (research-krx 박제)
- ADR 007 §D3 — 부분 부정 + ADR 009 supersede
- ADR 007 §D5 — OHLCV-A Yahoo Finance 유지
- ADR 009 — K12-B 의 KRX 재발급 분기 박제
- commit `1eabbe7` — auth.ts 골격 박제 (history 보존)
- commit `b7d2b41` — ADR 007 Status Accepted

---

*Status: Archive (2026-05-04). 재활성화 = 흥권 KRX 재발급 + ADR 009 K12-B 또는 ADR 007 §D5 OHLCV-B 채택 후.*
