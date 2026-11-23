/**
 * #669 → #826 S2 → #826 S7 회귀 테스트 — 결과 화면(ResultStage)엔 워드마크 진입점이 없다.
 *
 * #826 S7(D11 A · D21-1 A)이 결과 화면 위 줄에서 워드마크 자체를 걷었다(위 줄은 ‹ 하나). 아래 원문의 "워드마크는 버튼이
 * 아니다"는 이제 "워드마크가 없다"로 강해졌고, 초기화 진입점(confirm)이 결과 화면에 되살아나지 않았음을 같이 잠근다.
 *
 * #669가 결과 화면 워드마크를 초기화 진입점으로 만들었으나(워드마크 탭 → window.confirm → 초기화), #826 S2가 워드마크 탭
 * 초기화를 통째로 걷었다(Seed constraint-7, 소유자 D05/D08). 지금 지우는 길은 편집 메뉴 초기화 2탭뿐이다. 이 테스트는
 * 그 제거를 잠근다: 워드마크는 버튼이 아니고(역할 · 키보드 진입 없음), 눌러도 confirm이 안 뜨고 아무 일도 없다.
 */
import { describe, expect, test, afterAll, afterEach, beforeEach, mock, spyOn } from 'bun:test';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// 스냅샷은 mock.module보다 먼저, 스프레드로(#611) — mobileChromeDarkHtmlBg.test.tsx와 동일 패턴.
const realImageCropModal = { ...require('@/components/ImageCropModal') };
const realImageCrop = { ...require('@/utils/imageCrop') };
afterAll(() => {
  mock.module('@/components/ImageCropModal', () => realImageCropModal);
  mock.module('@/utils/imageCrop', () => realImageCrop);
});

mock.module('@/components/ImageCropModal', () => ({
  default: ({
    imageSrc,
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
    </div>
  ),
}));

mock.module('@/utils/imageCrop', () => ({
  ...realImageCrop,
  getCroppedImg: () => Promise.resolve('blob:cropped-result'),
}));

const Home = (require('@/pages/index') as { default: typeof import('@/pages/index').default })
  .default;

const posterFileInput = () =>
  document.querySelector('input[type="file"][accept*="jpeg"]') as HTMLInputElement;
const pngFile = (name: string) => new File([name], name, { type: 'image/png' });
// MobileEditorShell은 결과화면 진입 후에도 hidden으로 계속 마운트돼 있어(#297) 같은 이름의
// 요소가 DOM에 여럿 있을 수 있다 — result-ambient(ResultStage 전용 testid)의 부모로 스코프를 좁혀 결과화면 쪽만 집는다.
const resultStage = () => within(screen.getByTestId('result-ambient').parentElement!);

function seedExportableDraft() {
  window.localStorage.setItem(
    'filme:phototicket:v1',
    JSON.stringify({
      movieInfo: { title: 'TITLE', titleOg: 'TITLE_OG', releaseDate: '2026-01-01' },
      components: {},
      fieldVisibility: {},
    })
  );
}

async function enterResultStage(user: ReturnType<typeof userEvent.setup>) {
  seedExportableDraft();
  render(<Home />);
  // 재방문자는 랜딩에서 "이어서 만들기"로 draft를 이어받는다(#727 c5) — 나머지 네 진입 경로는
  // "새로 시작"이라 문서를 새 문서로 되돌려(c7) 완료 게이트가 요구하는 title·titleOg·releaseDate가
  // 사라진다. 여기서 재려는 건 워드마크 초기화 배선이지 진입 경로가 아니므로 draft를 이어받는다.
  await user.click(screen.getByTestId('landing-restore'));
  // 랜딩을 떠난 뒤의 포스터 진입점은 헤더 메뉴 '포스터 추가' 한 곳이다(#674) — 그 경로가 여는
  // input이 이것이라, 여기선 파일 선택만 직접 일으킨다(진입점 자체는 다른 스위트가 잠근다).
  fireEvent.change(posterFileInput(), { target: { files: [pngFile('poster.png')] } });
  await user.click(await screen.findByText('mock-apply'));
  await user.click(await screen.findByRole('button', { name: '완료' }));
  await screen.findByTestId('result-ambient'); // ResultStage 진입 확인
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  mock.restore();
});

describe('ResultStage에 워드마크 진입점이 없다 (#826 S2 → S7)', () => {
  test('워드마크 제목 · 버튼이 없고, 결과 화면 어디를 눌러도 confirm이 없다', async () => {
    const user = userEvent.setup();
    await enterResultStage(user);
    const confirmSpy = spyOn(window, 'confirm');

    expect(resultStage().queryByRole('button', { name: 'FILME — 처음 화면으로 돌아가기' }) === null).toBe(true);
    expect(resultStage().queryByRole('heading', { name: 'FILME' }) === null).toBe(true);
    // 티켓 무드 안에도 FILME 라벨이 있으니 위 줄로 좁힌다.
    expect(within(screen.getByTestId('result-topbar')).queryByLabelText('FILME') === null).toBe(true);
    await user.click(screen.getByTestId('result-topbar'));
    await user.keyboard('{Enter}');

    expect(confirmSpy).not.toHaveBeenCalled();
    // 결과화면 그대로 — 뒤로가기 버튼(ResultStage 전용 진입점)이 여전히 있고 랜딩은 안 뜬다.
    expect(screen.getByRole('button', { name: '편집으로 돌아가기' })).toBeTruthy();
    expect(screen.getByTestId('landing').classList.contains('fixed')).toBe(false);
  });
});
