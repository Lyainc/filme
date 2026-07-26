/**
 * 포스터 크롭 파이프라인 단일 소유자 회귀 테스트 (#548).
 *
 * imageUploaderRecrop.test.tsx(#182 PR #191)와 mobileEditorShellPosterCropPipeline.test.tsx(#315)를
 * 합친 파일이다 — 두 파일이 각각 검증하던 pendingNewFile 상태머신이 #548에서 usePosterCrop
 * 한 벌로 합쳐졌으므로, 테스트도 같은 상태머신을 두 소비자(데스크톱 ImageUploader · 모바일
 * 서브메뉴)에서 각각 밟는 형태로 옮겼다. 여기서 지키는 불변식:
 *   - 교체(새 파일) 후 취소 → 재크롭 비활성 (직전 포스터의 원본은 이미 revoke돼 stale이다)
 *   - 재크롭 취소(새 파일 안 고름) → 원본 유지, 재크롭 계속 활성
 *   - 첫 업로드 취소 → 원본 폐기, 프리뷰 없음
 *   - 크롭 진행 중 드롭 무시 (getCroppedImg가 읽는 중인 blob을 revoke하지 않게)
 *
 * 그리고 #548이 실제로 고치는 것: 셸이 언마운트됐다 다시 마운트되는 경로(AppShell = pages/index.tsx의
 * 모바일↔데스크톱 브레이크포인트 전환)에서 크롭 원본이 살아남는가. 예전엔 원본 objectURL을
 * 컴포넌트가 소유해 셸이 죽을 때 revoke됐고, 그 결과
 *   (a) 복원 시드가 죽은 URL을 다시 물어 재크롭 버튼만 활성인 채로 뜨고,
 *   (b) saveDraft가 죽은 URL을 blobUrlToBlob에 넣어 posterOriginal을 undefined로 기록해
 *       IndexedDB의 원본을 영구히 지웠다.
 * 아래 '브레이크포인트 전환' describe가 그 URL이 revoke되지 않고 saveDraft 입력으로 계속
 * 살아있음을 못 박는다.
 *
 * ImageCropModal은 **실물을 쓴다**(logoCropFreeAspect·desktopStudioShellRecropWiring과 동일) —
 * mock.module로 갈면 bun의 파일 간 격리 부재 때문에 뒤에 도는 그 파일들이 스텁을 받아 깨진다.
 * canvas에 의존하는 getCroppedImg만 mock하고, 실물 모달을 태우기 위한 <img> 자연 크기 스텁 +
 * load 이벤트 관용구를 그 파일들에서 그대로 가져왔다.
 */
import { describe, expect, test, afterEach, mock, spyOn } from 'bun:test';
import { useState } from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desktopShellProps, mobileShellProps } from './shellHarness';

// holdCrop: 다음 크롭을 붙잡아 isCropping(busy) 창을 관측 가능하게 한다. releaseCrop으로 푼다.
let cropN = 0;
let holdCrop = false;
let releaseCrop: (() => void) | null = null;
mock.module('@/utils/imageCrop', () => ({
  getCroppedImg: () =>
    new Promise<string>((resolve) => {
      const url = `blob:cropped-${++cropN}`;
      if (holdCrop) releaseCrop = () => resolve(url);
      else resolve(url);
    }),
}));

const { usePhototicket } = require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');
const ImageUploader = (
  require('@/components/ImageUploader') as { default: typeof import('@/components/ImageUploader').default }
).default;
const { MobileEditorShell } = require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');
const { DesktopStudioShell } = require('@/components/v2/DesktopStudioShell') as typeof import('@/components/v2/DesktopStudioShell');

// 포스터 전용 파일 input(accept에 jpeg 포함) — OcrUploadCard의 image/* input과 구분.
const posterFileInput = () => document.querySelector('input[type="file"][accept*="jpeg"]') as HTMLInputElement;
const pngFile = (name: string) => new File([name], name, { type: 'image/png' });
const cropDialog = () => screen.queryByRole('dialog', { name: '포스터 크롭' });
/** 모달이 지금 어느 원본을 가리키는지. 티켓 프리뷰의 <img>와 안 섞이게 다이얼로그 안에서만 찾는다. */
const cropSrc = () => document.querySelector('[role="dialog"] img')?.getAttribute('src') ?? null;
const recropButton = () => screen.getByRole('button', { name: '재크롭' }) as HTMLButtonElement;

