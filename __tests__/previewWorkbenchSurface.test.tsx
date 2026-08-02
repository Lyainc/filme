/**
 * #571 회귀 테스트 — 편집 프리뷰 작업대 표면(작업면 + 그림자 + 재단 마크).
 *
 * 잡으려는 회귀는 하나다: **재단 마크가 max 모드까지 따라 들어가는 것.** max는 헤더·툴바까지
 * 걷어내고 티켓만 남기는 모드라(#328) 프레임 바깥 마크가 남으면 그 정의가 깨지고, 마크가
 * 티켓 바깥 12px에 그려지므로 fixed 오버레이 안에서 화면 가장자리로 삐져나온다.
 * 시각값(색·알파) 자체는 스냅샷할 게 못 되고 scripts/measure-chrome.mjs가 프레임 봉쇄를 재므로,
 * 여기선 "어느 모드에 붙는가"만 잠근다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { mobileShellProps } from './shellHarness';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed-poster
      </button>
      <MobileEditorShell {...mobileShellProps(photo)} />
    </>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(cleanup);

describe('편집 프리뷰 작업대 표면 (#571)', () => {
  test('기본 모드: 프리뷰 래퍼에 재단 마크가 붙고, 작업면이 스테이지에 깔린다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByText('seed-poster'));

    const wrap = container.querySelector('div.relative.mx-auto.block.rounded-card');
    expect(wrap).toBeTruthy();
    expect(wrap!.classList.contains('crop-marks')).toBe(true);

    // 작업면은 fit 스테이지(래퍼의 부모)가 든다 — 배경에서 한 칸 갈린 면이라야 그 위 그림자가 산다.
    expect((wrap!.parentElement as HTMLElement).style.background).toBe('var(--workbench)');
  });

  test('max 모드: 재단 마크가 따라 들어가지 않는다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('seed-poster'));
    await user.click(screen.getByRole('button', { name: '최대화' }));

    const wrap = screen.getByRole('button', { name: '기본 크기로 돌아가기' });
    expect(wrap.classList.contains('crop-marks')).toBe(false);
  });
});
