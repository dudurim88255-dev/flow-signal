# 소형 코인 스크리너 — 2026-11-02

생성: 2026-11-02 10:09 KST · 출처: DefiLlama 무료 API (`/overview/fees`, `/protocols`, `/lite/protocols2`, `/summary/fees/{slug}`) + CoinGecko 무료 API (`/coins/markets`) — CoinGecko 645/751개 조회

필터: mcap $5M~$100M · rev_30d ≥ $50,000 · trend ≥ 1.0 · 토큰 보유

- rev = DefiLlama `dailyRevenue`, 자식 프로토콜은 부모(토큰) 단위로 합산
- rev_annual = rev_30d × 12 · pf = FDV(없으면 mcap) ÷ rev_annual — `(기준)` 표시
- trend = 최근 완결 3개월 월평균 ÷ 그 전 3개월 월평균 (진행 중인 달 제외)
- mcap·FDV = CoinGecko 값 우선 (없으면 DefiLlama mcap) · 유통비율 = mcap ÷ FDV · pf_mcap = mcap ÷ rev_annual
- 플래그: `mcap불일치` DefiLlama·CoinGecko mcap 차이 >30% (토큰 매핑 오류 의심) · `유통<25%` 향후 언락 희석 위험 · `pf<1 데이터확인` 매출 과대집계 의심
- FDV 기준 행: 36/36

## 결과 (36개, pf 오름차순)

