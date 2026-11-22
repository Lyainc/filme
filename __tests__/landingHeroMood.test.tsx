/**
 * #635·#615 회귀 테스트.
 *
 *  - rate limit(shared 윈도우 소진)이 "인식된 정보가 없어요"와 다른 안내로 갈리고, 그 뒤에도
 *    이탈 경로(포스터 업로드 · 직접 입력)가 막히지 않는다(#635 c2 · ac2).
 *  - 랜딩 히어로 auto-scroll 갤러리(#615, 2026-08-04 개정)의 샘플 클릭은 훑어보기가 아니라
 *    그 자리에서 셸의 진짜 components.layout을 커밋한다 — 그래야 크롭 프리셋이 방금 고른
 *    무드와 어긋나지 않는다(#529). 예전 무드칩(LayoutStrip)의 "훑어보고 다른 CTA가 나중에
 *    커밋" 미러 단계는 이 개정으로 폐기됐다(heroLayout/commitHeroLayout 삭제).
 */
import { useState } from 'react';
import { describe, expect, test, beforeEach, afterAll, afterEach, mock, jest } from 'bun:test';
import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PhototicketState } from '@/types';
import { mobileShellProps } from './shellHarness';

// runOcr must be mocked BEFORE MobileEditorShell (transitively imports it via OcrUploadCard) is
// loaded — bun's mock.module is not hoisted (같은 패턴, ocrUndoRestore.test.tsx 참고).
let ocrImpl: (file: File) => Promise<Record<string, unknown>> = async () => ({});
// 스프레드 스냅샷 + afterAll 복원(#611·#618) — docs/TESTING.md §5.
const realOcr = { ...require('@/utils/ocr') };
mock.module('@/utils/ocr', () => ({
  ...realOcr,
  runOcr: (file: File) => ocrImpl(file),
}));

const { MobileEditorShell } =
  require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');
const { usePhototicket, STORAGE_KEY } =
  require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');

let captured: PhototicketState;

function Harness() {
  const photo = usePhototicket();
  captured = photo.state;
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

const landing = () => screen.getByTestId('landing');
/** 지금 가운데 선 카드의 무드 이름 — 가운데 슬롯(data-slot 0)만 하나다. */
const centeredIn = (gallery: HTMLElement) =>
  gallery.querySelector('button[data-slot="0"]')!.getAttribute('aria-label')!.split(' 무드로')[0];
const ocrFileInput = () =>
  document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;

afterEach(() => {
  cleanup();
  ocrImpl = async () => ({});
  localStorage.clear();
});

afterAll(() => {
  mock.module('@/utils/ocr', () => realOcr);
});

describe('OCR rate limit 이탈 경로 (#635 c2)', () => {
  test('shared 윈도우 소진 시 "인식 실패"와 다른 안내가 뜨고, 이탈 경로는 그대로 남는다', async () => {
    ocrImpl = async () => ({ rateLimited: true });
    render(<Harness />);

    fireEvent.change(ocrFileInput(), {
      target: { files: [new File(['x'], 'ticket.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(
        screen.getAllByText('지금 요청이 많아요. 잠시 후 다시 시도하거나 직접 입력해 주세요.').length
      ).toBeGreaterThan(0);
    });

    // 필드가 하나도 안 채워졌으니 랜딩은 계속 오버레이 — 이탈 경로가 여전히 화면에 있어야 한다.
    expect(landing().classList.contains('fixed')).toBe(true);
    expect(screen.getByRole('button', { name: '포스터 업로드' })).toBeDefined();
    expect(screen.getByTestId('landing-skip-poster')).toBeDefined();
    expect(captured.movieInfo.theater).toBe('');
  });
});

describe('히어로 갤러리 샘플 클릭이 무드를 즉시 커밋한다 (#615, 2026-08-04 개정)', () => {
  const stubSample = () =>
    within(landing()).getByRole('button', { name: '스텁 무드로 바로 시작' });

  test('클릭 즉시 photo.state.components.layout이 그 무드로 바뀐다', () => {
    render(<Harness />);
    expect(captured.components.layout).toBe('minimal');

    fireEvent.click(stubSample());

    expect(captured.components.layout).toBe('stub');
  });

  test('클릭이 랜딩 오버레이를 걷는다 — 훑어보기용 중간 상태 없이 바로 편집 화면 진입', () => {
    render(<Harness />);
    expect(landing().classList.contains('fixed')).toBe(true);

    fireEvent.click(stubSample());

    expect(landing().classList.contains('fixed')).toBe(false);
  });
});

// #615는 "재방문자의 복원된 무드가 진입만으로 기본값으로 되돌아가지 않는다"를 잠갔는데, #727이
// 진입의 의미 자체를 갈랐다 — 랜딩의 네 경로는 이제 **새 문서 시작**이고(c7), 복원된 문서를
// 이어받는 길은 "이어서 만들기" 하나다(c5). 그래서 명제가 진입 경로별로 둘로 쪼개진다.
// #615가 막으려던 사고(재방문자가 고른 무드가 소리 없이 minimal로 돌아감)는 아래 첫 케이스가
// 그대로 진다 — 복원 경로에서 무드가 유지되는지가 그 계약의 현재 얼굴이다.
describe('복원된 draft의 무드는 이어받을 때만 유지된다 (#615 → #727)', () => {
  afterEach(() => {
    localStorage.clear();
  });

  const seedStubDraft = async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ movieInfo: { title: '인터스텔라' }, components: { layout: 'stub' } })
    );
    await act(async () => {
      render(<Harness />);
    });
    await waitFor(() => expect(captured.components.layout).toBe('stub'));
  };

  test('"이어서 만들기"로 이어받으면 복원된 무드가 그대로다', async () => {
    await seedStubDraft();

    fireEvent.click(screen.getByTestId('landing-restore'));

    expect(captured.components.layout).toBe('stub');
  });

  test('"직접 입력"은 새 문서라 기본 무드로 시작한다', async () => {
    await seedStubDraft();

    fireEvent.click(screen.getByTestId('landing-skip-poster'));

    // 저장분은 그대로 살아 있다(c7) — 오탭이면 새로고침 한 번으로 stub draft가 돌아온다.
    expect(captured.components.layout).toBe('minimal');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).components.layout).toBe('stub');
  });
});

