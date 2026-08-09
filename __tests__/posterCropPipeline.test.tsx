/**
 * 포스터 크롭 파이프라인 단일 소유자 회귀 테스트 (#548).
 *
 * imageUploaderRecrop.test.tsx(#182 PR #191)와 mobileEditorShellPosterCropPipeline.test.tsx(#315)를
 * 합친 파일이다 — 두 파일이 각각 검증하던 pendingNewFile 상태머신이 #548에서 usePosterCrop
 * 한 벌로 합쳐졌다. #607에서 소비자도 한 벌(모바일 셸)이 되며 데스크톱 ImageUploader 경로를
 * 걷어내고, 그쪽에서만 밟히던 불변식을 같은 셸 경로로 이관했다. 여기서 지키는 불변식:
 *   - 교체(새 파일) 후 취소 → 재크롭 비활성 (직전 포스터의 원본은 이미 revoke돼 stale이다)
 *   - 재크롭 취소(새 파일 안 고름) → 원본 유지, 재크롭 계속 활성
 *   - 첫 업로드 취소 → 원본 폐기, 프리뷰 없음
 *   - 크롭 진행 중 드롭 무시 (getCroppedImg가 읽는 중인 blob을 revoke하지 않게)
 *   - 마우스 없이 Tab + Enter만으로 업로드 → 크롭 → 적용 완주(#608, 파일 맨 아래 describe)
 *
 * 그리고 #548이 실제로 고치는 것: 원본 objectURL의 소유자가 컴포넌트가 아니라 usePhototicket
 * 이라는 것. 예전엔 셸이 소유해 셸이 죽을 때 revoke됐고, 그 결과
 *   (a) 복원 시드가 죽은 URL을 다시 물어 재크롭 버튼만 활성인 채로 뜨고,
 *   (b) saveDraft가 죽은 URL을 blobUrlToBlob에 넣어 posterOriginal을 undefined로 기록해
 *       IndexedDB의 원본을 영구히 지웠다.
 * 그 실패를 실제로 밟던 언마운트 경로(모바일↔데스크톱 브레이크포인트 전환)는 #607이 셸을
 * 한 벌로 만들며 **사라졌다** — 그래서 전환 왕복 describe는 지웠고, 여전히 의미 있는 실패
 * 모드 (b)만 아래 saveDraft 테스트로 남겼다(소유자가 셸로 되돌아가면 이게 먼저 깨진다).
 *
 * ImageCropModal은 **실물을 쓴다**(logoCropFreeAspect와 동일) —
 * mock.module로 갈면 bun의 파일 간 격리 부재 때문에 뒤에 도는 그 파일들이 스텁을 받아 깨진다.
 * canvas에 의존하는 getCroppedImg만 mock하고, 실물 모달을 태우기 위한 <img> 자연 크기 스텁 +
 * load 이벤트 관용구를 그 파일들에서 그대로 가져왔다.
 */
import { describe, expect, test, afterAll, afterEach, mock, spyOn } from 'bun:test';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mobileShellProps } from './shellHarness';

// holdCrop: 다음 크롭을 붙잡아 isCropping(busy) 창을 관측 가능하게 한다. releaseCrop으로 푼다.
let cropN = 0;
let holdCrop = false;
let releaseCrop: (() => void) | null = null;
// 스프레드 스냅샷 + afterAll 복원(#611·#618) — `require()`가 주는 건 살아있는 네임스페이스라
// mock.module이 그 객체를 제자리에서 갈아끼운다. 복사본으로 떠 둬야 복원이 진짜 복원이 된다.
// 안 되돌리면 이 getCroppedImg 스텁이 프로세스 끝까지 남아, 같은 모듈을 쓰는 뒤 파일이
// 실제 canvas 크롭 대신 `blob:cropped-N` 문자열을 받는다.
const realImageCrop = { ...require('@/utils/imageCrop') };
mock.module('@/utils/imageCrop', () => ({
  ...realImageCrop,
  getCroppedImg: () =>
    new Promise<string>((resolve) => {
      const url = `blob:cropped-${++cropN}`;
      if (holdCrop) releaseCrop = () => resolve(url);
      else resolve(url);
    }),
}));

const { usePhototicket } = require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');
const { MobileEditorShell } = require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');

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

