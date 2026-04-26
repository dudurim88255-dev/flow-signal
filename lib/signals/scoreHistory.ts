/**
 * ScoreHistory — FlowScore 7일 추이를 prediction 저장소에서 derive.
 *
 * 배경:
 *   별도 score:v3:*:history:7d Redis key 는 존재하지 않음 (verify 2026-04-26).
 *   savePrediction() 이 매일 prediction:{market}:{ticker}:{YYYY-MM-DD} 에 score 저장.
 *   여기서 최근 7일치 daily prediction 을 mget 으로 조회하여 score 만 추출.
 *
 * 반환 형식:
 *   number[] — 시간 오름차순 (가장 오래된 것이 [0], 오늘이 [N-1]).
 *   누락 일자는 배열에서 skip (빈 슬롯 X). 호출 측이 length 로 데이터 풍부도 판단.
 *
 * 빈 배열 fallback:
 *   prediction 데이터 누적 안 된 신규 종목 또는 cron 미실행 시 [].
 */

import { getRedis } from '../redis';
import type { Market, Prediction } from '../predictions';
import { daysAgoStr } from '../predictions';

const HISTORY_DAYS = 7;

export async function getScoreHistory7d(
  market: Market,
  ticker: string
): Promise<number[]> {
  const redis = getRedis();

  // 7일치 키 생성 — 가장 오래된 → 오늘 순서
  const keys: string[] = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    keys.push(`prediction:${market}:${ticker}:${daysAgoStr(i)}`);
  }

  // mget — 누락 일자는 null 반환
  const raw = await redis.mget<(string | null)[]>(...keys);

  const scores: number[] = [];
  for (const value of raw) {
    if (value == null) continue;
    try {
      const pred: Prediction =
        typeof value === 'string' ? JSON.parse(value) : (value as Prediction);
      if (typeof pred.score === 'number') {
        scores.push(pred.score);
      }
    } catch {
      // 파싱 실패 — 해당 일자 skip
    }
  }

  return scores;
}
