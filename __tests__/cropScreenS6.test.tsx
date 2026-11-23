/**
 * #826 S6 — 크롭 화면(전체 화면 · 다크 고정) 상호작용 잠금. Seed docs/specs/826-s6-crop-menu.yaml의
 * acceptance-3 · 4 · 6 · 7 · 8 · 14 · 15를 여기서 잡는다(describe 이름에 번호가 있다).
 *
 * ImageCropModal · 크롭 훅 · 진입점(셸 · 도크 사진 모드 · 필드 입력 패널)은 **실물**이다. canvas에 의존하는
 * getCroppedImg만 mock한다(다른 크롭 테스트와 같은 사유) — 스프레드 스냅샷 + afterAll 복원(#611).
 *
 * 토스트 부재(showError 미호출)는 spy가 아니라 **실 errorToast를 <ErrorToastHost/>로 마운트해 DOM으로** 잰다.
 * 전역 setup이 이미 실 모듈을 올려 둬서 mock.module이 앞선 파일이 잡은 바인딩에 닿는다는 보장이 없고, 호스트가
 * 그리는 role=alert는 어느 모듈 사본에서 불렀든 보이기 때문이다. 감지 능력은 첫 describe의 양성 대조가 확인한다.
 *
 * happy-dom은 레이아웃이 없다 — 크롭 프레임의 크기가 아니라 역할 · 이름 · 속성 · 호출 인자를 본다. 모서리를 끄는
 * 포인터 드래그는 재현하지 않고, 완전 자유 비율은 ReactCrop 루트의 고정 비율 클래스 유무와 data-aspect로 본다.
 */
import { describe, expect, test, afterAll, afterEach, beforeEach, mock, spyOn } from 'bun:test';
import type { ComponentProps } from 'react';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { POSTER_RATIO, TARGET_HEIGHT } from '@/utils/constants';
import type { Area } from '@/utils/imageCrop';
import { mobileShellProps } from './shellHarness';
import { DockHarness, dockProbe, resetDockProbe } from './dockHarness';

// holdCrop: 다음 크롭을 붙잡아 '적용 중' 창을 관측 가능하게 한다. failCrop: getCroppedImg를 던지게 한다.
let cropMode: 'ok' | 'fail' | 'hold' = 'ok';
let cropN = 0;
let cropCalls: unknown[][] = [];
let releaseCrop: (() => void) | null = null;
const realImageCrop = { ...require('@/utils/imageCrop') };
mock.module('@/utils/imageCrop', () => ({
  ...realImageCrop,
  getCroppedImg: (...args: unknown[]) => {
    cropCalls.push(args);
    return new Promise<string>((resolve, reject) => {
      if (cropMode === 'fail') {
        reject(new Error('canvas unavailable (mock)'));
        return;
      }
      const url = `blob:cropped-${++cropN}`;
      if (cropMode === 'hold') releaseCrop = () => resolve(url);
      else resolve(url);
    });
  },
}));

const ImageCropModal = (require('@/components/ImageCropModal') as { default: typeof import('@/components/ImageCropModal').default }).default;
const { usePhototicket } = require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');
const { MobileEditorShell } = require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');
const { ErrorToastHost, showError } = require('@/utils/errorToast') as typeof import('@/utils/errorToast');

const noop = () => {};
const pngFile = (name: string) => new File([name], name, { type: 'image/png' });
const textFile = () => new File(['x'], 'memo.txt', { type: 'text/plain' });

const dialogEl = () => screen.getByRole('dialog', { name: /자르기$/ });
const inDialog = () => within(dialogEl());
const cropSrc = () => dialogEl().querySelector('img')?.getAttribute('src') ?? null;
const frame = () => screen.getByTestId('crop-frame');
const hiddenPicker = () => inDialog().getByLabelText('다른 사진 파일') as HTMLInputElement;
const pickAnother = (file: File) => fireEvent.change(hiddenPicker(), { target: { files: [file] } });
/** 크롭 화면 밖에 뜬 알림(= 토스트)의 수. 크롭 화면 안 경고는 세지 않는다. */
const toastCount = () => {
  const d = screen.queryByRole('dialog', { name: /자르기$/ });
  return screen.queryAllByRole('alert').filter((a) => !d || !d.contains(a)).length;
};

