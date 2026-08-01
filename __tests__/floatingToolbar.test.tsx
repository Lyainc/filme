/**
 * #356 — 플로팅 툴바 회귀 (MobileEditorShell 배선 통합).
 *
 * - undo/redo 배선: 초기 disabled → 편집 settle 후 '실행 취소'가 폼을 되돌린다.
 * - 항목목록 버튼이 #360의 임시 헤더 버튼을 대체 — 헤더가 아니라 툴바에서 드로어를 연다.
 * - 숨김 → 원형 '툴바 표시' 버튼으로 접힘 → 재표시.
 * - 배치설정(#387에서 헤더 편집 메뉴로 이전) → 라디오 프리셋 탭이 방향을 바꾸고
 *   filme:toolbar:v1로 영속, 재마운트 시 복원(새로고침 복원 완료 조건).
 */
import { describe, expect, test, afterEach, beforeEach, jest } from 'bun:test';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { FloatingToolbar, type TbPrefs } from '@/components/v2/FloatingToolbar';
import { PhoneFrame, PHONE_FRAME_ID } from '@/components/v2/PhoneFrame';
import type { PhototicketState } from '@/types';
import { MIN_AA, targetPx } from './tapTargets';

const TB_KEY = 'filme:toolbar:v1';

let captured: PhototicketState;

function Harness() {
  const photo = usePhototicket();
  captured = photo.state;
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed-poster
      </button>
      <button type="button" onClick={() => photo.updateMovieInfo({ theater: 'CGV 용산' })}>
        seed-edit
      </button>
      <MobileEditorShell
        photo={photo}
        canExport
        theme="light"
        onThemeChange={() => {}}
        onDone={() => {}}
        disabledReason=""
        previewMovieInfo={photo.state.movieInfo}
        previewComponents={photo.state.components}
        fieldVisibility={photo.state.fieldVisibility}
      />
    </>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  jest.useFakeTimers();
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

const userSetup = () => userEvent.setup({ delay: null });
// fake timer 전진은 동기라 실시간 대기 없이 디바운스를 발화시킨다.
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

async function seedPoster(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('seed-poster'));
  // 히스토리 베이스라인은 마운트 후 첫 디바운스(350ms)가 잡는다 — 그 윈도 안의 변경(포스터
  // 업로드의 fieldVisibility 리셋 포함)은 베이스라인에 뭉친다. 이후 편집이 1스텝으로 잡히도록
  // settle을 기다린다.
  await advance(400);
  return screen.getByRole('toolbar', { name: '편집 도구' });
}

