# 소형 코인 스크리너 — 2026-10-05

생성: 2026-10-05 09:21 KST · 출처: DefiLlama 무료 API (`/overview/fees`, `/protocols`, `/lite/protocols2`, `/summary/fees/{slug}`) + CoinGecko 무료 API (`/coins/markets`) — CoinGecko 0/730개 조회 (배치 3개 실패)

필터: mcap $5M~$100M · rev_30d ≥ $50,000 · trend ≥ 1.0 · 토큰 보유

- rev = DefiLlama `dailyRevenue`, 자식 프로토콜은 부모(토큰) 단위로 합산
- rev_annual = rev_30d × 12 · pf = FDV(없으면 mcap) ÷ rev_annual — `(기준)` 표시
- trend = 최근 완결 3개월 월평균 ÷ 그 전 3개월 월평균 (진행 중인 달 제외)
- mcap·FDV = CoinGecko 값 우선 (없으면 DefiLlama mcap) · 유통비율 = mcap ÷ FDV · pf_mcap = mcap ÷ rev_annual
- 플래그: `mcap불일치` DefiLlama·CoinGecko mcap 차이 >30% (토큰 매핑 오류 의심) · `유통<25%` 향후 언락 희석 위험 · `pf<1 데이터확인` 매출 과대집계 의심
- FDV 기준 행: 0/28

## 결과 (28개, pf 오름차순)

