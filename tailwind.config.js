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

        // 2nd 시네마틱 neutral(#203) — 구조 요소(eyebrow·디바이더) 전용, 액션 red와 별개
        'neutral-2': 'var(--neutral-2)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', '"Pretendard Variable"', 'Pretendard', 'system-ui', '"Apple SD Gothic Neo"', '"Noto Sans KR"', 'sans-serif'],
        mono: ['var(--font-mono)', '"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
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
        // 완성 화면 eyebrow의 은은한 rise-in(#222). backwards fill로 종료 후 transform을
        // 남기지 않아 settle과 같은 이유로 screen-in identity-matrix 함정을 피한다.
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // #98 완성 모먼트 "철컥 안착" — 결과 promoted 셀이 마운트될 때 위에서 살짝
        // 내려앉으며 accent ring/그림자가 깊어진다(60%에서 미세 overshoot). box-shadow를
        // keyframe이 전담 — 100%는 PreviewFilmCell의 promoted inline 그림자와 동일해서
        // animation 종료 후 원래 스타일로 복귀해도(아래 backwards) 시각 점프가 없다.
        // 100%(=정상 표시)가 끝상태라 reduced-motion 전역 가드가 duration을 0.01ms로
        // 죽여도 정상에 즉시 도달 → 자동 비활성.
        'settle': {
          '0%': {
            opacity: '0',
            transform: 'translateY(-10px) scale(0.96)',
            boxShadow: '0 4px 16px -8px rgba(0,0,0,0.3)',
          },
          '60%': { opacity: '1', transform: 'translateY(2px) scale(1.005)' },
          '100%': {
            opacity: '1',
            transform: 'translateY(0) scale(1)',
            boxShadow:
              '0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent), 0 16px 50px -16px rgba(0,0,0,0.6)',
          },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'sprocket-spin': 'sprocket-spin 1.4s linear infinite',
        'slide-up': 'slide-up 0.3s ease-out forwards',
        'rise-in': 'rise-in 0.5s cubic-bezier(0.2,0.9,0.3,1) backwards',
        // backwards: 마운트 즉시 0% 프레임부터 적용하되, 종료 후엔 transform을 남기지
        // 않고 원래 스타일로 복귀 → screen-in identity-matrix 함정(forwards) 원천 차단.
        'settle': 'settle 0.42s cubic-bezier(0.2,0.9,0.3,1) backwards',
      },
    },
  },
  plugins: [],
}
