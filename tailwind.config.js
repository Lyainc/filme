/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // === Wizard light theme ===
        bg: '#F8F5EE',           // page cream
        surface: '#FCFAF6',      // raised cards
        paper: '#FFFFFF',        // device/modal surface (used by bg-paper, bg-paper/25 etc.)
        fg: {
          DEFAULT: '#2C2622',    // primary text dark brown
          muted: '#756B62',
          faint: '#A89E92',
        },
        accent: {
          DEFAULT: '#C8704F',    // warm rust
          soft: 'rgba(200,112,79,0.12)',
          ink: '#9B5436',
        },
        success: '#3A9A56',
        warn: '#D9A248',
        danger: '#D6422F',

        // wizard hairline border (Tailwind's `border` token name conflicts with
        // Preflight's borderColor.DEFAULT — keep this as `hairline`).
        hairline: '#E5DFD3',
      },
      fontFamily: {
        sans: ['var(--font-sans)', '"Pretendard Variable"', 'Pretendard', 'system-ui', '"Apple SD Gothic Neo"', '"Noto Sans KR"', 'sans-serif'],
        mono: ['var(--font-mono)', '"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
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
        widest: '0.24em',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
}
