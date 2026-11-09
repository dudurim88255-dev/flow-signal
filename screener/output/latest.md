# 소형 코인 스크리너 — 2026-11-09

생성: 2026-11-09 10:20 KST · 출처: DefiLlama 무료 API (`/overview/fees`, `/protocols`, `/lite/protocols2`, `/summary/fees/{slug}`) + CoinGecko 무료 API (`/coins/markets`) — CoinGecko 650/756개 조회

필터: mcap $5M~$100M · rev_30d ≥ $50,000 · trend ≥ 1.0 · 토큰 보유

- rev = DefiLlama `dailyRevenue`, 자식 프로토콜은 부모(토큰) 단위로 합산
- rev_annual = rev_30d × 12 · pf = FDV(없으면 mcap) ÷ rev_annual — `(기준)` 표시
- trend = 최근 완결 3개월 월평균 ÷ 그 전 3개월 월평균 (진행 중인 달 제외)
- mcap·FDV = CoinGecko 값 우선 (없으면 DefiLlama mcap) · 유통비율 = mcap ÷ FDV · pf_mcap = mcap ÷ rev_annual
- 플래그: `mcap불일치` DefiLlama·CoinGecko mcap 차이 >30% (토큰 매핑 오류 의심) · `유통<25%` 향후 언락 희석 위험 · `pf<1 데이터확인` 매출 과대집계 의심
- FDV 기준 행: 35/35

## 결과 (35개, pf 오름차순)

