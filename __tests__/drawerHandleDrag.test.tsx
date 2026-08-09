/**
 * 필드 드로어 엣지 핸들 축 분리 드래그 회귀 (#567·#579, 동반 설계).
 *
 * - 수평 드래그(왼쪽으로 당기기)는 드로어를 연다(#567).
 * - 수직 드래그는 핸들 y좌표를 옮긴다(#579) — 드로어는 열리지 않는다.
 * - 순수 탭(이동 없음)은 기존대로 드로어를 연다(비드래그 대체 경로, WCAG 2.2 SC 2.5.7).
 * - 영속된 y가 프레임 밖이면 마운트 시 재클램프된다(FloatingToolbar #190과 같은 패턴).
 */
import { describe, expect, test, afterEach, jest } from 'bun:test';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { mobileShellProps } from './shellHarness';

const DRAWER_KEY = 'filme:drawer:v1';

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

afterEach(cleanup);

const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

async function seedPoster(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('seed-poster'));
  return screen.getByRole('button', { name: '티켓 항목 목록 열기' });
}

describe('필드 드로어 엣지 핸들 (#567·#579)', () => {
  test('순수 탭은 그대로 드로어를 연다(비드래그 대체 경로)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const handle = await seedPoster(user);

    await user.click(handle);
    expect(await screen.findByRole('dialog', { name: '티켓 항목' })).toBeTruthy();
  });

  test('수평 드래그(왼쪽으로 당기기)로 드로어가 열린다(#567)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const handle = await seedPoster(user);

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, clientY: 300 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 370, clientY: 300 }); // dx=-30, dy=0
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 370, clientY: 300 });

    expect(await screen.findByRole('dialog', { name: '티켓 항목' })).toBeTruthy();
  });

  test('오른쪽(무의미한 방향) 수평 드래그는 그 자체로 열지 않지만, axis를 안 잠가 뒤이은 탭은 살아있다', async () => {
    // 실브라우저 CDP 트러스티드 클릭 재현(#567/#579 구현 중 발견) — 오른쪽 흔들림에 axis를
    // 'h'로 잠그면 이후 click까지 드래그로 오판돼 순수 탭 하나가 조용히 무시된다.
    const user = userEvent.setup();
    render(<Harness />);
    const handle = await seedPoster(user);

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, clientY: 300 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 430, clientY: 300 }); // dx=+30, 무의미한 방향
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 430, clientY: 300 });
    expect(screen.queryByRole('dialog', { name: '티켓 항목' })).toBeNull();

    // 실브라우저는 pointerup 뒤 같은 타깃에 click을 이어 보낸다 — 흔들림으로 axis가 안
    // 잠겼으면 이 click이 정상적인 탭으로 열려야 한다.
    fireEvent.click(handle);
    expect(await screen.findByRole('dialog', { name: '티켓 항목' })).toBeTruthy();
  });

  test('수직 드래그는 핸들을 이동시키고 드로어는 열지 않는다(#579)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const handle = await seedPoster(user);
    const before = handle.style.top;

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, clientY: 300 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 400, clientY: 340 }); // dy=+40, dx=0
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 400, clientY: 340 });
    // 실제 브라우저는 pointerup 뒤에도 같은 타깃에 click을 이어 보낸다 — 드래그로 판정됐으면
    // 이 click이 드로어를 열면 안 된다(탭=열기/드래그=이동 구분이 핵심 요구사항).
    fireEvent.click(handle);

    expect(screen.queryByRole('dialog', { name: '티켓 항목' })).toBeNull();
    expect(handle.style.top).not.toBe(before);
    expect(handle.style.top).not.toBe('50%');
  });

  test('수직 드래그로 옮긴 y가 300ms 뒤 filme:drawer:v1로 영속된다', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    render(<Harness />);
    const handle = await seedPoster(user);

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, clientY: 300 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 400, clientY: 340 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 400, clientY: 340 });

    advance(310);
    const raw = window.localStorage.getItem(DRAWER_KEY);
    expect(raw).toBeTruthy();
    expect(typeof JSON.parse(raw!).y).toBe('number');
    jest.useRealTimers();
  });

  test('고급 설정 모달의 상/하 스냅이 비드래그 대체 경로로 핸들을 옮긴다(WCAG 2.2 SC 2.5.7)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const handle = await seedPoster(user);
    const before = handle.style.top;

    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(screen.getByRole('button', { name: '고급 설정' }));
    await user.click(screen.getByRole('button', { name: '위쪽 가장자리로 이동' }));

    expect(handle.style.top).not.toBe(before);
    expect(await screen.findAllByText('위쪽 가장자리로 옮겼어요')).not.toHaveLength(0);
  });

  test('영속된 y가 프레임 밖이면 마운트 시 재클램프된다', async () => {
    window.localStorage.setItem(DRAWER_KEY, JSON.stringify({ y: 999999 }));
    const user = userEvent.setup();
    render(<Harness />);
    const handle = await seedPoster(user);

    const top = parseFloat(handle.style.top);
    expect(Number.isFinite(top)).toBe(true);
    expect(top).toBeLessThanOrEqual(window.innerHeight - 8); // TB_EDGE=8
  });
});

