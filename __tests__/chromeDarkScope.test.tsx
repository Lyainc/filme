/**
 * #353→#363 회귀 테스트 — 앰비언트 다크 크롬 스코프.
 *
 * 원래(#353) 포스터 유무로 토글했지만, 랜딩 톤앤매너 통일(#363)로 셸 루트의 .chrome-dark
 * 스코프(토큰 로컬 재정의)와 앰비언트 배경이 상시 켜진다. 스코프 클래스가 빠지면 라이트
 * 테마에서 앰비언트 다크 배경 위에 라이트 토큰(흰 알약·대비 역전)이 얹히는 회귀라 이 배선이 핵심.
 * 렌더 패턴은 mobileEditorShellFieldCoverage.test.tsx 미러(모듈 mock 없음).
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { ResultStage } from '@/components/v2/ResultStage';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed
      </button>
      <MobileEditorShell
        photo={photo}
        canExport
        theme="light"
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

describe('앰비언트 다크 크롬 스코프 (#353→#363 상시)', () => {
  test('포스터 없음(랜딩)에도 chrome-dark + 앰비언트 상시 표시', () => {
    render(<Harness />);
    const ambient = screen.getByTestId('chrome-ambient');
    // 인라인 opacity 토글 없음 — 항상 보인다(#363 톤앤매너 통일).
    expect(ambient.style.opacity).toBe('');
    expect((ambient.parentElement as HTMLElement).classList.contains('chrome-dark')).toBe(true);
  });

  test('포스터 업로드 후에도 동일 — chrome-dark + 앰비언트 유지', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    const ambient = screen.getByTestId('chrome-ambient');
    expect(ambient.style.opacity).toBe('');
    expect((ambient.parentElement as HTMLElement).classList.contains('chrome-dark')).toBe(true);
  });
});

// 결과화면 톤(#357) — ResultStage는 항상 포스터가 있는 화면이라 chrome-dark + 앰비언트가
// 조건 없이 상시 on이어야 한다. 스코프가 빠지면 라이트 테마에서 다크 앰비언트 위에 라이트
// 토큰이 얹히는 #353과 동일 계열의 회귀.
function ResultHarness() {
  const photo = usePhototicket();
  return (
    <ResultStage
      theme="light"
      onBack={() => {}}
      croppedImageUrl="blob:test-poster"
      movieInfo={photo.state.movieInfo}
      components={photo.state.components}
      fieldVisibility={photo.state.fieldVisibility}
    />
  );
}

describe('ResultStage 결과화면 톤 (#357)', () => {
  test('루트에 chrome-dark 상시 적용 + 앰비언트 상시 표시', () => {
    render(<ResultHarness />);
    // testid는 편집 셸과 분리(result-ambient) — resultOpen 시 둘이 동시 마운트라 중복 방지.
    const ambient = screen.getByTestId('result-ambient');
    // 편집 셸과 달리 opacity 토글 없음 — 인라인 opacity를 걸지 않아 항상 보인다.
    expect(ambient.style.opacity).toBe('');
    expect((ambient.parentElement as HTMLElement).classList.contains('chrome-dark')).toBe(true);
  });

  // PR #362 리뷰 P2 — dock을 조건부 unmount로 숨기면 DesignRail의 pop(열린 패널) state가
  // 최대화 왕복마다 리셋된다(#297 P1과 동일 패턴). hidden 토글 + 항상 마운트를 고정한다.
  test('편집 셸: max 전환에도 dock(DesignRail)은 마운트 유지', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    // 최대화(플로팅 툴바) 진입 후에도 dock 탭이 DOM에 남아 있어야 한다(hidden일 뿐).
    fireEvent.click(screen.getByRole('button', { name: '최대화' }));
    expect(screen.getByRole('button', { name: '무드', hidden: true })).toBeTruthy();
  });
});
