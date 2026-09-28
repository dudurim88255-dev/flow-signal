# 소형 코인 스크리너 — 2026-09-28

생성: 2026-09-28 12:01 KST · 출처: DefiLlama 무료 API (`/overview/fees`, `/protocols`, `/lite/protocols2`, `/summary/fees/{slug}`) + CoinGecko 무료 API (`/coins/markets`) — CoinGecko 603/707개 조회

필터: mcap $5M~$100M · rev_30d ≥ $50,000 · trend ≥ 1.0 · 토큰 보유

- rev = DefiLlama `dailyRevenue`, 자식 프로토콜은 부모(토큰) 단위로 합산
- rev_annual = rev_30d × 12 · pf = FDV(없으면 mcap) ÷ rev_annual — `(기준)` 표시
- trend = 최근 완결 3개월 월평균 ÷ 그 전 3개월 월평균 (진행 중인 달 제외)
- mcap·FDV = CoinGecko 값 우선 (없으면 DefiLlama mcap) · 유통비율 = mcap ÷ FDV · pf_mcap = mcap ÷ rev_annual
- 플래그: `mcap불일치` DefiLlama·CoinGecko mcap 차이 >30% (토큰 매핑 오류 의심) · `유통<25%` 향후 언락 희석 위험 · `pf<1 데이터확인` 매출 과대집계 의심
- FDV 기준 행: 21/21

## 결과 (21개, pf 오름차순)

