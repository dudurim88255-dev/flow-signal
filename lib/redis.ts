import { Redis } from "@upstash/redis";

// Redis 싱글톤 — 빌드 시 크래시 방지용 지연 초기화
let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}
