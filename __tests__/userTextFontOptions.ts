/**
 * 한줄평·서명 폰트 9택(#437)의 기대표 — 칩 라벨 → 저장값 → 렌더된 fontFamily 조각 → 크기 배율.
 *
 * quote(designRailQuoteFont)와 signature(designRailSignatureFont)가 같은 `QuoteFont` 유니온과
 * 같은 `userTextFont` 진입점을 쓰므로 표도 하나만 둔다 — 두 파일에 복사해 두면 한쪽만 고치는
 * 드리프트가 생기고, 그게 이 축에서 제일 그럴듯한 회귀다.
 *
 * **값을 프로덕션 코드에서 끌어오지 않고 여기 손으로 적는 게 요점이다.** `_shared.tsx`의
 * USER_TEXT_FONTS·HANGUL_SIZE_SCALE에서 파생시키면 매핑이 통째로 틀려도 테스트가 같이 틀려
 * 통과한다. 배율은 `bun scripts/measure-font-metrics.mjs`의 실측값이고, 폰트를 더하거나
 * 갈아치우면 스크립트를 다시 돌려 저 상수와 이 표를 **둘 다** 갱신한다.
 */
export interface FontChip {
  /** 레일 칩 라벨 */
  label: string;
  /** components.quoteFont / components.signatureFont에 저장되는 값 */
  value: string;
  /** 렌더된 inline fontFamily에 반드시 들어 있어야 하는 조각 */
  family: string;
  /** 한글 텍스트일 때의 크기 배율(기준 = hand) */
  hangul: number;
  /** 라틴 텍스트일 때의 크기 배율(기준 = Instrument Serif) */
  latin: number;
}

/** 'auto'를 뺀 8종 — auto는 텍스트에 따라 도착지가 갈려 케이스별로 따로 본다. */
export const FONT_CHIPS: readonly FontChip[] = [
  // `Pretendard`가 아니라 `--font-sans`를 기대하는 게 요점이다(#437) — 리터럴
  // "Pretendard Variable"은 next/font가 등록한 난독화 패밀리(`pretendard`)를 못 가리켜서,
  // OS에 폰트가 따로 깔린 기기에서만 맞고 나머지는 시스템 폰트로 조용히 떨어졌다.
  { label: '고딕', value: 'gothic', family: '--font-sans', hangul: 0.838, latin: 1.002 },
  { label: '바탕', value: 'batang', family: '--font-batang', hangul: 0.757, latin: 1.039 },
  { label: '자람', value: 'hand', family: '--font-quote-kr', hangul: 1, latin: 1.25 },
  { label: '잉크', value: 'ink', family: '--font-ink', hangul: 0.903, latin: 1.143 },
  { label: '은영', value: 'eunyoung', family: '--font-eunyoung', hangul: 0.943, latin: 1.238 },
  { label: '붓', value: 'brush', family: '--font-brush', hangul: 0.89, latin: 1.25 },
  { label: '쿨가이', value: 'coolguy', family: '--font-coolguy', hangul: 0.905, latin: 1.246 },
  { label: '꽃길', value: 'flower', family: '--font-flower', hangul: 0.918, latin: 1.25 },
];

/** auto가 도착하는 두 곳 — 한글이면 자람(hand), 라틴이면 Instrument Serif. 배율은 둘 다 1. */
export const AUTO_HANGUL_FAMILY = '--font-quote-kr';
export const AUTO_LATIN_FAMILY = '--font-display';

/** 칩 라벨 전부(자동 포함) — 잠금 검사처럼 9개를 다 훑어야 하는 자리에서 쓴다. */
export const ALL_FONT_LABELS = ['자동', ...FONT_CHIPS.map((c) => c.label)];

/** `userTextFont(text, font, base)`가 내놓는 fontSize와 같은 반올림(소수 둘째 자리). */
export function expectedFontSize(base: number, scale: number): string {
  return `${Math.round(base * scale * 100) / 100}px`;
}
