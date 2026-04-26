# SCORE_PAGE.md — 종목 신호 상세 페이지 디자인 스펙

> **Status**: Active source-of-truth (2026-04-26)
> **Scope**: `app/score/[market]/[ticker]/page.tsx` 와 그 컴포넌트 트리
> **Pattern**: Google Stitch / 모바일 우선 (380px) → 데스크톱 enhancement

본 문서는 디자인 토큰 + 컴포넌트 패턴의 단일 진실. tailwind.config.ts 의 `theme.extend` + `app/globals.css` 의 CSS 변수가 본 문서를 그대로 구현. 컴포넌트는 토큰 참조만, hardcoded hex 금지.

---

## 1. 컬러 토큰

### 시그널 강도 (점수 → 색상)

| 토큰 | Hex | 점수 구간 | 의미 |
|---|---|---|---|
| `--signal-strong-buy` | `#10b981` | ≥ 80 | 강매수 |
| `--signal-buy` | `#34d399` | 60 ~ 79 | 매수 |
| `--signal-neutral` | `#6b7280` | 40 ~ 59 | 관망 |
| `--signal-sell` | `#f87171` | 20 ~ 39 | 매도 |
| `--signal-strong-sell` | `#dc2626` | < 20 | 강매도 |

Tailwind: `text-signal-strong-buy bg-signal-strong-buy/10 border-signal-strong-buy/30`

### 진입 타이밍 / AI 액센트

| 토큰 | Hex | 용도 |
|---|---|---|
| `--pending-zone` | `#f59e0b` | BB 영역 밖 — "되돌림 대기" 박스 (앰버) |
| `--ai-accent` | `#a78bfa` | AI 해설 좌측 보더 + 배지 (보라) |

### 표면 / 테두리

| 토큰 | Hex | 용도 |
|---|---|---|
| `--bg-primary` | `#0a0a0c` | 페이지 배경 |
| `--bg-card` | `#131318` | 일반 카드 |
| `--bg-card-elevated` | `#1a1a20` | 모달 / 강조 카드 / 선택된 항목 |
| `--border-subtle` | `#1f2024` | 기본 테두리 |

### 텍스트 위계

| 토큰 | Hex | 용도 |
|---|---|---|
| `--text-primary` | `#e7e7e9` | 본문 / 주요 숫자 |
| `--text-secondary` | `#9c9ca0` | 라벨 / 메타 |
| `--text-tertiary` | `#6c6c70` | 캡션 / 보조 |

### 등락 (시장 환경 vs 종목 등락 분리)

- **종목 등락**: `--signal-buy` (양수) / `--signal-sell` (음수) — 시그널 색과 동일
- **거시 우호/불리**: 종목 등락 색을 **재사용 X**. 별도 의미 표현:
  - 우호: `--signal-buy` 톤이지만 "우호" 텍스트 라벨 + 작은 점
  - 불리: `--signal-sell` 톤이지만 "불리" 텍스트 라벨 + 작은 점
  - 색만 보고 등락으로 오해되지 않도록 텍스트 라벨 필수

---

## 2. 타이포그래피

### 폰트 패밀리

```
Pretendard Variable, Pretendard, -apple-system, sans-serif
```

`globals.css` 의 `body` 에 이미 적용. 모든 컴포넌트 상속.

### 위계 + 사이즈

| 클래스 / 역할 | px | weight | 용도 |
|---|---|---|---|
| h1 (종목명) | 26 | 500 | 헤더 카드 종목명 |
| h2 (가격) | 22 | 500 | 헤더 카드 현재가 |
| h3 (메트릭 카드) | 17 | 500 | 거시 카드 수치, 시그널 그룹 점수 |
| body | 13 | 400 | 본문 텍스트 |
| caption | 11 | 400 | 라벨, 보조 정보 |
| micro | 10 | 400 | 메타, 마이크로 라벨 (Live/추정 등) |

`font-feature-settings: 'tnum'` — 모든 숫자 등폭. `globals.css` 의 `html` 에 이미 적용.

### Tailwind 매핑 (theme.extend.fontSize)

```ts
fontSize: {
  'h1': ['26px', { lineHeight: '1.3', fontWeight: '500' }],
  'h2': ['22px', { lineHeight: '1.35', fontWeight: '500' }],
  'h3': ['17px', { lineHeight: '1.4', fontWeight: '500' }],
  'body': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
  'caption': ['11px', { lineHeight: '1.4', fontWeight: '400' }],
  'micro': ['10px', { lineHeight: '1.3', fontWeight: '400' }],
}
```

