# FlowSignal × Financial ML 서베이 — 학습 노트 & 작업 결정사항

> 작성일: 2026-04-14 (오전)
> 맥락: Kelly & Xiu "Financial Machine Learning" (2023, NBER WP 31502) 학습 후 FlowSignal 진화 로드맵 수립
> 다음 액션: 2026-04-27 19:00 baseline 작업

---

## 0. 이 문서의 목적

흥권님이 오전에 Kelly-Xiu의 150페이지 Financial Machine Learning 서베이 논문을 Claude와 같이 읽고, 그 결과를 FlowSignal에 어떻게 적용할지 결정한 내용의 전체 기록. 퇴근 후 집에서 이 파일과 동봉된 3개 파일(baseline-schedule.md, baseline-capture.ts, wedge.ts)만 보면 작업 재개 가능하도록 작성.

---

## 1. 논문 3종 핵심 요약

### 1.1 Kelly & Xiu (2023) "Financial Machine Learning" — 150p 서베이

**논문 구조**:
1. Introduction — 가격은 예측이다
2. The Virtues of Complex Models — 복잡도는 미덕
3. Return Prediction — 실증 기법 호스레이스
4. Risk-Return Tradeoffs — 팩터 모델
5. Optimal Portfolios — MSRR·SDF·강화학습
6. Conclusions

**2장 핵심 명제 (Kelly-Malamud-Zhou 2022, 현 JoF 2024)**:
- 분석가의 딜레마: `R_{t+1} = f(X_t) + ε`, f 미지
- 뉴럴넷 근사 → 리지 회귀, 복잡도 `c = P/T`
- **"계산 가능한 한 가장 큰 모델을 써라"**
- c ≈ 0: 편향 커서 무용
- c → 1: OLS 폭발 (interpolation boundary, 과적합 지옥)
- c > 1: ridgeless R² 재상승 (암묵적 정규화)
- 적절한 z(ridge)를 주면 double descent 대신 **"permanent ascent"**
- 샤프비율이 복잡도에 대해 단조 증가

**저자 공식 권고**:
> "임의의 예측 변수를 마구 추가하라는 허가가 아니다. (i) 그럴듯한 모든 예측 변수를 포함하고 (ii) 단순 선형보다 풍부한 비선형 모델을 쓰라. 학습 데이터가 부족해도, 특히 신중한 shrinkage와 함께라면 예측·포트폴리오 이득이 있다."

**3장 실증 호스레이스 (Gu-Kelly-Xiu RFS 2020)**:
- 1000개 변수 OLS: R² = -35%/월, 시장 언더퍼폼
- 같은 변수 Elastic Net: 표본외 샤프 1.33
- 뉴럴넷(NN1-NN5) > 트리(RF/GBRT) > 페널티선형 > OLS
- **이득의 원천**: 비선형 예측변수 상호작용
- 모든 기법이 같은 지배 시그널에 합의: 모멘텀·유동성·변동성
- S&P 500 타이밍: NN 샤프 0.77 vs buy-hold 0.51
- 개별주식 롱숏: NN 샤프 1.35 (회귀 대비 2배)

**4장 팩터 모델**:
- IPCA (Kelly-Pruitt-Su 2019): `β_{i,t} = Γ·z_{i,t}` — 특성을 β의 instrument로
- 오토인코더 팩터 모델 (Gu-Kelly-Xiu 2021): IPCA의 선형 β를 NN으로
- 이상현상 80%+가 리스크 프리미엄으로 재해석

**5장 최적 포트폴리오 — 가장 실전적**:
- Plug-in Markowitz는 실전에서 재앙
- **MSRR (Maximum Sharpe Ratio Regression)**: `w_t = S_t·β`, 샤프를 직접 회귀로 최대화
- High Complexity MSRR: 복잡도 미덕이 포트폴리오 샤프에도 적용 (Didisheim et al. 2023)
- SDF = 거래 가능 포트폴리오
- **5.6 거래비용 & RL**: DeMiguel-Martin-Utrera-Nogales-Uppal 2020 — 대부분의 특성이 거래비용 후 표본외 가치 상실. 손실함수에 `(w_t − w_{t-1})'·TC·(w_t − w_{t-1})` 항 추가가 정석

### 1.2 Didisheim-Ke-Kelly-Malamud (2023) "Complexity in Factor Pricing Models"

- NBER WP 31689, 172페이지, 현재 제목 "APT or AIPT?"
- https://www.nber.org/papers/w31689
- SSRN abstract=4574634

**복잡도 쐐기 분해식**:
```
Wedge(z, c) = u_IS − u_OOS
            = (u_IS − u_TRUE) + (u_TRUE − u_OOS)
            = Overfit       + Limits to Learning
```
- `u`: 효용 (샤프비율 또는 가격결정오차)
- `c = P/T`
- c > 0이면 limits to learning은 항상 양수
- ridge shrinkage z로 둘 다 완화 가능 (단, 0으로 만들 수는 없음)

