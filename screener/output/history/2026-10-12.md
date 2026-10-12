# 소형 코인 스크리너 — 2026-10-12

생성: 2026-10-12 09:52 KST · 출처: DefiLlama 무료 API (`/overview/fees`, `/protocols`, `/lite/protocols2`, `/summary/fees/{slug}`) + CoinGecko 무료 API (`/coins/markets`) — CoinGecko 632/736개 조회

필터: mcap $5M~$100M · rev_30d ≥ $50,000 · trend ≥ 1.0 · 토큰 보유

- rev = DefiLlama `dailyRevenue`, 자식 프로토콜은 부모(토큰) 단위로 합산
- rev_annual = rev_30d × 12 · pf = FDV(없으면 mcap) ÷ rev_annual — `(기준)` 표시
- trend = 최근 완결 3개월 월평균 ÷ 그 전 3개월 월평균 (진행 중인 달 제외)
- mcap·FDV = CoinGecko 값 우선 (없으면 DefiLlama mcap) · 유통비율 = mcap ÷ FDV · pf_mcap = mcap ÷ rev_annual
- 플래그: `mcap불일치` DefiLlama·CoinGecko mcap 차이 >30% (토큰 매핑 오류 의심) · `유통<25%` 향후 언락 희석 위험 · `pf<1 데이터확인` 매출 과대집계 의심
- FDV 기준 행: 26/26

## 결과 (26개, pf 오름차순)

