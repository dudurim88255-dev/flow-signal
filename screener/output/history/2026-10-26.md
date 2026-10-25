# 소형 코인 스크리너 — 2026-10-26

생성: 2026-10-26 08:41 KST · 출처: DefiLlama 무료 API (`/overview/fees`, `/protocols`, `/lite/protocols2`, `/summary/fees/{slug}`) + CoinGecko 무료 API (`/coins/markets`) — CoinGecko 642/746개 조회

필터: mcap $5M~$100M · rev_30d ≥ $50,000 · trend ≥ 1.0 · 토큰 보유

- rev = DefiLlama `dailyRevenue`, 자식 프로토콜은 부모(토큰) 단위로 합산
- rev_annual = rev_30d × 12 · pf = FDV(없으면 mcap) ÷ rev_annual — `(기준)` 표시
- trend = 최근 완결 3개월 월평균 ÷ 그 전 3개월 월평균 (진행 중인 달 제외)
- mcap·FDV = CoinGecko 값 우선 (없으면 DefiLlama mcap) · 유통비율 = mcap ÷ FDV · pf_mcap = mcap ÷ rev_annual
- 플래그: `mcap불일치` DefiLlama·CoinGecko mcap 차이 >30% (토큰 매핑 오류 의심) · `유통<25%` 향후 언락 희석 위험 · `pf<1 데이터확인` 매출 과대집계 의심
- FDV 기준 행: 29/29

## 결과 (29개, pf 오름차순)

