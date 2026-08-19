/**
 * #669 회귀 테스트 — 결과 화면(ResultStage)의 워드마크도 #578과 같은 초기화 진입점이다.
 *
 * ResultStage는 usePhototicket의 photo(따라서 clearDraft)를 직접 안 받는 구조라, 초기화
 * 판정·confirm·실제 clear는 MobileEditorShell 인스턴스가 그대로 쥐고 있다(그 셸은 결과화면이
 * 열려도 언마운트되지 않고 CSS로만 숨는다, #297) — pages/index.tsx가 ref
 * (MobileEditorShellHandle.requestWordmarkReset)로 그 로직을 호출만 중계한다. 그래서 이
 * 테스트는 로직 자체(이력 판정 네 축)가 아니라 배선 — ResultStage 워드마크 탭이 실제로 그
 * 셸의 초기화를 트리거하고, 취소하면 결과화면이 그대로 유지되고, 확인하면 편집 화면(랜딩)으로
 * 돌아가는지 — 를 검증한다. 판정 로직 자체의 다섯 축은 wordmarkClearOnTap.test.tsx가 이미
 * MobileEditorShell 레벨에서 커버한다.
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
// 워드마크 버튼이 DOM에 2개(숨은 편집 셸용 + 보이는 결과화면용) 있다 — result-ambient(ResultStage
// 전용 testid)의 부모로 스코프를 좁혀 결과화면 쪽만 집는다.
const resultWordmark = () =>
  within(screen.getByTestId('result-ambient').parentElement!).getByRole('button', {
    name: 'FILME — 처음 화면으로 돌아가기',
  });

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

describe('ResultStage 워드마크 초기화 배선 (#669)', () => {
  test('작업 이력이 있는 채로 결과화면에 진입했을 때, 워드마크 탭 → confirm → 취소하면 결과화면이 유지된다', async () => {
    const user = userEvent.setup();
    await enterResultStage(user);

    const confirmSpy = spyOn(window, 'confirm').mockImplementation(() => false);
    await user.click(resultWordmark());

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // 취소했으니 결과화면 그대로 — 뒤로가기 버튼(ResultStage 전용 진입점)이 여전히 있다.
    expect(screen.getByRole('button', { name: '편집으로 돌아가기' })).toBeTruthy();
  });

  test('워드마크 탭 → confirm → 확인하면 초기화되고 편집 화면(랜딩)으로 돌아간다', async () => {
    const user = userEvent.setup();
    await enterResultStage(user);

    spyOn(window, 'confirm').mockImplementation(() => true);
    await user.click(resultWordmark());

    // ResultStage는 resultOpen=false로 언마운트되고, 편집 셸이 다시 보이며 랜딩이 뜬다
    // (초기화가 croppedImageUrl·landingDismissed·history를 전부 되돌린 증거, #614).
    expect(screen.queryByRole('button', { name: '편집으로 돌아가기' })).toBeNull();
    expect(screen.getByTestId('landing').classList.contains('fixed')).toBe(true);
  });
});
