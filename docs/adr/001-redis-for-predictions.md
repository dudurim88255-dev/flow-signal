# ADR 001 — 예측 저장소로 Redis 선택

**날짜**: 2026-04  
**상태**: 확정

## 결정

예측 결과(`Prediction`)와 진화된 신호 가중치(`MarketWeights`)를 Upstash Redis에 저장한다.

## 이유

- **TTL 기반 자동 만료**: 예측은 30일, 가중치는 1년 후 자동 삭제. DB였으면 별도 배치 정리 필요.
- **Vercel Edge 친화적**: Upstash Redis REST API는 HTTP이므로 Edge Function에서도 호출 가능.
- **스키마 불필요**: 예측 구조가 계속 바뀌는 초기 단계에서 마이그레이션 없이 JSON 그대로 저장.
- **비용**: 예측 데이터는 소량(하루 수십 건)이라 Redis free tier로 충분.

## 키 스키마

```
prediction:{market}:{ticker}:{YYYY-MM-DD}  — TTL 30일
weights:{market}                            — TTL 365일
```

## 환경변수 이중 지원

`KV_REST_API_*` (Vercel KV 레거시) 또는 `UPSTASH_REDIS_REST_*` (Upstash 직접) 모두 지원.  
→ `lib/redis.ts`에서 KV 우선, fallback Upstash.  
Vercel KV가 sunset됐으나 기존 env var가 남아있는 환경을 위해 유지.

## 한계 (알고 선택한 것)

- `redis.keys('prediction:crypto:*')` 패턴 스캔은 데이터 수천 건 이상이면 느려짐.
- 예측이 1만 건 넘어가면 Neon Postgres로 마이그레이션 검토.
