/**
 * #492 회귀 테스트 — 데스크톱 DESIGN '크기' 섹션의 재크롭이 셸을 통째로 지나서 실제로 동작하는가.
 *
 * designRailPosterSize.test.tsx는 leaf(DesignRail·DesktopDesignPanel)에 콜백을 직접 주입해
 * 버튼→콜백 배선만 본다. 그 사이에 있는 진짜 취약한 구간 — ImageUploader가 올려준 트리거를
 * DesktopStudioShell이 state에 담아 DESIGN 패널에 내려주는 왕복 — 은 아무도 안 밟는다.
 * 예를 들어 `setRecropPoster(recrop)`처럼 `() => fn` 감싸기를 빠뜨리면 React가 콜백을 업데이터로
 * 오해해 **업로드 직후 크롭 모달이 저절로 열리고** 버튼은 영영 안 뜨는데, 그래도 나머지 테스트는
 * 전부 초록이다. 이 파일이 그 구간을 밟는다.
 *
 * 추가로 탭·줌 왕복이 크롭 원본을 안 죽이는지도 같이 못 박는다 — 조건부 마운트였을 땐
 * ImageUploader의 unmount cleanup이 objectURL을 revoke해 재크롭이 조용히 사라졌다.
 *
 * ImageCropModal은 **실물을 쓴다**(logoCropFreeAspect.test.tsx와 동일) — mock으로 갈면 bun의
 * mock.module이 파일 간 격리가 안 돼서 뒤에 도는 그 파일이 스텁을 받아 깨진다(실측). 대신
 * 실물 모달을 태우기 위한 <img> 자연 크기 스텁 + load 이벤트 관용구를 그 파일에서 그대로 가져오고,
 * canvas에 의존하는 getCroppedImg만 mock한다(imageUploaderRecrop.test.tsx 등과 동일 shape).
 */
import { describe, expect, test, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desktopShellProps } from './shellHarness';

let cropN = 0;
mock.module('@/utils/imageCrop', () => ({
  getCroppedImg: () => Promise.resolve(`blob:cropped-${++cropN}`),
}));

const { usePhototicket } = require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');
const { DesktopStudioShell } = require('@/components/v2/DesktopStudioShell') as typeof import('@/components/v2/DesktopStudioShell');

function Harness() {
  const photo = usePhototicket();
  return <DesktopStudioShell {...desktopShellProps(photo)} />;
}

// 포스터 전용 파일 input(accept에 jpeg 포함) — OcrUploadCard의 image/* input과 구분.
const posterFileInput = () =>
  document.querySelector('input[type="file"][accept*="jpeg"]') as HTMLInputElement;
const pngFile = (name: string) => new File([name], name, { type: 'image/png' });

const RECROP_LABEL = '포스터 다시 크롭';
const recropButton = () => screen.queryByRole('button', { name: RECROP_LABEL });
const cropDialog = () => screen.queryByRole('dialog', { name: '포스터 크롭' });

/** 실물 크롭 모달의 onImageLoad(mediaAspect 계산 → 크롭 초기화)를 태운다. */
function loadImage(naturalWidth: number, naturalHeight: number) {
  const img = document.querySelector('img') as HTMLImageElement;
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: naturalHeight, configurable: true });
  Object.defineProperty(img, 'width', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'height', { value: naturalHeight, configurable: true });
  fireEvent.load(img);
}

/** 파일 선택 → 크롭 적용까지. 이후 photo에 포스터 + 크롭 원본이 모두 서 있다. */
async function uploadPoster(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(posterFileInput(), { target: { files: [pngFile('p.png')] } });
  await screen.findByRole('dialog', { name: '포스터 크롭' });
  loadImage(2000, 3000);
  await user.click(screen.getByRole('button', { name: '적용' }));
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  cropN = 0;
});

describe('DesktopStudioShell DESIGN 크기 재크롭 배선 (#492)', () => {
  test('업로드 → DESIGN 탭 → "포스터 다시 크롭"이 크롭 모달을 다시 연다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await uploadPoster(user);
    // 적용 직후 모달은 닫혀 있어야 한다 — 여기서 열려 있으면 트리거가 렌더 중에 불린 것이다.
    expect(cropDialog()).toBeNull();

    await user.click(screen.getByRole('button', { name: 'DESIGN' }));
    const button = recropButton();
    expect(button).not.toBeNull();

    await user.click(button!);
    expect(cropDialog()).not.toBeNull();
  });

  test('포스터 전이면 버튼이 없다 — 죽은 컨트롤 방지', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'DESIGN' }));
    expect(recropButton()).toBeNull();
  });

  test('탭·줌 왕복이 크롭 원본을 죽이지 않는다 (조건부 마운트 회귀)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await uploadPoster(user);

    // INFO를 들렀다 DESIGN으로: POSTER 패널이 언마운트되면 원본이 revoke돼 버튼이 사라진다.
    await user.click(screen.getByRole('button', { name: 'INFO' }));
    await user.click(screen.getByRole('button', { name: 'DESIGN' }));
    expect(recropButton()).not.toBeNull();

    // 최대화 왕복도 같은 함정 — 인스펙터(aside)째 언마운트되면 ImageUploader가 같이 죽는다.
    await user.click(screen.getByRole('button', { name: '최대화' }));
    await user.click(screen.getByRole('button', { name: '기본' }));
    expect(recropButton()).not.toBeNull();
  });
});
