/**
 * #679 방향 1 — 형압 패널 도구 칩이 진입/종료 CTA를 겸하는지 검증.
 *
 * 전폭 CTA 버튼("형압 칠하기 시작" 등)이 없어졌고, 브러시/올가미 칩 탭 자체가 embossEditMode를
 * 켠다. 편집 중인 도구 칩을 다시 탭하면 꺼진다. 값만 보면 배선이 끊겨도 통과하니 photo 상태를
 * 직접 노출해 끝까지 확인한다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <div data-testid="edit-mode">{String(photo.embossEditMode)}</div>
      <div data-testid="tool">{photo.embossTool}</div>
      <DesignRail photo={photo} />
    </>
  );
}

async function openEmbossPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '형압' }));
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('형압 패널 — 도구 칩이 진입/종료를 겸함 (#679)', () => {
  test('전폭 CTA 버튼이 없다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openEmbossPanel(user);

    expect(screen.queryByRole('button', { name: /형압 칠하기 시작|올가미로 선택 시작|탭해서 종료/ })).toBeNull();
  });

  test('브러시 칩을 탭하면 바로 편집 모드로 들어간다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openEmbossPanel(user);

    expect(screen.getByTestId('edit-mode').textContent).toBe('false');
    await user.click(screen.getByRole('radio', { name: '브러시' }));
    expect(screen.getByTestId('edit-mode').textContent).toBe('true');
    expect(screen.getByTestId('tool').textContent).toBe('brush');
  });

  test('편집 중인 도구 칩을 다시 탭하면 종료된다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openEmbossPanel(user);

    await user.click(screen.getByRole('radio', { name: '브러시' }));
    expect(screen.getByTestId('edit-mode').textContent).toBe('true');

    await user.click(screen.getByRole('radio', { name: '브러시' }));
    expect(screen.getByTestId('edit-mode').textContent).toBe('false');
  });

  test('편집 중 다른 도구 칩을 탭하면 도구만 바뀌고 편집은 계속된다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openEmbossPanel(user);

    await user.click(screen.getByRole('radio', { name: '브러시' }));
    await user.click(screen.getByRole('radio', { name: '올가미' }));

    expect(screen.getByTestId('edit-mode').textContent).toBe('true');
    expect(screen.getByTestId('tool').textContent).toBe('lasso');
  });

  test('편집 종료 후엔 어떤 칩도 선택된 것처럼 보이지 않는다(fresh-context 리뷰)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openEmbossPanel(user);

    const brush = () => screen.getByRole('radio', { name: '브러시' });
    const lasso = () => screen.getByRole('radio', { name: '올가미' });

    // 진입 전: 둘 다 미선택.
    expect(brush().getAttribute('aria-checked')).toBe('false');
    expect(lasso().getAttribute('aria-checked')).toBe('false');

    await user.click(brush());
    expect(brush().getAttribute('aria-checked')).toBe('true');

    // 같은 칩을 다시 탭해 종료 — embossTool은 'brush'로 남지만 편집 중이 아니므로
    // 브러시 칩도 다시 미선택으로 돌아가야 한다(마지막 도구가 선택된 것처럼 보이면 안 됨).
    await user.click(brush());
    expect(screen.getByTestId('edit-mode').textContent).toBe('false');
    expect(brush().getAttribute('aria-checked')).toBe('false');
    expect(lasso().getAttribute('aria-checked')).toBe('false');
  });

  test('편집 중이 아닐 땐 도구 무관하게 같은 안내 문구를 쓴다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openEmbossPanel(user);

    expect(screen.getByText('도구를 탭하면 바로 편집을 시작해요.')).not.toBeNull();

    // 올가미로 진입했다 나가도 문구가 브러시 전용 표현으로 안 갈린다.
    await user.click(screen.getByRole('radio', { name: '올가미' }));
    await user.click(screen.getByRole('radio', { name: '올가미' }));
    expect(screen.getByText('도구를 탭하면 바로 편집을 시작해요.')).not.toBeNull();
  });
});
