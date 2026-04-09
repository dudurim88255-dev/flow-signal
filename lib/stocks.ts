export type Market = "kospi" | "us" | "crypto";

export interface StockDef {
  symbol: string;     // yahoo finance 심볼
  name: string;       // 한국어 이름
  sector: string;     // 섹터
  market: Market;
}

// 코스피 TOP 30
export const KOSPI_STOCKS: StockDef[] = [
  // 반도체
  { symbol: "005930.KS", name: "삼성전자",         sector: "반도체",   market: "kospi" },
  { symbol: "000660.KS", name: "SK하이닉스",       sector: "반도체",   market: "kospi" },
  // 2차전지
  { symbol: "373220.KS", name: "LG에너지솔루션",   sector: "2차전지",  market: "kospi" },
  { symbol: "006400.KS", name: "삼성SDI",          sector: "2차전지",  market: "kospi" },
  { symbol: "051910.KS", name: "LG화학",           sector: "화학",     market: "kospi" },
  // 바이오
  { symbol: "207940.KS", name: "삼성바이오로직스", sector: "바이오",   market: "kospi" },
  { symbol: "068270.KS", name: "셀트리온",         sector: "바이오",   market: "kospi" },
  // 자동차
  { symbol: "005380.KS", name: "현대차",           sector: "자동차",   market: "kospi" },
  { symbol: "000270.KS", name: "기아",             sector: "자동차",   market: "kospi" },
  { symbol: "012330.KS", name: "현대모비스",       sector: "자동차",   market: "kospi" },
  // IT
  { symbol: "035420.KS", name: "NAVER",            sector: "IT",       market: "kospi" },
  { symbol: "035720.KS", name: "카카오",           sector: "IT",       market: "kospi" },
  { symbol: "018260.KS", name: "삼성SDS",          sector: "IT서비스", market: "kospi" },
  // 금융
  { symbol: "105560.KS", name: "KB금융",           sector: "금융",     market: "kospi" },
  { symbol: "055550.KS", name: "신한지주",         sector: "금융",     market: "kospi" },
  { symbol: "086790.KS", name: "하나금융지주",     sector: "금융",     market: "kospi" },
  { symbol: "316140.KS", name: "우리금융지주",     sector: "금융",     market: "kospi" },
  { symbol: "024110.KS", name: "기업은행",         sector: "금융",     market: "kospi" },
  { symbol: "323410.KS", name: "카카오뱅크",       sector: "핀테크",   market: "kospi" },
  // 통신
  { symbol: "017670.KS", name: "SK텔레콤",         sector: "통신",     market: "kospi" },
  { symbol: "030200.KS", name: "KT",               sector: "통신",     market: "kospi" },
  // 게임
  { symbol: "259960.KS", name: "크래프톤",         sector: "게임",     market: "kospi" },
  { symbol: "036570.KS", name: "엔씨소프트",       sector: "게임",     market: "kospi" },
  // 방산
  { symbol: "012450.KS", name: "한화에어로스페이스", sector: "방산",   market: "kospi" },
  { symbol: "079550.KS", name: "LIG넥스원",         sector: "방산",   market: "kospi" },
  { symbol: "047810.KS", name: "한국항공우주",       sector: "방산",   market: "kospi" },
  // 조선
  { symbol: "009540.KS", name: "HD한국조선해양",   sector: "조선",     market: "kospi" },
  { symbol: "329180.KS", name: "HD현대중공업",     sector: "조선",     market: "kospi" },
  // 건설
  { symbol: "000720.KS", name: "현대건설",         sector: "건설",     market: "kospi" },
  { symbol: "028260.KS", name: "삼성물산",         sector: "건설",     market: "kospi" },
  // 에너지·소재
  { symbol: "096770.KS", name: "SK이노베이션",     sector: "에너지",   market: "kospi" },
  { symbol: "005490.KS", name: "POSCO홀딩스",      sector: "철강",     market: "kospi" },
  { symbol: "010130.KS", name: "고려아연",         sector: "소재",     market: "kospi" },
  // 중공업
  { symbol: "034020.KS", name: "두산에너빌리티",   sector: "중공업",   market: "kospi" },
  // 게임
  { symbol: "293490.KS", name: "카카오게임즈",     sector: "게임",     market: "kospi" },
  { symbol: "251270.KS", name: "넷마블",           sector: "게임",     market: "kospi" },
  // 보험·금융
  { symbol: "032830.KS", name: "삼성생명",         sector: "보험",     market: "kospi" },
  { symbol: "138040.KS", name: "메리츠금융지주",   sector: "보험",     market: "kospi" },
];

