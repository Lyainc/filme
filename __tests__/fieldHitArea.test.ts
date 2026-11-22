/**
 * #826 S3 constraint-8 · acceptance-4 — 필드 hit 44(D13-2 A)의 순수 판정.
 *
 * 글자 상자가 44보다 작은 필드는 중심을 두고 축마다 44로 넓혀 받고, 그 상자에 드는 필드 중 중심이 가장 가까운 것을 연다.
 * 어느 상자에도 안 들면 null(→ 셸은 그 탭을 원래 받던 쪽, 포스터 없는 문서면 '포스터 추가'로 보낸다).
 */
import { describe, expect, test } from 'bun:test';
import { pickFieldAt, FIELD_HIT_PX, type FieldBox } from '@/utils/fieldHitArea';

/** 프리뷰 219×350 축척의 작은 필드 둘 — 관람일과 극장이 위아래로 붙어 44 상자가 겹친다(D13 그림). */
const watchDate: FieldBox = { field: 'watchDate', left: 40, top: 200, width: 30, height: 8 };
const theater: FieldBox = { field: 'theater', left: 40, top: 230, width: 30, height: 8 };
const title: FieldBox = { field: 'title', left: 10, top: 20, width: 200, height: 20 };

describe('pickFieldAt (#826 S3 hit 44)', () => {
  test('hit 크기는 44다', () => {
    expect(FIELD_HIT_PX).toBe(44);
  });

  test('글자 상자 밖이지만 중심 44 안이면 그 필드가 열린다', () => {
    // 관람일 중심 (55, 204) — 위로 18px 떨어진 점은 글자 상자(높이 8) 밖이지만 44/2=22 안이다.
    expect(pickFieldAt(55, 186, [watchDate])).toBe('watchDate');
    // 오른쪽으로 21px(폭 30 → 반폭 22) 안.
    expect(pickFieldAt(76, 204, [watchDate])).toBe('watchDate');
  });

  test('두 44 상자가 겹치는 자리에서는 중심이 가까운 필드가 열린다', () => {
    // 관람일 중심 y=204, 극장 중심 y=234 — y=221은 관람일에서 17, 극장에서 13.
    expect(pickFieldAt(55, 221, [watchDate, theater])).toBe('theater');
    // y=217은 관람일에서 13, 극장에서 17.
    expect(pickFieldAt(55, 217, [watchDate, theater])).toBe('watchDate');
  });

  test('어느 44에도 들지 않으면 null이다', () => {
    expect(pickFieldAt(55, 300, [watchDate, theater])).toBeNull();
    expect(pickFieldAt(150, 204, [watchDate, theater])).toBeNull();
  });

  test('44보다 큰 축은 글자 상자 그대로 쓴다 — 넓은 제목의 가장자리 근처도 제목이다', () => {
    // 제목 중심 x=110. 왼쪽 끝 x=12는 중심에서 98px 떨어졌지만 글자 상자 폭 200 안이다.
    expect(pickFieldAt(12, 30, [title])).toBe('title');
    // 세로는 높이 20 < 44라 44로 넓힌다 — 중심 y=30에서 21px 아래는 받는다.
    expect(pickFieldAt(12, 51, [title])).toBe('title');
    expect(pickFieldAt(12, 53, [title])).toBeNull();
  });

  test('한 축이라도 0인 상자(레이아웃 전 · 글자 없는 노드)는 누를 수 없다', () => {
    expect(pickFieldAt(0, 0, [{ field: 'seat', left: 0, top: 0, width: 0, height: 0 }])).toBeNull();
    expect(pickFieldAt(10, 10, [{ field: 'seat', left: 10, top: 0, width: 0, height: 20 }])).toBeNull();
  });
});