| # | 이름 | 분야 | mcap | FDV | 유통비율 | rev_30d | trend | pf (기준) | pf_mcap | holders_rev_30d | 분야 내 pf 순위 | 플래그 | 링크 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Graphite Protocol | Launchpad | $21.29M | $34.88M | 61% | $3.42M | 8.77 | 0.9x (FDV) | 0.5x | $7.90K | 1/2 | pf<1 데이터확인 | [DefiLlama](https://defillama.com/protocol/graphite-protocol) |
| 2 | Gains Network | Derivatives | $9.25M | $9.25M | 100% | $546.03K | 1.47 | 1.4x (FDV) | 1.4x | $41.50K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/gains-network) |
| 3 | ORE Protocol | Gamified Mining | $61.53M | $61.53M | 100% | $2.96M | 1.02 | 1.7x (FDV) | 1.7x | $2.93M | 1/1 | - | [DefiLlama](https://defillama.com/protocol/ore-protocol) |
| 4 | Inverse Finance | CDP | $7.48M | $7.64M | 98% | $278.61K | 1.17 | 2.3x (FDV) | 2.2x | $6.98K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/inverse-finance) |
| 5 | Solv Protocol | Bridge | $23.53M | $39.77M | 59% | $1.26M | 1.28 | 2.6x (FDV) | 1.6x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/solv-protocol) |
| 6 | Marinade | Staking Pool | $14.65M | $18.76M | 78% | $441.01K | 1.28 | 3.5x (FDV) | 2.8x | $220.50K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/marinade-finance) |
| 7 | Beefy | Yield Aggregator | $5.43M | $5.43M | 100% | $100.31K | 1.06 | 4.5x (FDV) | 4.5x | $36.11K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/beefy) |
| 8 | Stargate Finance | Cross Chain Bridge | $18.53M | $18.53M | 100% | $272.83K | 1.63 | 5.7x (FDV) | 5.7x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/stargate-finance) |
| 9 | Chainflip | Dexs | $26.49M | $26.49M | 100% | $326.18K | 1.09 | 6.8x (FDV) | 6.8x | $326.18K | 1/5 | - | [DefiLlama](https://defillama.com/protocol/chainflip) |
| 10 | Venus | Lending | $53.58M | $94.50M | 57% | $726.00K | 1.66 | 10.8x (FDV) | 6.2x | $289.52K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/venus-finance) |
| 11 | Saphyre | Dexs | $5.02M | $20.27M | 25% | $149.43K | 1.04 | 11.3x (FDV) | 2.8x | - | 2/5 | 유통<25% | [DefiLlama](https://defillama.com/protocol/dragon-swap) |
| 12 | Securitize | RWA | $55.64M | $357.64M | 16% | $2.61M | 1.14 | 11.4x (FDV) | 1.8x | - | 1/2 | 유통<25% | [DefiLlama](https://defillama.com/protocol/securitize) |
| 13 | SSV Network | Staking Pool | $43.43M | $43.43M | 100% | $305.20K | 2.32 | 11.9x (FDV) | 11.9x | $305.20K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/ssv-network) |
| 14 | Cetus | Dexs | $25.68M | $26.60M | 97% | $169.94K | 1.11 | 13.0x (FDV) | 12.6x | - | 3/5 | - | [DefiLlama](https://defillama.com/protocol/cetus) |
| 15 | Lista DAO | CDP | $34.67M | $64.15M | 54% | $347.41K | 2.18 | 15.4x (FDV) | 8.3x | $28.10K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/lista-dao) |
| 16 | Tornado Cash | Privacy | $32.44M | $67.56M | 48% | $351.74K | 1.80 | 16.0x (FDV) | 7.7x | $351.74K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/tornado-cash) |
| 17 | Definitive | DEX Aggregator | $30.90M | $113.79M | 27% | $536.13K | 2.15 | 17.7x (FDV) | 4.8x | $107.23K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/definitive) |
| 18 | Spark | Lending | $74.62M | $222.66M | 34% | $1.02M | ∞ | 18.1x (FDV) | 6.1x | $649.22K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/spark) |
| 19 | Sushi | DEX Aggregator | $69.16M | $70.31M | 98% | $270.05K | 1.11 | 21.7x (FDV) | 21.3x | $7.66K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/sushi) |
| 20 | Centrifuge | RWA | $56.01M | $100.13M | 56% | $361.84K | 1.06 | 23.1x (FDV) | 12.9x | - | 2/2 | - | [DefiLlama](https://defillama.com/protocol/centrifuge) |
| 21 | stake.link | Liquid Staking | $11.68M | $30.75M | 38% | $88.86K | 1.04 | 28.8x (FDV) | 11.0x | $53.31K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/stake.link) |
| 22 | Rhea Finance | Dexs | $39.40M | $95.56M | 41% | $274.48K | 1.32 | 29.0x (FDV) | 12.0x | - | 4/5 | - | [DefiLlama](https://defillama.com/protocol/rhea-finance) |
| 23 | ApeX Protocol | Derivatives | $38.84M | $125.21M | 31% | $182.07K | 1.17 | 57.3x (FDV) | 17.8x | $182.07K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/apex-protocol) |
| 24 | o1.exchange | Launchpad | $77.01M | $481.32M | 16% | $683.47K | 9.70 | 58.7x (FDV) | 9.4x | - | 2/2 | 유통<25% | [DefiLlama](https://defillama.com/protocol/o1-exchange) |
| 25 | Lombard | Restaked BTC | $45.39M | $124.77M | 36% | $133.57K | 1.52 | 77.8x (FDV) | 28.3x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/lombard-finance) |
| 26 | VVS Finance | Dexs | $42.88M | $93.66M | 46% | $54.32K | 1.46 | 143.7x (FDV) | 65.8x | $36.08K | 5/5 | - | [DefiLlama](https://defillama.com/protocol/vvs-finance) |

## 필터 단계별 탈락

| 단계 | 개수 |
|---|---|
| 대상 (매출 보고 프로토콜, 부모 단위 합산) | 1931 |
| 토큰 없음 | 1056 |
| mcap 5M~100M 범위 밖 (mcap 미상 포함) | 687 |
| rev_30d < $50,000 | 125 |
| trend 계산 불가 (완결 월 6개 미만/데이터 없음) | 8 |
| trend < 1.0 | 29 |
| 최종 통과 | 26 |

## 검증 행: Infinex (필터 무관)

| # | 이름 | 분야 | mcap | FDV | 유통비율 | rev_30d | trend | pf (기준) | pf_mcap | holders_rev_30d | 분야 내 pf 순위 | 플래그 | 링크 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| - | Infinex | Interface | $9.80M | $49.14M | 20% | $48.38K | 0.48 | 84.7x (FDV) | 16.9x | - | - | 유통<25% | [DefiLlama](https://defillama.com/protocol/infinex) |

- 사용한 완결 월: 2026-04, 2026-05, 2026-06, 2026-07, 2026-08, 2026-09 · 합산 자식: Infinex Perp, Infinex Spot, Infinex Hyperliquid Spot, Infinex Outcome
