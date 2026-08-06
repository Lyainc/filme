/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '.theme-dark'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 폰 프레임이 뷰포트를 그대로 채울지(모바일) 400px로 좁힐지(데스크톱) 가르는 유일한
      // 경계다 — 소비자는 PhoneFrame의 `rail:w-[400px]` 하나뿐이다. #607 이전엔 JS 쪽
      // src/utils/breakpoints.ts(RAIL_BREAKPOINT_PX)와 값을 미러링해야 했고 한쪽만 바꾸면 그
      // 사이 폭에 dead zone이 생겼는데(#104), 셸 분기가 사라지며 JS 짝도 함께 삭제됐다.
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
        // 강조색 사용 규칙(D8, #615 → #616에서 실제 코드에 맞춰 정정) — accent가 나갈 자리는 둘뿐이다:
        // ① 화면당 하나뿐인 주 액션의 채움(`bg-accent` + `text-accent-ink`) — 랜딩 OCR CTA와 결과
        //    화면 "사진에 저장"이 그것이고, #635가 OCR을 주 CTA로 올릴 때 이 채움을 의도적으로 남겼다.
        // ② 상태 표시 — 선택(무드칩 링·레일 활성 라벨), 포커스링, 드래그 오버 아웃라인.
        // 정적 카피·장식·구조 요소엔 안 쓴다(위계는 fg/fg-muted/fg-faint 대비로 잡고, eyebrow·디바이더
        // 같은 구조 요소는 neutral-2가 따로 맡는다). 2차 액션은 채움이 아니라 `accent-soft` 그라운드다.
        // #615 원안 주석은 "CTA 배경엔 안 쓴다"였는데 셸·랜딩·결과 어디서도 그렇게 구현된 적이 없다.
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
      // 서비스 UI(앱 chrome) 타이포 스케일(#616) — 랜딩(#615)이 실제로 쓰던 26/14/12를 앵커로
      // 삼아 손으로 흩어져 있던 아홉 단(9.5·10·11·12·13·14·15·16·26)을 다섯 단으로 모은다.
      // 랜딩→편집 전환에서 글자 크기가 연속되게 하는 게 목적이라, 소비자는 chrome 전체다.
      // **티켓 렌더(src/components/moods/·_shared.tsx)는 이 스케일 밖이다** — 무드 서체·크기는
      // 디자인 의도라 인라인 스타일로 따로 산다(#114/PR #129 결정, #616 함정 1).
      // 값만 두고 line-height를 안 싣는 건 의도다: text-[11px] 같은 arbitrary 값도 font-size만
      // 정하므로 이름만 바꾸는 자리는 픽셀이 1도 안 움직인다(#563 불변식 보호). 행간이 필요한
      // 자리는 지금처럼 leading-* 를 따로 얹는다. display만 예외 — 호출처가 랜딩 h1 하나고
      // 기존 leading-[1.25] tracking-tight를 그대로 흡수한다.
      fontSize: {
        display: ['26px', { lineHeight: '1.25', letterSpacing: '-0.025em' }],
        title: '16px',    // 입력 필드 — 16px 미만이면 iOS가 포커스 시 화면을 확대한다
        body: '14px',     // 본문·행·값·주요 액션
        caption: '12px',  // 칩·노트·보조 링크
        micro: '11px',    // dock 라벨·상태·eyebrow
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
        // 에디터 세로 리듬 3단 스케일(#201) — field(필드 내부) < group(필드 묶음) < section(섹션 경계)
        field: '0.625rem',  // 10px, 기존 space-y-2.5
        group: '1rem',      // 16px, 기존 space-y-4/5 통합
        section: '1.5rem',  // 24px, 기존 space-y-6
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
        // 랜딩 히어로 무드 갤러리(#615) — 리스트를 2벌 이어붙인 트랙을 -50% 이동시켜
        // seamless loop. reduced-motion에서는 정지 그리드로 통째로 갈아끼우므로(JS 분기,
        // MoodGallery) 이 keyframe 자체엔 reduced-motion 처리가 없다 — 전역 가드
        // (globals.css @media prefers-reduced-motion)가 duration을 0.01ms로 죽이는 건
        // 벨트오브서스펜더스일 뿐, 실제 정지 레이아웃은 JS가 만든다.
        'marquee': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
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
        'marquee': 'marquee 24s linear infinite',
      },
    },
  },
  plugins: [],
}
