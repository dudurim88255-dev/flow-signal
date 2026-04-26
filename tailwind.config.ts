import type { Config } from 'tailwindcss'

/**
 * Tokens — docs/design/SCORE_PAGE.md 와 동기화. 변경 시 그 문서 §8 절차 준수.
 * CSS 변수 매핑 — globals.css `:root` 와 1:1.
 */
export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        signal: {
          'strong-buy': 'rgb(var(--signal-strong-buy) / <alpha-value>)',
          buy: 'rgb(var(--signal-buy) / <alpha-value>)',
          neutral: 'rgb(var(--signal-neutral) / <alpha-value>)',
          sell: 'rgb(var(--signal-sell) / <alpha-value>)',
          'strong-sell': 'rgb(var(--signal-strong-sell) / <alpha-value>)',
        },
        pending: 'rgb(var(--pending-zone) / <alpha-value>)',
        ai: 'rgb(var(--ai-accent) / <alpha-value>)',
        bg: {
          primary: 'rgb(var(--bg-primary) / <alpha-value>)',
          card: 'rgb(var(--bg-card) / <alpha-value>)',
          'card-elevated': 'rgb(var(--bg-card-elevated) / <alpha-value>)',
        },
        border: {
          subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
        },
        fg: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',
        },
      },
      fontSize: {
        h1: ['26px', { lineHeight: '1.3', fontWeight: '500' }],
        h2: ['22px', { lineHeight: '1.35', fontWeight: '500' }],
        h3: ['17px', { lineHeight: '1.4', fontWeight: '500' }],
        body: ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        caption: ['11px', { lineHeight: '1.4', fontWeight: '400' }],
        micro: ['10px', { lineHeight: '1.3', fontWeight: '400' }],
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '10px',
        lg: '12px',
      },
    },
  },
  plugins: [],
} satisfies Config