/**
 * 갤러리 탭은 draft를 만들지 않는다 — #615는 **같은** 무드 재탭만 막았지만(동일값 가드), #727이
 * 그 비대칭을 없앴다: 무드는 이제 `updateComponents`가 아니라 `resetDocument`의 layout 인자로
 * 실려 dirtyTick을 아예 안 올린다(c7). 근거는 오탭 복구다 — 갤러리는 화면 가운데를 덮는 자동
 * 회전 캐러셀이라 오탭 확률이 낮지 않은데, 탭 한 번이 1초 뒤 autosave로 이어지면 석 달 전 draft가
 * 그 자리에서 덮인다. 저장분이 덮이는 시점은 새 문서의 **첫 자동저장**, 즉 사용자가 실제로 편집한
 * 뒤여야 한다. #615가 막으려던 사고(오탭이 draft를 만들어 랜딩이 영영 안 뜸)는 이제 두 겹으로
 * 막힌다 — 애초에 draft를 안 쓰고, 써도 랜딩은 draft와 무관하게 뜬다(c1).
 */
describe('갤러리 무드 탭은 draft를 만들지 않는다 (#615 → #727)', () => {
  const sampleFor = (name: string) =>
    within(landing()).getByRole('button', { name: new RegExp(`^${name} 무드로 바로 시작`) });

  afterEach(() => {
    jest.useRealTimers();
    localStorage.clear();
  });

  test('이미 켜져 있는 무드 카드를 눌러도 autosave가 draft를 안 쓴다', () => {
    jest.useFakeTimers();
    render(<Harness />);
    expect(captured.components.layout).toBe('minimal');

    fireEvent.click(sampleFor('미니멀'));

    // 디바운스(1s) + 여유. 무드가 dirtyTick을 올리면 여기서 draft가 쓰인다.
    act(() => jest.advanceTimersByTime(2000));

    expect(localStorage.getItem(STORAGE_KEY)).toBe(null);
    // 진입 자체는 정상적으로 일어나야 한다 — 미룬 건 저장이지 화면 전환이 아니다.
    expect(landing().classList.contains('fixed')).toBe(false);
  });

  test('다른 무드 카드도 draft를 안 쓴다 — 화면은 그 무드로 시작하되 저장은 첫 편집까지 미룬다', () => {
    jest.useFakeTimers();
    render(<Harness />);

    fireEvent.click(sampleFor('스텁'));
    act(() => jest.advanceTimersByTime(2000));

    // 고른 무드는 화면에 즉시 선다 — 미룬 건 저장이지 선택이 아니다.
    expect(captured.components.layout).toBe('stub');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(null);
  });
});

