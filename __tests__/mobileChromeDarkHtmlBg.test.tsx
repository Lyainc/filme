/**
 * #402→#415 회귀 테스트 — 모바일 셸 html 배경 동기화.
 *
 * .chrome-dark는 셸 내부 div 스코프라 documentElement(html) 자신의 배경(--bg)까진 CSS 변수
 * 상속이 안 닿는다(상속은 자손 방향으로만). MobileEditorShell이 theme를 그대로 따르게 되며(#415)
 * html의 기존 .theme-dark 동기화만으로 편집 셸과는 항상 맞아떨어져, showMobile 기준 무조건
 * forcing은 필요 없어졌다(오히려 라이트 테마에서 셸은 라이트인데 html만 다크가 되는 역전 회귀를
 * 만든다). documentElement.chrome-dark forcing은 여전히 다크인 ResultStage(#357, theme 무관)가
 * 떠 있을 때만 필요 — 라이트 테마에서 그 화면을 볼 때 iOS 탄성 스크롤·100dvh 재계산 순간 밝은
 * html 배경이 다크 크롬 위로 노출되는 걸 막는다(원 #402 재현 조건).
 *
 * resultOpen===true 경로(claude-review PR #426 P1 지적) — index.tsx:89의
 * `showMobile && resultOpen` 중 resultOpen 절이 실제로 켜지는 코드 경로는 편집 완료("완료" 탭)
 * 뒤 ResultStage가 뜨는 흐름뿐이라, 그걸 타야 이 effect의 진짜 목적(라이트 테마에서 결과화면
 * 진입 시 배경 매치)이 검증된다. ImageCropModal(canvas)만 mock — mobileEditorShellPosterCropPipeline
 * .test.tsx와 동일 패턴(공유 훅인 usePhototicket은 mock하지 않음, #179 bun mock.module 전역 누수 회피).
 * localStorage에 title/titleOg/releaseDate를 미리 심어 canExport를 채우고, 실제 파일 input +
 * mock 크롭 모달로 포스터만 업로드해 "완료" 탭까지 실제 UI 경로로 돈다.
 */
import { describe, expect, test, afterEach, beforeEach, mock } from 'bun:test';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
  getCroppedImg: () => Promise.resolve('blob:cropped-result'),
}));

const Home = (require('@/pages/index') as { default: typeof import('@/pages/index').default })
  .default;

function setViewportWidth(width: number) {
  window.innerWidth = width;
}

const posterFileInput = () =>
  document.querySelector('input[type="file"][accept*="jpeg"]') as HTMLInputElement;
const pngFile = (name: string) => new File([name], name, { type: 'image/png' });

// canExport(hasPoster·title·titleOg·releaseDate)를 채워 "완료" 탭이 실제로 onDone까지 도달하게 한다.
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

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('chrome-dark', 'theme-dark');
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.classList.remove('chrome-dark', 'theme-dark');
});

describe('모바일 셸 html 배경 동기화 (#402→#415)', () => {
  test('모바일 + 라이트 테마(기본): documentElement에 chrome-dark 미적용 — 셸도 라이트라 매치', () => {
    setViewportWidth(500);
    render(<Home />);
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(false);
  });

  test('모바일 + 다크 테마: documentElement에 theme-dark 적용(기존 테마 동기화, chrome-dark forcing 불필요)', () => {
    setViewportWidth(500);
    // _document.tsx의 FOUC 스크립트가 이미 얹어놨을 상태를 시뮬레이트 — Home의 mount effect가
    // 이 클래스를 읽어 theme state를 'dark'로 확정한다.
    document.documentElement.classList.add('theme-dark');
    render(<Home />);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(false);
  });

  test('데스크톱 렌더 시엔 documentElement에 chrome-dark 미적용', () => {
    setViewportWidth(1200);
    render(<Home />);
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(false);
  });

  test('모바일 + 라이트 테마 + 결과화면(resultOpen) 진입: documentElement에 chrome-dark 적용', async () => {
    setViewportWidth(500);
    seedExportableDraft();
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole('button', { name: /포스터 업로드/ }));
    fireEvent.change(posterFileInput(), { target: { files: [pngFile('poster.png')] } });
    await user.click(await screen.findByText('mock-apply'));

    expect(document.documentElement.classList.contains('chrome-dark')).toBe(false);

    await user.click(await screen.findByRole('button', { name: '완료' }));

    expect(document.documentElement.classList.contains('chrome-dark')).toBe(true);
  });

  test('unmount(페이지 이동) 시 chrome-dark cleanup', async () => {
    setViewportWidth(500);
    seedExportableDraft();
    const user = userEvent.setup();
    const { unmount } = render(<Home />);

    await user.click(screen.getByRole('button', { name: /포스터 업로드/ }));
    fireEvent.change(posterFileInput(), { target: { files: [pngFile('poster.png')] } });
    await user.click(await screen.findByText('mock-apply'));
    await user.click(await screen.findByRole('button', { name: '완료' }));
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(true);

    unmount();
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(false);
  });
});