| # | 이름 | 분야 | mcap | FDV | 유통비율 | rev_30d | trend | pf (기준) | pf_mcap | holders_rev_30d | 분야 내 pf 순위 | 플래그 | 링크 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ORE Protocol | Gamified Mining | $56.80M | $56.80M | 100% | $4.28M | 1.03 | 1.1x (FDV) | 1.1x | $4.23M | 1/1 | - | [DefiLlama](https://defillama.com/protocol/ore-protocol) |
| 2 | Graphite Protocol | Launchpad | $11.66M | $19.10M | 61% | $987.68K | 16.10 | 1.6x (FDV) | 1.0x | - | 1/2 | - | [DefiLlama](https://defillama.com/protocol/graphite-protocol) |
| 3 | GMX | Derivatives | $82.24M | $82.24M | 100% | $3.60M | 1.83 | 1.9x (FDV) | 1.9x | $3.33M | 1/4 | - | [DefiLlama](https://defillama.com/protocol/gmx) |
| 4 | Inverse Finance | CDP | $7.14M | $7.26M | 98% | $289.08K | 1.60 | 2.1x (FDV) | 2.1x | $9.38K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/inverse-finance) |
| 5 | Solv Protocol | Bridge | $24.85M | $40.65M | 61% | $1.25M | 1.13 | 2.7x (FDV) | 1.7x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/solv-protocol) |
| 6 | Usual | RWA | $19.44M | $19.61M | 99% | $542.70K | 1.27 | 3.0x (FDV) | 3.0x | $381.86K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/usual) |
| 7 | Overtime | Prediction Market | $9.85M | $9.85M | 100% | $262.90K | 1.17 | 3.1x (FDV) | 3.1x | $69.80K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/overtime) |
| 8 | Marinade | Staking Pool | $12.20M | $15.63M | 78% | $395.39K | 1.89 | 3.3x (FDV) | 2.6x | $197.69K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/marinade-finance) |
| 9 | Stargate Finance | Cross Chain Bridge | $12.49M | $12.49M | 100% | $293.61K | 2.73 | 3.5x (FDV) | 3.5x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/stargate-finance) |
| 10 | KyberSwap | DEX Aggregator | $21.36M | $24.60M | 87% | $558.22K | 1.08 | 3.7x (FDV) | 3.2x | - | 1/2 | - | [DefiLlama](https://defillama.com/protocol/kyberswap) |
| 11 | Dolomite | Lending | $10.71M | $20.65M | 52% | $333.28K | 1.17 | 5.2x (FDV) | 2.7x | - | 1/4 | - | [DefiLlama](https://defillama.com/protocol/dolomite) |
| 12 | Chainflip | Dexs | $30.98M | $30.98M | 100% | $486.20K | 1.41 | 5.3x (FDV) | 5.3x | $486.20K | 1/7 | - | [DefiLlama](https://defillama.com/protocol/chainflip) |
| 13 | Securitize | RWA | $34.03M | $186.12M | 18% | $2.53M | 1.01 | 6.1x (FDV) | 1.1x | - | 2/2 | 유통<25% | [DefiLlama](https://defillama.com/protocol/securitize) |
| 14 | Gains Network | Derivatives | $10.94M | $10.94M | 100% | $147.83K | 1.27 | 6.2x (FDV) | 6.2x | $26.97K | 2/4 | - | [DefiLlama](https://defillama.com/protocol/gains-network) |
| 15 | Tokenlon | Dexs | $21.98M | $24.74M | 89% | $250.83K | 1.03 | 8.2x (FDV) | 7.3x | - | 2/7 | - | [DefiLlama](https://defillama.com/protocol/tokenlon) |
| 16 | Liquity | CDP | $16.70M | $16.89M | 99% | $158.24K | 2.42 | 8.9x (FDV) | 8.8x | $127.47K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/liquity) |
| 17 | SSV Network | Staking Pool | $32.18M | $32.18M | 100% | $277.00K | 2.21 | 9.7x (FDV) | 9.7x | $277.00K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/ssv-network) |
| 18 | Ekubo Protocol | Dexs | $10.46M | $10.46M | 100% | $87.71K | 1.80 | 9.9x (FDV) | 9.9x | $84.56K | 3/7 | - | [DefiLlama](https://defillama.com/protocol/ekubo) |
| 19 | Orca | Dexs | $82.06M | $101.22M | 81% | $788.87K | 2.46 | 10.7x (FDV) | 8.7x | $291.28K | 4/7 | - | [DefiLlama](https://defillama.com/protocol/orca) |
| 20 | Lista DAO | Lending | $30.85M | $57.07M | 54% | $398.74K | 2.35 | 11.9x (FDV) | 6.4x | $16.87K | 2/4 | - | [DefiLlama](https://defillama.com/protocol/lista-dao) |
| 21 | Spark | Lending | $54.05M | $157.14M | 34% | $1.06M | ∞ | 12.4x (FDV) | 4.3x | $329.09K | 3/4 | - | [DefiLlama](https://defillama.com/protocol/spark) |
| 22 | Strike Finance Perpetuals | Derivatives | $7.05M | $9.79M | 72% | $60.80K | 1.22 | 13.4x (FDV) | 9.7x | $60.80K | 3/4 | - | [DefiLlama](https://defillama.com/protocol/strike-finance-perpetuals) |
| 23 | Aethir | Developer Tools | $92.56M | $193.13M | 48% | $1.14M | 1.31 | 14.1x (FDV) | 6.8x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/aethir) |
| 24 | Tornado Cash | Privacy | $25.94M | $54.31M | 48% | $301.97K | 1.37 | 15.0x (FDV) | 7.2x | $301.97K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/tornado-cash) |
| 25 | Rhea Finance | Dexs | $16.00M | $38.64M | 41% | $200.49K | 2.52 | 16.1x (FDV) | 6.6x | - | 5/7 | - | [DefiLlama](https://defillama.com/protocol/rhea-finance) |
| 26 | Cetus | Dexs | $18.32M | $18.98M | 97% | $89.97K | 1.44 | 17.6x (FDV) | 17.0x | - | 6/7 | - | [DefiLlama](https://defillama.com/protocol/cetus) |
| 27 | stake.link | Liquid Staking | $9.10M | $24.05M | 38% | $78.84K | 1.46 | 25.4x (FDV) | 9.6x | $47.36K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/stake.link) |
| 28 | dYdX | Derivatives | $75.48M | $85.49M | 88% | $229.09K | 1.27 | 31.1x (FDV) | 27.5x | $229.09K | 4/4 | - | [DefiLlama](https://defillama.com/protocol/dydx) |
| 29 | Definitive | DEX Aggregator | $22.80M | $83.13M | 27% | $203.72K | 2.16 | 34.0x (FDV) | 9.3x | $40.74K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/definitive) |
| 30 | Flying Tulip | Services | $54.60M | $57.98M | 94% | $133.99K | 1.12 | 36.1x (FDV) | 34.0x | - | 1/2 | - | [DefiLlama](https://defillama.com/protocol/flying-tulip) |
| 31 | Origin Protocol | Liquid Staking | $16.27M | $30.61M | 53% | $51.86K | 1.09 | 49.2x (FDV) | 26.1x | $51.86K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/origin-defi) |
| 32 | Venus | Lending | $46.09M | $81.16M | 57% | $128.85K | 1.78 | 52.5x (FDV) | 29.8x | $49.98K | 4/4 | - | [DefiLlama](https://defillama.com/protocol/venus-finance) |
| 33 | VVS Finance | Dexs | $33.11M | $72.30M | 46% | $54.58K | 2.23 | 110.4x (FDV) | 50.5x | $24.74K | 7/7 | - | [DefiLlama](https://defillama.com/protocol/vvs-finance) |
| 34 | Safe | Services | $68.89M | $87.12M | 79% | $50.28K | 3.23 | 144.4x (FDV) | 114.2x | - | 2/2 | - | [DefiLlama](https://defillama.com/protocol/safe) |
| 35 | o1.exchange | Launchpad | $67.63M | $422.72M | 16% | $205.18K | 5.13 | 171.7x (FDV) | 27.5x | - | 2/2 | 유통<25% | [DefiLlama](https://defillama.com/protocol/o1-exchange) |

## 필터 단계별 탈락

| 단계 | 개수 |
|---|---|
| 대상 (매출 보고 프로토콜, 부모 단위 합산) | 2056 |
| 토큰 없음 | 1140 |
| mcap 5M~100M 범위 밖 (mcap 미상 포함) | 738 |
| rev_30d < $50,000 | 117 |
| trend 계산 불가 (완결 월 6개 미만/데이터 없음) | 4 |
| trend < 1.0 | 22 |
| 최종 통과 | 35 |

## 검증 행: Infinex (필터 무관)

| # | 이름 | 분야 | mcap | FDV | 유통비율 | rev_30d | trend | pf (기준) | pf_mcap | holders_rev_30d | 분야 내 pf 순위 | 플래그 | 링크 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| - | Infinex | Interface | $7.74M | $38.79M | 20% | $29.79K | 0.81 | 108.5x (FDV) | 21.6x | - | - | 유통<25% | [DefiLlama](https://defillama.com/protocol/infinex) |

- 사용한 완결 월: 2026-05, 2026-06, 2026-07, 2026-08, 2026-09, 2026-10 · 합산 자식: Infinex Perp, Infinex Spot, Infinex Hyperliquid Spot, Infinex Outcome, Infinex Lighter