// 미국 주요주 25개
export const US_STOCKS: StockDef[] = [
  // 빅테크
  { symbol: "NVDA",  name: "엔비디아",       sector: "반도체",    market: "us" },
  { symbol: "AAPL",  name: "애플",           sector: "IT",        market: "us" },
  { symbol: "MSFT",  name: "마이크로소프트", sector: "클라우드",  market: "us" },
  { symbol: "GOOGL", name: "구글",           sector: "IT",        market: "us" },
  { symbol: "AMZN",  name: "아마존",         sector: "커머스",    market: "us" },
  { symbol: "META",  name: "메타",           sector: "IT",        market: "us" },
  { symbol: "TSLA",  name: "테슬라",         sector: "자동차",    market: "us" },
  // 반도체
  { symbol: "AVGO",  name: "브로드컴",       sector: "반도체",    market: "us" },
  { symbol: "AMD",   name: "AMD",            sector: "반도체",    market: "us" },
  { symbol: "TSM",   name: "TSMC",           sector: "반도체",    market: "us" },
  { symbol: "ARM",   name: "ARM홀딩스",      sector: "반도체",    market: "us" },
  { symbol: "SMCI",  name: "슈퍼마이크로",   sector: "서버",      market: "us" },
  // AI·소프트웨어
  { symbol: "PLTR",  name: "팔란티어",       sector: "AI",        market: "us" },
  { symbol: "ORCL",  name: "오라클",         sector: "클라우드",  market: "us" },
  { symbol: "CRM",   name: "세일즈포스",     sector: "클라우드",  market: "us" },
  { symbol: "CRWD",  name: "크라우드스트라이크", sector: "사이버보안", market: "us" },
  // 금융
  { symbol: "JPM",   name: "JP모건",         sector: "금융",      market: "us" },
  { symbol: "V",     name: "비자",           sector: "금융",      market: "us" },
  { symbol: "COIN",  name: "코인베이스",     sector: "핀테크",    market: "us" },
  { symbol: "HOOD",  name: "로빈후드",       sector: "핀테크",    market: "us" },
  // 미디어·리테일
  { symbol: "NFLX",  name: "넷플릭스",       sector: "미디어",    market: "us" },
  { symbol: "WMT",   name: "월마트",         sector: "리테일",    market: "us" },
  { symbol: "SHOP",  name: "쇼피파이",       sector: "이커머스",  market: "us" },
  // 에너지·헬스케어
  { symbol: "XOM",   name: "엑손모빌",       sector: "에너지",    market: "us" },
  { symbol: "LLY",   name: "일라이릴리",     sector: "헬스케어",  market: "us" },
  // 반도체 추가
  { symbol: "MRVL",  name: "마벨테크",       sector: "반도체",    market: "us" },
  { symbol: "INTC",  name: "인텔",           sector: "반도체",    market: "us" },
  // 비트코인 관련
  { symbol: "MSTR",  name: "마이크로스트래티지", sector: "핀테크", market: "us" },
  // 모빌리티
  { symbol: "UBER",  name: "우버",           sector: "모빌리티",  market: "us" },
  // AI 데이터
  { symbol: "SNOW",  name: "스노우플레이크", sector: "AI",        market: "us" },
  // 미디어·엔터
  { symbol: "DIS",   name: "디즈니",         sector: "미디어",    market: "us" },
  // 금 ETF
  { symbol: "GLD",   name: "금 ETF(GLD)",    sector: "원자재",    market: "us" },
];

// 코인 TOP 15
export const CRYPTO_COINS: StockDef[] = [
  // 메이저
  { symbol: "bitcoin",     name: "비트코인",  sector: "레이어1",  market: "crypto" },
  { symbol: "ethereum",    name: "이더리움",  sector: "레이어1",  market: "crypto" },
  { symbol: "solana",      name: "솔라나",    sector: "레이어1",  market: "crypto" },
  { symbol: "binancecoin", name: "바이낸스",  sector: "거래소",   market: "crypto" },
  { symbol: "ripple",      name: "리플",      sector: "결제",     market: "crypto" },
  // 알트 레이어1
  { symbol: "cardano",     name: "카르다노",  sector: "레이어1",  market: "crypto" },
  { symbol: "avalanche-2", name: "아발란체",  sector: "레이어1",  market: "crypto" },
  { symbol: "near",        name: "니어",      sector: "레이어1",  market: "crypto" },
  { symbol: "sui",         name: "수이",      sector: "레이어1",  market: "crypto" },
  { symbol: "the-open-network", name: "톤코인",    sector: "레이어1",  market: "crypto" },
  // 인프라
  { symbol: "chainlink",   name: "체인링크",  sector: "오라클",   market: "crypto" },
  { symbol: "polkadot",    name: "폴카닷",    sector: "레이어0",  market: "crypto" },
  // 레이어2
  { symbol: "polygon-ecosystem-token", name: "폴리곤(POL)", sector: "레이어2", market: "crypto" },
  { symbol: "arbitrum",      name: "아비트럼",  sector: "레이어2",  market: "crypto" },
  { symbol: "optimism",      name: "옵티미즘",  sector: "레이어2",  market: "crypto" },
  // DeFi
  { symbol: "hyperliquid",   name: "하이퍼리퀴드", sector: "DeFi",  market: "crypto" },
  // 결제 추가
  { symbol: "stellar",       name: "스텔라",    sector: "결제",     market: "crypto" },
  // 밈코인
  { symbol: "dogecoin",    name: "도지코인",  sector: "밈코인",   market: "crypto" },
  { symbol: "pepe",        name: "페페",      sector: "밈코인",   market: "crypto" },
  { symbol: "dogwifcoin",  name: "도그위프햇", sector: "밈코인",  market: "crypto" },
];

// 섹터 목록 (히트맵용)
export const SECTORS = [
  "반도체", "IT", "클라우드", "AI", "사이버보안",
  "2차전지", "바이오", "헬스케어",
  "자동차", "금융", "핀테크", "보험",
  "화학", "철강", "에너지", "소재", "원자재",
  "통신", "게임", "방산", "조선", "건설", "미디어", "리테일",
  "모빌리티", "이커머스", "서버", "중공업", "IT서비스",
  "레이어1", "레이어2", "DeFi", "결제", "거래소", "오라클", "레이어0", "밈코인",
];