function MobileHarness({ onPhoto }: { onPhoto?: (p: ReturnType<typeof usePhototicket>) => void } = {}) {
  const photo = usePhototicket();
  onPhoto?.(photo);
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

/** 재크롭은 헤더 편집 메뉴 안에 있다 — 데스크톱 ImageUploader의 인라인 버튼 자리를 이게 잇는다. */
const openMenu = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: '편집 메뉴' }));
const uploadCta = () => screen.getByRole('button', { name: /포스터 있으면 올리기/ });

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  cropN = 0;
  holdCrop = false;
  releaseCrop = null;
  mock.restore(); // mock()/spyOn()만 되돌린다 — 모듈 mock은 아래 afterAll이 따로 푼다.
});

afterAll(() => {
  mock.module('@/utils/imageCrop', () => realImageCrop);
});

describe('포스터 크롭 상태머신 (#182 PR #191 · #315, 실제 파일-선택 경로)', () => {
  test('첫 업로드 후 서브메뉴 재크롭이 활성화된다', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    await user.click(uploadCta());
    await pickAndApply(user, 'a.png');

    await openMenu(user);
    expect(recropButton().disabled).toBe(false);
  });

  test('교체 후 취소 → 재크롭 비활성 (stale objectURL 방지)', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    await user.click(uploadCta());
    await pickAndApply(user, 'a.png');

    // 교체: 새 파일을 고른 뒤 취소 — 직전 포스터의 원본은 이미 revoke됐으므로 재크롭 불가여야 한다.
    // 옛 "커밋된 포스터가 있으면 활성" 가드는 이 경우를 못 봐서, 버려진 교체 파일을 가리킨 채
    // 버튼이 살아있었다(#182 P1).
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: '포스터 교체' }));
    await pickAndCancel(user, 'b.png');

    await openMenu(user);
    expect(recropButton().disabled).toBe(true);
  });

  test('재크롭 취소는 원본을 유지한다 (재크롭 계속 활성)', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    await user.click(uploadCta());
    await pickAndApply(user, 'a.png');

    await openMenu(user);
    await user.click(recropButton());
    await screen.findByRole('dialog', { name: '포스터 크롭' });
    await user.click(screen.getByRole('button', { name: '다른 사진 선택' }));

    await openMenu(user);
    expect(recropButton().disabled).toBe(false);
  });

  test('첫 업로드 취소 → 프리뷰 없음(원본 폐기)', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    await user.click(uploadCta());
    await pickAndCancel(user, 'a.png');

    // 포스터가 없으면 셸은 업로드 CTA로 되돌아간다 — #614 이후 그 CTA는 랜딩의 것이고, 크롭을
    // 취소하면 오버레이가 다시 덮인다(파생 showLanding). 편집 메뉴의 포스터 액션도 그대로 게이팅.
    expect(uploadCta()).toBeTruthy();
    // CTA는 overlay·inline 양쪽에 다 있으므로 존재만으로는 "덮였다"를 못 잰다 — landingOverlay와
    // 같이 fixed 여부로 판정한다(PR #622 claude-review P1).
    expect(screen.getByTestId('landing').classList.contains('fixed')).toBe(true);
    await openMenu(user);
    expect(screen.queryByRole('button', { name: '재크롭' })).toBeNull();
  });

  // 자동저장 복원(#489)과 같은 상태 — 세션 내 업로드 없이 원본만 훅에 들어와 있는 경우.
  // handleImageUpload의 originalUrl 인자가 IDB 복원과 같은 시드 경로(usePosterCrop.seedOriginal)다.
  test('원본이 시드돼 있으면 세션 내 업로드 없이도 재크롭이 바로 된다', async () => {
    let photo!: ReturnType<typeof usePhototicket>;
    render(<MobileHarness onPhoto={(p) => { photo = p; }} />);
    act(() => {
      photo.handleImageUpload('blob:restored-poster', 'blob:restored-original');
    });

    const user = userEvent.setup();
    await openMenu(user);
    expect(recropButton().disabled).toBe(false);
    await user.click(recropButton());
    await screen.findByRole('dialog', { name: '포스터 크롭' });
    expect(cropSrc()).toBe('blob:restored-original');
  });

  test('원본 복원이 안 됐으면(포스터만 있음) 재크롭은 계속 비활성', async () => {
    let photo!: ReturnType<typeof usePhototicket>;
    render(<MobileHarness onPhoto={(p) => { photo = p; }} />);
    act(() => {
      photo.handleImageUpload('blob:restored-poster');
    });

    await openMenu(userEvent.setup());
    expect(recropButton().disabled).toBe(true);
  });

  // 원본 blob의 단일 소유자가 usePosterCrop의 revoke effect라는 것 — 교체하면 직전 원본이
  // 정확히 한 번 풀려야 한다. 이 어서션이 없으면 아래 saveDraft의 not.toContain이
  // 스파이가 아무것도 안 잡는 상태에서도 통과하는 헛 어서션이 된다.
  test('교체하면 직전 원본이 revoke된다 (단일 소유자)', async () => {
    const revoke = spyOn(URL, 'revokeObjectURL');
    const user = userEvent.setup();
    let photo!: ReturnType<typeof usePhototicket>;
    render(<MobileHarness onPhoto={(p) => { photo = p; }} />);

    await user.click(uploadCta());
    await pickAndApply(user, 'a.png');
    const first = photo.posterCrop.originalSrc!;
    expect(revoke.mock.calls.flat()).not.toContain(first);

    await openMenu(user);
    await user.click(screen.getByRole('button', { name: '포스터 교체' }));
    fireEvent.change(posterFileInput(), { target: { files: [pngFile('b.png')] } });
    await screen.findByRole('dialog', { name: '포스터 크롭' });
    expect(revoke.mock.calls.flat().filter((u) => u === first)).toHaveLength(1);
  });

  // #548 실패 모드 (b) — 원본 소유자가 훅이 아니라 셸로 되돌아가면 여기서 먼저 깨진다.
  // 이걸 밟던 언마운트 경로(브레이크포인트 전환)는 #607에서 사라졌지만, saveDraft가 살아있는
  // 원본을 실어보내는지는 소유권이 바뀌는 순간 그대로 회귀하므로 남겨둔다.
  test('saveDraft가 살아있는 원본을 실어보낸다 — posterOriginal이 undefined로 안 덮인다', async () => {
    const revoke = spyOn(URL, 'revokeObjectURL');
    // saveDraft는 posterCrop.originalSrc를 blobUrlToBlob(=fetch(blob:))에 넣어 IndexedDB에
    // 영속한다. 그 URL이 revoke됐으면 fetch가 실패해 posterOriginal: undefined가 기록되고
    // 원본이 IndexedDB에서 영구히 사라진다. happy-dom엔 objectURL을 되읽는 경로가 없으므로
    // fetch를 스텁해 "무엇이 넘어갔는지"를 관측한다 — IndexedDB 왕복 자체는
    // draftImageRestore.test.tsx가 인메모리 스토어로 커버한다.
    const fetched: string[] = [];
    spyOn(global, 'fetch').mockImplementation((async (url: string) => {
      fetched.push(url);
      return new Response(new Blob([url]));
    }) as unknown as typeof fetch);

    const user = userEvent.setup();
    let photo!: ReturnType<typeof usePhototicket>;
    render(<MobileHarness onPhoto={(p) => { photo = p; }} />);

    await user.click(uploadCta());
    await pickAndApply(user, 'poster.png');
    const original = photo.posterCrop.originalSrc!;

    await act(async () => {
      photo.saveDraft();
    });

    expect(fetched).toContain(original);
    expect(revoke.mock.calls.flat()).not.toContain(original);
    expect(cropDialog()).toBeNull();
  });
});

