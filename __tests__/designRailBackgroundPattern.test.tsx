/**
 * #530 PR 1 — 디자인 레일 '패턴' 항목(배경 기하 패턴) 상호작용 테스트.
 *
 * 레일 피커와 Editorial 렌더를 **같은 photo 상태**에 물려, 칩을 눌렀을 때 티켓의 패턴 레이어에
 * 실제로 반영되는지를 끝까지 본다(designRailQuoteFont.test.tsx와 같은 모양). appliesTo 무드
 * 필터·기본값·무드 왕복 값 보존을 검증한다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';
import { MoodEditorial } from '@/components/moods/MoodEditorial';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.updateComponents({ layout: 'editorial' })}>
        editorial로 전환
      </button>
      <button type="button" onClick={() => photo.updateComponents({ layout: 'minimal' })}>
        minimal로 전환
      </button>
      <div data-testid="background-pattern">{photo.state.components.backgroundPattern ?? '(미설정)'}</div>
      <DesignRail photo={photo} />
      <MoodEditorial
        movieInfo={photo.state.movieInfo}
        components={photo.state.components}
        croppedImageUrl="blob:x"
      />
    </>
  );
}

/** aria-hidden 패턴 레이어 — 'none'이면 아예 안 그려진다. */
function patternLayer(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-bg-pattern="true"]');
}

async function openPatternPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'editorial로 전환' }));
  await user.click(screen.getByRole('button', { name: '패턴' }));
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('레일 패턴 — 배경 기하 패턴 3택 (#530)', () => {
  test('패턴 항목은 editorial에서 레일에 뜨고, minimal에서는 안 뜬다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 초기 무드는 minimal — appliesTo(['editorial','criterion','stub'])에서 탈락.
    expect(screen.queryByRole('button', { name: '패턴' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'editorial로 전환' }));
    expect(screen.getByRole('button', { name: '패턴' })).not.toBeNull();
  });

  test('기본값은 none이고 패턴 레이어가 렌더되지 않는다', () => {
    const { container } = render(<Harness />);
    expect(screen.getByTestId('background-pattern').textContent).toBe('none');
    expect(patternLayer(container)).toBeNull();
  });

  test('3택 각각이 상태에 반영되고 패턴 레이어가 렌더된다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await openPatternPanel(user);

    await user.click(screen.getByRole('radio', { name: '도트' }));
    expect(screen.getByTestId('background-pattern').textContent).toBe('dots');
    expect(patternLayer(container)!.style.backgroundImage).toContain('radial-gradient');

    await user.click(screen.getByRole('radio', { name: '사선' }));
    expect(screen.getByTestId('background-pattern').textContent).toBe('diagonal');
    expect(patternLayer(container)!.style.backgroundImage).toContain('repeating-linear-gradient');

    await user.click(screen.getByRole('radio', { name: '그리드' }));
    expect(screen.getByTestId('background-pattern').textContent).toBe('grid');
    // 그리드는 두 겹(가로+세로) repeating-linear-gradient.
    expect(patternLayer(container)!.style.backgroundImage.split('repeating-linear-gradient').length - 1).toBe(2);

    // 되돌리면 레이어 자체가 사라진다.
    await user.click(screen.getByRole('radio', { name: '없음' }));
    expect(screen.getByTestId('background-pattern').textContent).toBe('none');
    expect(patternLayer(container)).toBeNull();
  });

  test('무드를 왕복해도 고른 패턴이 보존된다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await openPatternPanel(user);

    await user.click(screen.getByRole('radio', { name: '사선' }));
    // 다른 무드로 나가면 패턴 항목 자체가 사라진다(#523 자동 닫힘).
    await user.click(screen.getByRole('button', { name: 'minimal로 전환' }));
    expect(screen.queryByRole('button', { name: '패턴' })).toBeNull();
    expect(screen.getByTestId('background-pattern').textContent).toBe('diagonal');

    await user.click(screen.getByRole('button', { name: 'editorial로 전환' }));
    await user.click(screen.getByRole('button', { name: '패턴' }));
    expect((screen.getByRole('radio', { name: '사선' }) as HTMLButtonElement).getAttribute('aria-checked')).toBe('true');
    expect(patternLayer(container)!.style.backgroundImage).toContain('repeating-linear-gradient');
  });
});