// 드롭존 진입의 크롭 프리셋 레이스(PR #636 2차 P0)는 드롭 업로드째 걷혀 사라졌다(#826 S5 D18-2) — 드롭이
// 아무 일도 안 한다는 부재 단언은 posterCropPipeline.test.tsx가 진다.

/**
 * 캐러셀 손짓 3종(#615 → #826 S5) — 탭/길게 누름/스와이프를 시간과 거리로 가른다. 여기서 잠그는 건 **손짓이
 * 서로를 오염시키지 않는다**는 것: 넘기려던 손짓과 멈춰 보려던 손짓이 편집 화면 진입으로 떨어지면 사용자는
 * 되돌리기 위해 초기화까지 가야 한다.
 */
describe('캐러셀 손짓 — 탭만 진입시킨다 (#615)', () => {
  const gallery = () => within(landing()).getByTestId('mood-gallery');
  const minimalCard = () =>
    within(gallery()).getByRole('button', { name: '미니멀 무드로 바로 시작' });

  test('그냥 탭하면 그 무드로 진입한다', () => {
    render(<Harness />);
    const card = minimalCard();

    fireEvent.pointerDown(card, { clientX: 100 });
    fireEvent.pointerUp(card, { clientX: 100 });
    fireEvent.click(card);

    expect(landing().classList.contains('fixed')).toBe(false);
  });

  const centered = () => centeredIn(gallery());

  test('왼쪽으로 끌면 다음 무드가 중앙으로 오고, 손을 떼도 진입하지 않는다', () => {
    render(<Harness />);
    const card = minimalCard();
    expect(centered()).toBe('미니멀');

    fireEvent.pointerDown(gallery(), { clientX: 200 });
    fireEvent.pointerMove(gallery(), { clientX: 140 }); // 임계값(28px) 초과
    fireEvent.pointerUp(gallery(), { clientX: 140 });
    fireEvent.click(card, { detail: 1 }); // 실제 포인터 클릭(브라우저는 detail>=1) — 키보드는 0.

    // 끈 방향(왼쪽)으로 한 칸 — GALLERY_LAYOUTS 순서상 미니멀 다음은 크라이테리언이다.
    expect(centered()).toBe('크라이테리언');
    // 그리고 랜딩은 그대로 떠 있어야 한다 — 넘기려던 손짓이 진입으로 새면 안 된다.
    expect(landing().classList.contains('fixed')).toBe(true);
    expect(captured.components.layout).toBe('minimal');
  });

  test('오른쪽으로 끌면 반대 방향으로 넘어간다', () => {
    render(<Harness />);
    expect(centered()).toBe('미니멀');

    fireEvent.pointerDown(gallery(), { clientX: 140 });
    fireEvent.pointerMove(gallery(), { clientX: 200 });

    // 목록의 처음에서 뒤로 가면 마지막으로 감긴다(원형).
    expect(centered()).toBe('스텁');
  });

  test('길게 누르고 떼면 진입하지 않는다 — 천천히 보려던 손짓이다', () => {
    jest.useFakeTimers();
    try {
      render(<Harness />);
      const card = minimalCard();

      fireEvent.pointerDown(gallery(), { clientX: 100 });
      act(() => jest.advanceTimersByTime(500)); // LONG_PRESS_MS(350) 초과
      fireEvent.pointerUp(gallery(), { clientX: 100 });
      fireEvent.click(card, { detail: 1 }); // 실제 포인터 클릭(브라우저는 detail>=1) — 키보드는 0.

      expect(landing().classList.contains('fixed')).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  test('스와이프 후 pointerdown 없이 키보드 Enter로 다른 카드에 진입해도 stale swiped를 안 읽는다 (claude-review PR #653 7차 P1)', () => {
    render(<Harness />);
    const card = minimalCard();

    // 스와이프로 gesture.current.swiped = true를 남긴다 — 다음 pointerdown 전까지 안 풀린다.
    fireEvent.pointerDown(gallery(), { clientX: 200 });
    fireEvent.pointerMove(gallery(), { clientX: 140 });
    fireEvent.pointerUp(gallery(), { clientX: 140 });

    // 이후 새 pointerdown 없이 키보드로 카드를 활성화 — 브라우저는 이 click을 detail: 0으로 낸다.
    fireEvent.click(card, { detail: 0 });

    expect(landing().classList.contains('fixed')).toBe(false);
  });

  test('pointerdown이 오면 컨테이너가 그 포인터를 캡처한다 — 밖에서 떼도 pointerup을 받기 위함', () => {
    render(<Harness />);
    const el = gallery() as HTMLElement & { hasPointerCapture: (id: number) => boolean };

    fireEvent.pointerDown(gallery(), { clientX: 100, pointerId: 7 });

    expect(el.hasPointerCapture(7)).toBe(true);
  });

  test('pointerup에서 캡처를 다시 놓는다 — 안 놓으면 브라우저가 뒤이은 click의 타깃을 컨테이너로 재지정해 카드 클릭이 죽는다', () => {
    render(<Harness />);
    const el = gallery() as HTMLElement & { hasPointerCapture: (id: number) => boolean };

    fireEvent.pointerDown(gallery(), { clientX: 100, pointerId: 7 });
    fireEvent.pointerUp(gallery(), { clientX: 100, pointerId: 7 });

    expect(el.hasPointerCapture(7)).toBe(false);
  });

  test('pointercancel에서도 캡처를 놓는다', () => {
    render(<Harness />);
    const el = gallery() as HTMLElement & { hasPointerCapture: (id: number) => boolean };

    fireEvent.pointerDown(gallery(), { clientX: 100, pointerId: 7 });
    fireEvent.pointerCancel(gallery(), { pointerId: 7 });

    expect(el.hasPointerCapture(7)).toBe(false);
  });

  test('세로 페이지 스크롤은 캐러셀이 가로채지 않는다 (touch-action: pan-y)', () => {
    render(<Harness />);
    expect((gallery() as HTMLElement).style.touchAction).toBe('pan-y');
  });
});

/**
 * 무대 기둥 전시 구조(#826 S5 constraint-3 · acceptance-3) — 실제 px 비(0.62 · 0.52 · 0.34 · 0.22)는 measure-chrome.mjs
 * `landing` 축이 400×675에서 잰다. 여기선 접근성 구조와 선언값을 잠근다.
 */
describe('무대 기둥 전시 (#826 S5 L-01)', () => {
  const gallery = () => within(landing()).getByTestId('mood-gallery');
  const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

  test('전시가 carousel · "무드 전시"이고 기둥 · 위치 표시는 aria-hidden, 위치 표시가 1 / 5에서 한 칸 넘기면 2 / 5', () => {
    jest.useFakeTimers();
    try {
      render(<Harness />);
      expect(gallery().getAttribute('aria-roledescription')).toBe('carousel');
      expect(gallery().getAttribute('aria-label')).toBe('무드 전시');
      const beam = screen.getByTestId('mood-gallery-beam');
      expect(beam.getAttribute('aria-hidden')).toBe('true');
      expect(beam.className).toContain('w-[62%]');
      expect(beam.className).toContain('border-x');
      expect(beam.className).toContain('bg-s1');
      const index = screen.getByTestId('mood-gallery-index');
      expect(index.getAttribute('aria-hidden')).toBe('true');
      expect(index.className).toContain('tabular-nums');
      expect(index.className).toContain('text-caption');
      expect(index.textContent).toBe('1 / 5');
      advance(4000);
      expect(screen.getByTestId('mood-gallery-index').textContent).toBe('2 / 5');
    } finally {
      jest.useRealTimers();
    }
  });

  test('가운데 카드 52% · 그림자, 좌우 34% · 불투명도 0.32 · 그림자 없음 · 22% 밖, 먼 카드는 불투명도 0이되 보이는 요소로 남는다', () => {
    render(<Harness />);
    const bySlot = (d: number) => gallery().querySelector(`button[data-slot="${d}"]`) as HTMLElement;
    expect(bySlot(0).style.width).toBe('52%');
    expect(bySlot(0).style.boxShadow).toBe('var(--pr-ticket-shadow)');
    for (const d of [-1, 1]) {
      expect(bySlot(d).style.width).toBe('34%');
      expect(bySlot(d).style.opacity).toBe('0.32');
      expect(bySlot(d).style.boxShadow).toBe('none');
    }
    expect(bySlot(-1).style.left).toBe('-22%');
    expect(bySlot(1).style.left).toBe('88%'); // 100 − 34 + 22 — 오른쪽 가장자리가 22% 밖
    for (const d of [-2, 2]) {
      const far = bySlot(d);
      expect(far.style.opacity).toBe('0');
      expect(far.style.pointerEvents).toBe('none');
      expect(far.style.visibility === '' || far.style.visibility === 'visible').toBe(true);
      expect(far.style.display === '' || far.style.display !== 'none').toBe(true);
      expect(far.tabIndex >= 0).toBe(true);
    }
  });
});

/**
 * 자동 전시와 정지(#826 S5 constraint-4, 바뀐 요구 1 — 소유자 결정 2026-11-17). 정지 · 재개 버튼은 없다. 4초마다
 * 한 칸 넘기고, 누르고 있는 동안 · 키보드 포커스가 전시 안에 있는 동안 멈춘다. 마우스를 올리는 것만으로는 안
 * 멈춘다(D18-2).
 */
describe('자동 전시 — 버튼 없이 누름 · 포커스 동안 정지 (#826 S5)', () => {
  const gallery = () => within(landing()).getByTestId('mood-gallery');
  const centered = () => centeredIn(gallery());
  const card = (name: string) => within(gallery()).getByRole('button', { name: `${name} 무드로 바로 시작` });
  const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('3999ms엔 그대로, 4000ms에 한 칸 넘어가고 정지 · 재개 버튼이 없다', () => {
    render(<Harness />);
    expect(screen.queryByRole('button', { name: '자동 전시 정지' }) === null).toBe(true);
    expect(screen.queryByRole('button', { name: '자동 전시 재개' }) === null).toBe(true);
    advance(3999);
    expect(centered()).toBe('미니멀');
    advance(1);
    expect(centered()).toBe('크라이테리언');
  });

  test('누르고 있는 동안 8000ms 멈추고, 떼면 4000ms 뒤 넘어간다', () => {
    render(<Harness />);
    fireEvent.pointerDown(gallery(), { clientX: 100, pointerId: 1 });
    advance(8000);
    expect(centered()).toBe('미니멀');
    fireEvent.pointerUp(gallery(), { clientX: 100, pointerId: 1 });
    advance(3999);
    expect(centered()).toBe('미니멀');
    advance(1);
    expect(centered()).toBe('크라이테리언');
  });

  test('pointercancel도 누름 정지를 푼다', () => {
    render(<Harness />);
    fireEvent.pointerDown(gallery(), { clientX: 100, pointerId: 1 });
    advance(8000);
    fireEvent.pointerCancel(gallery(), { pointerId: 1 });
    advance(4000);
    expect(centered()).toBe('크라이테리언');
  });

  test('키보드로 들어온 포커스가 전시 안에 있는 동안 8000ms 멈추고, 밖으로 나가면 4000ms 뒤 넘어간다', () => {
    render(<Harness />);
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => card('미니멀').focus());
    advance(8000);
    expect(centered()).toBe('미니멀');
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => screen.getByTestId('landing-skip-poster').focus());
    advance(3999);
    expect(centered()).toBe('미니멀');
    advance(1);
    expect(centered()).toBe('크라이테리언');
  });

  test('포인터로 누른 뒤 남은 포커스로는 멈추지 않는다', () => {
    render(<Harness />);
    const c = card('미니멀');
    fireEvent.pointerDown(c, { clientX: 100, pointerId: 1 });
    act(() => c.focus());
    fireEvent.pointerUp(c, { clientX: 100, pointerId: 1 });
    advance(4000);
    expect(centered()).toBe('크라이테리언');
  });

  test('마우스 pointerenter만으로는 멈추지 않는다', () => {
    render(<Harness />);
    fireEvent.pointerEnter(gallery(), { pointerType: 'mouse' });
    fireEvent.pointerOver(card('미니멀'), { pointerType: 'mouse' });
    advance(4000);
    expect(centered()).toBe('크라이테리언');
  });

  test('길게(350ms 초과) 누른 뒤 떼면 무드로 들어가지 않고, 28px 스와이프마다 한 칸씩 넘어간다', () => {
    render(<Harness />);
    fireEvent.pointerDown(gallery(), { clientX: 100, pointerId: 1 });
    advance(400);
    fireEvent.pointerUp(gallery(), { clientX: 100, pointerId: 1 });
    fireEvent.click(card('미니멀'), { detail: 1 });
    expect(landing().classList.contains('fixed')).toBe(true);

    fireEvent.pointerDown(gallery(), { clientX: 200, pointerId: 2 });
    fireEvent.pointerMove(gallery(), { clientX: 173, pointerId: 2 }); // 27px — 아직
    expect(centered()).toBe('미니멀');
    fireEvent.pointerMove(gallery(), { clientX: 172, pointerId: 2 }); // 28px
    expect(centered()).toBe('크라이테리언');
    fireEvent.pointerMove(gallery(), { clientX: 144, pointerId: 2 }); // 다시 28px
    expect(centered()).toBe('35mm');
    fireEvent.pointerUp(gallery(), { clientX: 144, pointerId: 2 });
  });
});

/** 키보드 도달(#826 S5 constraint-5) — 5개 전부 tab 순서의 버튼이고, 포커스가 간 카드가 가운데로 온다. */
describe('키보드 도달 (#826 S5)', () => {
  const gallery = () => within(landing()).getByTestId('mood-gallery');
  const card = (name: string) => within(gallery()).getByRole('button', { name: `${name} 무드로 바로 시작` });

  test('카드 버튼 5개가 접근성 트리에 있고 tabIndex가 음수가 아니다', () => {
    render(<Harness />);
    const buttons = within(gallery()).getAllByRole('button');
    expect(buttons).toHaveLength(5);
    for (const b of buttons) expect(b.tabIndex >= 0).toBe(true);
  });

  test('Tab으로 차례로 닿고, 가운데가 아닌 카드에 포커스가 가면 그 카드가 가운데가 되며 Enter로 들어간다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const names = ['미니멀', '크라이테리언', '35mm', '에디토리얼', '스텁'];
    act(() => card('미니멀').focus());
    for (const name of names.slice(1)) {
      await user.tab();
      expect(document.activeElement === card(name)).toBe(true);
      expect(centeredIn(gallery())).toBe(name);
      expect(screen.getByTestId('mood-gallery-index').textContent).toBe(`${names.indexOf(name) + 1} / 5`);
    }
    await user.keyboard('{Enter}');
    expect(captured.components.layout).toBe('stub');
    expect(landing().classList.contains('fixed')).toBe(false);
  });

  test('먼 카드(두 칸)에 프로그램 포커스를 줘도 가운데로 오고, 키보드 활성화(detail 0)로 들어간다', () => {
    render(<Harness />);
    const far = card('35mm');
    expect(far.style.pointerEvents).toBe('none');
    act(() => far.focus());
    expect(centeredIn(gallery())).toBe('35mm');
    fireEvent.click(far, { detail: 0 });
    expect(captured.components.layout).toBe('35mm');
  });

  test('좌우 카드를 포인터로 탭하면 그 카드의 무드로 들어간다', () => {
    render(<Harness />);
    const right = gallery().querySelector('button[data-slot="1"]') as HTMLElement;
    const left = gallery().querySelector('button[data-slot="-1"]') as HTMLElement;
    expect(right.getAttribute('aria-label')).toBe('크라이테리언 무드로 바로 시작');
    expect(left.getAttribute('aria-label')).toBe('스텁 무드로 바로 시작');
    fireEvent.pointerDown(right, { clientX: 380, pointerId: 1 });
    fireEvent.pointerUp(right, { clientX: 380, pointerId: 1 });
    fireEvent.click(right, { detail: 1 });
    expect(captured.components.layout).toBe('criterion');
  });

  test('왼쪽 카드도 탭하면 그 무드로 들어간다', () => {
    render(<Harness />);
    const left = gallery().querySelector('button[data-slot="-1"]') as HTMLElement;
    fireEvent.pointerDown(left, { clientX: 20, pointerId: 1 });
    fireEvent.pointerUp(left, { clientX: 20, pointerId: 1 });
    fireEvent.click(left, { detail: 1 });
    expect(captured.components.layout).toBe('stub');
  });
});