---

## 3. 간격 스케일 (모바일 우선 380px)

### 페이지 / 카드

| 영역 | 모바일 | 태블릿 ≥640 | 데스크톱 ≥1024 |
|---|---|---|---|
| 페이지 padding | 12px 14px | 16px 20px | 24px 32px |
| 카드 padding | 14~16px | 16~20px | 18~22px |
| 카드 간격 (vertical) | 12~16px | 16~20px | 18~24px |
| 카드 내 요소 간격 | 8~14px | 10~16px | 12~16px |

### radius

| 크기 | 용도 |
|---|---|
| 8px | 작은 박스 (배지, 라벨, 미니 버튼) |
| 10px | 메트릭 카드, 거시 그리드 셀 |
| 12px | 대형 카드 (헤더, 신호 그룹) |
| 16px | 페이지 컨테이너 (사용 X — flat 페이지) |

### Tailwind 매핑 (theme.extend.borderRadius)

```ts
borderRadius: {
  'sm': '8px',
  'DEFAULT': '10px',
  'lg': '12px',
}
```

---

## 4. 컴포넌트 패턴

### 4.1 헤더 카드

점수 도넛 + 가격 + 변동 + 진입영역 + AI 요약을 **하나의 카드** 로 통합. 기존 페이지의 분산된 영역 (히어로 / 신뢰도바 / 알림배너) 대비 정보 밀도 ↑, 페이지 길이 ↓.

```
┌─────────────────────────────────────────────────┐
│  [미국주식] INTC                                 │
│  Intel Corporation                              │
│  ─────────────────────────────────────────────  │
│  [도넛 88]  $24.32                              │
│             7일 +12.3%  30일 +82.1%              │
│             ───────                              │
│  ┌─────────────────────────────────────────┐    │
│  │ 진입 영역 [되돌림 대기 ⚠️]              │    │
│  │ $21.50 ~ $23.80 · 현재가 +1.5σ 위        │    │
│  └─────────────────────────────────────────┘    │
│  ─────────────────────────────────────────────  │
│  │ 모멘텀이 강하나 단기 과열. 박스권 회귀 시 │    │
│  │ 진입 권고.                              │    │
│  └─ AI 해설                                      │
└─────────────────────────────────────────────────┘
```

토큰: `bg-bg-card border-border-subtle rounded-lg`

### 4.2 EntryZoneCard (진입 영역 박스)

`status` 에 따라 자동 전환:

| status | 색 | 라벨 | 아이콘 |
|---|---|---|---|
| `in_zone` | `--signal-buy` 10% bg + 30% border | "즉시 진입권" | `✓` |
| `pending_pullback` | `--pending-zone` 10% bg + 30% border | "되돌림 대기" | `⚠️` |
| `no_recommendation` | hide (렌더 X) | — | — |

표시 정보:
- 라벨 + 아이콘
- 진입 가격 범위 (`{lower} ~ {upper}` — 시장 통화 단위)
- 사유 (`reason` — 한 줄, 14px text-secondary)

### 4.3 ScoreHistorySparkline (시계열 카드)

- FlowScore 7일 추이 영역 차트
- x축: 7개 포인트 (오늘 기준 최근 → 가장 최근)
- y축: 0~100
- 각 포인트 위에 점수 라벨 (micro 사이즈, tabular-nums)
- 라인 색: 추세 (마지막 - 첫 번째 부호) 기준 buy/sell 토큰
- area fill: 라인 색 10% opacity

빈 데이터 fallback: "추이 데이터 누적 중" 회색 placeholder + 현재 점수 1개 점 표시.

### 4.4 거시경제 그리드 (2x2)

- 4개 카드: VIX / 10Y / DXY / SPY MA (시장별 다름)
- 각 카드: 라벨 (caption) → 수치 (h3 tabular-nums) → 7일 변화 (caption)
- 우호/불리 배지: 작은 점 + 텍스트 (`positiveIsGood` 기준)

### 4.5 SignalGroupCard