| # | 이름 | 분야 | mcap | FDV | 유통비율 | rev_30d | trend | pf (기준) | pf_mcap | holders_rev_30d | 분야 내 pf 순위 | 플래그 | 링크 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ORE Protocol | Gamified Mining | $44.57M | $44.57M | 100% | $2.45M | 1.22 | 1.5x (FDV) | 1.5x | $2.43M | 1/1 | - | [DefiLlama](https://defillama.com/protocol/ore-protocol) |
| 2 | Gains Network | Derivatives | $11.85M | $11.85M | 100% | $587.93K | 1.10 | 1.7x (FDV) | 1.7x | $35.91K | 1/2 | - | [DefiLlama](https://defillama.com/protocol/gains-network) |
| 3 | Solv Protocol | Bridge | $24.04M | $42.03M | 57% | $1.22M | 1.80 | 2.9x (FDV) | 1.6x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/solv-protocol) |
| 4 | nest | Dexs | $5.00M | $36.47M | 14% | $546.93K | 3.13 | 5.6x (FDV) | 0.8x | $546.93K | 1/4 | 유통<25% | [DefiLlama](https://defillama.com/protocol/nest) |
| 5 | HyperLend | Lending | $5.30M | $13.45M | 39% | $195.98K | 1.25 | 5.7x (FDV) | 2.3x | - | 1/2 | - | [DefiLlama](https://defillama.com/protocol/hyperlend) |
| 6 | Alchemix | Synthetics | $6.82M | $8.64M | 79% | $68.65K | 8.82 | 10.5x (FDV) | 8.3x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/alchemix) |
| 7 | Overtime | Prediction Market | $11.44M | $11.44M | 100% | $83.52K | 1.73 | 11.4x (FDV) | 11.4x | $83.52K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/overtime) |
| 8 | Lista DAO | CDP | $37.70M | $69.75M | 54% | $478.81K | 1.61 | 12.1x (FDV) | 6.6x | $31.73K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/lista-dao) |
| 9 | Securitize | RWA | $64.25M | $413.02M | 16% | $2.72M | 1.45 | 12.7x (FDV) | 2.0x | - | 1/3 | 유통<25% | [DefiLlama](https://defillama.com/protocol/securitize) |
| 10 | SSV Network | Staking Pool | $46.13M | $46.13M | 100% | $297.43K | 1.30 | 12.9x (FDV) | 12.9x | $297.43K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/ssv-network) |
| 11 | Definitive | DEX Aggregator | $31.45M | $117.10M | 27% | $749.04K | 1.29 | 13.0x (FDV) | 3.5x | $149.81K | 1/1 | - | [DefiLlama](https://defillama.com/protocol/definitive) |
| 12 | HumidiFi | Dexs | $15.64M | $68.00M | 23% | $380.63K | 1.39 | 14.9x (FDV) | 3.4x | - | 2/4 | 유통<25% | [DefiLlama](https://defillama.com/protocol/humidifi) |
| 13 | Minswap | Dexs | $6.68M | $9.56M | 70% | $52.88K | 1.11 | 15.1x (FDV) | 10.5x | $25.08K | 3/4 | - | [DefiLlama](https://defillama.com/protocol/minswap) |
| 14 | o1.exchange | Launchpad | $84.22M | $526.40M | 16% | $2.87M | 3.61 | 15.3x (FDV) | 2.4x | - | 1/2 | 유통<25% | [DefiLlama](https://defillama.com/protocol/o1-exchange) |
| 15 | Venus | Lending | $57.18M | $100.85M | 57% | $477.42K | 1.73 | 17.6x (FDV) | 10.0x | $190.28K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/venus-finance) |
| 16 | Centrifuge | RWA | $61.94M | $110.74M | 56% | $433.08K | 1.10 | 21.3x (FDV) | 11.9x | - | 2/3 | - | [DefiLlama](https://defillama.com/protocol/centrifuge) |
| 17 | Sanctum | Liquid Staking | $44.67M | $85.98M | 52% | $241.70K | 1.05 | 29.6x (FDV) | 15.4x | - | 1/1 | - | [DefiLlama](https://defillama.com/protocol/sanctum) |
| 18 | Aquarius Stellar | Dexs | $16.00M | $36.35M | 44% | $82.55K | 1.52 | 36.7x (FDV) | 16.1x | $82.55K | 4/4 | - | [DefiLlama](https://defillama.com/protocol/aquarius-stellar) |
| 19 | Metaplex | Launchpad | $26.02M | $55.19M | 47% | $109.71K | 1.09 | 41.9x (FDV) | 19.8x | $54.86K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/metaplex) |
| 20 | ApeX Protocol | Derivatives | $40.49M | $130.53M | 31% | $217.71K | 1.38 | 50.0x (FDV) | 15.5x | $217.71K | 2/2 | - | [DefiLlama](https://defillama.com/protocol/apex-protocol) |
| 21 | USD AI | RWA | $90.78M | $453.91M | 20% | $168.72K | 1.43 | 224.2x (FDV) | 44.8x | - | 3/3 | 유통<25% | [DefiLlama](https://defillama.com/protocol/usd-ai) |

## 필터 단계별 탈락

| 단계 | 개수 |
|---|---|
| 대상 (매출 보고 프로토콜, 부모 단위 합산) | 1860 |
| 토큰 없음 | 1020 |
| mcap 5M~100M 범위 밖 (mcap 미상 포함) | 654 |
| rev_30d < $50,000 | 115 |
| trend 계산 불가 (완결 월 6개 미만/데이터 없음) | 7 |
| trend < 1.0 | 43 |
| 최종 통과 | 21 |

## 검증 행: Infinex (필터 무관)

| # | 이름 | 분야 | mcap | FDV | 유통비율 | rev_30d | trend | pf (기준) | pf_mcap | holders_rev_30d | 분야 내 pf 순위 | 플래그 | 링크 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| - | Infinex | Interface | $14.10M | $70.72M | 20% | $50.44K | 0.43 | 116.8x (FDV) | 23.3x | - | - | 유통<25% | [DefiLlama](https://defillama.com/protocol/infinex) |

- 사용한 완결 월: 2026-03, 2026-04, 2026-05, 2026-06, 2026-07, 2026-08 · 합산 자식: Infinex Perp, Infinex Spot