/** 스크린샷 인식(#826 S5 constraint-11 L-03) — 셸 경로의 인식 중 · 성공 · 실패. 여덟 문구의 자리는 landingOcrNotice가 잰다. */
describe('랜딩 스크린샷 인식 (#826 S5 L-03)', () => {
  const ocrButton = () => screen.getByRole<HTMLButtonElement>('button', { name: '티켓 스크린샷으로 자동입력' });
  const png = () => new File(['x'], 'ticket.png', { type: 'image/png' });

  test('인식 중엔 주 CTA가 "티켓 인식 중…"(aria-busy) · disabled이고 링크 쌍이 막히며, 실패 뒤 돌아온다', async () => {
    let finish!: (v: Record<string, unknown>) => void;
    ocrImpl = () => new Promise((resolve) => { finish = resolve; });
    render(<Harness />);
    fireEvent.change(ocrFileInput(), { target: { files: [png()] } });

    await waitFor(() => expect(ocrButton().getAttribute('aria-busy')).toBe('true'));
    expect(ocrButton().textContent).toContain('티켓 인식 중…');
    expect(ocrButton().disabled).toBe(true);
    expect(ocrButton().querySelector('span[aria-hidden="true"] svg') !== null).toBe(true);
    // 인식 중엔 채움을 걷은 보조 모양(마스터 L-03 로딩).
    expect(ocrButton().className).toContain('bg-transparent');
    expect(ocrButton().className).not.toContain('bg-accent');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '포스터 업로드' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '포스터 없이 직접 입력' }).disabled).toBe(true);

    await act(async () => finish({ failed: true }));
    await waitFor(() => expect(ocrButton().getAttribute('aria-busy')).toBe('false'));
    expect(ocrButton().textContent).toContain('티켓 스크린샷으로 자동입력');
    expect(ocrButton().disabled).toBe(false);
    expect(ocrButton().className).toContain('bg-accent');
    expect(screen.getByTestId('landing-notice').textContent).toBe('인식에 실패했어요');
    expect(screen.queryByTestId('mood-gallery-index') === null).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '포스터 업로드' }).disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '포스터 없이 직접 입력' }).disabled).toBe(false);
    expect(landing().classList.contains('fixed')).toBe(true);
  });

  test('인식 성공이면 랜딩이 걷히고 자동입력 배너가 보이는 편집 화면이다(E-05)', async () => {
    ocrImpl = async () => ({ theater: 'CGV 용산아이파크몰', seat: 'H12' });
    render(<Harness />);
    fireEvent.change(ocrFileInput(), { target: { files: [png()] } });
    await waitFor(() => expect(landing().classList.contains('fixed')).toBe(false));
    expect(captured.movieInfo.theater).toBe('CGV 용산아이파크몰');
    expect(!!screen.queryByRole('button', { name: '되돌리기' })).toBe(true);
  });

  test('인식된 정보가 없으면 랜딩에 남아 그 자리에 안내가 뜨고, 빈 편집(E-02)은 "포스터 없이 직접 입력"으로 간다', async () => {
    ocrImpl = async () => ({});
    render(<Harness />);
    fireEvent.change(ocrFileInput(), { target: { files: [png()] } });
    await waitFor(() => expect(screen.getByTestId('landing-notice').textContent).toBe('인식된 정보가 없어요. 직접 입력해 주세요.'));
    expect(landing().classList.contains('fixed')).toBe(true);
    fireEvent.click(screen.getByTestId('landing-skip-poster'));
    expect(landing().classList.contains('fixed')).toBe(false);
    expect(captured.movieInfo.title).toBe('');
  });
});