/** 실물 크롭 모달의 onImageLoad(mediaAspect 계산 → 크롭 초기화)를 태운다 — 안 하면 '적용'이 비활성. */
function loadImage(naturalWidth = 2000, naturalHeight = 3000) {
  const img = document.querySelector('[role="dialog"] img') as HTMLImageElement;
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: naturalHeight, configurable: true });
  Object.defineProperty(img, 'width', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'height', { value: naturalHeight, configurable: true });
  fireEvent.load(img);
}

/** 파일 선택 → 실물 모달 적용까지. 이후 photo에 포스터 + 크롭 원본이 모두 서 있다. */
async function pickAndApply(user: ReturnType<typeof userEvent.setup>, name: string) {
  fireEvent.change(posterFileInput(), { target: { files: [pngFile(name)] } });
  await screen.findByRole('dialog', { name: '포스터 크롭' });
  loadImage();
  await user.click(screen.getByRole('button', { name: '적용' }));
}

/** 파일 선택 → 모달 취소. */
async function pickAndCancel(user: ReturnType<typeof userEvent.setup>, name: string) {
  fireEvent.change(posterFileInput(), { target: { files: [pngFile(name)] } });
  await screen.findByRole('dialog', { name: '포스터 크롭' });
  await user.click(screen.getByRole('button', { name: '다른 사진 선택' }));
}

// 데스크톱 leaf 하네스 — DesktopStudioShell이 ImageUploader에 넘기는 것과 동일한 배선.
function UploaderHarness({ onPhoto }: { onPhoto?: (p: ReturnType<typeof usePhototicket>) => void } = {}) {
  const photo = usePhototicket();
  onPhoto?.(photo);
  return (
    <ImageUploader
      crop={photo.posterCrop}
      isProcessing={false}
      imageUrl={photo.state.croppedImageUrl}
      layout="minimal"
    />
  );
}

function MobileHarness() {
  const photo = usePhototicket();
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  cropN = 0;
  holdCrop = false;
  releaseCrop = null;
  mock.restore();
});

