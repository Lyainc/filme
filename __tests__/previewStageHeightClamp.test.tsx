/**
 * #532 회귀 고정 — 세로 예산은 max-height가 아니라 '그 높이를 채우는 폭'으로 건다(사유는
 * TicketRenderer 스테이지 주석). 스테이지(TicketRenderer)와 데스크톱 셸 래퍼(카드 폭) 양쪽을 본다.
 *
 * happy-dom은 width의 top-level min()을 못 받아 ''로 떨구지만 max-width의 calc()/min()은 원문
 * 그대로 보존한다 — 그래서 두 클램프 다 max-width로 표현돼 있고, 그 덕에 검증도 된다.
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TicketRenderer, { PREVIEW_MAX_HEIGHT } from '@/components/TicketRenderer';
import { DesktopStudioShell } from '@/components/v2/DesktopStudioShell';
import { usePhototicket } from '@/hooks/usePhototicket';
import { LAYOUTS } from '@/utils/layouts';
import { FULL_MOVIE, makeMoodBase } from './fixtures';
import { desktopShellProps } from './shellHarness';

/** 세로 예산을 채우는 폭 — 두 클램프가 같은 식을 쓰는지 비교할 기준값. */
const budgetWidth = (w: number, h: number) => `calc(${PREVIEW_MAX_HEIGHT} * ${w} / ${h})`;

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed-poster
      </button>
      <DesktopStudioShell {...desktopShellProps(photo, { disabledReason: null })} />
    </>
  );
}

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

  test('데스크톱 셸 래퍼(카드)도 같은 예산으로 줄어든다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('seed-poster'));

    // 래퍼가 같이 안 줄면 카드(PreviewFilmCell)만 넓게 남아 티켓 좌우에 검은 띠가 생긴다.
    const { width, height } = LAYOUTS[0];
    const wrapper = screen.getByTestId('desktop-preview-stage');
    expect(wrapper.style.maxWidth).toBe(`min(100%, ${budgetWidth(width, height)})`);
  });
});