/** 실물 모달의 onImageLoad(크롭 초기화)를 태운다 — 안 하면 '적용'이 비활성. */
function loadImage(naturalWidth = 2000, naturalHeight = 3000) {
  const img = dialogEl().querySelector('img') as HTMLImageElement;
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: naturalHeight, configurable: true });
  Object.defineProperty(img, 'width', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'height', { value: naturalHeight, configurable: true });
  fireEvent.load(img);
}

function Modal(props: Partial<ComponentProps<typeof ImageCropModal>> = {}) {
  return (
    <>
      <ImageCropModal imageSrc="blob:x" target="poster" accept="image/*" onClose={noop} onComplete={noop} onPickFile={noop} {...props} />
      <ErrorToastHost />
    </>
  );
}

type Photo = ReturnType<typeof usePhototicket>;
function Shell({ onPhoto }: { onPhoto?: (p: Photo) => void }) {
  const photo = usePhototicket();
  onPhoto?.(photo);
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}
function DockWithToast() {
  return (
    <>
      <DockHarness mode="photo" />
      <ErrorToastHost />
    </>
  );
}

const posterInput = () => document.querySelector('input[type="file"][aria-label="포스터 이미지 파일"]') as HTMLInputElement;
const posterRow = () => within(document.querySelector('[data-asset-row="포스터"]') as HTMLElement);
const recropButton = () => posterRow().getByRole('button', { name: '자르기' }) as HTMLButtonElement;
const openPhotoMode = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('tab', { name: '사진' }));
const setDock = (fn: (p: NonNullable<typeof dockProbe.photo>) => void) =>
  act(async () => {
    fn(dockProbe.photo!);
  });

async function openPoster(name: string) {
  fireEvent.change(posterInput(), { target: { files: [pngFile(name)] } });
  await screen.findByRole('dialog', { name: '포스터 자르기' });
  loadImage();
}
async function pickAndApply(user: ReturnType<typeof userEvent.setup>, name: string) {
  await openPoster(name);
  await user.click(inDialog().getByRole('button', { name: '적용' }));
}

// 숨은 파일 입력의 click() 호출을 가로챈다 — 어느 입력이 눌렸는지(this)만 기록하고 실제 선택창은 안 연다.
let clicked: HTMLInputElement[] = [];
const clickDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'click');
beforeEach(() => {
  resetDockProbe();
  clicked = [];
  document.documentElement.setAttribute('data-theme', 'light');
  HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
    clicked.push(this);
  };
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  if (clickDesc) Object.defineProperty(HTMLInputElement.prototype, 'click', clickDesc);
  else delete (HTMLInputElement.prototype as { click?: unknown }).click;
  cropMode = 'ok';
  cropN = 0;
  cropCalls = [];
  releaseCrop = null;
  mock.restore(); // spyOn만 되돌린다 — 모듈 mock은 afterAll이 푼다.
});
afterAll(() => {
  mock.module('@/utils/imageCrop', () => realImageCrop);
});

describe('토스트 감지 양성 대조 (acceptance-7의 전제)', () => {
  test('호스트를 마운트한 채 showError를 부르면 크롭 화면 밖 알림으로 잡힌다', () => {
    render(<Modal />);
    expect(toastCount()).toBe(0);
    act(() => showError('대조용'));
    expect(toastCount()).toBe(1);
  });
});

