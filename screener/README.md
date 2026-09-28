# 소형 코인 스크리너 v1

DefiLlama 무료 API + CoinGecko 무료 API(FDV·mcap). 실행은 GitHub Actions(`.github/workflows/screener.yml`)에서 — 수동 실행 또는 매주 월 07:00 KST.

- 결과: `output/latest.csv`, `output/latest.md`, 날짜별 사본 `output/history/YYYY-MM-DD.*`
- 로컬 실행: `python screener/screener.py` (표준 라이브러리만)
- 계산 정의·필터·검증 행(Infinex)은 `latest.md` 상단 참고
- mcap·FDV는 CoinGecko 무료 API(`/coins/markets`)로 보강. 한도 여유가 필요하면 저장소 시크릿 `COINGECKO_API_KEY`(무료 Demo 키) 추가 — 없어도 동작