describe('플로팅 툴바 (#356)', () => {
  test('undo/redo 배선: 초기 disabled → 편집 후 실행 취소가 폼을 되돌린다', async () => {
    const user = userSetup();
    render(<Harness />);
    await seedPoster(user);

    const undo = screen.getByRole('button', { name: '실행 취소' }) as HTMLButtonElement;
    const redo = screen.getByRole('button', { name: '다시 실행' }) as HTMLButtonElement;
    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(true);

    await user.click(screen.getByText('seed-edit'));
    expect(captured.movieInfo.theater).toBe('CGV 용산');
    await advance(360); // 350ms 디바운스 settle
    expect(undo.disabled).toBe(false);

    await user.click(undo);
    expect(captured.movieInfo.theater).toBe('');
    expect(redo.disabled).toBe(false);

    await user.click(redo);
    expect(captured.movieInfo.theater).toBe('CGV 용산');
  });

  test('항목목록 버튼이 헤더 대신 툴바에서 드로어를 연다(#360 임시 진입점 대체)', async () => {
    const user = userSetup();
    render(<Harness />);
    const toolbar = await seedPoster(user);

    // '티켓 항목 목록' 접근명은 이제 툴바 안에만 있다(헤더 버튼 제거).
    const listButtons = screen.getAllByRole('button', { name: '티켓 항목 목록' });
    expect(listButtons.length).toBe(1);
    expect(toolbar.contains(listButtons[0])).toBe(true);

    await user.click(listButtons[0]);
    // FieldDrawer(#355) 배선 재사용 — 우측 드로어(dialog)가 열린다. dynamic 로드라 findBy.
    expect(await screen.findByRole('dialog', { name: '티켓 항목' })).toBeTruthy();
  });

  test('숨김 → 원형 표시 버튼으로 접히고, 다시 펼 수 있다', async () => {
    const user = userSetup();
    render(<Harness />);
    await seedPoster(user);

    await user.click(screen.getByRole('button', { name: '툴바 숨기기' }));
    expect(screen.queryByRole('toolbar', { name: '편집 도구' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '툴바 표시' }));
    expect(screen.getByRole('toolbar', { name: '편집 도구' })).toBeTruthy();
  });

  test('영속된 이동식 좌표가 뷰포트 밖이면 마운트 시 재클램프된다(#190)', async () => {
    // 저장 당시보다 좁은 뷰포트로 다시 연 상황 — resize 없이 마운트만으로 화면 안으로 들어와야 한다.
    window.localStorage.setItem(
      TB_KEY,
      JSON.stringify({ orient: 'v', place: 'movable', x: 5000, y: 5000, hidden: false })
    );
    const user = userSetup();
    render(<Harness />);
    const toolbar = await seedPoster(user);

    const m = toolbar.style.transform.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/);
    expect(m).toBeTruthy();
    expect(parseFloat(m![1])).toBeLessThanOrEqual(window.innerWidth - 8); // EDGE=8
    expect(parseFloat(m![2])).toBeLessThanOrEqual(window.innerHeight - 8);
  });

  test('배치 라디오(#387→#574, 헤더 편집 메뉴 → 고급 설정 모달로 이전)가 방향을 바꾸고 별도 키로 영속, 재마운트에 복원된다', async () => {
    const user = userSetup();
    const { unmount } = render(<Harness />);
    const toolbar = await seedPoster(user);
    expect(toolbar.getAttribute('aria-orientation')).toBe('vertical'); // 기본 세로·고정

    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(screen.getByRole('button', { name: '고급 설정' }));
    expect(screen.getByRole('radiogroup', { name: '툴바 배치' })).toBeTruthy();

    await user.click(screen.getByRole('radio', { name: '가로형 · 고정식' }));
    expect(toolbar.getAttribute('aria-orientation')).toBe('horizontal');

    // 자동 영속(300ms 디바운스) — 문서 키(filme:phototicket:v1)가 아닌 별도 키.
    await advance(310);
    const raw = window.localStorage.getItem(TB_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).orient).toBe('h');
    expect(window.localStorage.getItem('filme:phototicket:v1')).toBeNull();

    // 재마운트(새로고침 상당) — 저장된 방향으로 복원.
    unmount();
    const user2 = userSetup();
    render(<Harness />);
    const toolbar2 = await seedPoster(user2);
    expect(toolbar2.getAttribute('aria-orientation')).toBe('horizontal');
  });

  test('포스터 업로드 전엔 고급 설정 진입점 자체가 헤더 메뉴에 없다(claude-review PR #405 P1 — 마운트 전 스냅 no-op 방지, #574로 승계)', async () => {
    const user = userSetup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    // 모달 진입점을 막는 게 게이팅의 전부다 — 열려도 스냅이 조용히 no-op일 자리를 애초에 안 만든다.
    expect(screen.queryByRole('button', { name: '고급 설정' })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: '툴바 배치' })).toBeNull();
  });

  test('숨김 상태에서도 배치 스냅이 동작한다(claude-review PR #405 P1 — hidden 분기 ref 누락 회귀 방지)', async () => {
    const user = userSetup();
    render(<Harness />);
    await seedPoster(user);

    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(screen.getByRole('button', { name: '고급 설정' }));
    await user.click(screen.getByRole('radio', { name: '세로형 · 이동식' }));
    // 툴바 숨기기는 모달 뒤에 깔린 툴바가 아니라 모달을 닫고 눌러야 한다(#574 — 모달이 풀페이지).
    await user.click(screen.getByRole('button', { name: '닫기' }));
    await user.click(screen.getByRole('button', { name: '툴바 숨기기' }));
    expect(screen.queryByRole('toolbar', { name: '편집 도구' })).toBeNull();

    // 숨김 상태에서 다시 모달을 열어 스냅한다 — 툴바가 hidden 분기로 렌더돼도 ref가 살아있어야 한다.
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(screen.getByRole('button', { name: '고급 설정' }));
    await user.click(screen.getByRole('button', { name: '왼쪽 가장자리로 이동' }));

    // hidden 분기에 ref가 안 붙어 있었다면 toolbarRef.current가 null이라 스냅이 no-op되고
    // x가 이전 값(null) 그대로 남는다 — TB_EDGE(8)로 갱신됐으면 hidden 상태에서도 살아있다는 뜻.
    await advance(310);
    const raw = JSON.parse(window.localStorage.getItem(TB_KEY)!);
    expect(raw.x).toBe(8);
  });

  test('숨김 원형 버튼도 드래그로 위치를 옮길 수 있다 — 임계거리 넘으면 탭이 억제되고 고정식은 이동식으로 승격한다 (#568)', async () => {
    const user = userSetup();
    render(<Harness />);
    await seedPoster(user);

    // 기본값은 place:'fixed' — 숨겨도 위치 조정 수단이 없던 게 이슈였다.
    await user.click(screen.getByRole('button', { name: '툴바 숨기기' }));
    const hiddenBtn = screen.getByRole('button', { name: '툴바 표시' });

    fireEvent.pointerDown(hiddenBtn, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(hiddenBtn, { clientX: 140, clientY: 100, pointerId: 1 }); // dx=40 > 6px 임계
    fireEvent.pointerUp(hiddenBtn, { clientX: 140, clientY: 100, pointerId: 1 });
    // 실 브라우저는 pointerup 뒤 click을 마저 쏜다 — 드래그였으면 이 click이 표시 토글을 하면 안 된다.
    fireEvent.click(hiddenBtn);

    // 억제됐다면 여전히 숨김(원형 버튼)이고, 억제가 안 됐다면 펼쳐진 툴바가 나타난다.
    expect(screen.queryByRole('toolbar', { name: '편집 도구' })).toBeNull();
    expect(screen.getByRole('button', { name: '툴바 표시' })).toBeTruthy();

    await advance(310);
    const raw = JSON.parse(window.localStorage.getItem(TB_KEY)!);
    expect(raw.place).toBe('movable'); // 드래그가 고정식을 이동식으로 승격시켰다.
    expect(raw.x).toBeGreaterThan(0); // 오른쪽으로 40px 옮긴 만큼 반영됐다(클램프 전제로 정확값은 안 본다).
  });

  test('숨김 원형 버튼의 순수 탭(이동 없음)은 그대로 표시 토글로 처리된다 (#568)', async () => {
    const user = userSetup();
    render(<Harness />);
    await seedPoster(user);

    await user.click(screen.getByRole('button', { name: '툴바 숨기기' }));
    const hiddenBtn = screen.getByRole('button', { name: '툴바 표시' });

    fireEvent.pointerDown(hiddenBtn, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(hiddenBtn, { clientX: 100, clientY: 100, pointerId: 1 }); // 이동 없음
    fireEvent.click(hiddenBtn);

    expect(screen.getByRole('toolbar', { name: '편집 도구' })).toBeTruthy();
  });
});