describe('acceptance-3 — 원본 비율 보존은 스위치다', () => {
  test('포스터 크롭에 role=switch가 정확히 하나, 이름은 원본 비율 보존, 기본 꺼짐, checkbox는 없다', () => {
    render(<Modal layout="minimal" />);
    const switches = inDialog().getAllByRole('switch');
    expect(switches).toHaveLength(1);
    expect(switches[0].textContent).toContain('원본 비율 보존');
    expect(inDialog().getByRole('switch', { name: '원본 비율 보존' })).toBeTruthy();
    expect(switches[0].getAttribute('aria-checked')).toBe('false');
    expect(inDialog().queryAllByRole('checkbox')).toHaveLength(0);
  });

  test('클릭하면 켜지고 data-aspect가 포스터 표준에서 이미지 자연비로 바뀐다', () => {
    render(<Modal layout="minimal" />);
    loadImage(2000, 2865);
    expect(Number(frame().getAttribute('data-aspect'))).toBe(POSTER_RATIO);
    fireEvent.click(inDialog().getByRole('switch'));
    expect(inDialog().getByRole('switch').getAttribute('aria-checked')).toBe('true');
    expect(Number(frame().getAttribute('data-aspect'))).toBeCloseTo(2000 / 2865, 5);
  });

  test('Space와 Enter로도 바뀐다', async () => {
    const user = userEvent.setup();
    render(<Modal layout="minimal" />);
    const sw = inDialog().getByRole('switch');
    sw.focus();
    await user.keyboard(' ');
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await user.keyboard('{Enter}');
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  test('layout이 없으면(로고 · 서명 · 스탬프) 스위치가 없다', () => {
    render(<Modal target="logo" />);
    expect(inDialog().queryAllByRole('switch')).toHaveLength(0);
    expect(inDialog().queryAllByRole('checkbox')).toHaveLength(0);
  });

  test('처리 중에는 스위치가 비활성이다', () => {
    render(<Modal layout="minimal" isProcessing />);
    expect((inDialog().getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('acceptance-4 — 진입점마다 제목 · 접근 이름 · 화면 모양이 같다', () => {
  /** 접근 이름 = 보이는 <h2> 제목, 루트는 다크 고정 · 전체 화면이고 카드 · 블러 · 폭 상한이 없다. */
  function expectScreen(title: string) {
    const d = screen.getByRole('dialog', { name: title });
    const heading = within(d).getByRole('heading', { name: title, level: 2 });
    expect(heading.textContent).toBe(title);
    expect(d.classList.contains('chrome-dark')).toBe(true);
    expect(d.classList.contains('fixed') && d.classList.contains('inset-0')).toBe(true);
    expect(/(^|\s)(rounded[\w-]*|backdrop-blur[\w-]*|max-w-[\w[\]-]+)(\s|$)/.test(d.className)).toBe(false);
    // 앱 테마가 라이트여도 다크 스코프는 이 루트 자신이 쥔다.
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  }

  test.each([
    ['poster', '포스터 자르기'],
    ['logo', '로고 자르기'],
    ['signature', '서명 자르기'],
    ['stamp', '스탬프 자르기'],
  ] as const)('ImageCropModal target=%s → %s (직접 렌더)', (target, title) => {
    render(<Modal target={target} />);
    expectScreen(title);
  });

  test('포스터: 셸의 포스터 파일 입력 → 포스터 자르기', async () => {
    render(<Shell />);
    fireEvent.change(posterInput(), { target: { files: [pngFile('p.png')] } });
    await screen.findByRole('dialog', { name: '포스터 자르기' });
    expectScreen('포스터 자르기');
  });

  test('도크 사진 모드 극장 로고 행 → 로고 자르기', async () => {
    render(<DockWithToast />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText('극장 로고 이미지 파일'), { target: { files: [pngFile('c.png')] } });
    });
    await screen.findByRole('dialog', { name: '로고 자르기' });
    expectScreen('로고 자르기');
  });

  test('도크 사진 모드 포맷 로고 행 → 로고 자르기', async () => {
    render(<DockWithToast />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText('포맷 로고 이미지 파일'), { target: { files: [pngFile('f.png')] } });
    });
    await screen.findByRole('dialog', { name: '로고 자르기' });
    expectScreen('로고 자르기');
  });

  test('도크 사진 모드 배경 스탬프 행 → 스탬프 자르기', async () => {
    render(<DockWithToast />);
    await setDock((p) => p.updateComponents({ layout: 'stub' }));
    await act(async () => {
      fireEvent.change(screen.getByLabelText('스탬프 이미지 업로드'), { target: { files: [pngFile('s.png')] } });
    });
    await screen.findByRole('dialog', { name: '스탬프 자르기' });
    expectScreen('스탬프 자르기');
  });

  // 정보 모드 필드 입력 패널(InPlaceFieldEditor)의 '이미지로' 입력 — 극장 · 포맷 로고와 서명이 같은 useLogoCrop을 쓰되 제목은 필드로 갈린다.
  describe('필드 입력 패널의 이미지 입력', () => {
    function InfoShell() {
      const photo = usePhototicket();
      return (
        <>
          <button
            type="button"
            onClick={() => {
              photo.handleImageUpload('blob:test-poster');
              photo.updateMovieInfo({ title: 'TITLE0', theater: 'CGV0' });
              photo.updateComponents({ layout: 'stub', chain: 'blob:chain', chainVisible: true, format: 'blob:format', formatVisible: true });
            }}
          >
            seed
          </button>
          <MobileEditorShell {...mobileShellProps(photo)} />
        </>
      );
    }
    const openPanel = async (editLabel: string, panelLabel: string) => {
      fireEvent.click(screen.getByText('seed'));
      fireEvent.click(await screen.findByRole('button', { name: `${editLabel} 편집` }));
      return screen.findByRole('group', { name: `${panelLabel} 입력` });
    };

    test.each([
      ['극장 로고', '로고 자르기'],
      ['포맷 로고', '로고 자르기'],
      ['서명', '서명 자르기'],
    ] as const)('%s → %s', async (label, title) => {
      render(<InfoShell />);
      await openPanel(label, label);
      // 패널의 숨은 입력은 패널 그룹 바깥 형제라 화면 전체에서 찾는다 — 정보 모드로 바뀐 도크에는 같은 이름의 입력이 없다.
      fireEvent.change(screen.getByLabelText(`${label} 이미지 파일`), { target: { files: [pngFile('i.png')] } });
      await screen.findByRole('dialog', { name: title });
      expectScreen(title);
    });
  });
});

describe('acceptance-6 — 다른 사진', () => {
  test('버튼은 크롭 화면 안의 숨은 입력을 누르고 바깥 입력은 누르지 않는다', async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await openPoster('a.png');
    await user.click(inDialog().getByRole('button', { name: '다른 사진' }));
    expect(clicked).toHaveLength(1);
    expect(dialogEl().contains(clicked[0])).toBe(true);
    expect(clicked[0] === hiddenPicker()).toBe(true);
    expect(clicked.some((el) => el === posterInput())).toBe(false);
  });

  test('숨은 입력은 Tab 순환 밖이고 접근 이름이 바깥 업로드 입력과 겹치지 않는다', async () => {
    render(<Shell />);
    await openPoster('a.png');
    const input = hiddenPicker();
    expect(input.getAttribute('tabindex')).toBe('-1');
    expect(input.getAttribute('aria-label')).toBe('다른 사진 파일');
    expect(input.getAttribute('aria-label')).not.toBe(posterInput().getAttribute('aria-label'));
    expect(inDialog().queryByLabelText('포스터 이미지 파일') === null).toBe(true);
    expect(screen.getAllByLabelText('포스터 이미지 파일')).toHaveLength(1);
  });

  test('Tab 순환: 적용이 마지막, 거기서 Tab은 첫 컨트롤(✕)로, 숨은 입력은 한 번도 포커스를 못 받는다', async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await openPoster('a.png');
    const apply = inDialog().getByRole('button', { name: '적용' });
    const close = inDialog().getByRole('button', { name: '닫기' });
    const hidden = hiddenPicker();
    apply.focus();
    await user.tab();
    expect(document.activeElement === close).toBe(true);
    await user.tab({ shift: true });
    expect(document.activeElement === apply).toBe(true);
    // 한 바퀴 이상 돌며 매 정지점을 확인한다.
    let everHidden = false;
    for (let i = 0; i < 8; i++) {
      await user.tab();
      if (document.activeElement === hidden) everHidden = true;
      expect(dialogEl().contains(document.activeElement)).toBe(true);
    }
    expect(everHidden).toBe(false);
  });

  test('포스터: 이미지 파일을 고르면 그 사진으로 크롭을 다시 시작한다 — 스위치는 꺼짐 · 비율은 프리셋', async () => {
    render(<Shell />);
    await openPoster('a.png');
    const before = cropSrc();
    fireEvent.click(inDialog().getByRole('switch'));
    expect(inDialog().getByRole('switch').getAttribute('aria-checked')).toBe('true');
    expect(Number(frame().getAttribute('data-aspect'))).toBeCloseTo(2000 / 3000, 5);

    pickAnother(pngFile('b.png'));
    expect(cropSrc() === before).toBe(false);
    expect(inDialog().getByRole('switch').getAttribute('aria-checked')).toBe('false');
    loadImage(1000, 1000);
    expect(Number(frame().getAttribute('data-aspect'))).toBe(POSTER_RATIO);
  });

  test('로고: 이미지 파일을 고르면 크롭이 새 사진으로 다시 시작하고 로고 값은 그대로다', async () => {
    render(<DockWithToast />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText('극장 로고 이미지 파일'), { target: { files: [pngFile('c.png')] } });
    });
    await screen.findByRole('dialog', { name: '로고 자르기' });
    const before = cropSrc();
    pickAnother(pngFile('d.png'));
    expect(screen.queryByRole('dialog', { name: '로고 자르기' }) === null).toBe(false);
    expect(cropSrc() === before).toBe(false);
    expect(String(dockProbe.photo!.state.components.chain ?? '')).toBe('');
  });

  test('onPickFile은 이미지 파일 하나로만 불리고, 같은 입력을 다시 골라도 change가 뜨게 비워진다', () => {
    const picked: File[] = [];
    render(<Modal onPickFile={(f) => picked.push(f)} />);
    const file = pngFile('z.png');
    pickAnother(file);
    expect(picked).toEqual([file]);
    expect(hiddenPicker().value).toBe('');
  });

  test('파일을 안 고르거나 이미지가 아니면 화면 · 사진이 그대로다', async () => {
    render(<Shell />);
    await openPoster('a.png');
    const before = cropSrc();
    fireEvent.change(hiddenPicker(), { target: { files: [] } });
    pickAnother(textFile());
    expect(screen.queryByRole('dialog', { name: '포스터 자르기' }) === null).toBe(false);
    expect(cropSrc() === before).toBe(true);
  });

  test('onPickFile도 비이미지 · 빈 선택에는 불리지 않는다', () => {
    const picked: File[] = [];
    render(<Modal onPickFile={(f) => picked.push(f)} />);
    fireEvent.change(hiddenPicker(), { target: { files: [] } });
    pickAnother(textFile());
    expect(picked).toHaveLength(0);
  });

  describe('랜딩에서 연 포스터 크롭', () => {
    const KEY = 'filme:phototicket:v1';
    test('다른 사진을 골라도 랜딩은 그대로이고 적용에서만 벗어난다', async () => {
      window.localStorage.setItem(KEY, JSON.stringify({ movieInfo: { title: '인터스텔라' } }));
      const user = userEvent.setup();
      render(<Shell />);
      const landing = () => screen.getByTestId('landing');
      expect(landing().classList.contains('fixed')).toBe(true);

      await user.click(screen.getByRole('button', { name: /포스터 업로드/ }));
      await openPoster('a.png');
      pickAnother(pngFile('b.png'));
      await screen.findByRole('dialog', { name: '포스터 자르기' });
      expect(landing().classList.contains('fixed')).toBe(true);
      expect(screen.getByTestId('landing-restore').textContent).toContain('인터스텔라');

      loadImage();
      await user.click(inDialog().getByRole('button', { name: '적용' }));
      expect(landing().classList.contains('hidden')).toBe(true);
    });
  });
});

