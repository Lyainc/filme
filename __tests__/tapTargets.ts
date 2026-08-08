/**
 * 탭 타깃 크기 회귀의 공용 판정기(#508 → #500·#553).
 *
 * happy-dom엔 실 레이아웃이 없어 px를 못 재므로 선언된 크기(Tailwind 사이즈 클래스 h-N/w-N =
 * N×4px, 또는 인라인 style의 px)를 파싱해 판정한다. 클래스 파싱이라 실제 렌더 px를 못 보므로,
 * 파서를 우회해 타깃을 줄일 수 있는 수단(브레이크포인트 variant `max-[380px]:h-5`, `scale-*`
 * 변형, 인라인 scale 축소)은 아예 금지해 구멍을 막는다 — 그걸 쓰고 싶으면 이 파서가 아니라
 * 실 px 측정 방식으로 갈아탈 것.
 *
 * 실제 렌더 px는 브라우저 실측으로 따로 확인한다(#508 툴바 239.6→179.6px, #500 후보정 dock 413→312px).
 */
import { expect } from 'bun:test';

/** WCAG 2.2 SC 2.5.8 (AA) 최소 타깃 — 24×24 CSS px. */
export const MIN_AA = 24;

/**
 * 파서가 못 보는 축소 경로를 막는다 — 크기 자체가 아니라 "선언된 크기를 나중에 줄이는 수단"이
 * 대상이라, 타깃 엘리먼트뿐 아니라 그 서브트리(스와치 span 등)에도 따로 걸 수 있게 분리했다.
 *
 * `active:scale-*`는 예외다(#647) — breakpoint/variant로 선언 크기 자체를 몰래 줄이는 우회
 * (`max-[380px]:h-5` 류)를 막는 게 이 정규식의 원래 의도고, `:active` 순간에만 걸리는 눌림
 * 피드백은 정적 선언 크기를 바꾸지 않는다. 다른 콜론-variant(hover:/focus:/breakpoint:) 축소는
 * 여전히 막힌다.
 */
export function assertNoShrink(el: Element, what: string) {
  const cls = el.getAttribute('class') ?? '';
  const style = el.getAttribute('style') ?? '';
  const at = (s: string) => `${what}: ${cls || style} — ${s}`;
  expect(at('variant 금지')).not.toMatch(/(?:^|\s)(?!active:scale-)\S+:(?:h|w|size|scale|max-[hw])-/);
  expect(at('scale 클래스 금지')).not.toMatch(/(?:^|\s)-?scale-/);
  // max-h/max-w는 h-N을 그대로 둔 채 실렌더만 줄인다 — 파서엔 안 보이는 축소라 같이 막는다.
  expect(at('max-h/max-w 금지')).not.toMatch(/(?:^|\s)max-[hw]-/);
  // 인라인 transform도 같은 우회 — 축소(1 미만)만 막는다(활성 칩의 scale(1.05)는 확대라 무해).
  // scaleX/scaleY/scale3d까지 잡아야 한 축만 줄이는 우회가 안 샌다.
  const inlineScale = style.match(/scale(?:X|Y|3d)?\(\s*([\d.]+)/);
  if (inlineScale) expect(Number(inlineScale[1])).toBeGreaterThanOrEqual(1);
}

/**
 * tailwind.config.js theme.extend.spacing의 named 토큰 — h-N처럼 숫자×4px가 아니라 리터럴
 * px값이라 별도 조회 테이블로 읽는다(#647 축 2: min-h-touch/h-touch 도입으로 처음 필요해짐).
 */
const NAMED_SPACING_PX: Record<string, number> = { touch: 44 };

/**
 * 선언된 타깃 크기를 px로 돌려준다. 축마다 다음 중 하나로 선언돼 있어야 한다:
 *  - Tailwind `h-N`/`w-N` (N×4px)
 *  - Tailwind named spacing `h-touch`/`w-touch`(NAMED_SPACING_PX 참고)
 *  - 인라인 `style="width:46px"` (TexturePicker 칩처럼 상수로 크기를 잡는 경우)
 *  - 가로만: `flex-1`/`w-full` — 부모 폭을 채우는 선언이라 축소 경로가 아니다(Infinity로 통과)
 */
export function targetPx(el: Element, what: string): { w: number; h: number } {
  const cls = el.getAttribute('class') ?? '';
  const style = el.getAttribute('style') ?? '';
  const at = (s: string) => `${what}: ${cls || style} — ${s}`;
  assertNoShrink(el, what);

  // size-N은 두 축을 한 번에 잡는 Tailwind 관용구 — h-N/w-N과 같은 선언이라 같이 읽는다.
  const fromClass = (axis: 'h' | 'w') => {
    const named = cls.match(new RegExp(`(?:^|\\s)(?:min-)?${axis}-(${Object.keys(NAMED_SPACING_PX).join('|')})(?:\\s|$)`));
    if (named) return NAMED_SPACING_PX[named[1]];
    const m = cls.match(new RegExp(`(?:^|\\s)(?:${axis}|size)-(\\d+)(?:\\s|$)`));
    return m ? Number(m[1]) * 4 : null;
  };
  const fromStyle = (prop: 'height' | 'width') => {
    const m = style.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*([\\d.]+)px`));
    return m ? Number(m[1]) : null;
  };

  const h = fromClass('h') ?? fromStyle('height');
  const fills = /(?:^|\s)(?:flex-1|w-full)(?:\s|$)/.test(cls);
  const w = fromClass('w') ?? fromStyle('width') ?? (fills ? Infinity : null);
  if (h === null) throw new Error(at('h-N 또는 인라인 height 필요'));
  if (w === null) throw new Error(at('w-N·인라인 width·flex-1 중 하나 필요'));
  return { h, w };
}

/** 타깃이 SC 2.5.8 하한을 넘는지 단언한다. 넘으면 실측 크기를 돌려준다. */
export function expectMeetsAA(el: Element, what: string): { w: number; h: number } {
  const { w, h } = targetPx(el, what);
  if (w < MIN_AA || h < MIN_AA) throw new Error(`${what}: ${w}×${h}px < ${MIN_AA}×${MIN_AA} (SC 2.5.8 AA)`);
  return { w, h };
}