// 이동식 좌표계 회귀 (#607) — 프레임(contain:paint)이 fixed의 컨테이닝 블록이라 translate가
// 프레임 원점에서 풀린다. 클램프·스냅이 window.innerWidth를 읽으면 1440 뷰포트에서 400px 프레임
// 밖(예 x=1388)이 허용되고 그 좌표가 localStorage에 영속돼 다시 열어도 안 돌아온다.
// happy-dom엔 실 레이아웃이 없어 프레임 rect만 데스크톱 실측값(left 520 · 400×900)으로 스텁한다.
describe('이동식 툴바 좌표계는 뷰포트가 아니라 폰 프레임 기준 (#607)', () => {
  const nativeRect = Element.prototype.getBoundingClientRect;
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.id !== PHONE_FRAME_ID) return nativeRect.call(this);
      return { x: 520, y: 0, left: 520, top: 0, right: 920, bottom: 900, width: 400, height: 900, toJSON: () => ({}) } as DOMRect;
    };
  });
  afterEach(() => {
    Element.prototype.getBoundingClientRect = nativeRect;
  });

  // 툴바 자신의 rect/offsetWidth는 happy-dom에서 0이라 상한은 frame.width - 0 - TB_EDGE = 392.
  const MAX_X = 400 - 8;

  test('영속된 뷰포트 좌표가 마운트 재클램프로 프레임 안에 들어오고, 우측 스냅도 프레임 우단에 붙는다', async () => {
    // 데스크톱 뷰포트 기준으로 저장돼 있던 구 좌표(프레임 밖).
    window.localStorage.setItem(
      TB_KEY,
      JSON.stringify({ orient: 'v', place: 'movable', x: 1388, y: 400, hidden: false })
    );
    const user = userSetup();
    render(
      <PhoneFrame>
        <Harness />
      </PhoneFrame>
    );
    const toolbar = await seedPoster(user);

    const x = () => parseFloat(toolbar.style.transform.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/)![1]);
    expect(x()).toBe(MAX_X); // 뷰포트로 클램프했다면 1388이 그대로 통과한다

    // 드래그 없는 대체 경로(WCAG 2.2 SC 2.5.7)도 같은 좌표계여야 한다. 스냅 버튼은 #574에서
    // 메뉴 직속이 아니라 '고급 설정' 모달 안으로 이사했다.
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(screen.getByRole('button', { name: '고급 설정' }));
    await user.click(screen.getByRole('button', { name: '오른쪽 가장자리로 이동' }));
    await advance(310);
    expect(JSON.parse(window.localStorage.getItem(TB_KEY)!).x).toBe(MAX_X);
    // 모달이 풀페이지라 스냅 순간 툴바가 안 보인다(claude-review PR #630 P1) — 이동 사실을
    // 알리는 토스트가 실제로 떴는지 검증.
    expect(screen.getAllByText('오른쪽 가장자리로 옮겼어요').length).toBeGreaterThan(0);
  });
});

