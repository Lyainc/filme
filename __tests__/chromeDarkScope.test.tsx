/**
 * #353→#363→#415 회귀 테스트 — 앰비언트 다크 크롬 스코프.
 *
 * 원래(#353) 포스터 유무로 토글, 랜딩 톤앤매너 통일(#363)로 theme 무관 상시 다크가 됐었지만
 * 그 결과 다크모드 토글이 죽은 컨트롤이 돼(#415) theme==='dark'일 때만 셸 루트 .chrome-dark
 * 스코프(토큰 로컬 재정의) + 앰비언트 배경이 켜지는 것으로 되돌렸다. 라이트 테마에선 데스크톱과
 * 톤을 맞춰(#415 권장) 앰비언트를 아예 렌더하지 않고 app-canvas의 --bg 그대로 노출한다.
 * 렌더 패턴은 mobileEditorShellFieldCoverage.test.tsx 미러(모듈 mock 없음).
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { ResultStage } from '@/components/v2/ResultStage';

function Harness({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed
      </button>
      <MobileEditorShell
        photo={photo}
        canExport
        theme={theme}
        themePreference="light"
        onThemeChange={() => {}}
        onDone={() => {}}
        disabledReason=""
        previewMovieInfo={photo.state.movieInfo}
        previewComponents={{ ...photo.state.components, layout: 'stub' }}
        fieldVisibility={photo.state.fieldVisibility}
      />
    </>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('앰비언트 다크 크롬 스코프 — theme 바인딩 (#415)', () => {
  test('라이트 테마: chrome-dark 미적용 + 앰비언트 미렌더(데스크톱과 동일 톤)', () => {
    render(<Harness theme="light" />);
    expect(screen.queryByTestId('chrome-ambient') === null).toBe(true);
    const canvas = document.querySelector('.app-canvas') as HTMLElement;
    expect(canvas.classList.contains('chrome-dark')).toBe(false);
  });

  test('다크 테마: chrome-dark 적용 + 앰비언트 표시(포스터 유무 무관)', () => {
    render(<Harness theme="dark" />);
    const ambient = screen.getByTestId('chrome-ambient');
    expect(ambient.style.opacity).toBe('');
    // 앰비언트 직계 부모가 아니라 셸 루트(.app-canvas)를 찾는다 — #685가 헤더/본문/dock/툴바를
    // display:contents 래퍼(APP_BACKGROUND_ID)로 한 겹 더 감싸 앰비언트의 바로 위 부모가
    // app-canvas 자신이 아니게 됐다(시각·클래스 상속에는 영향 없음, 순수 inert 타깃용).
    expect(ambient.closest('.chrome-dark')).not.toBeNull();
  });

  test('다크 테마 + 포스터 업로드 후에도 동일 유지', () => {
    render(<Harness theme="dark" />);
    fireEvent.click(screen.getByText('seed'));
    const ambient = screen.getByTestId('chrome-ambient');
    expect(ambient.closest('.chrome-dark')).not.toBeNull();
  });
});

// 결과화면 톤(#357 → #826 S7 D21-5 A) — 결과 화면도 앱 테마를 따른다. 다크일 때만 루트가 .chrome-dark이고,
// 라이트는 라이트 토큰으로 그린다(편집 셸과 같은 규칙, #415). result-ambient는 테마와 상관없이 루트의 직계 자식으로
// 남는다 — 하네스(scripts/measure-chrome.mjs)가 그 부모로 결과 스테이지 봉쇄를 잰다.
function ResultHarness({ theme }: { theme: 'light' | 'dark' }) {
  const photo = usePhototicket();
  return (
    <ResultStage
      theme={theme}
      onBack={() => {}}
      croppedImageUrl="blob:test-poster"
      movieInfo={photo.state.movieInfo}
      components={photo.state.components}
      fieldVisibility={photo.state.fieldVisibility}
    />
  );
}

describe('ResultStage 결과화면 톤 (#826 S7 D21-5 A)', () => {
  test('라이트 테마: 루트에 chrome-dark 없음, 앰비언트는 루트의 직계 자식', () => {
    render(<ResultHarness theme="light" />);
    const ambient = screen.getByTestId('result-ambient');
    const root = ambient.parentElement as HTMLElement;
    expect(root.getAttribute('data-testid')).toBe('result-stage');
    expect(root.classList.contains('chrome-dark')).toBe(false);
    expect(ambient.style.opacity).toBe('');
  });

  test('다크 테마: 루트가 chrome-dark, 앰비언트는 루트의 직계 자식', () => {
    render(<ResultHarness theme="dark" />);
    const ambient = screen.getByTestId('result-ambient');
    const root = ambient.parentElement as HTMLElement;
    expect(root.getAttribute('data-testid')).toBe('result-stage');
    expect(root.classList.contains('chrome-dark')).toBe(true);
  });
});

describe('편집 셸 도크 마운트 유지', () => {
  // PR #362 리뷰 P2 — dock을 조건부 unmount로 숨기면 도구 선택 같은 로컬 state가 전체 보기 왕복마다
  // 리셋된다(#297 P1과 동일 패턴). hidden 토글 + 항상 마운트를 고정한다(#826 S2: 옛 DesignRail → 도크).
  test('편집 셸: max 전환에도 dock(EditorDock)은 마운트 유지', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('landing-skip-poster')); // 상단 줄은 랜딩을 떠난 뒤에 선다(#826 S2)
    fireEvent.click(screen.getByText('seed'));
    // 전체 보기(상단 줄) 진입 후에도 도크 모드 탭이 DOM에 남아 있어야 한다(hidden일 뿐).
    fireEvent.click(screen.getByRole('button', { name: '전체 보기' }));
    expect(screen.getByRole('tab', { name: '디자인', hidden: true })).toBeTruthy();
    expect(screen.getByTestId('editor-dock').classList.contains('hidden')).toBe(true);
  });
});
