/**
 * #315 회귀 테스트 — MobileEditorShell 포스터 크롭 파이프라인의 실제 파일-선택 경로.
 *
 * ImageUploader.tsx의 originalSrc/pendingNewFile 상태머신(#182, __tests__/imageUploaderRecrop.test.tsx)을
 * MobileEditorShell로 그대로 포팅했는데, mobileEditorShellMenu.test.tsx는 photo.handleImageUpload를
 * 직접 호출해 시드하므로 실제 <input type="file"> 선택 → 크롭 모달 → 취소/적용 경로를 거치지 않는다
 * (claude-review PR #331 P1 지적). 이 파일은 imageUploaderRecrop.test.tsx와 동형으로 실제 파일 input을
 * 통해 교체 후 취소 → 재크롭 disabled(stale 파일 방지), 재크롭 취소 → 재크롭 유지를 검증한다.
 *
 * ImageCropModal(react-easy-crop, canvas)과 getCroppedImg(canvas)는 mock — imageUploaderRecrop.test.tsx와
 * 동일한 mock.module 패턴. MobileEditorShell 렌더 트리엔 OcrUploadCard의 파일 input도 있어
 * accept 속성으로 포스터용 input만 특정한다(포스터: jpeg/png/webp, OCR: image/*).
 */
import { describe, expect, test, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';

mock.module('@/components/ImageCropModal', () => ({
  default: ({
    imageSrc,
    onClose,
    onComplete,
  }: {
    imageSrc: string;
    onClose: () => void;
    onComplete: (a: unknown) => void;
  }) => (
    <div role="dialog">
      <span data-testid="crop-src">{imageSrc}</span>
      <button type="button" onClick={() => onComplete({ x: 0, y: 0, width: 1, height: 1 })}>
        mock-apply
      </button>
      <button type="button" onClick={onClose}>mock-cancel</button>
    </div>
  ),
}));

let cropN = 0;
mock.module('@/utils/imageCrop', () => ({
  getCroppedImg: () => Promise.resolve(`blob:cropped-${++cropN}`),
}));

const { MobileEditorShell } = require('@/components/v2/MobileEditorShell') as {
  MobileEditorShell: typeof import('@/components/v2/MobileEditorShell').MobileEditorShell;
};

function Harness() {
  const photo = usePhototicket();
  return (
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
  );
}

// 포스터 전용 파일 input(accept에 jpeg 포함) — OcrUploadCard의 image/* input과 구분.
const posterFileInput = () =>
  document.querySelector('input[type="file"][accept*="jpeg"]') as HTMLInputElement;
const pngFile = (name: string) => new File([name], name, { type: 'image/png' });

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  cropN = 0;
});

describe('MobileEditorShell 포스터 크롭 파이프라인 (#315, 실제 파일-선택 경로)', () => {
  test('첫 업로드 후 서브메뉴 재크롭이 활성화된다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: /포스터 업로드/ }));
    fireEvent.change(posterFileInput(), { target: { files: [pngFile('a.png')] } });
    await user.click(await screen.findByText('mock-apply'));

    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    expect(
      (screen.getByRole('button', { name: '재크롭' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  test('교체 후 취소 → 재크롭 disabled (stale objectURL 방지, #182와 동형)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 1. 첫 업로드 → 적용.
    await user.click(screen.getByRole('button', { name: /포스터 업로드/ }));
    fireEvent.change(posterFileInput(), { target: { files: [pngFile('a.png')] } });
    await user.click(await screen.findByText('mock-apply'));

    // 2. 서브메뉴 "포스터 교체" → 새 파일 선택 → 크롭 취소.
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(screen.getByRole('button', { name: '포스터 교체' }));
    fireEvent.change(posterFileInput(), { target: { files: [pngFile('b.png')] } });
    await user.click(await screen.findByText('mock-cancel'));

    // 3. 직전 포스터의 원본은 이미 revoke됐으므로 재크롭은 disabled여야 한다.
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    expect(
      (screen.getByRole('button', { name: '재크롭' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  test('재크롭 취소는 원본을 유지한다 (재크롭 계속 활성)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: /포스터 업로드/ }));
    fireEvent.change(posterFileInput(), { target: { files: [pngFile('a.png')] } });
    await user.click(await screen.findByText('mock-apply'));

    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(screen.getByRole('button', { name: '재크롭' }));
    await user.click(await screen.findByText('mock-cancel'));

    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    expect(
      (screen.getByRole('button', { name: '재크롭' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
