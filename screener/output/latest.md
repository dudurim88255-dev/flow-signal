# 소형 코인 스크리너 — 2026-10-19

생성: 2026-10-19 08:49 KST · 출처: DefiLlama 무료 API (`/overview/fees`, `/protocols`, `/lite/protocols2`, `/summary/fees/{slug}`) + CoinGecko 무료 API (`/coins/markets`) — CoinGecko 638/742개 조회

필터: mcap $5M~$100M · rev_30d ≥ $50,000 · trend ≥ 1.0 · 토큰 보유

- rev = DefiLlama `dailyRevenue`, 자식 프로토콜은 부모(토큰) 단위로 합산
- rev_annual = rev_30d × 12 · pf = FDV(없으면 mcap) ÷ rev_annual — `(기준)` 표시
- trend = 최근 완결 3개월 월평균 ÷ 그 전 3개월 월평균 (진행 중인 달 제외)
- mcap·FDV = CoinGecko 값 우선 (없으면 DefiLlama mcap) · 유통비율 = mcap ÷ FDV · pf_mcap = mcap ÷ rev_annual
- 플래그: `mcap불일치` DefiLlama·CoinGecko mcap 차이 >30% (토큰 매핑 오류 의심) · `유통<25%` 향후 언락 희석 위험 · `pf<1 데이터확인` 매출 과대집계 의심
- FDV 기준 행: 30/30

## 결과 (30개, pf 오름차순)

