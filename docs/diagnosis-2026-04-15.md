# FlowSignal Phase 1 시그널 무결성 진단 보고서

**작성일**: 2026-04-15  
**대상 브랜치**: main (commit 744bddb)  
**진단 범위**: lib/signals/*, app/api/score/route.ts, lib/predictions.ts  
**상태**: 읽기 전용 — 수정 없음

---

## 1. 코드 구조 확인

### 1-A. 신호 정의 및 파일 구성

| 파일 | 담당 | 신호 수 | 비고 |
|------|------|---------|------|
| `lib/signals/crypto.ts` | C1~C13 정의 + `flowScore()` | 13 | live 기본값 포함 |
| `lib/signals/korea.ts` | K1~K12 정의 | 12 | `flowScore` re-export |
| `lib/signals/us.ts` | U1~U12 정의 | 12 | 전부 `live: true` 하드코딩 |
| `lib/signals/index.ts` | 통합 평가 엔진 `evaluateSignals()` | — | 레짐 가중치·confidence 계산 |
| `lib/signals/riskgate.ts` | 6개 리스크 체크 `runRiskGate()` | — | harvest 크론에서만 호출 |
| `lib/signals/walkforward.ts` | Shadow WF 검증 엔진 | — | Redis wf:result:{market} |

### 1-B. flowScore() 구현 — live 필터링 확인

`crypto.ts` 147~159행 (실제 코드):
```typescript
export function flowScore(signals: SignalScore[]) {
  // live: false 신호는 실데이터 없음 — 분자·분모 양쪽에서 제외 (v3.1)
  const active = signals.filter((x) => x.live);
  const pool = active.length > 0 ? active : signals; // fallback
  const totalW = pool.reduce((s, x) => s + x.weight, 0);
  const score  = pool.reduce((s, x) => s + x.score * x.weight, 0) / totalW;
  ...
}
```

**결론**: `flowScore()`는 내부적으로 `live:true` 신호만 사용해 가중합을 계산한다.  
fallback 조건(전체 live=0)은 의도된 설계.

---

## 2. 이슈 ⑤ — live:false 신호의 가중합 참여 여부

### 판정: **해소됨 (v3.1에서 수정 완료)**

`flowScore()`가 호출 시 ALL signals를 받더라도 내부에서 `filter(x => x.live)`로 제한한다.  
`evaluateSignals()`의 `flowScore(result.signals)` 호출도 동일하게 적용된다.

### 단, 주의할 파생 문제 발견: Confidence 계산의 분모 오염 가능성

`index.ts` 367~378행:
```typescript
// 레짐 가중치: ALL signals에 적용 (live:false 포함)
for (const sig of result.signals) {
  if (sig.id in storedWeights) {
    sig.weight = storedWeights[sig.id]; // 변이: live:false도 weight 업데이트됨
  }
}
const { score, label } = flowScore(result.signals); // 점수는 live만 사용 (OK)
```

`index.ts` 389~391행:
```typescript
const totalW = result.signals.reduce((s, x) => s + x.weight, 0); // live:false 포함!
const liveW  = result.signals.filter((x) => x.live).reduce((s, x) => s + x.weight, 0);
const coverage = totalW > 0 ? Math.round((liveW / totalW) * 100) : 0;
```

레짐 가중치가 non-live 신호에도 적용되면 `totalW`가 달라져 `coverage`가 흔들린다.  
그러나 이 confidence 값('high'/'medium'/'low')은 **프론트엔드에 실제로 전달되지 않는다** (이슈 ⑧ 참조).  
실질적 영향: 현재 없음. 잠재적 혼란: 있음.

---

## 3. 이슈 ⑦ — Risk Gate #5가 WF 결과를 참조하는 경로 확인

### 판정: **Risk Gate는 평가 파이프라인에 미연결**

`runRiskGate()` 호출 위치:
- ✅ `app/api/cron/harvest/route.ts` — harvest 크론 내에서만 사용
- ❌ `lib/signals/index.ts` (evaluateSignals) — **호출 없음**
- ❌ `app/api/score/[market]/[ticker]/route.ts` — **호출 없음**

**실제 흐름**:
```
브라우저 요청 → /api/score → evaluateSignals() → flowScore() → SSE 전송
                                ↑
                        Risk Gate 체크 없음

크론 01:00 UTC → /api/cron/harvest → evaluateSignals() → runRiskGate() → savePrediction()
                                                              ↑
                                                    Risk Gate 여기서만 실행
```

즉, **사용자가 /score 페이지에서 받는 점수는 Risk Gate를 통과하지 않는다.**  
샘플 부족(체크 #6)·WF 성능 저하(체크 #5)·레짐 불안정(체크 #3) 종목도  
/score에서는 정상 점수가 그대로 표시된다.

### Risk Gate #5 (WF 성능) 상세 동작

`riskgate.ts` 61~64행:
```typescript
export function checkWalkforwardPerformance(wfResult: WalkforwardResult | null): boolean {
  if (!wfResult || wfResult.windows.length === 0) return true; // null → pass (초기 단계)
  const avgAcc = wfResult.windows.reduce(...) / wfResult.windows.length;
  return avgAcc >= 45;
}
```

현재 예측 데이터가 없으므로 (`wf:result:{market}` Redis 키 없음) → 모든 시장 WF check는 **pass**.  
이는 의도된 초기 단계 동작.

---

## 4. 이슈 ⑧ — Confidence 이중 계산 시스템

### 판정: **타입 충돌 및 출처 불일치 확인됨**

두 개의 독립적인 confidence 계산이 공존한다:

| 위치 | 방식 | 타입 | 프론트 전달 여부 |
|------|------|------|-----------------|
| `index.ts:388-407` | live weight 커버리지 기반 (`liveW/totalW`) | `'high'\|'medium'\|'low'` | **아니오** |
| `route.ts:24-32` (`calcConfidence`) | 신호 점수 표준편차 기반 (`100 - stddev*2`) | `number (0~100)` | **예** |

#### 데이터 흐름 추적

```
evaluateSignals() 반환
  result.confidence = 'high'|'medium'|'low'  ← 커버리지 기반 (index.ts)

route.ts:
  const confidence = calcConfidence(result.signals);  ← stddev 기반 숫자 (0~100)
  redis.set(cacheKey, JSON.stringify({ ...result, confidence }))
  // → result.confidence (string) 이 confidence (number) 로 덮어씌워짐

SSE enqueue("result", { ..., confidence, ... })
  // 프론트엔드가 받는 값: 숫자 (stddev 기반)
```

#### 실측 불일치 예시 (2026-04-15 curl 결과)

**삼성전자(005930, korea)**:
- live 신호: K9(7)+K10(10)+K11(6)+K12(8) = liveW 31
- total weight: 14+12+10+8+8+6+5+6+7+10+6+8 = 100
- 커버리지 = 31% → index.ts 판단: `'low'` 신뢰도
- 실제 SSE 수신 confidence: **70** (stddev 기반, 낮은 편차 → 높은 값)

**비트코인(BTC, crypto)**:
- live 신호: C4(10)+C5(8)+C6(6)+C7(6)+C8(8)+C11(10)+C12(7)+C13(6) = liveW 61
- total weight: 108
- 커버리지 = 56% → index.ts 판단: `'medium'`
- 실제 SSE 수신 confidence: **76** (stddev 기반)

**판단**: 두 시스템이 서로 다른 의미를 가지며, 커버리지 기반 값은 계산만 되고 폐기된다.  
`EvalResult` 타입 선언(`confidence: 'high'|'medium'|'low'`)과 실제 저장/전송 타입(`number`)이 불일치한다.

---

## 5. 이슈 ⑨ — Crypto 활성(live) 신호 목록

### 판정: **8개 확인, C13 default 불일치 발견**

| ID | 이름 | 데이터 소스 | weight | live 기본값(crypto.ts) | live 실제(index.ts) |
|----|------|-----------|--------|----------------------|-------------------|
| C4 | 펀딩비 | Binance fundingRate | 10 | `false` | `true` |
| C5 | OI 변화 | Binance openInterest + Redis | 8 | `false` | `true` |
| C6 | 롱숏 비율 | Binance globalLongShortRatio | 6 | `false` | `true` |
| C7 | 공포탐욕 | alternative.me FNG | 6 | `false` | `true` |
| C8 | A/D 다이버전스 | CoinGecko OHLCV | 8 | `false` | `true` |
| C11 | 모멘텀(RSI+MACD) | CoinGecko OHLCV | 10 | `true` ⚠ | `true` |
| C12 | 거래량 Z | CoinGecko OHLCV | 7 | `true` ⚠ | `true` |
| C13 | 청산 스파이크 | Binance allForceOrders | 6 | `false` ⚠ | `true` |

**비활성(live:false) 신호**:

| ID | 이름 | 데이터 소스 | weight | 비고 |
|----|------|-----------|--------|------|
| C1 | 고래 순매수 | 온체인 (미연결) | 12 | `whaleNet24h=0` 하드코딩 |
| C2 | 거래소 순유출 | 온체인 (미연결) | 12 | `exchangeNetOut=0` 하드코딩 |
| C3 | 스테이블 유입 | 온체인 (미연결) | 8 | `stablecoinIn24h=0` 하드코딩 |
| C9 | 휴면코인 활성 | 온체인 (미연결) | 5 | `dormantReactivated7d=0` 하드코딩 |
| C10 | MVRV | CoinGecko 미지원 | 8 | `mvrv=1.5` 하드코딩 |

**발견된 불일치**:
- `crypto.ts` 141~142행: C11, C12의 기본값이 `live: live.C11 ?? true`로 `true` 디폴트
- 나머지 C1~C10, C13은 `live: live.Cx ?? false`로 `false` 디폴트
- `crypto.ts` 143행: C13 디폴트는 `false`이지만 `index.ts` 201행에서 명시적으로 `true`
- `computeCryptoSignals(input)` 를 liveFlags 없이 단독 호출하면 C11·C12만 live이고 C13은 non-live가 된다 (테스트 코드·미래 재사용 시 위험)

**활성 신호 weight 합계**: 10+8+6+6+8+10+7+6 = **61 / 108 (커버리지 56.5%)**

---

## 6. 추가 발견 — K12 업종 상대강도의 neutral 고착

`index.ts` 260행:
```typescript
sectorRet20d: 0,  // 업종 데이터 없음 → 0% 고정
```

`korea.ts` 71행:
```typescript
export const k12RelativeStrength = (stockRet20d: number, sectorRet20d: number) =>
  clip(50 + (stockRet20d - sectorRet20d) * 200, 0, 100);
```

K12는 `live: true`로 표시되지만 실제로는 `(stockRet20d - 0) * 200`  
즉, **절대 20일 수익률**을 측정한다. 섹터 대비 상대강도가 아니다.  
index.ts 주석도 "partially — sector는 neutral"로 인정하고 있음.

---

## 7. 스코어 샘플 (2026-04-15 실측)

### 비트코인 (crypto/bitcoin)
```
live 신호 8개:
  C4(펀딩비)=55, C5(OI)=50, C6(롱숏)=56.8, C7(공포탐욕)=77
  C8(A/D)=65, C11(모멘텀)=27.0, C12(거래량Z)=33.9, C13(청산)=50

비활성 신호 5개 (모두 score=50, neutral):
  C1=50, C2=50, C3=50, C9=50, C10=45

결과: score=50.5, label="관망", liveCount=8, confidence=76
현재가: $70,757, ret7d=-2.6%, ret30d=0%
```

### 삼성전자 (korea/005930)
```
live 신호 4개:
  K9(거래량+OBV)=57.6, K10(모멘텀)=72.5
  K11(이평선)=90, K12(업종상대강도*)=52.4  (* 실제론 절대 수익률)

비활성 신호 8개: K1~K8 (전부 neutral/고정값)
  K1=50, K2=50, K3=50, K4=50, K5=68, K6=50, K7=72, K8=30

결과: score=67.4, label="매수", liveCount=4, confidence=70
현재가: 211,000원, ret7d=+9.3%, ret30d=+22.5%
```

### 엔비디아 (us/NVDA)
```
live 신호 12개 (전부):
  U1(단기모멘텀)=100, U2(거래량서지)=46.5, U3(OBV)=100
  U4(A/D수급)=100, U5(이평선)=60, U6(20일수익률)=68.1
  U7(추세기울기)=99.0, U8(볼린저)=40, U9(60일수익률)=57.6
  U10(변동성)=45, U11(RSI+MACD)=82.6, U12(SPY상대강도)=57.6

결과: score=71.9, label="매수", liveCount=12, confidence=55
현재가: $196.51, ret7d=+10.8%, ret30d=+7.7%
```

---

## 8. Redis 예측 데이터 현황

`/api/report?market={market}` → 3개 시장 모두 "아직 생성된 리포트가 없습니다"  
→ 예측 데이터 없음 또는 harvest 크론 미실행 상태

**확인**: /api/cron/harvest는 매일 01:00 UTC 실행 예정이나, 현재까지 충분한 예측이 누적되지 않았음.  
Redis `prediction:*` 키: 0개 (harvest 미실행)  
WalkforwardResult: null (초기 단계, WF check #5 자동 pass)  
RiskGate #6 (샘플부족): verifiedCount=0 → 체크 **실패** 상태

---

## 9. 요약 — 발견된 이슈 등급 분류

| # | 이슈 | 등급 | 상태 |
|---|------|------|------|
| ⑤ | live:false 신호의 가중합 참여 | 🟢 해소 | v3.1에서 flowScore 내부 필터 완료 |
| ⑦a | Risk Gate가 평가 파이프라인에 미연결 | 🔴 설계 차이 | /score 경로는 Risk Gate 없이 점수 반환 |
| ⑦b | WF check: 초기엔 자동 pass | 🟡 정상 | 예측 누적 전 의도된 동작 |
| ⑧ | Confidence 이중 시스템 (타입 충돌) | 🔴 버그 | string 타입 선언 vs. number 실제 전송 |
| ⑨a | C13 live 기본값 불일치 | 🟡 잠재적 | index.ts는 true, crypto.ts 기본값은 false |
| ⑨b | C11·C12 live 기본값이 true (나머지는 false) | 🟡 불일치 | 일관성 없는 기본값 |
| ➕ | K12가 live:true이지만 절대 수익률 측정 | 🟡 오분류 | sectorRet20d=0 고착 |
| ➕ | 레짐 가중치가 non-live 신호에도 적용됨 | 🟢 무해 | totalW에 영향 있으나 score에는 무영향 |

---

## 10. 수정 권고 (우선순위 순, 실행은 승인 후)

1. **[P0] Confidence 타입 통일** — `EvalResult.confidence`를 number로 변경하거나, route.ts가 index.ts의 string 값을 사용하도록 통일. 현재 TypeScript 타입과 실제 런타임 값이 불일치.

2. **[P1] Risk Gate를 /score 경로에 연결** — 또는 Risk Gate는 harvest 전용임을 문서화. 현재 사용자 접근 경로에서 샘플부족·WF 실패 종목이 걸러지지 않음.

3. **[P2] C13 기본값 수정** — `crypto.ts` 143행: `live: live.C13 ?? false` → `live: live.C13 ?? true`. (단, Binance allForceOrders 엔드포인트 신뢰성 먼저 검토)

4. **[P2] K12 live:true 재검토** — `sectorRet20d`가 항상 0이라면 live 표시가 오해를 부를 수 있음. `live: false`로 변경하거나 실제 섹터 수익률 데이터를 연결.

5. **[P3] C11·C12 기본값 통일** — `computeCryptoSignals()` 독립 호출 시 예상과 다른 live 목록이 나오지 않도록 모든 신호의 기본값을 `false`로 통일하고 index.ts에서 명시적으로 지정.
