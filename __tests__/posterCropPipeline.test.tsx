/**
 * 포스터 크롭 파이프라인 단일 소유자 회귀 테스트 (#548).
 *
 * imageUploaderRecrop.test.tsx(#182 PR #191)와 mobileEditorShellPosterCropPipeline.test.tsx(#315)를
 * 합친 파일이다 — 두 파일이 각각 검증하던 pendingNewFile 상태머신이 #548에서 usePosterCrop
 * 한 벌로 합쳐졌다. #607에서 소비자도 한 벌(모바일 셸)이 되며 데스크톱 ImageUploader 경로를
 * 걷어내고, 그쪽에서만 밟히던 불변식을 같은 셸 경로로 이관했다. 여기서 지키는 불변식:
 *   - 교체(새 파일) 후 취소 → 직전 원본이 그대로 남고 재크롭도 활성(#826 S6 constraint-18, 확정 전 새 파일만 버려진다)
 *   - 재크롭 취소(새 파일 안 고름) → 원본 유지, 재크롭 계속 활성
 *   - 첫 업로드 취소 → 원본 폐기, 프리뷰 없음
 *   - 드롭은 아무 일도 안 한다(#826 S5 D18-2로 드롭 업로드 제거)
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
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mobileShellProps } from './shellHarness';

// holdCrop: 다음 크롭을 붙잡아 isCropping(busy) 창을 관측 가능하게 한다. releaseCrop으로 푼다.
let cropN = 0;
let holdCrop = false;
let releaseCrop: (() => void) | null = null;
// failCrop: getCroppedImg를 던지게 한다 — usePosterCrop.complete가 false를 돌려주는 실패 분기
// (canvas/SVG 오류)를 재현한다. #727에서 그 분기가 문서를 건드리면 안 된다는 계약이 생겼다.
let failCrop = false;
// 스프레드 스냅샷 + afterAll 복원(#611·#618) — `require()`가 주는 건 살아있는 네임스페이스라
// mock.module이 그 객체를 제자리에서 갈아끼운다. 복사본으로 떠 둬야 복원이 진짜 복원이 된다.
// 안 되돌리면 이 getCroppedImg 스텁이 프로세스 끝까지 남아, 같은 모듈을 쓰는 뒤 파일이
// 실제 canvas 크롭 대신 `blob:cropped-N` 문자열을 받는다.
const realImageCrop = { ...require('@/utils/imageCrop') };
mock.module('@/utils/imageCrop', () => ({
  ...realImageCrop,
  getCroppedImg: () =>
    new Promise<string>((resolve, reject) => {
      if (failCrop) {
        reject(new Error('canvas unavailable (mock)'));
        return;
      }
      const url = `blob:cropped-${++cropN}`;
      if (holdCrop) releaseCrop = () => resolve(url);
      else resolve(url);
    }),
}));

const { usePhototicket } = require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');
const { MobileEditorShell } = require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');

// 포스터 전용 파일 input — OcrUploadCard의 image/* input, 사진 모드 로고 행 input(accept에 jpeg 포함)과 구분한다.
const posterFileInput = () => document.querySelector('input[type="file"][aria-label="포스터 이미지 파일"]') as HTMLInputElement;
const pngFile = (name: string) => new File([name], name, { type: 'image/png' });
const cropDialog = () => screen.queryByRole('dialog', { name: '포스터 자르기' });
/** 모달이 지금 어느 원본을 가리키는지. 티켓 프리뷰의 <img>와 안 섞이게 다이얼로그 안에서만 찾는다. */
const cropSrc = () => document.querySelector('[role="dialog"] img')?.getAttribute('src') ?? null;
// 교체 · 재크롭은 메뉴가 아니라 도크 사진 모드의 포스터 행에 있다(#826 S2, constraint-3) — 버튼 이름은 '교체' · '자르기'.
const posterRow = () => within(document.querySelector('[data-asset-row="포스터"]') as HTMLElement);
const recropButton = () => posterRow().getByRole('button', { name: '자르기' }) as HTMLButtonElement;

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
  await screen.findByRole('dialog', { name: '포스터 자르기' });
  loadImage();
  await user.click(screen.getByRole('button', { name: '적용' }));
}