/** 마우스 없이 Tab만으로 목표 컨트롤까지 간다. 못 닿으면(=키보드 경로 단절) 명시적으로 실패시킨다. */
async function tabTo(user: ReturnType<typeof userEvent.setup>, target: HTMLElement, label: string) {
  for (let i = 0; i < 60; i++) {
    if (document.activeElement === target) return;
    await user.tab();
  }
  throw new Error(`Tab 60회 안에 "${label}"에 도달하지 못했다 — 키보드 경로가 끊겼다`);
}

// 드롭 업로드(#607) — 데스크톱 ImageUploader가 지워지며 같이 사라졌던 진입점이라, 되살린 뒤
// 다시 없어지지 않게 못 박는다. 파일 대화상자와 달리 드롭은 스크립트로 끝까지 재현된다.
describe('드롭으로 포스터 업로드 (#607)', () => {
  const drop = (el: Element, files: File[]) => fireEvent.drop(el, { dataTransfer: { files } });

  test('업로드 CTA에 이미지 파일을 드롭하면 크롭 모달이 열린다', async () => {
    render(<MobileHarness />);

    drop(uploadCta(), [pngFile('dropped.png')]);

    await screen.findByRole('dialog', { name: '포스터 크롭' });
  });

  test('accept 밖 타입(PDF)은 무시한다 — input의 accept와 같은 목록을 쓴다', () => {
    render(<MobileHarness />);

    drop(uploadCta(), [new File(['x'], 'doc.pdf', { type: 'application/pdf' })]);

    expect(cropDialog()).toBeNull();
  });

  // 크롭 진행 중 드롭 무시 — getCroppedImg가 읽고 있는 원본 blob을 openFile의 교체가 revoke하면
  // 진행 중인 크롭이 죽은 URL을 읽는다. 구 ImageUploader의 같은 이름 테스트를 이 CTA로 이관한 것:
  // 모달이 CTA를 시각적으로 가려 실사용 드래그로는 못 닿지만, CTA는 DOM에 그대로 남아 있어
  // (croppedImageUrl이 아직 null) 이벤트를 직접 쏘면 가드를 그대로 밟는다 — 구 테스트도
  // fireEvent.drop을 드롭존에 직접 쏘는 방식이었다(claude-review PR #619 P1).
  test('크롭 진행 중 드롭은 무시된다 (in-flight 원본 보존)', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    await user.click(uploadCta());
    fireEvent.change(posterFileInput(), { target: { files: [pngFile('a.png')] } });
    await screen.findByRole('dialog', { name: '포스터 크롭' });
    loadImage();
    const srcBefore = cropSrc();

    // 적용을 붙잡아 isCropping(busy) 창을 열어둔다.
    holdCrop = true;
    await user.click(screen.getByRole('button', { name: '적용' }));
    drop(uploadCta(), [pngFile('b.png')]);

    // 가드가 막아야 crop.openFile이 안 불리고, 모달은 in-flight 원본을 계속 가리킨다.
    expect(cropSrc()).toBe(srcBefore);

    await act(async () => {
      releaseCrop?.();
    });
    expect(cropN).toBe(1);
  });
});

