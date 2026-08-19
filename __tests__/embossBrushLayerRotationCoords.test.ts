/**
 * `toLocalRect`(회전 가로 무드의 max 뷰모드 좌표 역변환, #729 c5) 수치 검증.
 * `getBoundingClientRect`가 회전된 요소의 **축정렬 bbox**를 주므로 width/height가 로컬
 * 폭/높이와 뒤바뀐 채로 들어오는데, 이 함수가 그걸 되돌리는지를 실제 좌표값으로 잠근다
 * (claude-review #736 P1 — 순수 함수인데 비export라 테스트가 없었다).
 */
import { describe, expect, test } from 'bun:test';
import { toLocalRect, screenFracToBoxFrac, boxFracToScreenFrac } from '@/components/v2/EmbossBrushLayer';

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
}

describe('toLocalRect — 90도 회전 축정렬 bbox 역변환 (#729 c5)', () => {
  test('회전 전 세로 사각형(width<height)이 축정렬 bbox에서 width>height로 뒤집혀 들어와도 로컬 좌표에서 다시 세로로 돌아온다', () => {
    // 화면(축정렬 bbox)은 가로로 넓다(width 5, height 2) — 90도 회전된 세로 요소의 실측치.
    const r = rect(10, 20, 5, 2);
    const local = toLocalRect(0, 0, r);
    // 로컬 좌표계에서는 폭/높이가 뒤바뀌어야 한다(원래 세로 요소이므로 local.width < local.height).
    expect(local.width).toBeCloseTo(2);
    expect(local.height).toBeCloseTo(5);
  });

  test('피벗이 원점일 때 좌상단 모서리가 정확한 부호로 매핑된다', () => {
    const r = rect(10, 20, 5, 2);
    const local = toLocalRect(0, 0, r);
    // corners: (10,20)->(20,-10), (15,22)->(22,-15) → left=min(20,22)=20, top=min(-10,-15)=-15
    expect(local.left).toBeCloseTo(20);
    expect(local.top).toBeCloseTo(-15);
  });

  test('피벗이 사각형 중심일 때 결과도 피벗 기준으로 평행이동한다', () => {
    const r = rect(0, 0, 4, 2); // 중심 (2, 1)
    const centered = toLocalRect(2, 1, r);
    const origin = toLocalRect(0, 0, r);
    expect(centered.left).toBeCloseTo(origin.left - 1); // y-pivotCy 방향
    expect(centered.top).toBeCloseTo(origin.top + 2); // -(x-pivotCx) 방향
  });
});

describe('screenFracToBoxFrac / boxFracToScreenFrac — 포인터·올가미 미리보기 축 스왑 (#729 c5, claude-review #736 2차 P1)', () => {
  test('rotated=false는 항등 변환이다', () => {
    expect(screenFracToBoxFrac(0.3, 0.7, false)).toEqual({ boxX: 0.3, boxY: 0.7 });
    expect(boxFracToScreenFrac(0.3, 0.7, false)).toEqual({ u: 0.3, v: 0.7 });
  });

  test('rotated=true는 로컬 x=화면 y, 로컬 y=1-화면 x로 스왑한다', () => {
    expect(screenFracToBoxFrac(0.2, 0.9, true)).toEqual({ boxX: 0.9, boxY: 0.8 });
  });

  test('boxFracToScreenFrac은 screenFracToBoxFrac의 정확한 역변환이다(왕복 항등, rotated 양쪽)', () => {
    for (const rotated of [false, true]) {
      for (const [u, v] of [[0.1, 0.4], [0.5, 0.5], [0.9, 0.05]] as const) {
        const { boxX, boxY } = screenFracToBoxFrac(u, v, rotated);
        const back = boxFracToScreenFrac(boxX, boxY, rotated);
        expect(back.u).toBeCloseTo(u);
        expect(back.v).toBeCloseTo(v);
      }
    }
  });
});