| # | 이름 | 분야 | mcap | FDV | 유통비율 | rev_30d | trend | pf (기준) | pf_mcap | holders_rev_30d | 분야 내 pf 순위 | 플래그 | 링크 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Graphite Protocol | Launchpad | $14.91M | $24.43M | 61% | $1.68M | 8.77 | 1.2x (FDV) | 0.7x | $7.90K | 1/3 | - | [DefiLlama](https://defillama.com/protocol/graphite-protocol) |
| 2 | GMX | Derivatives | $87.83M | $87.83M | 100% | $4.90M | 1.13 | 1.5x (FDV) | 1.5x | $4.44M | 1/4 | - | [DefiLlama](https://defillama.com/protocol/gmx) |
| 3 | ORE Protocol | Gamified Mining | $80.73M | $80.73M | 100% | $3.78M | 1.02 | 1.8x (FDV) | 1.8x | $3.74M | 1/1 | - | [DefiLlama](https://defillama.com/protocol/ore-protocol) |
| 4 | Inverse Finance | CDP | $7.89M | $8.03M | 98% | $288.86K | 1.17 | 2.3x (FDV) | 2.3x | $9.33K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/inverse-finance) |
| 5 | Gains Network | Derivatives | $9.48M | $9.48M | 100% | $328.51K | 1.51 | 2.4x (FDV) | 2.4x | $41.89K | 2/4 | - | [DefiLlama](https://defillama.com/protocol/gains-network) |
| 6 | Solv Protocol | Bridge | $25.42M | $42.97M | 59% | $1.28M | 1.28 | 2.8x (FDV) | 1.6x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/solv-protocol) |
| 7 | Stargate Finance | Cross Chain Bridge | $14.35M | $14.35M | 100% | $386.83K | 1.70 | 3.1x (FDV) | 3.1x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/stargate-finance) |
| 8 | Marinade | Staking Pool | $13.61M | $17.44M | 78% | $437.87K | 1.28 | 3.3x (FDV) | 2.6x | $218.93K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/marinade-finance) |
| 9 | Beefy | Yield Aggregator | $5.82M | $5.82M | 100% | $95.88K | 1.06 | 5.1x (FDV) | 5.1x | $34.51K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/beefy) |
| 10 | Chainflip | Dexs | $26.80M | $26.80M | 100% | $386.33K | 1.09 | 5.8x (FDV) | 5.8x | $386.33K | 1/4 | - | [DefiLlama](https://defillama.com/protocol/chainflip) |
| 11 | Securitize | RWA | $38.14M | $208.59M | 18% | $2.65M | 1.14 | 6.6x (FDV) | 1.2x | - | 1/2 | 유통<25% | [DefiLlama](https://defillama.com/protocol/securitize) |
| 12 | SSV Network | Staking Pool | $36.04M | $36.04M | 100% | $299.52K | 2.32 | 10.0x (FDV) | 10.0x | $299.52K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/ssv-network) |
| 13 | SoSoValue | Indexes | $99.11M | $289.79M | 34% | $2.04M | 1.12 | 11.8x (FDV) | 4.0x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/sosovalue) |
| 14 | Cetus | Dexs | $20.76M | $21.51M | 97% | $144.14K | 1.11 | 12.4x (FDV) | 12.0x | - | 2/4 | - | [DefiLlama](https://defillama.com/protocol/cetus) |
| 15 | Lista DAO | CDP | $34.11M | $63.11M | 54% | $403.26K | 2.18 | 13.0x (FDV) | 7.0x | $21.07K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/lista-dao) |
| 16 | Tornado Cash | Privacy | $31.70M | $66.12M | 48% | $362.77K | 1.80 | 15.2x (FDV) | 7.3x | $362.77K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/tornado-cash) |
| 17 | Spark | Lending | $60.73M | $178.83M | 34% | $950.81K | ∞ | 15.7x (FDV) | 5.3x | $394.07K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/spark) |
| 18 | Sushi | DEX Aggregator | $57.35M | $58.30M | 98% | $306.65K | 1.11 | 15.8x (FDV) | 15.6x | $11.74K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/sushi) |
| 19 | Venus | Lending | $50.18M | $88.37M | 57% | $458.59K | 1.66 | 16.1x (FDV) | 9.1x | $182.52K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/venus-finance) |
| 20 | Rhea Finance | Dexs | $24.23M | $58.78M | 41% | $287.45K | 1.32 | 17.0x (FDV) | 7.0x | - | 3/4 | - | [DefiLlama](https://defillama.com/protocol/rhea-finance) |
| 21 | Centrifuge | RWA | $38.43M | $68.71M | 56% | $320.40K | 1.06 | 17.9x (FDV) | 10.0x | - | 2/2 | - | [DefiLlama](https://defillama.com/protocol/centrifuge) |
| 22 | Definitive | DEX Aggregator | $23.41M | $85.69M | 27% | $361.89K | 2.15 | 19.7x (FDV) | 5.4x | $72.38K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/definitive) |
| 23 | Metaplex | Launchpad | $23.26M | $49.37M | 47% | $173.09K | 1.25 | 23.8x (FDV) | 11.2x | $86.54K | 2/3 | - | [DefiLlama](https://defillama.com/protocol/metaplex) |
| 24 | stake.link | Liquid Staking | $10.03M | $26.43M | 38% | $90.08K | 1.04 | 24.5x (FDV) | 9.3x | $54.06K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/stake.link) |
| 25 | dYdX | Derivatives | $90.39M | $102.38M | 88% | $251.94K | 1.34 | 33.9x (FDV) | 29.9x | $251.94K | 3/4 | - | [DefiLlama](https://defillama.com/protocol/dydx) |
| 26 | ApeX Protocol | Derivatives | $34.77M | $110.09M | 32% | $147.24K | 1.17 | 62.3x (FDV) | 19.7x | $147.24K | 4/4 | - | [DefiLlama](https://defillama.com/protocol/apex-protocol) |
| 27 | VVS Finance | Dexs | $37.80M | $82.55M | 46% | $70.09K | 1.46 | 98.1x (FDV) | 44.9x | $37.48K | 4/4 | - | [DefiLlama](https://defillama.com/protocol/vvs-finance) |
| 28 | Lombard | Restaked BTC | $44.74M | $112.81M | 40% | $92.21K | 1.52 | 101.9x (FDV) | 40.4x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/lombard-finance) |
| 29 | o1.exchange | Launchpad | $64.89M | $405.55M | 16% | $320.52K | 9.70 | 105.4x (FDV) | 16.9x | - | 3/3 | 유통<25% | [DefiLlama](https://defillama.com/protocol/o1-exchange) |

## 필터 단계별 탈락

| 단계 | 개수 |
|---|---|
| 대상 (매출 보고 프로토콜, 부모 단위 합산) | 1994 |
| 토큰 없음 | 1096 |
| mcap 5M~100M 범위 밖 (mcap 미상 포함) | 717 |
| rev_30d < $50,000 | 118 |
| trend 계산 불가 (완결 월 6개 미만/데이터 없음) | 5 |
| trend < 1.0 | 29 |
| 최종 통과 | 29 |

## 검증 행: Infinex (필터 무관)

| # | 이름 | 분야 | mcap | FDV | 유통비율 | rev_30d | trend | pf (기준) | pf_mcap | holders_rev_30d | 분야 내 pf 순위 | 플래그 | 링크 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| - | Infinex | Interface | $8.59M | $43.06M | 20% | $38.67K | 0.48 | 92.8x (FDV) | 18.5x | - | - | 유통<25% | [DefiLlama](https://defillama.com/protocol/infinex) |

- 사용한 완결 월: 2026-04, 2026-05, 2026-06, 2026-07, 2026-08, 2026-09 · 합산 자식: Infinex Perp, Infinex Spot, Infinex Hyperliquid Spot, Infinex Outcome
