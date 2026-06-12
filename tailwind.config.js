/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '.theme-dark'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // rail↔dock 단일 경계(#104). src/utils/breakpoints.ts의 RAIL_BREAKPOINT_PX와
      // 반드시 같은 px — 한쪽만 바꾸면 그 사이 폭에 진입 CTA dead zone이 생긴다.
      screens: {
        rail: '1024px',
      },
      colors: {
        // === v2.2 cool-neutral theme (CSS var — responds to .theme-dark) ===
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-elevated': 'var(--surface-elevated)',
        paper: 'var(--surface-elevated)',   // backward compat alias
        fg: {
          DEFAULT: 'var(--fg)',
          muted: 'var(--fg-muted)',
          faint: 'var(--fg-faint)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          hover: 'var(--accent-hover)',
          ink: 'var(--accent-ink)',
        },
        'border-strong': 'var(--border-strong)',
        'focus-ring': 'var(--focus-ring)',
        success: 'var(--success)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',

        // design-system border token — use border-line, bg-line for dividers/separators
        line: 'var(--border)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', '"Pretendard Variable"', 'Pretendard', 'system-ui', '"Apple SD Gothic Neo"', '"Noto Sans KR"', 'sans-serif'],
        mono: ['var(--font-mono)', '"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
        // 라틴 디스플레이(Oswald). 한글은 Pretendard 폴백으로 per-glyph 렌더 → 토푸 방지.
        display: ['var(--font-display)', '"Oswald"', 'var(--font-sans)', '"Pretendard Variable"', '"Apple SD Gothic Neo"', '"Noto Sans KR"', 'sans-serif'],
      },
      borderRadius: {
        field: '12px',       // backward compat (Stage 2에서 컴포넌트 클래스 교체)
        'field-sm': '10px',  // v2.2 신규 (--r-field: 10px)
        card: '18px',
        modal: '22px',
        shell: '20px',       // v2.2 --r-shell
        chip: '9999px',
      },
      spacing: {
        btn: '52px',
        touch: '44px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(44,38,34,0.05), 0 12px 40px -24px rgba(44,38,34,0.18)',
      },
      letterSpacing: {
        widest: '0.24em',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'sprocket-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        // X축은 배너의 -translate-x-1/2(중앙정렬)와 충돌하지 않도록 keyframe 안에서 -50%로 고정
        'slide-up': {
          '0%': { opacity: '0', transform: 'translate(-50%, 1rem)' },
          '100%': { opacity: '1', transform: 'translate(-50%, 0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'sprocket-spin': 'sprocket-spin 1.4s linear infinite',
        'slide-up': 'slide-up 0.3s ease-out forwards',
      },
    },
  },
  plugins: [],
}