describe('데스크톱 ImageUploader 재크롭 상태머신 (#182 PR #191)', () => {
  test('교체 후 취소 → 재크롭 비활성 (stale objectURL 방지)', async () => {
    const user = userEvent.setup();
    render(<UploaderHarness />);

    await pickAndApply(user, 'a.png');
    expect(recropButton().disabled).toBe(false);

    // 교체: 새 파일을 고른 뒤 취소 — 직전 포스터의 원본은 이미 revoke됐으므로 재크롭 불가여야 한다.
    // 옛 "커밋된 포스터가 있으면 활성" 가드는 이 경우를 못 봐서, 버려진 교체 파일을 가리킨 채
    // 버튼이 살아있었다(#182 P1).
    await pickAndCancel(user, 'b.png');
    expect(recropButton().disabled).toBe(true);
  });

  test('재크롭 취소는 원본을 유지한다 (재크롭 계속 활성)', async () => {
    const user = userEvent.setup();
    render(<UploaderHarness />);

    await pickAndApply(user, 'a.png');
    await user.click(recropButton());
    await screen.findByRole('dialog', { name: '포스터 크롭' });
    await user.click(screen.getByRole('button', { name: '다른 사진 선택' }));

    expect(recropButton().disabled).toBe(false);
  });

  test('첫 업로드 취소 → 프리뷰 없음(원본 폐기)', async () => {
    const user = userEvent.setup();
    render(<UploaderHarness />);

    await pickAndCancel(user, 'a.png');
    expect(screen.queryByRole('button', { name: '재크롭' })).toBeNull();
    expect(screen.getByText('포스터 업로드')).toBeTruthy();
  });

  test('크롭 진행 중 드롭은 무시된다 (in-flight 원본 보존)', async () => {
    const user = userEvent.setup();
    render(<UploaderHarness />);

    fireEvent.change(posterFileInput(), { target: { files: [pngFile('a.png')] } });
    await screen.findByRole('dialog', { name: '포스터 크롭' });
    loadImage();
    const srcBefore = cropSrc();

    // 적용을 붙잡아 isCropping(busy) 창을 열어둔다. 아직 커밋 전이라 드롭존은 <label>.
    holdCrop = true;
    await user.click(screen.getByRole('button', { name: '적용' }));
    fireEvent.drop(document.querySelector('label')!, { dataTransfer: { files: [pngFile('b.png')] } });

    // busy 가드가 막아야 openFile이 안 불리고, 모달은 in-flight 원본을 계속 가리킨다.
    expect(cropSrc()).toBe(srcBefore);

    await act(async () => {
      releaseCrop?.();
    });
    expect(cropN).toBe(1);
  });

  // 자동저장 복원(#489)과 같은 상태 — 세션 내 업로드 없이 원본만 훅에 들어와 있는 경우.
  // handleImageUpload의 originalUrl 인자가 IDB 복원과 같은 시드 경로(usePosterCrop.seedOriginal)다.
  test('원본이 시드돼 있으면 세션 내 업로드 없이도 재크롭이 바로 된다', async () => {
    let photo!: ReturnType<typeof usePhototicket>;
    render(<UploaderHarness onPhoto={(p) => { photo = p; }} />);
    act(() => {
      photo.handleImageUpload('blob:restored-poster', 'blob:restored-original');
    });

    const user = userEvent.setup();
    expect(recropButton().disabled).toBe(false);
    await user.click(recropButton());
    await screen.findByRole('dialog', { name: '포스터 크롭' });
    expect(cropSrc()).toBe('blob:restored-original');
  });

  // 원본 blob의 단일 소유자가 usePosterCrop의 revoke effect라는 것 — 교체하면 직전 원본이
  // 정확히 한 번 풀려야 한다. 이 어서션이 없으면 아래 '브레이크포인트 전환'의 not.toContain이
  // 스파이가 아무것도 안 잡는 상태에서도 통과하는 헛 어서션이 된다.
  test('교체하면 직전 원본이 revoke된다 (단일 소유자)', async () => {
    const revoke = spyOn(URL, 'revokeObjectURL');
    const user = userEvent.setup();
    let photo!: ReturnType<typeof usePhototicket>;
    render(<UploaderHarness onPhoto={(p) => { photo = p; }} />);

    await pickAndApply(user, 'a.png');
    const first = photo.posterCrop.originalSrc!;
    expect(revoke.mock.calls.flat()).not.toContain(first);

    fireEvent.change(posterFileInput(), { target: { files: [pngFile('b.png')] } });
    await screen.findByRole('dialog', { name: '포스터 크롭' });
    expect(revoke.mock.calls.flat().filter((u) => u === first)).toHaveLength(1);
  });

  test('원본 복원이 안 됐으면(포스터만 있음) 재크롭은 계속 비활성', () => {
    let photo!: ReturnType<typeof usePhototicket>;
    render(<UploaderHarness onPhoto={(p) => { photo = p; }} />);
    act(() => {
      photo.handleImageUpload('blob:restored-poster');
    });

    expect(recropButton().disabled).toBe(true);
  });
});

describe('모바일 셸 포스터 크롭 파이프라인 (#315, 실제 파일-선택 경로)', () => {
  test('첫 업로드 후 서브메뉴 재크롭이 활성화된다', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    await user.click(screen.getByRole('button', { name: /포스터 업로드/ }));
    await pickAndApply(user, 'a.png');

    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    expect(recropButton().disabled).toBe(false);
  });

  test('교체 후 취소 → 재크롭 비활성 (데스크톱과 동일 상태머신)', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    await user.click(screen.getByRole('button', { name: /포스터 업로드/ }));
    await pickAndApply(user, 'a.png');

    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(screen.getByRole('button', { name: '포스터 교체' }));
    await pickAndCancel(user, 'b.png');

    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    expect(recropButton().disabled).toBe(true);
  });

  test('재크롭 취소는 원본을 유지한다 (재크롭 계속 활성)', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    await user.click(screen.getByRole('button', { name: /포스터 업로드/ }));
    await pickAndApply(user, 'a.png');

    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(recropButton());
    await screen.findByRole('dialog', { name: '포스터 크롭' });
    await user.click(screen.getByRole('button', { name: '다른 사진 선택' }));

    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    expect(recropButton().disabled).toBe(false);
  });
});