// 눌림 scale 합성 회귀 (#662) — 위치 고정용 인라인 transform은 어떤 CSS 특이성보다도 이겨
// class 기반 active:scale을 무효화한다. pointer down/up을 state로 추적해 같은 인라인
// transform 문자열에 scale(0.97)을 이어붙이는지, 뗄 때 원복되는지를 검증한다.
describe('필드 드로어 핸들 눌림 scale 합성 (#662)', () => {
  test('인라인 transform이 없는 상태(핸들 미이동)에서도 눌림 중엔 scale(0.97)이 걸리고 뗄 때 원복된다', async () => {
    window.localStorage.removeItem(DRAWER_KEY); // 앞선 테스트가 남긴 영속 y로 drawerHandleY가 초기부터 non-null이 되는 걸 방지
    const user = userEvent.setup();
    render(<Harness />);
    const handle = await seedPoster(user);
    expect(handle.style.transform).toBe('');

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, clientY: 300 });
    expect(handle.style.transform).toBe('translateY(-50%) scale(0.97)');

    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 400, clientY: 300 });
    expect(handle.style.transform).toBe('');
  });

  test('인라인 transform이 있는 상태(핸들을 한 번 옮긴 뒤)에서도 scale(0.97)이 걸리고 뗄 때 원복된다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const handle = await seedPoster(user);

    // 수직 드래그로 한 번 옮겨 인라인 top + transform:'none'을 건다(#579).
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, clientY: 300 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 400, clientY: 340 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 400, clientY: 340 });
    expect(handle.style.transform).toBe('none');

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, clientY: 340 });
    expect(handle.style.transform).toBe('scale(0.97)');

    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 400, clientY: 340 });
    expect(handle.style.transform).toBe('none');
  });

  test('transform에 transition을 거는 클래스를 다시 붙이지 않는다(핸들 점프 회귀, PR #664 리뷰 P1)', async () => {
    // floatingToolbar.test.tsx의 같은 잠금과 대칭 — 이유는 이쪽이 더 좁다. 핸들은
    // drawerHandleY가 null→값으로 처음 바뀌는 axis-lock 순간 top이 즉시 절대값으로 점프하는데
    // (top엔 transition이 없다) transform만 transition을 타면 둘이 같은 프레임에 안 맞아 핸들이
    // 48px(h-24 절반) 위로 튄다(PR #663 리뷰 P1). active:scale을 다시 손댈 때 transition-transform이
    // 딸려 들어오지 않았는지 잠근다.
    const user = userEvent.setup();
    render(<Harness />);
    const handle = await seedPoster(user);
    const cls = handle.getAttribute('class') ?? '';
    expect(cls).toMatch(/active:scale-\[0\.97\]/);
    expect(cls).not.toMatch(/transition-transform|transition-\[[^\]]*transform[^\]]*\]|transition-all/);
  });
});