**실증 규모**:
- JKP 주식 특성 + random Fourier feature
- P = 36 ~ 360,000, c = 0.1 ~ 1,000, T = 360개월
- 고복잡도 샤프 ~3.7 vs 저복잡도 c<1 샤프의 2.6배
- 즉 쐐기 이론은 실증적으로 **2배 이상의 샤프 격차** 설명력

### 1.3 Kelly-Malamud-Zhou (JoF 2024) — 결정적 경고

> "타이밍 전략이 음의 R²를 가지면서도 양의 표본외 기대수익과 양의 샤프비율을 가질 수 있다. 양의 표본외 R²는 경제적으로 가치 있는 타이밍 전략의 필요조건이 아니다."

**FlowSignal 적용**: baseline 지표에서 R²를 빼라. 샤프·수익·변동성·히트율만 추적.

---

## 2. FlowSignal 진화 로드맵 (4단계)

```
v3.1 (현재)
  선형 가중합 + 레짐별 가중치 + WF bootstrap(60/14/14)
  c = P/T ≈ 0.17~0.25 (저복잡도 안전지대, 미덕 활용 불가)
     ↓
v3.2 (1순위, 이번 작업)
  복잡도 쐐기 해석 인프라 구축
  4/27 baseline → 6회 체크포인트 → 10/24 강결론
  evolve 재개 전후 정량 비교 가능화
     ↓
v3.3 (2순위, baseline 운영 중 병행 가능)
  Risk Gate를 이분적 차단 → 점수 페널티로 전환
  DeMiguel 2020 거래비용 관점 적용
  이슈 ③(실시간 미적용) + ⑥(WF 결과로 차단) 동시 해결
  실시간 조회는 "계산하되 risk_flags 배지만" 모드
     ↓
v4 (3순위, 중장기)
  MSRR로 "예측 → 포트폴리오" 2단계 통합
  2-layer MLP 비선형 집계기 도입 (P 증가 → c↑ → 미덕 영역 진입)
  IPCA식 레짐 파라미터화: w_t = Γ·regime_t
  Chen-Pelger-Zhu 2021 GAN SDF 탐색
```

**각 단계의 전제**: 다음 단계의 기준선이 되는 wedge 측정값이 있어야 진짜 개선인지 판단 가능. 순서를 지키는 것 자체가 진화의 핵심.

---

## 3. 4/27 Baseline 작업 결정사항

### 3.1 대상
- BTC (crypto, P=13)
- 005930 삼성전자 (korea, P=15)
- NVDA (us, P=10)

### 3.2 복잡도 좌표
| 항목 | 값 |
|---|---|
| P | 10~15 |
| T_train (bootstrap) | 60 |
| **c** | **0.17 ~ 0.25** |
| interpolation boundary 거리 | 0.75 ~ 0.83 |
| 위치 | 저복잡도 안전지대 |
| 의미 | 과적합 위험 낮음 / 복잡도 미덕 미활용 |

### 3.3 IS 지표 산출 — 하이브리드 방식

**결정**: A(primary) + B(reference) 병기.

| 방식 | 역할 | 소스 |
|---|---|---|
| A | primary (쐐기 계산에 사용) | WF 60일 bootstrap의 실제 실현 수익률 |
| B | reference (사후 대조) | evaluateSignals 내부 산출값 |

**이유**:
- A는 논문의 u_IS 정의와 정확히 일치, 재현성 있음
- B는 저장 비용 0이며 A와의 괴리 자체가 진단 신호(evaluateSignals 로직 검증)
- haiku-4.5 호출의 확률성은 A를 쓰면 우회됨

### 3.4 주 측정 단위 — 5d

**샘플 크기 분석**:
- 60일 bootstrap에서 5d 예측: 12개 독립 관측
- 60일 bootstrap에서 14d 예측: 4개 독립 관측
- 5d가 14d보다 **3배 빠른 속도**로 정확도 향상

**샤프 SE 공식**: `SE(SR) ≈ √((1 + 0.5·SR²)/n)`, 참값 SR=1 가정

| 경과일 | 5d n | 5d SE | 14d n | 14d SE |
|---|---|---|---|---|
| 15일 | 3 | 0.71 | 1 | ∞ |
| 30일 | 6 | 0.50 | 2 | 0.87 |
| 60일 | 12 | 0.35 | 4 | 0.61 |
| **85일** | **17** | **0.30** | 6 | 0.50 |
| 120일 | 24 | 0.25 | 8 | 0.43 |
| **180일** | **36** | **0.20** | 12 | 0.35 |

**결정**: 5d가 주, 14d가 보조. 둘의 괴리는 과적합 진단 지표로 활용.

### 3.5 OOS 체크포인트 일정 (6회)