| # | 이름 | 분야 | mcap | FDV | 유통비율 | rev_30d | trend | pf (기준) | pf_mcap | holders_rev_30d | 분야 내 pf 순위 | 플래그 | 링크 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Graphite Protocol | Launchpad | $26.50M | - | - | $3.71M | 8.77 | 0.6x (mcap) | 0.6x | - | 1/3 | pf<1 데이터확인 | [DefiLlama](https://defillama.com/protocol/graphite-protocol) |
| 2 | Gains Network | Derivatives | $10.14M | - | - | $655.54K | 1.47 | 1.3x (mcap) | 1.3x | $42.09K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/gains-network) |
| 3 | Securitize | RWA | $52.30M | - | - | $2.72M | 1.14 | 1.6x (mcap) | 1.6x | - | 1/2 | - | [DefiLlama](https://defillama.com/protocol/securitize) |
| 4 | Solv Protocol | Bridge | $24.39M | - | - | $1.24M | 1.28 | 1.6x (mcap) | 1.6x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/solv-protocol) |
| 5 | ORE Protocol | Gamified Mining | $66.04M | - | - | $2.59M | 1.02 | 2.1x (mcap) | 2.1x | $2.56M | 1/1 | - | [DefiLlama](https://defillama.com/protocol/ore-protocol) |
| 6 | Inverse Finance | CDP | $7.39M | - | - | $267.41K | 1.17 | 2.3x (mcap) | 2.3x | $5.48K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/inverse-finance) |
| 7 | fx Protocol | Dual-Token Stablecoin | $5.71M | - | - | $206.36K | 2.08 | 2.3x (mcap) | 2.3x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/fx-protocol) |
| 8 | Marinade | Staking Pool | $13.26M | - | - | $421.26K | 1.28 | 2.6x (mcap) | 2.6x | $210.63K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/marinade-finance) |
| 9 | HumidiFi | Dexs | $15.35M | - | - | $381.82K | ∞ | 3.3x (mcap) | 3.3x | - | 1/4 | - | [DefiLlama](https://defillama.com/protocol/humidifi) |
| 10 | o1.exchange | Launchpad | $81.77M | - | - | $1.72M | 9.70 | 4.0x (mcap) | 4.0x | - | 2/3 | - | [DefiLlama](https://defillama.com/protocol/o1-exchange) |
| 11 | Beefy | Yield Aggregator | $5.85M | - | - | $119.73K | 1.06 | 4.1x (mcap) | 4.1x | $43.10K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/beefy) |
| 12 | Definitive | DEX Aggregator | $34.92M | - | - | $693.95K | 2.15 | 4.2x (mcap) | 4.2x | $138.79K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/definitive) |
| 13 | Stargate Finance | Cross Chain Bridge | $20.57M | - | - | $277.56K | 1.63 | 6.2x (mcap) | 6.2x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/stargate-finance) |
| 14 | Venus | Lending | $57.99M | - | - | $772.97K | 1.66 | 6.3x (mcap) | 6.3x | $308.53K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/venus-finance) |
| 15 | Lista DAO | CDP | $36.68M | - | - | $474.71K | 2.17 | 6.4x (mcap) | 6.4x | $33.77K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/lista-dao) |
| 16 | Spark | Lending | $84.86M | - | - | $1.04M | ∞ | 6.8x (mcap) | 6.8x | $805.44K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/spark) |
| 17 | Chainflip | Dexs | $26.72M | - | - | $311.92K | 1.09 | 7.1x (mcap) | 7.1x | $311.92K | 2/4 | - | [DefiLlama](https://defillama.com/protocol/chainflip) |
| 18 | Alchemix | Synthetics | $6.92M | - | - | $55.27K | 7.01 | 10.4x (mcap) | 10.4x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/alchemix) |
| 19 | Rhea Finance | Dexs | $29.70M | - | - | $218.57K | 1.32 | 11.3x (mcap) | 11.3x | - | 3/4 | - | [DefiLlama](https://defillama.com/protocol/rhea-finance) |
| 20 | stake.link | Liquid Staking | $12.94M | - | - | $91.98K | 1.04 | 11.7x (mcap) | 11.7x | $55.06K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/stake.link) |
| 21 | Centrifuge | RWA | $58.00M | - | - | $401.06K | 1.06 | 12.1x (mcap) | 12.1x | - | 2/2 | - | [DefiLlama](https://defillama.com/protocol/centrifuge) |
| 22 | SSV Network | Staking Pool | $46.13M | - | - | $306.95K | 2.31 | 12.5x (mcap) | 12.5x | $306.95K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/ssv-network) |
| 23 | Cetus | Dexs | $27.20M | - | - | $170.34K | 1.11 | 13.3x (mcap) | 13.3x | - | 4/4 | - | [DefiLlama](https://defillama.com/protocol/cetus) |
| 24 | ApeX Protocol | Derivatives | $36.78M | - | - | $194.55K | 1.17 | 15.8x (mcap) | 15.8x | $194.55K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/apex-protocol) |
| 25 | Kinetiq | Liquid Staking | $87.92M | - | - | $405.32K | 1.34 | 18.1x (mcap) | 18.1x | $145.98K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/kinetiq) |
| 26 | Sushi | DEX Aggregator | $72.86M | - | - | $268.51K | 1.11 | 22.6x (mcap) | 22.6x | $6.47K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/sushi) |
| 27 | Lombard | Restaked BTC | $49.55M | - | - | $158.37K | 1.63 | 26.1x (mcap) | 26.1x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/lombard-finance) |
| 28 | Metaplex | Launchpad | $28.92M | - | - | $66.29K | 1.04 | 36.4x (mcap) | 36.4x | $33.15K | 3/3 | - | [DefiLlama](https://defillama.com/protocol/metaplex) |

## 필터 단계별 탈락

| 단계 | 개수 |
|---|---|
| 대상 (매출 보고 프로토콜, 부모 단위 합산) | 1898 |
| 토큰 없음 | 1032 |
| mcap 5M~100M 범위 밖 (mcap 미상 포함) | 677 |
| rev_30d < $50,000 | 122 |
| trend 계산 불가 (완결 월 6개 미만/데이터 없음) | 8 |
| trend < 1.0 | 31 |
| 최종 통과 | 28 |

## 검증 행: Infinex (필터 무관)

| # | 이름 | 분야 | mcap | FDV | 유통비율 | rev_30d | trend | pf (기준) | pf_mcap | holders_rev_30d | 분야 내 pf 순위 | 플래그 | 링크 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| - | Infinex | Interface | $11.87M | - | - | $52.09K | 0.48 | 19.0x (mcap) | 19.0x | - | - | - | [DefiLlama](https://defillama.com/protocol/infinex) |

- 사용한 완결 월: 2026-04, 2026-05, 2026-06, 2026-07, 2026-08, 2026-09 · 합산 자식: Infinex Perp, Infinex Spot
