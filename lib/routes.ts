import type { StockDef } from './stocks';

/** lib/stocks.ts 기반 StockDef → /score 경로 */
export function toScoreRoute(stock: StockDef): string {
  if (stock.market === 'crypto') {
    return `/score/crypto/${stock.symbol}`;
  }
  if (stock.market === 'kospi' || stock.market === 'kosdaq') {
    const code = stock.symbol.replace('.KS', '').replace('.KQ', '');
    return `/score/korea/${code}`;
  }
  if (stock.market === 'us') {
    return `/score/us/${stock.symbol}`;
  }
  return '/';
}

/** Portfolio Holding (id = coinId ?? symbol) → /score 경로 */
export function toScoreRouteFromHolding(holding: {
  id: string;
  market: string;
}): string {
  if (holding.market === 'crypto') {
    return `/score/crypto/${holding.id}`;
  }
  if (holding.market === 'kospi' || holding.market === 'kosdaq') {
    const code = holding.id.replace('.KS', '').replace('.KQ', '');
    return `/score/korea/${code}`;
  }
  if (holding.market === 'us') {
    return `/score/us/${holding.id}`;
  }
  return '/';
}

/** API StockData (coinId 포함) → /score 경로 */
export function toScoreRouteFromData(stock: {
  symbol: string;
  coinId?: string;
  market: string;
}): string {
  if (stock.market === 'crypto') {
    return `/score/crypto/${stock.coinId ?? stock.symbol}`;
  }
  if (stock.market === 'kospi' || stock.market === 'kosdaq') {
    const code = stock.symbol.replace('.KS', '').replace('.KQ', '');
    return `/score/korea/${code}`;
  }
  if (stock.market === 'us') {
    return `/score/us/${stock.symbol}`;
  }
  return '/';
}