| 회차 | 날짜 | 경과일 | 5d n | 5d SE | 단계 |
|---|---|---|---|---|---|
| 0 | 2026-04-27 | 0 | 0 | — | **Baseline 저장**, OOS=null |
| 1 | 2026-05-12 | 15 | 3 | 0.71 | 초기 스냅샷, 방향성만 |
| 2 | 2026-05-27 | 30 | 6 | 0.50 | **1차 wedge 추정**, 신뢰도 낮음 |
| 3 | 2026-06-26 | 60 | 12 | 0.35 | **2차**, 쐐기 ≥0.7 식별 가능 |
| 4 | 2026-07-21 | 85 | 17 | 0.30 | **3차, 실용 최소 신뢰** |
| 5 | 2026-08-25 | 120 | 24 | 0.25 | **4차**, 쐐기 ≥0.5 식별 |
| 6 | 2026-10-24 | 180 | 36 | 0.20 | **5차, 강한 결론** (쐐기 ≥0.4) |

### 3.6 evolve 재개 타이밍

**결정: Case 1 — 4/27 baseline 직후 즉시 재개**

이유: pre/post-evolve의 OOS 수집이 동시 진행되어 시간 낭비 없음. 기다리면 첫 비교가 9월 중순으로 밀림.

### 3.7 evolve 전후 해석 판정표

| 관찰 | 해석 | 액션 |
|---|---|---|
| ΔSharpe_OOS > 0, ΔWedge < 0 | **진짜 개선** | evolve 공식 채택 |
| ΔSharpe_OOS > 0, ΔWedge ≈ 0 | 적합도 향상 | 수용 |
| ΔSharpe_OOS ≈ 0, ΔWedge < 0 | 안정성 개선 | 운영 지속 |
| ΔSharpe_OOS > 0, ΔWedge > 0 | **함정 (IS만 부풀어짐)** | 경계, 추가 관측 |
| ΔSharpe_OOS < 0 | 재학습 실패 | 이전 가중치로 롤백 |

---

## 4. 구현 파일 4종

이 노트와 함께 묶여 있는 파일:

1. **`docs/complexity-wedge-notes.md`** (이 파일) — 학습 노트 + 결정사항 전체
2. **`docs/baseline-schedule.md`** — 6회 체크포인트 캘린더 + 각 시점 체크리스트
3. **`scripts/baseline-capture.ts`** — baseline JSON 저장 스크립트 초안
4. **`lib/metrics/wedge.ts`** — 쐐기 계산 모듈 초안

집에서 Claude Code에 던질 때:
```
@docs/complexity-wedge-notes.md 를 읽고 
@scripts/baseline-capture.ts 와 @lib/metrics/wedge.ts 를 
FlowSignal 프로젝트에 맞게 완성해줘. 
주의사항은 docs/baseline-schedule.md 참고.
```

---

## 5. 주의사항 (FlowSignal 고유)

### 5.1 절대 건드리지 말 것
- **Dashboard 코드**: 2026-04-14 새벽 디자인 통일 시도로 탭 렌더링 불안정 경험 있음(9d80027 롤백). baseline 작업은 Dashboard 무관, /score/ API만 호출
- **upstash-kv-lime-lamp Redis**: 진짜 사용 중 인스턴스. ideal-wahoo-82696(빈 것)과 혼동 금지
- **COIN_TO_BINANCE 맵**: BTC 신호 계산에 필수. 새 코인 추가 시 이 맵에도 추가해야 findTicker 역방향 조회 동작

### 5.2 기존 미해결 이슈와의 관계
쐐기 인프라는 다음 이슈에 답을 주는 수단:
- 이슈 ⑧(예측 5d/14d 이중 검증 학습 영향 불명) → 쐐기가 이걸 정량화
- 이슈 ⑨(admin 메트릭 IC/hit/Sharpe 가시화 없음) → wedge admin 페이지가 해결
- 이슈 ③(Risk Gate 실시간 미적용) → v3.3에서 별도 해결, baseline은 그대로 진행

### 5.3 기존 버그 (주말 4/18 작업 예정, baseline과 무관)
- 검색 후 전체 클릭 불가
- 투자시그널 카드 시간 경과에 따라 악화 (SSE 연결 누수 추정)
- 대시보드 아래쪽 리스트 클릭은 정상
- → DevTools Network 탭 EventSource 개수 모니터링부터

---

## 6. 참고 문헌

- Kelly, B. & Xiu, D. (2023). "Financial Machine Learning." NBER WP 31502 / SSRN 4501707  
  https://www.nber.org/papers/w31502  
  https://bfi.uchicago.edu/wp-content/uploads/2023/07/BFI_WP_2023-100.pdf
- Didisheim, A., Ke, S., Kelly, B., Malamud, S. (2023). "Complexity in Factor Pricing Models" / "APT or AIPT?". NBER WP 31689 / SSRN 4574634  
  https://www.nber.org/papers/w31689
- Kelly, B., Malamud, S., Zhou, K. (2024). "The Virtue of Complexity in Return Prediction." Journal of Finance.  
  https://onlinelibrary.wiley.com/doi/10.1111/jofi.13298
- Gu, S., Kelly, B., Xiu, D. (2020). "Empirical Asset Pricing via Machine Learning." RFS 33(5).
- DeMiguel, V. et al. (2020). "A Transaction-Cost Perspective on the Multitude of Firm Characteristics." RFS 33(5).