describe('키보드 전용 포스터 업로드 경로 (#608)', () => {
  test('Tab + Enter만으로 업로드 → 크롭 → 적용까지 완주한다', async () => {
    const user = userEvent.setup();
    let photo!: ReturnType<typeof usePhototicket>;
    render(<MobileHarness onPhoto={(p) => { photo = p; }} />);

    // ① 드롭존까지 Tab으로 도달 + Enter가 파일 선택을 실제로 연다.
    await tabTo(user, uploadCta(), '포스터 있으면 올리기');
    const openFileDialog = spyOn(posterFileInput(), 'click');
    await user.keyboard('{Enter}');
    expect(openFileDialog).toHaveBeenCalledTimes(1);

    // ② 파일 선택(OS 대화상자는 어느 환경에서도 스크립트 불가) → 크롭 모달.
    fireEvent.change(posterFileInput(), { target: { files: [pngFile('p.png')] } });
    await screen.findByRole('dialog', { name: '포스터 크롭' });
    loadImage();

    // ③ 모달 안에서도 Tab으로 '적용'까지 가고 Enter로 확정된다(포커스 트랩 안이라 밖으로 안 샌다).
    const apply = screen.getByRole('button', { name: '적용' }) as HTMLButtonElement;
    expect(apply.disabled).toBe(false);
    await tabTo(user, apply, '적용');
    await user.keyboard('{Enter}');

    expect(photo.state.croppedImageUrl).toBe('blob:cropped-1');
    expect(cropDialog()).toBeNull();
  });

  test('포스터가 있는 상태의 교체·재크롭도 헤더 메뉴에서 키보드로 열린다', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);
    await pickAndApply(user, 'p.png');

    const menu = screen.getByRole('button', { name: '편집 메뉴' });
    await tabTo(user, menu, '편집 메뉴');
    await user.keyboard('{Enter}');

    // '툴바 설정' 접이식 패널(#447)은 #574에서 '고급 설정' 모달 진입점으로 대체됐다 — inert 우회가
    // 더 이상 필요 없다(고급 설정 행 자체가 일반 버튼이라 Tab이 그냥 통과한다).
    const replace = await screen.findByRole('button', { name: '포스터 교체' });
    const openFileDialog = spyOn(posterFileInput(), 'click');
    await tabTo(user, replace, '포스터 교체');
    await user.keyboard('{Enter}');
    expect(openFileDialog).toHaveBeenCalledTimes(1);
  });
});