describe('acceptance-7 — 실패는 크롭 화면 안 경고로만 알린다', () => {
  test('이미지 로드 실패: 경고 · 표시 불가 문구 · 적용 비활성, 토스트 없음', () => {
    render(<Modal />);
    fireEvent.error(dialogEl().querySelector('img') as HTMLImageElement);
    expect(inDialog().getByRole('alert').textContent).toContain('이미지를 불러오지 못했어요');
    expect(inDialog().getByText('이미지를 표시할 수 없어요')).toBeTruthy();
    expect((inDialog().getByRole('button', { name: '적용' }) as HTMLButtonElement).disabled).toBe(true);
    expect(toastCount()).toBe(0);
  });

  test('로드 실패 뒤 다른 사진(새 imageSrc)이 들어오면 경고가 걷히고 사진이 다시 그려진다', () => {
    const { rerender } = render(<Modal />);
    fireEvent.error(dialogEl().querySelector('img') as HTMLImageElement);
    expect(inDialog().queryAllByRole('alert')).toHaveLength(1);
    rerender(<Modal imageSrc="blob:y" />);
    expect(inDialog().queryAllByRole('alert')).toHaveLength(0);
    expect(dialogEl().querySelector('img')?.getAttribute('src')).toBe('blob:y');
  });

  test('cropFailed prop은 자르지 못했어요 경고로 보이고 화면은 그대로다', () => {
    render(<Modal cropFailed />);
    expect(inDialog().getByRole('alert').textContent).toContain('자르지 못했어요');
    expect(dialogEl().querySelector('img') === null).toBe(false);
  });

  test('포스터: getCroppedImg가 거부되면 화면은 열린 채 경고, 토스트 없음 — 적용을 다시 누르면 경고가 걷히고 성공하면 닫힌다', async () => {
    const user = userEvent.setup();
    render(<Shell />);
    cropMode = 'fail';
    await pickAndApply(user, 'a.png');
    expect(screen.queryByRole('dialog', { name: '포스터 자르기' }) === null).toBe(false);
    expect(inDialog().getByRole('alert').textContent).toContain('자르지 못했어요');
    expect(toastCount()).toBe(0);

    // 다시 누르면 처리 시작과 함께 경고가 걷힌다.
    cropMode = 'hold';
    await user.click(inDialog().getByRole('button', { name: '적용' }));
    expect(inDialog().queryAllByRole('alert')).toHaveLength(0);
    expect(inDialog().getByRole('button', { name: '적용 중' })).toBeTruthy();
    await act(async () => {
      releaseCrop?.();
    });
    expect(screen.queryByRole('dialog', { name: '포스터 자르기' }) === null).toBe(true);
    expect(toastCount()).toBe(0);
  });

  test('포스터: 실패 뒤 다른 사진을 고르면 경고가 걷힌다', async () => {
    const user = userEvent.setup();
    render(<Shell />);
    cropMode = 'fail';
    await pickAndApply(user, 'a.png');
    expect(inDialog().queryAllByRole('alert')).toHaveLength(1);
    pickAnother(pngFile('b.png'));
    expect(inDialog().queryAllByRole('alert')).toHaveLength(0);
  });

  test('로고: getCroppedImg가 거부되면 화면은 열린 채 경고, 토스트 없음, 로고는 그대로 — 다른 사진이 경고를 걷는다', async () => {
    const user = userEvent.setup();
    render(<DockWithToast />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText('극장 로고 이미지 파일'), { target: { files: [pngFile('c.png')] } });
    });
    await screen.findByRole('dialog', { name: '로고 자르기' });
    loadImage(800, 200);
    cropMode = 'fail';
    await user.click(inDialog().getByRole('button', { name: '적용' }));
    expect(screen.queryByRole('dialog', { name: '로고 자르기' }) === null).toBe(false);
    expect(inDialog().getByRole('alert').textContent).toContain('자르지 못했어요');
    expect(toastCount()).toBe(0);
    expect(String(dockProbe.photo!.state.components.chain ?? '')).toBe('');

    pickAnother(pngFile('d.png'));
    expect(inDialog().queryAllByRole('alert')).toHaveLength(0);
  });
});

