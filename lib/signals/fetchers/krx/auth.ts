/**
 * KRX OPEN API 인증 wrapper
 *
 * ADR 006 Phase 2 부분 진입 — auth.ts 골격만 박제 (2026-05-04).
 * flow.ts / sector.ts / types.ts / Vitest fixture 는
 * portal endpoint docs 박제 후 별 PR (다음 세션):
 *   docs/research-krx-openapi-endpoints-2026-05-03.md
 *
 * 다음 세션 portal 박제 후 본 파일 정정 항목:
 *   1. AUTH_HEADER_NAME — 정확한 헤더 이름 (현 TBD)
 *      후보: AUTH_KEY / apikey / Authorization / X-API-KEY
 *   2. DEFAULT_BASE_URL — API host 정합 검증
 *      현재는 portal URL (https://openapi.krx.co.kr) 가정
 *   3. rate limit 처리 — 호출 간격 / 일별 한도 (현 미박제)
 *
 * 환경변수 (3곳 박제 ground truth — 2026-05-04):
 *   - KRX_API_KEY        — KRX OPEN API 인증키 (필수)
 *   - KRX_API_BASE_URL   — 선택, portal docs 박제 후 정확 host 박제
 */

const DEFAULT_BASE_URL = 'https://openapi.krx.co.kr';

export class KrxAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KrxAuthError';
  }
}

/**
 * KRX_API_KEY 환경변수 read.
 * 미박제 / 빈 문자열 시 KrxAuthError throw — fetcher 호출 시점에 명시적 fail.
 *
 * ADR 006 fallback policy: 키 미박제 / 401 / 403 → 해당 신호 live: false 강제.
 * 본 함수는 키 자체 부재만 catch, 401/403 은 호출 후 응답 status 로 처리 (flow.ts 박제 시).
 */
export function getKrxApiKey(): string {
  const key = process.env.KRX_API_KEY;
  if (!key || key.trim() === '') {
    throw new KrxAuthError(
      'KRX_API_KEY 환경변수 미박제 — .env.local / Vercel / GHA Secrets 확인'
    );
  }
  return key.trim();
}

/**
 * KRX OPEN API base URL.
 * default 는 portal URL — portal docs 박제 후 API host 정합 검증.
 * 환경변수 KRX_API_BASE_URL 로 override 가능 (예: staging / mirror endpoint).
 */
export function getKrxBaseUrl(): string {
  const override = process.env.KRX_API_BASE_URL?.trim();
  return override && override.length > 0 ? override : DEFAULT_BASE_URL;
}

/**
 * KRX OPEN API 호출 헤더 빌더.
 *
 * TBD: 정확한 인증 헤더 이름 — portal docs 박제 후 확정.
 * 현재는 envelope (Content-Type, Accept) 만 박제.
 *
 * portal 박제 후 정정:
 *   const apiKey = getKrxApiKey();
 *   return {
 *     '<HEADER_NAME>': apiKey,
 *     'Content-Type': 'application/json',
 *     Accept: 'application/json',
 *   };
 */
export function buildKrxHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/**
 * base URL + path 결합 (leading slash 정규화).
 * flow.ts / sector.ts 박제 시 endpoint path 결합 헬퍼로 사용.
 */
export function buildKrxUrl(path: string): string {
  const base = getKrxBaseUrl().replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}