// 탭 타깃 크기 회귀 (#508) — 풋프린트 축소가 WCAG 2.2 SC 2.5.8(AA, 24×24) 아래로 못 내려가게 못박는다.
// 판정기(클래스 파싱 + variant·scale 우회 금지)는 #500·#553이 같은 형태로 재사용하도록
// __tests__/tapTargets.ts로 뺐다 — 하한과 우회 금지 규칙이 파일마다 갈리면 안 된다.
// 실제 렌더 px는 브라우저 실측으로 확인했다(#508: 세로·고정 239.6→179.6px, 이동식 283.6→211.6px).
describe('탭 타깃 최소 크기 (#508, WCAG 2.2 SC 2.5.8 AA)', () => {
  const noop = () => {};

  function renderTb(prefs: Partial<TbPrefs>) {
    render(
      <FloatingToolbar
        prefs={{ orient: 'v', place: 'fixed', x: null, y: null, hidden: false, ...prefs }}
        onPrefsChange={noop}
        canUndo={false}
        canRedo={false}
        onUndo={noop}
        onRedo={noop}
        onFieldList={noop}
        onMaximize={noop}
      />
    );
  }

  test('세로·이동식: 버튼 5개 + 드래그 그립이 모두 24px 이상이다', () => {
    renderTb({ place: 'movable', x: 20, y: 20 });
    const toolbar = screen.getByRole('toolbar', { name: '편집 도구' });

    const buttons = Array.from(toolbar.querySelectorAll('button'));
    expect(buttons.length).toBe(5); // undo·redo·항목목록·최대화·숨김 — 셀렉터가 조용히 비면 통과하지 않게
    for (const b of buttons) {
      const { w, h } = targetPx(b, b.getAttribute('aria-label') ?? 'button');
      expect(w).toBeGreaterThanOrEqual(MIN_AA);
      expect(h).toBeGreaterThanOrEqual(MIN_AA);
    }

    // 그립은 v8 시안 12px이 SC 2.5.8 미달로 기각된 자리 — 버튼과 같은 하한을 받는다.
    const grip = toolbar.querySelector('[class*="cursor-grab"]');
    expect(grip).toBeTruthy();
    const g = targetPx(grip!, 'grip');
    expect(g.w).toBeGreaterThanOrEqual(MIN_AA);
    expect(g.h).toBeGreaterThanOrEqual(MIN_AA);
  });

  test('숨김 상태의 원형 표시 버튼도 24px 이상이다', () => {
    renderTb({ hidden: true });
    const { w, h } = targetPx(screen.getByRole('button', { name: '툴바 표시' }), '툴바 표시');
    expect(w).toBeGreaterThanOrEqual(MIN_AA);
    expect(h).toBeGreaterThanOrEqual(MIN_AA);
  });

  test('축소해도 a11y 속성(role·aria-label·aria-orientation·버튼 라벨)은 그대로다', () => {
    renderTb({ orient: 'h' });
    const toolbar = screen.getByRole('toolbar', { name: '편집 도구' });
    expect(toolbar.getAttribute('aria-orientation')).toBe('horizontal');
    expect(Array.from(toolbar.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'))).toEqual([
      '실행 취소',
      '다시 실행',
      '티켓 항목 목록',
      '최대화',
      '툴바 숨기기',
    ]);

    cleanup();
    renderTb({ orient: 'v' });
    expect(screen.getByRole('toolbar', { name: '편집 도구' }).getAttribute('aria-orientation')).toBe('vertical');
  });
});

