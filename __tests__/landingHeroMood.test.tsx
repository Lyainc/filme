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
import { describe, expect, test, afterAll, afterEach, mock, jest } from 'bun:test';
import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react';
import type { PhototicketState } from '@/types';
import { mobileShellProps } from './shellHarness';

// runOcr must be mocked BEFORE MobileEditorShell (transitively imports it via OcrUploadCard) is
// loaded — bun's mock.module is not hoisted (같은 패턴, ocrUndoRestore.test.tsx 참고).
let ocrImpl: (file: File) => Promise<Record<string, unknown>> = async () => ({});
// 스프레드 스냅샷 + afterAll 복원(#611·#618) — CLAUDE.md 테스트 규칙.
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
    within(landing()).getByRole('button', { name: /^Stub 무드로 바로 시작/ });

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

    fireEvent.click(sampleFor('Minimal'));

    // 디바운스(1s) + 여유. 무드가 dirtyTick을 올리면 여기서 draft가 쓰인다.
    act(() => jest.advanceTimersByTime(2000));

    expect(localStorage.getItem(STORAGE_KEY)).toBe(null);
    // 진입 자체는 정상적으로 일어나야 한다 — 미룬 건 저장이지 화면 전환이 아니다.
    expect(landing().classList.contains('fixed')).toBe(false);
  });

  test('다른 무드 카드도 draft를 안 쓴다 — 화면은 그 무드로 시작하되 저장은 첫 편집까지 미룬다', () => {
    jest.useFakeTimers();
    render(<Harness />);

    fireEvent.click(sampleFor('Stub'));
    act(() => jest.advanceTimersByTime(2000));

    // 고른 무드는 화면에 즉시 선다 — 미룬 건 저장이지 선택이 아니다.
    expect(captured.components.layout).toBe('stub');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(null);
  });
});

// 드롭존 onDrop이 commitHeroLayout()과 crop.openFile(file)을 같은 동기 핸들러에서 연달아 부른다
// (claude-review PR #636 2차 P0). ImageCropModal이 previewComponents.layout(pages/index.tsx의
// 280ms debounce)을 읽으면 방금 커밋한 무드가 아니라 그 debounce가 아직 안 따라잡은 직전 무드의
// 크롭 프리셋으로 열린다 — #529 invariant 위반. 실제 앱에선 debounce가 있지만 이 하네스의
// mobileShellProps는 previewComponents를 photo.state.components로 그대로 넘겨 항상 동기라
// 그 지연을 재현하지 못한다(2차 리뷰가 지적한 지점) — 그래서 여기서는 previewComponents를
// 마운트 시점 값에 고정해 "debounce가 영원히 안 따라잡은" 극단 케이스로 그 레이스를 강제한다.
describe('드롭존 진입이 debounce된 previewComponents가 아니라 실시간 무드로 크롭 프리셋을 연다 (claude-review PR #636 2차 P0)', () => {
  function DropRaceHarness({ onPhoto }: { onPhoto?: (p: ReturnType<typeof usePhototicket>) => void }) {
    const photo = usePhototicket();
    onPhoto?.(photo);
    // 마운트 시점('minimal', 세로 슬롯)에 고정 — 이후 photo.state.components.layout이 바뀌어도
    // 이 값은 안 따라간다. previewComponents가 debounce 중 멈춰 있는 순간을 그대로 흉내낸다.
    const [staleComponents] = useState(photo.state.components);
    return <MobileEditorShell {...mobileShellProps(photo, { previewComponents: staleComponents })} />;
  }

  test('가로 슬롯 무드 샘플을 고른 직후 드롭해도 크롭 모달이 가로 프리셋(1.5)으로 연다', async () => {
    let photo!: ReturnType<typeof usePhototicket>;
    render(<DropRaceHarness onPhoto={(p) => { photo = p; }} />);
    expect(photo.state.components.layout).toBe('minimal'); // 기본값 — 세로 슬롯

    fireEvent.click(within(landing()).getByRole('button', { name: /^Stub 무드로 바로 시작/ }));

    fireEvent.drop(landing(), {
      dataTransfer: { files: [new File(['x'], 'poster.png', { type: 'image/png' })] },
    });

    // 갤러리 클릭이 먼저 실제 state를 'stub'으로 바꿨는지 확인 — previewComponents(고정된
    // 'minimal')와 갈라진 게 이 테스트의 전제다.
    expect(photo.state.components.layout).toBe('stub');

    const dialog = await screen.findByRole('dialog', { name: '포스터 크롭' });
    // ImageCropModal이 photo.state.components.layout('stub', 가로)을 읽으면 1.5, previewComponents
    // ('minimal', 고정)를 읽으면 0.6666...(2/3) — 고침 전엔 후자가 나와 이 assertion이 깨진다.
    const aspect = Number(within(dialog).getByTestId('crop-frame').getAttribute('data-aspect'));
    expect(aspect).toBeCloseTo(1.5, 2);
  });
});

