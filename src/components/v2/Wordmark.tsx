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

/** 마크 + 로고타입 락업(BI 마스터 §01). 감싸는 랜드마크(h1/Link)는 호출부가 결정한다.
 * onClick(#578, 워드마크=초기화 두 번째 진입점)을 주면 아이콘+로고타입 전체가 탭 타깃이 되는데,
 * h1을 리터럴 `<button>`으로 바꾸는 대신(h1 시맨틱이 사라진다) h1은 그대로 두고 안쪽 span이
 * role="button"을 진다 — display:contents는 안 쓴다(WebKit이 한동안 접근성 트리에서 통째로
 * 지웠던 이력이 있는 속성이라, 레이아웃은 h1 자신의 flex로 잡는 쪽이 안전하다). */
export function Wordmark({ as: Tag = 'span', onClick }: { as?: 'h1' | 'span'; onClick?: () => void }) {
  // 시각 글자는 dotless-i라 접근성 이름은 aria-label로 고정 — SR·테스트 모두 "FILME"(클릭형은
  // "FILME — 처음 화면으로 돌아가기"로 대체).
  const glyphs = (
    <>
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
    </>
  );
  const glyphStyle = { fontFamily: 'var(--font-brand)', fontWeight: 900, fontSize: 19, lineHeight: 1, letterSpacing: '-0.012em' };

  if (!onClick) {
    return (
      <>
        <ClapTixMark />
        <Tag aria-label="FILME" className="inline-flex items-baseline whitespace-nowrap text-fg" style={glyphStyle}>
          {glyphs}
        </Tag>
      </>
    );
  }

  return (
    // h1 자체는 aria-label="FILME"로 고정 — 안 두면 accname이 name-from-content로 안쪽
    // button의 aria-label("FILME — 처음 화면으로 돌아가기")을 그대로 물려받아 헤딩 이름이
    // 깨진다(mobileEditorShellMenu.test.tsx의 heading name:'FILME' 회귀).
    <Tag aria-label="FILME" className="inline-flex items-center">
      <span
        role="button"
        tabIndex={0}
        aria-label="FILME — 처음 화면으로 돌아가기"
        className="inline-flex cursor-pointer items-center gap-2"
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
      >
        <ClapTixMark />
        <span className="inline-flex items-baseline whitespace-nowrap text-fg" style={glyphStyle}>{glyphs}</span>
      </span>
    </Tag>
  );
}