// 고정식 위치 실측/클램프(#419, ResizeObserver 보강 0e0e8a3) 회귀 — 이슈 #432.
// happy-dom의 getBoundingClientRect는 항상 {0,0,0,0}이라 Element.prototype을 스텁으로
// 오버라이드해 헤더/티켓 콘텐츠 위치를 모킹한다. FloatingToolbar.tsx의 measure()는 마운트
// 이펙트 안에서 동기 실행되므로(ResizeObserver.observe 호출 전) ResizeObserver 콜백이 실제로
// 발화하는지와 무관하게 초기 clamp 값을 검증할 수 있다.
describe('고정식 위치 실측 클램프 (#419, 이슈 #432)', () => {
  const nativeGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  let rects: WeakMap<Element, DOMRect>;

  beforeEach(() => {
    rects = new WeakMap();
    Element.prototype.getBoundingClientRect = function (this: Element) {
      return rects.get(this) ?? nativeGetBoundingClientRect.call(this);
    };
  });
  afterEach(() => {
    Element.prototype.getBoundingClientRect = nativeGetBoundingClientRect;
  });

  function stubRect(el: Element, partial: Partial<DOMRect>) {
    rects.set(el, {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
      ...partial,
    } as DOMRect);
  }

  const noop = () => {};
  const basePrefs: TbPrefs = { orient: 'v', place: 'fixed', x: null, y: null, hidden: false };

  function renderToolbar(orient: TbPrefs['orient'], headerEl: HTMLElement, contentTopEl: HTMLElement) {
    render(
      <FloatingToolbar
        prefs={{ ...basePrefs, orient }}
        onPrefsChange={noop}
        canUndo={false}
        canRedo={false}
        onUndo={noop}
        onRedo={noop}
        onFieldList={noop}
        onMaximize={noop}
        headerEl={headerEl}
        contentTopEl={contentTopEl}
      />
    );
    return screen.getByRole('toolbar', { name: '편집 도구' });
  }

  test('세로·고정: 헤더 아래로 TB_HEADER_MARGIN(12px)만큼 띄워 clamp된다', () => {
    const header = document.createElement('div');
    const content = document.createElement('div');
    stubRect(header, { bottom: 100 });
    stubRect(content, { top: 800 });

    const toolbar = renderToolbar('v', header, content);
    expect(toolbar.style.top).toBe('112px'); // 100 + TB_HEADER_MARGIN(12)
  });

  test('가로·고정: 여유 공간이 있으면 헤더 마진이 아니라 콘텐츠 바로 위에 붙는다', () => {
    const header = document.createElement('div');
    const content = document.createElement('div');
    stubRect(header, { bottom: 100 });
    stubRect(content, { top: 800 });

    const toolbar = renderToolbar('h', header, content);
    // happy-dom엔 실 레이아웃이 없어 toolbarH(offsetHeight)는 0 — contentTop(800) - 0 - TB_CONTENT_MARGIN(10)
    expect(toolbar.style.top).toBe('790px');
  });

  test('가로·고정: 콘텐츠가 헤더 코앞이어도 헤더를 절대 침범하지 않는다', () => {
    const header = document.createElement('div');
    const content = document.createElement('div');
    stubRect(header, { bottom: 100 });
    stubRect(content, { top: 105 }); // 콘텐츠에 그대로 붙으면 95px로 헤더(100~112) 침범

    const toolbar = renderToolbar('h', header, content);
    // Math.max(100+12, 105-0-10=95) → 112. 헤더 마진 clamp가 이긴다.
    expect(toolbar.style.top).toBe('112px');
  });
});