기존 SignalGroup 아코디언 → 카드형 변경:
- 헤더: 그룹명 + 평균 점수 + 4 미니 막대
- 4 미니 막대: 그룹 안 4개 신호 (id 정렬)
  - 막대 폭: 25% (각 신호 1개)
  - 막대 높이: `score / 100 * 24px`
  - 색: 신호별 점수 → 토큰
  - 막대 아래: 신호 ID (micro 사이즈)
- 클릭 시 상세 (각 신호 이름 + 점수 + LIVE/추정) 확장 — 기존 SignalBar 재사용
- 8개 이상 그룹: 막대 8개 + 미니 그리드

### 4.6 AISummaryInline

기존 AiCommentSection 의 카드 박스 → **인라인 보라 보더** 변경:

```
│ AI 해설
│ 모멘텀이 강하나 단기 과열. 박스권 회귀 시
│ 진입 권고.
```

좌측 4px `--ai-accent` 보더, 패딩 14px, 작은 라벨 "AI 해설" (micro 사이즈, ai-accent 색).

### 4.7 CTA 버튼

| 버튼 | 색 | 용도 |
|---|---|---|
| AI 분석 보기 | `--ai-accent` 배경 | AI 해설 lazy load |
| 알림 설정 | `--signal-buy` 배경 | 알림 설정 토글 |

높이: 40px (모바일 터치 친화). radius: 10px. 폰트: body weight 500.

### 4.8 K1~K8 dormant 처리 (한국 종목)

- 헤더 카드 신뢰도 영역에 경고 배지: "K1~K8 데이터 미수집 (K9~K12만 활성)"
- SignalGroupCard 안 K1~K8 신호: 회색 배경 + "데이터 미수집" 라벨 + 막대 흐림 (opacity 40%)
- 평균 점수 계산에서 K1~K8 제외 (또는 weight 0)

---

## 5. 반응형

```css
/* 모바일 default */
.score-page-container { max-width: 420px; padding: 12px 14px; }

/* 태블릿 ≥640 */
@media (min-width: 640px) {
  .score-page-container { max-width: 560px; padding: 16px 20px; }
}

/* 데스크톱 ≥1024 */
@media (min-width: 1024px) {
  .score-page-container {
    max-width: 1080px;
    padding: 24px 32px;
    display: grid;
    grid-template-columns: minmax(0, 540px) 1fr;
    gap: 24px;
  }
  /* 좌측: 헤더 카드 + 시계열 */
  /* 우측: 거시 + 신호 그룹 */
}
```

헤더 카드는 데스크톱에서도 max-width 540px — 시그널 본질 (도넛 + 가격) 강조. 우측에 거시/신호 보조 정보.

---

## 6. 데이터 시각화 룰

### 점수 → 색

```ts
// signal score 0-100 → 토큰
function scoreToToken(score: number): string {
  if (score >= 80) return 'signal-strong-buy';
  if (score >= 60) return 'signal-buy';
  if (score >= 40) return 'signal-neutral';
  if (score >= 20) return 'signal-sell';
  return 'signal-strong-sell';
}
```

### BB 영역 안/밖 시각화

`EntryZoneCard` 에서 자동 전환. `lib/signals/entryZone.ts` 의 `calculateEntryZone` 가 결정.

### 등락

- 양수: `text-signal-buy` (`+12.3%`)
- 음수: `text-signal-sell` (`-3.4%`)
- null/0: `text-text-tertiary` (`–`)

### 거시 우호/불리

종목 등락 색과 동의어가 아니다. 텍스트 라벨 + 작은 점 (`bg-signal-buy` / `bg-signal-sell`) 으로 표현. 등락처럼 보이지 않도록 큰 색 면 사용 금지.

---

## 7. 접근성

- 터치 타깃 최소 40x40
- 색 대비: WCAG AA (signal 토큰들 모두 `--bg-card` 위에서 4.5:1 이상)
- 색만으로 의미 전달 금지: 모든 상태 변화에 텍스트 라벨 동반
- 포커스 링: `outline: 2px solid var(--ai-accent); outline-offset: 2px;`

---

## 8. 토큰 변경 절차

1. 본 문서 토큰 표 수정 (변경 사유 + 날짜 주석)
2. `tailwind.config.ts` 의 `theme.extend.colors` 동기화
3. `app/globals.css` 의 CSS 변수 동기화
4. 영향받는 컴포넌트 시각 검증
5. PR 머지

---

*Status: Active. 변경 시 본 §8 절차 준수.*
