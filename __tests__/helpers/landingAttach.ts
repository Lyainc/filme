/**
 * 랜딩 첨부 시트(#826 S9) 진입 헬퍼 — 편집 상태까지 가는 새 길(주 버튼 → 시트 → 행 → … → 만들기)을 한 곳에 둔다.
 * 런타임에 앱 모듈을 require하지 않는다(mock.module 등록 후 require하는 파일에서도 안전하게 import).
 * 포스터 크롭의 getCroppedImg는 각 테스트 파일이 mock한다 — 여기선 실물 크롭 모달만 태운다.
 */
import { expect } from 'bun:test';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';

export type User = ReturnType<typeof userEvent.setup>;

export const pngFile = (name = 'a.png') => new File([name], name, { type: 'image/png' });

/** OCR 카드의 숨은 파일 입력 — 셸이 마운트하는 입력 중 `image/*`는 이것 하나다. */
export function ocrFileInput(): HTMLInputElement {
  const input = (Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[]).find(
    (i) => i.getAttribute('accept') === 'image/*',
  );
  if (!input) throw new Error('OcrUploadCard file input not found');
  return input;
}

export const posterFileInput = () =>
  document.querySelector('input[type="file"][aria-label="포스터 이미지 파일"]') as HTMLInputElement;

export const attachSheet = () => screen.queryByTestId('landing-attach-sheet');

/** 실물 크롭 모달의 onImageLoad(mediaAspect 계산 → 크롭 초기화)를 태운다 — 안 하면 '적용'이 비활성. */
export function loadCropImage(naturalWidth = 2000, naturalHeight = 3000) {
  // 시트 썸네일 img와 섞이지 않게 크롭 다이얼로그 안에서만 찾는다.
  const img = screen.getByRole('dialog', { name: '포스터 자르기' }).querySelector('img') as HTMLImageElement;
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: naturalHeight, configurable: true });
  Object.defineProperty(img, 'width', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'height', { value: naturalHeight, configurable: true });
  fireEvent.load(img);
}

/** 주 버튼('티켓 스크린샷으로 자동입력')으로 시트를 연다. 이미 열려 있으면 그대로 둔다. */
export async function openAttachSheet(user: User) {
  if (!attachSheet()) await user.click(screen.getByTestId('landing-cta'));
  return screen.findByTestId('landing-attach-sheet');
}

/** 시트의 '포스터' 행 → 파일 선택 → 크롭 모달 로드까지(적용은 누르지 않는다). */
export async function pickPosterInSheet(user: User, name = 'a.png') {
  await openAttachSheet(user);
  await user.click(screen.getByTestId('landing-sheet-poster'));
  fireEvent.change(posterFileInput(), { target: { files: [pngFile(name)] } });
  await screen.findByRole('dialog', { name: '포스터 자르기' });
  loadCropImage();
}

/** 시트에서 포스터를 넣는다 — 파일 선택 → 크롭 '적용'까지. 끝나면 시트 썸네일이 선다(getCroppedImg mock 필요). */
export async function addPosterViaSheet(user: User, name = 'a.png') {
  await pickPosterInSheet(user, name);
  await user.click(screen.getByRole('button', { name: '적용' }));
  await screen.findByTestId('landing-sheet-poster-thumb');
}

/** 시트의 '티켓 스크린샷' 행 → OCR 입력에 파일을 올린다(인식은 mock runOcr가 돌려준다). */
export async function uploadScreenshotViaSheet(user: User, file = pngFile('ticket.png')) {
  await openAttachSheet(user);
  await user.click(screen.getByTestId('landing-sheet-screenshot'));
  await user.upload(ocrFileInput(), file);
}

/** 시트 '만들기' — 활성이어야 눌린다(aria-disabled면 눌러도 아무 일이 없어서 먼저 확인한다). */
export async function makeFromSheet(user: User) {
  const make = screen.getByTestId('landing-sheet-make');
  await waitFor(() => expect(make.getAttribute('aria-disabled')).toBeNull());
  await user.click(make);
}

/** 포스터만 넣고 '만들기' — 정보 모드 편집 화면. */
export async function enterWithPosterViaSheet(user: User, name = 'a.png') {
  await addPosterViaSheet(user, name);
  await makeFromSheet(user);
}

/** 스크린샷만 넣고 '만들기' — 디자인 모드 + OCR 되돌리기 배너. 인식이 끝나 시트에 '인식했어요'가 서야 만든다. */
export async function enterWithOcrViaSheet(user: User, file = pngFile('ticket.png')) {
  await uploadScreenshotViaSheet(user, file);
  await waitFor(() => expect(screen.getByTestId('landing-sheet-screenshot').textContent).toContain('인식했어요'));
  await makeFromSheet(user);
}

/** '직접 입력' — 고른 무드로 새 문서, 정보 모드(옛 '포스터 없이 직접 입력'). */
export async function enterDirect(user: User) {
  await user.click(screen.getByTestId('landing-skip-poster'));
}
