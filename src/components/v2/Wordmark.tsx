/**
 * FILME BI 마스터 v2(claude.ai/design 2435c930, "FINAL · 19A 확정") 기준 브랜드 락업.
 * - 심볼: Clapper-Ticket 마크, 어센트 배지 안 -16° 대각(BI ANGLE 스펙).
 * - 로고타입: "fılme" — Nunito 900(--font-brand), dotless-i 위 어센트 dot tittle, me 강조.
 * 마크 내부 잉크/페이퍼(#FBF4EC/#241C22)는 테마 토큰이 아니라 BI 고정 브랜드 상수다.
 */

/** Clapper-Ticket 심볼(BI 마스터 §02) — 시안 Mark-ClapTix.dc.html SVG 포팅. */
function ClapTixMark({ size = 30 }: { size?: number }) {
  const ink = '#FBF4EC';
  const accent = '#241C22';
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-accent"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        style={{ width: Math.round(size * 0.73), height: Math.round(size * 0.73), transform: 'rotate(-16deg)' }}
      >
        <path fill={ink} d="M21 27 H79 A8 8 0 0 1 87 35 V65 A8 8 0 0 1 79 73 H21 A8 8 0 0 1 13 65 V35 A8 8 0 0 1 21 27 Z" />
        <rect x="21" y="34.5" width="30" height="9" rx="2.5" fill={accent} />
        <g fill={ink}>
          <path d="M24.5 34.5 H28.5 L25.5 43.5 H21.5 Z" />
          <path d="M32 34.5 H36 L33 43.5 H29 Z" />
          <path d="M39.5 34.5 H43.5 L40.5 43.5 H36.5 Z" />
          <path d="M47 34.5 H51 L48 43.5 H44 Z" />
        </g>
        <rect x="22" y="49" width="28" height="3.4" rx="1.7" fill={accent} />
        <rect x="22" y="56.5" width="18" height="3.4" rx="1.7" fill={accent} />
        <line x1="58" y1="33" x2="58" y2="67" stroke={accent} strokeWidth="2" strokeDasharray="2 3.6" strokeLinecap="round" />
        <rect x="66" y="43.5" width="14" height="14" rx="3.5" fill={accent} />
        <circle cx="73" cy="50.5" r="3.4" fill={ink} />
        <circle cx="73" cy="50.5" r="1.15" fill={accent} />
      </svg>
    </span>
  );
}

/** 마크 + 로고타입 락업(BI 마스터 §01). 감싸는 랜드마크(h1/Link)는 호출부가 결정한다. */
export function Wordmark({ as: Tag = 'span' }: { as?: 'h1' | 'span' }) {
  return (
    <>
      <ClapTixMark />
      {/* 시각 글자는 dotless-i라 접근성 이름은 aria-label로 고정 — SR·테스트 모두 "FILME". */}
      <Tag
        aria-label="FILME"
        className="inline-flex items-baseline whitespace-nowrap text-fg"
        style={{ fontFamily: 'var(--font-brand)', fontWeight: 900, fontSize: 19, lineHeight: 1, letterSpacing: '-0.012em' }}
      >
        f
        <span className="relative inline-block">
          ı
          <span
            aria-hidden="true"
            className="absolute rounded-full bg-accent"
            style={{ left: '50%', bottom: '0.72em', width: '0.2em', height: '0.2em', transform: 'translateX(-50%)' }}
          />
        </span>
        l<span className="text-accent">me</span>
      </Tag>
    </>
  );
}

/** Sprocket 없는 축약형 "FILME" 텍스트. 모바일 셸 nav바 전용. */
export function WordmarkCompact() {
  return (
    <span
      className="text-mono text-fg-muted"
      style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}
    >
      FILME
    </span>
  );
}