| # | 이름 | 분야 | mcap | FDV | 유통비율 | rev_30d | trend | pf (기준) | pf_mcap | holders_rev_30d | 분야 내 pf 순위 | 플래그 | 링크 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ORE Protocol | Gamified Mining | $75.63M | $75.63M | 100% | $4.24M | 1.03 | 1.5x (FDV) | 1.5x | $4.19M | 1/1 | - | [DefiLlama](https://defillama.com/protocol/ore-protocol) |
| 2 | THORSwap | DEX Aggregator | $9.55M | $9.55M | 100% | $503.51K | 1.24 | 1.6x (FDV) | 1.6x | $380.01K | 1/3 | - | [DefiLlama](https://defillama.com/protocol/thorswap) |
| 3 | Graphite Protocol | Launchpad | $12.59M | $20.62M | 61% | $1.02M | 16.10 | 1.7x (FDV) | 1.0x | $7.90K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/graphite-protocol) |
| 4 | GMX | Derivatives | $85.11M | $85.11M | 100% | $4.06M | 1.83 | 1.7x (FDV) | 1.7x | $3.70M | 1/4 | - | [DefiLlama](https://defillama.com/protocol/gmx) |
| 5 | Inverse Finance | CDP | $7.48M | $7.61M | 98% | $290.82K | 1.60 | 2.2x (FDV) | 2.1x | $9.40K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/inverse-finance) |
| 6 | Overtime | Prediction Market | $9.77M | $9.77M | 100% | $319.38K | 1.17 | 2.5x (FDV) | 2.5x | $69.80K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/overtime) |
| 7 | Solv Protocol | Bridge | $30.93M | $50.60M | 61% | $1.27M | 1.13 | 3.3x (FDV) | 2.0x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/solv-protocol) |
| 8 | Marinade | Staking Pool | $12.98M | $16.63M | 78% | $416.06K | 1.89 | 3.3x (FDV) | 2.6x | $208.03K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/marinade-finance) |
| 9 | Stargate Finance | Cross Chain Bridge | $14.72M | $14.72M | 100% | $342.19K | 2.73 | 3.6x (FDV) | 3.6x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/stargate-finance) |
| 10 | Gains Network | Derivatives | $9.12M | $9.12M | 100% | $164.12K | 1.27 | 4.6x (FDV) | 4.6x | $31.89K | 2/4 | - | [DefiLlama](https://defillama.com/protocol/gains-network) |
| 11 | Usual | RWA | $20.43M | $20.73M | 99% | $341.92K | 1.27 | 5.1x (FDV) | 5.0x | $176.71K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/usual) |
| 12 | Beefy | Yield Aggregator | $5.31M | $5.31M | 100% | $81.26K | 1.22 | 5.4x (FDV) | 5.4x | $29.25K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/beefy) |
| 13 | Chainflip | Dexs | $26.68M | $26.68M | 100% | $395.12K | 1.41 | 5.6x (FDV) | 5.6x | $393.09K | 1/7 | - | [DefiLlama](https://defillama.com/protocol/chainflip) |
| 14 | Dolomite | Lending | $11.99M | $23.13M | 52% | $318.19K | 1.17 | 6.1x (FDV) | 3.1x | - | 1/3 | - | [DefiLlama](https://defillama.com/protocol/dolomite) |
| 15 | Securitize | RWA | $36.96M | $202.17M | 18% | $2.62M | 1.01 | 6.4x (FDV) | 1.2x | - | 2/2 | 유통<25% | [DefiLlama](https://defillama.com/protocol/securitize) |
| 16 | KyberSwap | DEX Aggregator | $25.00M | $28.80M | 87% | $370.08K | 1.08 | 6.5x (FDV) | 5.6x | - | 2/3 | - | [DefiLlama](https://defillama.com/protocol/kyberswap) |
| 17 | Tokenlon | Dexs | $22.29M | $25.29M | 88% | $275.11K | 1.03 | 7.7x (FDV) | 6.8x | - | 2/7 | - | [DefiLlama](https://defillama.com/protocol/tokenlon) |
| 18 | Ekubo Protocol | Dexs | $10.23M | $10.23M | 100% | $95.87K | 1.80 | 8.9x (FDV) | 8.9x | $93.24K | 3/7 | - | [DefiLlama](https://defillama.com/protocol/ekubo) |
| 19 | SSV Network | Staking Pool | $33.56M | $33.56M | 100% | $288.40K | 2.21 | 9.7x (FDV) | 9.7x | $288.87K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/ssv-network) |
| 20 | Liquity | CDP | $19.40M | $19.63M | 99% | $156.87K | 2.42 | 10.4x (FDV) | 10.3x | $125.69K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/liquity) |
| 21 | Orca | Dexs | $91.18M | $112.48M | 81% | $847.15K | 2.46 | 11.1x (FDV) | 9.0x | $312.80K | 4/7 | - | [DefiLlama](https://defillama.com/protocol/orca) |
| 22 | Spark | Onchain Capital Allocator | $57.95M | $169.57M | 34% | $1.27M | 4.59 | 11.2x (FDV) | 3.8x | $309.83K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/spark) |
| 23 | Lista DAO | Lending | $32.98M | $61.02M | 54% | $403.01K | 2.35 | 12.6x (FDV) | 6.8x | $19.33K | 2/3 | - | [DefiLlama](https://defillama.com/protocol/lista-dao) |
| 24 | Strike Finance Perpetuals | Derivatives | $7.51M | $10.43M | 72% | $57.31K | 1.22 | 15.2x (FDV) | 10.9x | $57.30K | 3/4 | - | [DefiLlama](https://defillama.com/protocol/strike-finance-perpetuals) |
| 25 | Cetus | Dexs | $19.72M | $20.43M | 97% | $105.23K | 1.44 | 16.2x (FDV) | 15.6x | - | 5/7 | - | [DefiLlama](https://defillama.com/protocol/cetus) |
| 26 | Tornado Cash | Privacy | $31.75M | $66.30M | 48% | $323.77K | 1.37 | 17.1x (FDV) | 8.2x | $325.18K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/tornado-cash) |
| 27 | Rhea Finance | Dexs | $22.43M | $54.18M | 41% | $240.77K | 2.52 | 18.8x (FDV) | 7.8x | - | 6/7 | - | [DefiLlama](https://defillama.com/protocol/rhea-finance) |
| 28 | Definitive | DEX Aggregator | $21.04M | $77.04M | 27% | $265.17K | 2.16 | 24.2x (FDV) | 6.6x | $53.52K | 3/3 | - | [DefiLlama](https://defillama.com/protocol/definitive) |
| 29 | stake.link | Liquid Staking | $9.91M | $26.19M | 38% | $78.47K | 1.46 | 27.8x (FDV) | 10.5x | $47.25K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/stake.link) |
| 30 | Flying Tulip | Services | $55.97M | $59.44M | 94% | $135.33K | 1.12 | 36.6x (FDV) | 34.5x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/flying-tulip) |
| 31 | dYdX | Derivatives | $88.13M | $99.82M | 88% | $224.88K | 1.27 | 37.0x (FDV) | 32.7x | $226.62K | 4/4 | - | [DefiLlama](https://defillama.com/protocol/dydx) |
| 32 | Venus | Lending | $48.31M | $85.07M | 57% | $143.91K | 1.78 | 49.3x (FDV) | 28.0x | $55.77K | 3/3 | - | [DefiLlama](https://defillama.com/protocol/venus-finance) |
| 33 | Origin Protocol | Liquid Staking | $18.62M | $35.03M | 53% | $54.18K | 1.09 | 53.9x (FDV) | 28.6x | $54.40K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/origin-defi) |
| 34 | VVS Finance | Dexs | $35.59M | $77.73M | 46% | $62.66K | 2.23 | 103.4x (FDV) | 47.3x | $29.81K | 7/7 | - | [DefiLlama](https://defillama.com/protocol/vvs-finance) |
| 35 | o1.exchange | Launchpad | $63.36M | $396.00M | 16% | $244.94K | 5.13 | 134.7x (FDV) | 21.6x | - | 2/2 | 유통<25% | [DefiLlama](https://defillama.com/protocol/o1-exchange) |
| 36 | Lombard | Restaked BTC | $44.01M | $110.98M | 40% | $64.24K | 1.87 | 144.0x (FDV) | 57.1x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/lombard-finance) |

## 필터 단계별 탈락

| 단계 | 개수 |
|---|---|
| 대상 (매출 보고 프로토콜, 부모 단위 합산) | 2034 |
| 토큰 없음 | 1126 |
| mcap 5M~100M 범위 밖 (mcap 미상 포함) | 724 |
| rev_30d < $50,000 | 117 |
| trend 계산 불가 (완결 월 6개 미만/데이터 없음) | 8 |
| trend < 1.0 | 23 |
| 최종 통과 | 36 |

## 검증 행: Infinex (필터 무관)

| # | 이름 | 분야 | mcap | FDV | 유통비율 | rev_30d | trend | pf (기준) | pf_mcap | holders_rev_30d | 분야 내 pf 순위 | 플래그 | 링크 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| - | Infinex | Interface | $9.06M | $45.41M | 20% | $32.29K | 0.80 | 117.2x (FDV) | 23.4x | - | - | 유통<25% | [DefiLlama](https://defillama.com/protocol/infinex) |

- 사용한 완결 월: 2026-05, 2026-06, 2026-07, 2026-08, 2026-09, 2026-10 · 합산 자식: Infinex Perp, Infinex Spot, Infinex Hyperliquid Spot, Infinex Outcome
