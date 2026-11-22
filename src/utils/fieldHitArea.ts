import type { SheetTarget } from '@/constants/fields';

/** 화면 px 상자 하나 — getBoundingClientRect의 부분집합이라 테스트가 DOM 없이 만든다. */
export interface FieldBox {
  field: SheetTarget;
  left: number;
  top: number;
  width: number;
  height: number;
}

/** WCAG 2.5.5 탭 타깃 — 필드 글자 상자가 이보다 작으면 중심 기준으로 이만큼 넓혀 받는다(#826 S3 D13-2 A). */
export const FIELD_HIT_PX = 44;

/**
 * 누른 점 → 열 필드(#826 S3 constraint-8). 프리뷰 219×350에선 좌석 · 상영관 같은 필드 글자 상자가 8px 안팎이라,
 * 글자 상자를 중심에 두고 축마다 최소 44px로 넓힌 상자 안에 점이 드는 필드 중 중심이 가장 가까운 것을 연다.
 * 축이 이미 44보다 큰 필드(제목 폭 등)는 그 축을 그대로 쓴다 — 44×44 상자로 줄이면 글자 상자 바깥쪽이
 * 오히려 hit에서 빠진다. 한 축이라도 0인 상자(레이아웃 전, happy-dom, 글자 없는 노드)는 보이는 상자가 아니라 누를 수 없는 것으로 본다.
 * 어느 상자에도 안 들면 null이고, 그 탭은 원래 받던 쪽(포스터 없는 문서의 '포스터 추가')으로 간다.
 */
export function pickFieldAt(x: number, y: number, boxes: readonly FieldBox[], hit = FIELD_HIT_PX): SheetTarget | null {
  let best: SheetTarget | null = null;
  let bestDist = Infinity;
  for (const b of boxes) {
    if (b.width <= 0 || b.height <= 0) continue;
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    if (Math.abs(dx) > Math.max(b.width, hit) / 2 || Math.abs(dy) > Math.max(b.height, hit) / 2) continue;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = b.field;
    }
  }
  return best;
}

/** root 안의 data-field-tap 앵커를 화면 px 상자로 모은다 — 무드가 그린 필드만 나온다. */
export function fieldBoxesIn(root: Element): FieldBox[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-field-tap]')).map((el) => {
    const r = el.getBoundingClientRect();
    return { field: el.dataset.fieldTap as SheetTarget, left: r.left, top: r.top, width: r.width, height: r.height };
  });
}