describe('셸 언마운트 경로 = 브레이크포인트 전환 (#548)', () => {
  // pages/index.tsx와 동형 — usePhototicket은 페이지가 쥐고, 셸만 isMobile로 갈아끼운다.
  // 이 전환이 #492의 CSS hidden 상시 마운트로도 못 막는 유일한 언마운트 경로다.
  function BreakpointHarness({ onPhoto }: { onPhoto: (p: ReturnType<typeof usePhototicket>) => void }) {
    const photo = usePhototicket();
    const [mobile, setMobile] = useState(false);
    onPhoto(photo);
    return (
      <>
        <button type="button" onClick={() => setMobile((v) => !v)}>
          브레이크포인트 전환
        </button>
        {mobile ? (
          <MobileEditorShell {...mobileShellProps(photo)} />
        ) : (
          <DesktopStudioShell {...desktopShellProps(photo)} />
        )}
      </>
    );
  }

  test('데스크톱에서 크롭한 원본이 모바일 셸로 전환해도 살아있고 재크롭이 된다', async () => {
    const revoke = spyOn(URL, 'revokeObjectURL');
    const user = userEvent.setup();
    let photo!: ReturnType<typeof usePhototicket>;
    render(<BreakpointHarness onPhoto={(p) => { photo = p; }} />);

    await pickAndApply(user, 'poster.png');
    const original = photo.posterCrop.originalSrc!;
    expect(original).toBeTruthy();

    // 창 리사이즈로 셸이 통째로 교체된다 — 예전 구조에선 여기서 원본이 revoke됐다.
    await user.click(screen.getByRole('button', { name: '브레이크포인트 전환' }));
    expect(revoke.mock.calls.flat()).not.toContain(original);
    expect(photo.posterCrop.originalSrc).toBe(original);

    // 살아있는 원본을 실제로 다시 크롭할 수 있어야 한다 — "버튼만 활성" 상태가 아니다.
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    expect(recropButton().disabled).toBe(false);
    await user.click(recropButton());
    await screen.findByRole('dialog', { name: '포스터 크롭' });
    expect(cropSrc()).toBe(original);

    // 데스크톱으로 되돌아와도 마찬가지.
    await user.click(screen.getByRole('button', { name: '다른 사진 선택' }));
    await user.click(screen.getByRole('button', { name: '브레이크포인트 전환' }));
    expect(revoke.mock.calls.flat()).not.toContain(original);
    expect(photo.posterCrop.originalSrc).toBe(original);
    expect(cropDialog()).toBeNull();
  });

  test('전환 후 saveDraft가 살아있는 원본을 실어보낸다 — posterOriginal이 undefined로 안 덮인다', async () => {
    const revoke = spyOn(URL, 'revokeObjectURL');
    // saveDraft는 posterCrop.originalSrc를 blobUrlToBlob(=fetch(blob:))에 넣어 IndexedDB에
    // 영속한다. 그 URL이 revoke됐으면 fetch가 실패해 posterOriginal: undefined가 기록되고
    // 원본이 IndexedDB에서 영구히 사라진다(#548 실패 모드 b). happy-dom엔 objectURL을 되읽는
    // 경로가 없으므로 fetch를 스텁해 "무엇이 넘어갔는지"를 관측한다 — IndexedDB 왕복 자체는
    // draftImageRestore.test.tsx가 인메모리 스토어로 커버한다.
    const fetched: string[] = [];
    spyOn(global, 'fetch').mockImplementation((async (url: string) => {
      fetched.push(url);
      return new Response(new Blob([url]));
    }) as unknown as typeof fetch);

    const user = userEvent.setup();
    let photo!: ReturnType<typeof usePhototicket>;
    render(<BreakpointHarness onPhoto={(p) => { photo = p; }} />);

    await pickAndApply(user, 'poster.png');
    const original = photo.posterCrop.originalSrc!;

    await user.click(screen.getByRole('button', { name: '브레이크포인트 전환' }));
    await act(async () => {
      photo.saveDraft();
    });

    expect(fetched).toContain(original);
    expect(revoke.mock.calls.flat()).not.toContain(original);
  });
});
