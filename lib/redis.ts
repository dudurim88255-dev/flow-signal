import { Redis } from "@upstash/redis";

// Redis 싱글톤 — 빌드 시 크래시 방지용 지연 초기화
let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    // Vercel KV(KV_REST_API_*) 또는 Upstash 직접(UPSTASH_REDIS_REST_*) 모두 지원
    // KV_REST_API_* (Vercel KV) 우선, 없으면 UPSTASH_REDIS_REST_* 사용
    const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error("Redis env vars not set");
    _redis = new Redis({ url, token });
  }
  return _redis;
}