/** 파일 선택 → 모달 취소. */
async function pickAndCancel(user: ReturnType<typeof userEvent.setup>, name: string) {
  fireEvent.change(posterFileInput(), { target: { files: [pngFile(name)] } });
  await screen.findByRole('dialog', { name: '포스터 자르기' });
  await user.click(screen.getByRole('button', { name: '닫기' }));
}

function MobileHarness({ onPhoto }: { onPhoto?: (p: ReturnType<typeof usePhototicket>) => void } = {}) {
  const photo = usePhototicket();
  onPhoto?.(photo);
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

/** 포스터 행은 도크 사진 모드에 있다 — 그 모드 탭을 눌러 연다. */
const openMenu = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('tab', { name: '사진' }));
const uploadCta = () => screen.getByRole('button', { name: /포스터 업로드/ });

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  cropN = 0;
  holdCrop = false;
  releaseCrop = null;
  failCrop = false;
  mock.restore(); // mock()/spyOn()만 되돌린다 — 모듈 mock은 아래 afterAll이 따로 푼다.
});

afterAll(() => {
  mock.module('@/utils/imageCrop', () => realImageCrop);
});

/**
 * 랜딩 이탈이 걸리는 시점(#727 c2) — 다섯 이탈 중 포스터 축은 **크롭 확정**에 붙는다. 파일 선택
 * (c4)도, 크롭 취소도, 크롭 실패도 아니다. 이 셋을 갈라 재지 않으면 "언제 걷히나"가 통째로
 * 검증 밖으로 나간다 — landingOverlay는 파일 선택까지만, 위 상태머신 describe는 원본 수명만 본다.
 *
 * 실패 분기가 특히 중요하다: 문서 리셋을 크롭 **전**에 걸면 실패 토스트 뒤에 랜딩은 그대로인데
 * 복원된 문서만 비어, "이어서 만들기"가 빈 편집 화면을 열고 그 첫 편집이 멀쩡한 저장분을 덮는다.
 */
describe('랜딩 이탈은 크롭 확정에만 걸린다 (#727 c2)', () => {
  const STORAGE_KEY = 'filme:phototicket:v1';
  const landing = () => screen.getByTestId('landing');
  const seedDraft = () =>
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ movieInfo: { title: '인터스텔라' } })
    );

  test('크롭 확정이 랜딩을 걷고, 복원된 문서는 새 문서로 되돌아간다', async () => {
    seedDraft();
    const user = userEvent.setup();
    render(<MobileHarness />);
    expect(landing().classList.contains('fixed')).toBe(true);

    await user.click(uploadCta());
    await pickAndApply(user, 'a.png');

    expect(landing().classList.contains('hidden')).toBe(true);
    // 새 문서다 — 옛 draft의 제목이 안 따라온다. 저장분은 그대로 살아 있다(c7).
    expect(document.body.textContent).not.toContain('인터스텔라');
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('인터스텔라');
  });

  test('크롭이 실패하면 랜딩도 복원된 문서도 손대지 않는다', async () => {
    seedDraft();
    failCrop = true;
    const user = userEvent.setup();
    render(<MobileHarness />);

    await user.click(uploadCta());
    await pickAndApply(user, 'a.png');

    // 모달은 열린 채로 남아 재시도 가능하고, 랜딩은 오버레이 그대로다.
    expect(!!cropDialog()).toBe(true);
    expect(landing().classList.contains('fixed')).toBe(true);
    // 복원된 문서가 살아 있다 — 복원 행 라벨이 제목을 그대로 싣고 있는 게 근거다.
    expect(screen.getByTestId('landing-restore').textContent).toContain('인터스텔라');
  });

  test('크롭을 취소해도 랜딩은 오버레이 그대로다', async () => {
    seedDraft();
    const user = userEvent.setup();
    render(<MobileHarness />);

    await user.click(uploadCta());
    await pickAndCancel(user, 'a.png');

    expect(landing().classList.contains('fixed')).toBe(true);
    expect(screen.getByTestId('landing-restore').textContent).toContain('인터스텔라');
  });
});