describe('acceptance-8 — layout 없는 크롭은 완전 자유 비율', () => {
  test('aspect 없음 · 고정 비율 클래스 없음 · 초기 크롭 100%, 포스터와 대비된다', () => {
    const received: Area[] = [];
    const { unmount } = render(<Modal target="logo" onComplete={(a) => received.push(a)} />);
    loadImage(800, 200);
    expect(frame().getAttribute('data-aspect')).toBe('undefined');
    // 고정 비율이면 ReactCrop이 변 핸들을 숨기는 루트 클래스를 단다 — 자유 비율에서는 없어야 한다(가로 · 세로 따로 조절).
    expect(dialogEl().querySelector('.ReactCrop--fixed-aspect') === null).toBe(true);
    fireEvent.click(inDialog().getByRole('button', { name: '적용' }));
    expect(received).toEqual([{ x: 0, y: 0, width: 800, height: 200 }]);
    unmount();

    render(<Modal layout="minimal" />);
    loadImage(800, 200);
    expect(dialogEl().querySelector('.ReactCrop--fixed-aspect') === null).toBe(false);
  });

  test('도크 극장 로고 행: PNG · 긴 변 640으로 자른다', async () => {
    const user = userEvent.setup();
    render(<DockWithToast />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText('극장 로고 이미지 파일'), { target: { files: [pngFile('c.png')] } });
    });
    await screen.findByRole('dialog', { name: '로고 자르기' });
    loadImage(1200, 300);
    await user.click(inDialog().getByRole('button', { name: '적용' }));
    expect(cropCalls).toHaveLength(1);
    expect(cropCalls[0][2]).toEqual({ mimeType: 'image/png', maxSide: 640 });
    expect(String(dockProbe.photo!.state.components.chain ?? '')).toBe('blob:cropped-1');
  });

  test('도크 배경 스탬프 행: PNG · 긴 변 TARGET_HEIGHT로 자른다', async () => {
    const user = userEvent.setup();
    render(<DockWithToast />);
    await setDock((p) => p.updateComponents({ layout: 'stub' }));
    await act(async () => {
      fireEvent.change(screen.getByLabelText('스탬프 이미지 업로드'), { target: { files: [pngFile('s.png')] } });
    });
    await screen.findByRole('dialog', { name: '스탬프 자르기' });
    loadImage(900, 900);
    await user.click(inDialog().getByRole('button', { name: '적용' }));
    expect(cropCalls[0][2]).toEqual({ mimeType: 'image/png', maxSide: TARGET_HEIGHT });
  });
});

