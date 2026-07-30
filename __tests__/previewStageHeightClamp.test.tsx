/**
 * #532 회귀 고정 — 세로 예산은 max-height가 아니라 '그 높이를 채우는 폭'으로 건다(사유는
 * TicketRenderer 스테이지 주석).
 *
 * happy-dom은 width의 top-level min()을 못 받아 ''로 떨구지만 max-width의 calc()/min()은 원문
 * 그대로 보존한다 — 그래서 클램프가 max-width로 표현돼 있고, 그 덕에 검증도 된다.
 *
 * 짝이던 '데스크톱 셸 래퍼(카드)도 같은 예산으로 줄어든다'는 #607에서 셸과 함께 삭제했고 모바일로
 * 이관하지 않았다 — 모바일 기본 뷰의 프리뷰 래퍼는 세로 예산이 아니라 스테이지에 맞추는
 * fit 폭(#366, cq 기준)이라 검증할 등가 명제가 없다. 스테이지 자체의 예산 클램프는 아래
 * 무드별 테스트가 그대로 덮는다.
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { render, cleanup } from '@testing-library/react';
import TicketRenderer, { PREVIEW_MAX_HEIGHT } from '@/components/TicketRenderer';
import { LAYOUTS } from '@/utils/layouts';
import { FULL_MOVIE, makeMoodBase } from './fixtures';

/** 세로 예산을 채우는 폭 — 두 클램프가 같은 식을 쓰는지 비교할 기준값. */
const budgetWidth = (w: number, h: number) => `calc(${PREVIEW_MAX_HEIGHT} * ${w} / ${h})`;

afterEach(cleanup);

describe('프리뷰 스테이지 세로 클램프 (#532)', () => {
  test.each([...LAYOUTS])('$id — 스테이지가 세로 예산을 폭으로 클램프한다', ({ id, width, height }) => {
    const { container } = render(
      <TicketRenderer croppedImageUrl="blob:test-poster" movieInfo={FULL_MOVIE} components={makeMoodBase(id)} />
    );
    const stage = container.firstElementChild as HTMLElement;

    // 클램프는 폭에만 — max-height가 돌아오면 폭은 그대로인 채 높이만 깎여 하단이 잘린다.
    expect(stage.style.maxHeight).toBe('');
    expect(stage.style.aspectRatio).toBe(`${width} / ${height}`);
    expect(stage.style.maxWidth).toBe(budgetWidth(width, height));
  });
});