describe('포스터 크롭 상태머신 (#182 PR #191 · #315, 실제 파일-선택 경로)', () => {
  test('첫 업로드 후 사진 모드 자르기가 활성화된다', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    await user.click(uploadCta());
    await pickAndApply(user, 'a.png');

    await openMenu(user);
    expect(recropButton().disabled).toBe(false);
  });

  test('교체 후 취소 → 직전 원본이 그대로 남아 재크롭도 계속 활성 (#826 S6 constraint-18)', async () => {
    const user = userEvent.setup();
    let photo!: ReturnType<typeof usePhototicket>;
    render(<MobileHarness onPhoto={(p) => { photo = p; }} />);

    await user.click(uploadCta());
    await pickAndApply(user, 'a.png');
    const first = photo.posterCrop.originalSrc!;

    // 교체: 새 파일을 고른 뒤 취소 — 새 파일은 '적용'으로 확정되기 전이라 직전 포스터의 원본은 안 풀린다.
    // (옛 구조는 교체 파일을 고르는 즉시 직전 원본을 revoke해 취소 뒤 재크롭을 막았다.)
    await openMenu(user);
    await user.click(posterRow().getByRole('button', { name: '교체' }));
    await pickAndCancel(user, 'b.png');

    expect(photo.posterCrop.originalSrc).toBe(first);
    await openMenu(user);
    expect(recropButton().disabled).toBe(false);
  });

  test('재크롭 취소는 원본을 유지한다 (재크롭 계속 활성)', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    await user.click(uploadCta());
    await pickAndApply(user, 'a.png');

    await openMenu(user);
    await user.click(recropButton());
    await screen.findByRole('dialog', { name: '포스터 자르기' });
    await user.click(screen.getByRole('button', { name: '닫기' }));

    await openMenu(user);
    expect(recropButton().disabled).toBe(false);
  });

  test('첫 업로드 취소 → 프리뷰 없음(원본 폐기)', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    await user.click(uploadCta());
    await pickAndCancel(user, 'a.png');

    // 포스터가 없으면 셸은 업로드 CTA로 되돌아간다 — #614 이후 그 CTA는 랜딩의 것이고, 크롭을
    // 취소하면 오버레이가 다시 덮인다(파생 showLanding). 사진 모드의 자르기도 그대로 게이팅.
    expect(uploadCta()).toBeTruthy();
    // CTA는 overlay·inline 양쪽에 다 있으므로 존재만으로는 "덮였다"를 못 잰다 — landingOverlay와
    // 같이 fixed 여부로 판정한다(PR #622 claude-review P1).
    expect(screen.getByTestId('landing').classList.contains('fixed')).toBe(true);
    await openMenu(user);
    expect(posterRow().queryByRole('button', { name: '자르기' }) === null).toBe(true);
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
    await screen.findByRole('dialog', { name: '포스터 자르기' });
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

  // 원본 blob의 단일 소유자가 usePosterCrop의 revoke effect라는 것 — 교체가 '적용'으로 확정될 때
  // 직전 원본이 정확히 한 번 풀려야 한다(#826 S6 constraint-18: 새 파일을 고른 시점엔 안 풀린다).
  // 이 어서션이 없으면 아래 saveDraft의 not.toContain이 스파이가 아무것도 안 잡는 상태에서도
  // 통과하는 헛 어서션이 된다.
  test('교체를 적용하면 직전 원본이 revoke된다 (단일 소유자) — 새 파일을 고른 시점엔 아직 아니다', async () => {
    const revoke = spyOn(URL, 'revokeObjectURL');
    const user = userEvent.setup();
    let photo!: ReturnType<typeof usePhototicket>;
    render(<MobileHarness onPhoto={(p) => { photo = p; }} />);

    await user.click(uploadCta());
    await pickAndApply(user, 'a.png');
    const first = photo.posterCrop.originalSrc!;
    expect(revoke.mock.calls.flat()).not.toContain(first);

    await openMenu(user);
    await user.click(posterRow().getByRole('button', { name: '교체' }));
    fireEvent.change(posterFileInput(), { target: { files: [pngFile('b.png')] } });
    await screen.findByRole('dialog', { name: '포스터 자르기' });
    expect(revoke.mock.calls.flat()).not.toContain(first);

    loadImage();
    await user.click(screen.getByRole('button', { name: '적용' }));
    expect(revoke.mock.calls.flat().filter((u) => u === first)).toHaveLength(1);
    expect(photo.posterCrop.originalSrc).not.toBe(first);
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
    expect(cropDialog() === null).toBe(true);
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

// 드롭 업로드(#607)는 #826 S5에서 걷었다(D18-2, 소유자 결정 2026-11-22: 모바일에서 지원 안 되는 기능 제거,
// trace l_drop) — 포스터는 사진 모드와 랜딩 업로드 버튼으로만 넣는다. 이 묶음은 그 기능의 이름을 그대로 두고
// 드롭이 아무 일도 안 한다는 부재를 잰다(#826 S5 constraint-18).
describe('드롭으로 포스터 업로드 (#607)', () => {
  // 반환값은 기본 동작이 살아 있는지다 — 막지 않으면 브라우저가 떨어뜨린 파일로 이동해 편집이 날아간다(code-review).
  const drop = (el: Element) => {
    const notPrevented = fireEvent.drop(el, { dataTransfer: { files: [pngFile('dropped.png')] } });
    expect(notPrevented).toBe(false);
  };

  test('랜딩(업로드 버튼 · 랜딩 루트)에 이미지를 드롭해도 크롭 모달이 안 열린다', () => {
    render(<MobileHarness />);

    drop(uploadCta());
    drop(screen.getByTestId('landing'));

    expect(cropDialog() === null).toBe(true);
  });

  test('편집 캔버스 어디에 드롭해도 크롭 모달이 안 열린다', () => {
    render(<MobileHarness />);
    fireEvent.click(screen.getByTestId('landing-skip-poster'));

    // 옛 드롭 핸들러는 캔버스 스테이지 div에 걸려 있었다 — React는 루트에서 위임하므로 그 스테이지 안 프리뷰 래퍼에
    // 쏘면 스테이지 · 셸 · 루트까지 버블링 경로 전체를 밟는다.
    const preview = document.querySelector('div.relative.mx-auto.block.rounded-card');
    expect(preview === null).toBe(false);
    drop(preview!);

    expect(cropDialog() === null).toBe(true);
  });
});

describe('키보드 전용 포스터 업로드 경로 (#608)', () => {
  test('Tab + Enter만으로 업로드 → 크롭 → 적용까지 완주한다', async () => {
    const user = userEvent.setup();
    let photo!: ReturnType<typeof usePhototicket>;
    render(<MobileHarness onPhoto={(p) => { photo = p; }} />);

    // ① 드롭존까지 Tab으로 도달 + Enter가 파일 선택을 실제로 연다.
    await tabTo(user, uploadCta(), '포스터 업로드');
    const openFileDialog = spyOn(posterFileInput(), 'click');
    await user.keyboard('{Enter}');
    expect(openFileDialog).toHaveBeenCalledTimes(1);

    // ② 파일 선택(OS 대화상자는 어느 환경에서도 스크립트 불가) → 크롭 모달.
    fireEvent.change(posterFileInput(), { target: { files: [pngFile('p.png')] } });
    await screen.findByRole('dialog', { name: '포스터 자르기' });
    loadImage();

    // ③ 모달 안에서도 Tab으로 '적용'까지 가고 Enter로 확정된다(포커스 트랩 안이라 밖으로 안 샌다).
    const apply = screen.getByRole('button', { name: '적용' }) as HTMLButtonElement;
    expect(apply.disabled).toBe(false);
    await tabTo(user, apply, '적용');
    await user.keyboard('{Enter}');

    expect(photo.state.croppedImageUrl).toBe('blob:cropped-1');
    expect(cropDialog() === null).toBe(true);
  });

  test('포스터가 있는 상태의 교체도 도크 사진 모드에서 키보드로 열린다(#826 S2, 옛 헤더 메뉴 행)', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);
    await pickAndApply(user, 'p.png');

    // 모드 바는 APG tabs라 탭 하나만 Tab 정지점이다 — 사진 모드는 클릭으로 열고 그 안 버튼을 키보드로 연다.
    await user.click(screen.getByRole('tab', { name: '사진' }));
    const replace = posterRow().getByRole('button', { name: '교체' });
    const openFileDialog = spyOn(posterFileInput(), 'click');
    await tabTo(user, replace, '교체');
    await user.keyboard('{Enter}');
    expect(openFileDialog).toHaveBeenCalledTimes(1);
  });
});