describe('acceptance-14 — 다시 자르기 중 다른 사진을 고르고 닫아도 원본이 남는다', () => {
  /** 사진 모드에서 다시 자르기를 열고 다른 사진 b.png를 고른 상태까지. */
  async function recropWithAnother(user: ReturnType<typeof userEvent.setup>, revoke: ReturnType<typeof spyOn>) {
    let photo!: Photo;
    render(<Shell onPhoto={(p) => { photo = p; }} />);
    await user.click(screen.getByRole('button', { name: /포스터 업로드/ }));
    await pickAndApply(user, 'a.png');
    const first = photo.posterCrop.originalSrc!;
    expect(revoke.mock.calls.flat()).not.toContain(first);

    await openPhotoMode(user);
    await user.click(recropButton());
    await screen.findByRole('dialog', { name: '포스터 자르기' });
    expect(cropSrc()).toBe(first);
    pickAnother(pngFile('b.png'));
    const pending = cropSrc()!;
    expect(pending === first).toBe(false);
    return { first, pending, get photo() { return photo; } };
  }

  test('✕로 닫으면 이전 원본은 안 풀리고 다시 자르기 · saveDraft 원본이 그대로이며, 버려진 새 사진만 한 번 풀린다', async () => {
    const revoke = spyOn(URL, 'revokeObjectURL');
    const fetched: string[] = [];
    spyOn(global, 'fetch').mockImplementation((async (url: string) => {
      fetched.push(url);
      return new Response(new Blob([url]));
    }) as unknown as typeof fetch);
    const user = userEvent.setup();
    const s = await recropWithAnother(user, revoke);

    await user.click(inDialog().getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog', { name: '포스터 자르기' }) === null).toBe(true);
    expect(revoke.mock.calls.flat()).not.toContain(s.first);
    expect(revoke.mock.calls.flat().filter((u) => u === s.pending)).toHaveLength(1);
    expect(s.photo.posterCrop.originalSrc).toBe(s.first);

    await openPhotoMode(user);
    expect(recropButton().disabled).toBe(false);
    await act(async () => {
      s.photo.saveDraft();
    });
    expect(fetched).toContain(s.first);
    expect(fetched).not.toContain(s.pending);
  });

  test('적용하면 새 크롭이 확정되고 이전 원본이 정확히 한 번 풀린다', async () => {
    const revoke = spyOn(URL, 'revokeObjectURL');
    const user = userEvent.setup();
    const s = await recropWithAnother(user, revoke);

    loadImage();
    await user.click(inDialog().getByRole('button', { name: '적용' }));
    expect(screen.queryByRole('dialog', { name: '포스터 자르기' }) === null).toBe(true);
    expect(revoke.mock.calls.flat().filter((u) => u === s.first)).toHaveLength(1);
    expect(s.photo.posterCrop.originalSrc).toBe(s.pending);
    expect(revoke.mock.calls.flat()).not.toContain(s.pending);
    expect(s.photo.state.croppedImageUrl).toBe('blob:cropped-2');
  });

  test('로고: 다른 사진을 고른 뒤 ✕로 닫아도 로고 값은 그대로다', async () => {
    const user = userEvent.setup();
    render(<DockWithToast />);
    await setDock((p) => p.updateComponents({ chain: 'blob:old-logo' }));
    await act(async () => {
      fireEvent.change(screen.getByLabelText('극장 로고 이미지 파일'), { target: { files: [pngFile('c.png')] } });
    });
    await screen.findByRole('dialog', { name: '로고 자르기' });
    pickAnother(pngFile('d.png'));
    await user.click(inDialog().getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog', { name: '로고 자르기' }) === null).toBe(true);
    expect(String(dockProbe.photo!.state.components.chain)).toBe('blob:old-logo');
    expect(cropCalls).toHaveLength(0);
  });
});

describe('acceptance-15 — 처리 중에는 모든 컨트롤이 잠긴다', () => {
  test('버튼은 적용 중이고 다른 사진 · ✕ · 스위치가 비활성, Escape는 닫지 않는다', () => {
    let closed = 0;
    render(<Modal layout="minimal" isProcessing onClose={() => { closed++; }} />);
    const d = inDialog();
    expect(d.getByRole('button', { name: '적용 중' })).toBeTruthy();
    expect((d.getByRole('button', { name: '적용 중' }) as HTMLButtonElement).disabled).toBe(true);
    expect((d.getByRole('button', { name: '다른 사진' }) as HTMLButtonElement).disabled).toBe(true);
    expect((d.getByRole('button', { name: '닫기' }) as HTMLButtonElement).disabled).toBe(true);
    expect((d.getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closed).toBe(0);
  });

  test('대조: 처리 중이 아니면 Escape가 닫는다', () => {
    let closed = 0;
    render(<Modal onClose={() => { closed++; }} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closed).toBe(1);
  });
});