| # | 이름 | 분야 | mcap | FDV | 유통비율 | rev_30d | trend | pf (기준) | pf_mcap | holders_rev_30d | 분야 내 pf 순위 | 플래그 | 링크 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Graphite Protocol | Launchpad | $18.05M | $29.57M | 61% | $3.00M | 8.77 | 0.8x (FDV) | 0.5x | $7.90K | 1/3 | pf<1 데이터확인 | [DefiLlama](https://defillama.com/protocol/graphite-protocol) |
| 2 | ORE Protocol | Gamified Mining | $53.30M | $53.30M | 100% | $3.47M | 1.02 | 1.3x (FDV) | 1.3x | $3.44M | 1/1 | - | [DefiLlama](https://defillama.com/protocol/ore-protocol) |
| 3 | Gains Network | Derivatives | $9.88M | $9.89M | 100% | $499.40K | 1.51 | 1.6x (FDV) | 1.6x | $45.65K | 1/4 | - | [DefiLlama](https://defillama.com/protocol/gains-network) |
| 4 | GMX | Derivatives | $90.45M | $90.45M | 100% | $4.31M | 1.13 | 1.7x (FDV) | 1.7x | $3.73M | 2/4 | - | [DefiLlama](https://defillama.com/protocol/gmx) |
| 5 | Inverse Finance | CDP | $7.89M | $8.03M | 98% | $283.41K | 1.17 | 2.4x (FDV) | 2.3x | $8.06K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/inverse-finance) |
| 6 | Solv Protocol | Bridge | $26.02M | $43.98M | 59% | $1.28M | 1.28 | 2.9x (FDV) | 1.7x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/solv-protocol) |
| 7 | Stargate Finance | Cross Chain Bridge | $15.18M | $15.18M | 100% | $399.42K | 1.70 | 3.2x (FDV) | 3.2x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/stargate-finance) |
| 8 | Marinade | Staking Pool | $13.93M | $17.84M | 78% | $446.69K | 1.28 | 3.3x (FDV) | 2.6x | $223.34K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/marinade-finance) |
| 9 | Beefy | Yield Aggregator | $5.39M | $5.39M | 100% | $106.22K | 1.06 | 4.2x (FDV) | 4.2x | $38.24K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/beefy) |
| 10 | Chainflip | Dexs | $26.53M | $26.53M | 100% | $369.72K | 1.09 | 6.0x (FDV) | 6.0x | $369.72K | 1/4 | - | [DefiLlama](https://defillama.com/protocol/chainflip) |
| 11 | Securitize | RWA | $39.69M | $255.16M | 16% | $2.67M | 1.14 | 8.0x (FDV) | 1.2x | - | 1/2 | 유통<25% | [DefiLlama](https://defillama.com/protocol/securitize) |
| 12 | SSV Network | Staking Pool | $37.16M | $37.16M | 100% | $305.73K | 2.32 | 10.1x (FDV) | 10.1x | $305.73K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/ssv-network) |
| 13 | Cetus | Dexs | $21.54M | $22.32M | 97% | $179.39K | 1.11 | 10.4x (FDV) | 10.0x | - | 2/4 | - | [DefiLlama](https://defillama.com/protocol/cetus) |
| 14 | SoSoValue | Indexes | $99.11M | $289.79M | 34% | $2.29M | 1.12 | 10.5x (FDV) | 3.6x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/sosovalue) |
| 15 | Venus | Lending | $49.86M | $87.82M | 57% | $612.71K | 1.66 | 11.9x (FDV) | 6.8x | $244.41K | 1/3 | - | [DefiLlama](https://defillama.com/protocol/venus-finance) |
| 16 | Tornado Cash | Privacy | $29.85M | $62.27M | 48% | $409.66K | 1.80 | 12.7x (FDV) | 6.1x | $409.66K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/tornado-cash) |
| 17 | Lista DAO | Lending | $31.86M | $58.94M | 54% | $325.37K | 2.18 | 15.1x (FDV) | 8.2x | $24.90K | 2/3 | - | [DefiLlama](https://defillama.com/protocol/lista-dao) |
| 18 | Definitive | DEX Aggregator | $26.01M | $95.76M | 27% | $487.52K | 2.15 | 16.4x (FDV) | 4.4x | $97.50K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/definitive) |
| 19 | Spark | Lending | $65.41M | $193.89M | 34% | $961.71K | ∞ | 16.8x (FDV) | 5.7x | $531.75K | 3/3 | - | [DefiLlama](https://defillama.com/protocol/spark) |
| 20 | Sushi | DEX Aggregator | $61.63M | $62.65M | 98% | $309.73K | 1.11 | 16.9x (FDV) | 16.6x | $9.45K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/sushi) |
| 21 | Rhea Finance | Dexs | $28.50M | $69.04M | 41% | $320.74K | 1.32 | 17.9x (FDV) | 7.4x | - | 3/4 | - | [DefiLlama](https://defillama.com/protocol/rhea-finance) |
| 22 | Centrifuge | RWA | $45.47M | $81.29M | 56% | $335.34K | 1.06 | 20.2x (FDV) | 11.3x | - | 2/2 | - | [DefiLlama](https://defillama.com/protocol/centrifuge) |
| 23 | Metaplex | Launchpad | $22.80M | $48.64M | 47% | $178.09K | 1.25 | 22.8x (FDV) | 10.7x | $89.04K | 2/3 | - | [DefiLlama](https://defillama.com/protocol/metaplex) |
| 24 | stake.link | Liquid Staking | $10.59M | $27.89M | 38% | $101.26K | 1.04 | 23.0x (FDV) | 8.7x | $60.76K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/stake.link) |
| 25 | dYdX | Derivatives | $96.75M | $109.59M | 88% | $292.18K | 1.34 | 31.3x (FDV) | 27.6x | $292.18K | 3/4 | - | [DefiLlama](https://defillama.com/protocol/dydx) |
| 26 | ApeX Protocol | Derivatives | $37.11M | $119.62M | 31% | $167.96K | 1.17 | 59.4x (FDV) | 18.4x | $167.96K | 4/4 | - | [DefiLlama](https://defillama.com/protocol/apex-protocol) |
| 27 | Lombard | Restaked BTC | $42.42M | $106.96M | 40% | $132.52K | 1.52 | 67.3x (FDV) | 26.7x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/lombard-finance) |
| 28 | Kinetiq | Liquid Staking | $92.27M | $292.95M | 31% | $333.23K | 1.36 | 73.3x (FDV) | 23.1x | $135.56K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/kinetiq) |
| 29 | o1.exchange | Launchpad | $68.52M | $428.25M | 16% | $439.29K | 9.70 | 81.2x (FDV) | 13.0x | - | 3/3 | 유통<25% | [DefiLlama](https://defillama.com/protocol/o1-exchange) |
| 30 | VVS Finance | Dexs | $39.42M | $86.08M | 46% | $71.36K | 1.46 | 100.5x (FDV) | 46.0x | $42.09K | 4/4 | - | [DefiLlama](https://defillama.com/protocol/vvs-finance) |

## 필터 단계별 탈락

| 단계 | 개수 |
|---|---|
| 대상 (매출 보고 프로토콜, 부모 단위 합산) | 1963 |
| 토큰 없음 | 1075 |
| mcap 5M~100M 범위 밖 (mcap 미상 포함) | 702 |
| rev_30d < $50,000 | 115 |
| trend 계산 불가 (완결 월 6개 미만/데이터 없음) | 9 |
| trend < 1.0 | 32 |
| 최종 통과 | 30 |

## 검증 행: Infinex (필터 무관)

| # | 이름 | 분야 | mcap | FDV | 유통비율 | rev_30d | trend | pf (기준) | pf_mcap | holders_rev_30d | 분야 내 pf 순위 | 플래그 | 링크 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| - | Infinex | Interface | $8.17M | $40.95M | 20% | $49.34K | 0.48 | 69.2x (FDV) | 13.8x | - | - | 유통<25% | [DefiLlama](https://defillama.com/protocol/infinex) |

- 사용한 완결 월: 2026-04, 2026-05, 2026-06, 2026-07, 2026-08, 2026-09 · 합산 자식: Infinex Perp, Infinex Spot, Infinex Hyperliquid Spot, Infinex Outcome
