/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0E0E10',
          50: '#1B1B1F',
          100: '#16161A',
          200: '#1F1F24',
          300: '#2A2A30',
          400: '#3A3A42',
        },
        paper: {
          DEFAULT: '#F5F1E8',
          dim: '#E8E3D5',
        },
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
        burn: {
          DEFAULT: '#C75A3F',
        },
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', '"Helvetica Neue"', '"Apple SD Gothic Neo"', '"Noto Sans KR"', 'sans-serif'],
        display: ['"Fraunces"', '"Pretendard Variable"', 'Pretendard', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', '"Berkeley Mono"', '"SF Mono"', 'ui-monospace', 'Menlo', 'monospace'],
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
