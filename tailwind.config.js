/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // === Wizard light theme (디자인 시방서 기준) ===
        bg: '#F8F5EE',           // oklch(97% .018 70) page cream
        surface: '#FCFAF6',      // oklch(99% .008 70) cards
        paper: {                 // overrides legacy `paper.*` — DEFAULT 반전
          DEFAULT: '#FFFFFF',    // device/modal surface
          dim: '#E8E3D5',        // legacy 호환
          cream: '#F4EDE0',      // legacy 호환
          deep: '#1A1612',       // legacy 호환 (mood preview inner-frame fallback)
        },
        fg: {
          DEFAULT: '#2C2622',    // primary text dark brown
          muted: '#756B62',
          faint: '#A89E92',
        },
        accent: {
          DEFAULT: '#C8704F',    // warm rust ~ oklch(64% .13 28)
          soft: 'rgba(200,112,79,0.12)',
          ink: '#9B5436',
        },
        success: '#3A9A56',
        warn: '#D9A248',
        danger: '#D6422F',

        // === Legacy dark theme (Phase 3~4에서 wizard로 마이그레이션, Phase 5 cleanup 대상) ===
        ink: {
          DEFAULT: '#0E0E10',
          50: '#1B1B1F',
          100: '#16161A',
          200: '#1F1F24',
          300: '#2A2A30',
          400: '#3A3A42',
        },
        cannes: { DEFAULT: '#A8312A' },
        film: { base: '#0A0A0A', ink: '#F4EDE0' },
        bone: {
          DEFAULT: '#D8D2C2',
          50: '#F0EBDD',
          100: '#E2DCC9',
          400: '#9C988B',
          500: '#7A776D',
        },
        gold: {
          DEFAULT: '#E5B469',
          50: '#F5DDB1',
          100: '#EFCA8E',
          200: '#E5B469',
          300: '#C99A4F',
          400: '#A07835',
        },
        burn: { DEFAULT: '#C75A3F' },
        border: '#E5DFD3',  // wizard border (라이트)
      },
      fontFamily: {
        sans: ['var(--font-sans)', '"Pretendard Variable"', 'Pretendard', 'system-ui', '"Apple SD Gothic Neo"', '"Noto Sans KR"', 'sans-serif'],
        mono: ['var(--font-mono)', '"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
        // Legacy display/serif/inter — Phase 4~5에서 사용처 정리 후 제거
        display: ['"Fraunces"', '"Pretendard Variable"', 'Pretendard', 'Georgia', 'serif'],
        serif: ['"Cormorant Garamond"', '"Times New Roman"', 'Georgia', 'serif'],
        inter: ['"Inter"', '"Pretendard Variable"', '"Helvetica Neue"', 'sans-serif'],
      },
      borderRadius: {
        field: '12px',
        card: '18px',
        modal: '22px',
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
        tightest: '-0.04em',
        widest: '0.24em',
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '1.4' }],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'shimmer': 'shimmer 3s linear infinite',
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.95 0 0 0 0 0.95 0 0 0 0 0.95 0 0 0 0.18 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}