/**
 * 캐러셀 손짓 3종(#615, 2026-08-08) — 탭/길게 누름/스와이프를 시간과 거리로 가른다. 자동 전환은
 * 정지 대상이 아니라(시각 효과) 길게 누름이 늦출 뿐이고, 여기서 잠그는 건 **손짓이 서로를
 * 오염시키지 않는다**는 것: 넘기려던 손짓과 천천히 보려던 손짓이 편집 화면 진입으로 떨어지면
 * 사용자는 되돌리기 위해 초기화까지 가야 한다.
 */
describe('캐러셀 손짓 — 탭만 진입시킨다 (#615)', () => {
  const gallery = () => within(landing()).getByTestId('mood-gallery');
  const minimalCard = () =>
    within(gallery()).getByRole('button', { name: /^Minimal 무드로 바로 시작/ });

  test('그냥 탭하면 그 무드로 진입한다', () => {
    render(<Harness />);
    const card = minimalCard();

    fireEvent.pointerDown(card, { clientX: 100 });
    fireEvent.pointerUp(card, { clientX: 100 });
    fireEvent.click(card);

    expect(landing().classList.contains('fixed')).toBe(false);
  });

  /** 지금 가운데 선 카드 — 중앙 슬롯만 불투명도 1이다(CAROUSEL_SLOTS). */
  const centered = () =>
    (Array.from(gallery().querySelectorAll('button[data-touch]')) as HTMLElement[])
      .find((b) => b.style.opacity === '1')!
      .getAttribute('aria-label')!
      .split(' 무드로')[0];

  test('왼쪽으로 끌면 다음 무드가 중앙으로 오고, 손을 떼도 진입하지 않는다', () => {
    render(<Harness />);
    const card = minimalCard();
    expect(centered()).toBe('Minimal');

    fireEvent.pointerDown(gallery(), { clientX: 200 });
    fireEvent.pointerMove(gallery(), { clientX: 140 }); // 임계값(28px) 초과
    fireEvent.pointerUp(gallery(), { clientX: 140 });
    fireEvent.click(card, { detail: 1 }); // 실제 포인터 클릭(브라우저는 detail>=1) — 키보드는 0.

    // 끈 방향(왼쪽)으로 한 칸 — GALLERY_LAYOUTS 순서상 Minimal 다음은 Criterion이다.
    expect(centered()).toBe('Criterion');
    // 그리고 랜딩은 그대로 떠 있어야 한다 — 넘기려던 손짓이 진입으로 새면 안 된다.
    expect(landing().classList.contains('fixed')).toBe(true);
    expect(captured.components.layout).toBe('minimal');
  });

  test('오른쪽으로 끌면 반대 방향으로 넘어간다', () => {
    render(<Harness />);
    expect(centered()).toBe('Minimal');

    fireEvent.pointerDown(gallery(), { clientX: 140 });
    fireEvent.pointerMove(gallery(), { clientX: 200 });

    // 목록의 처음에서 뒤로 가면 마지막으로 감긴다(원형).
    expect(centered()).toBe('Stub');
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
