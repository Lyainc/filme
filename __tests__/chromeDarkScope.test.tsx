/**
 * #353 회귀 테스트 — 앰비언트 다크 크롬 스코프.
 *
 * 포스터 유무가 셸 루트의 .chrome-dark 스코프(토큰 로컬 재정의)와 앰비언트 배경의
 * opacity 페이드를 함께 토글하는지 검증한다. 스코프 클래스가 빠지면 라이트 테마에서
 * 앰비언트 다크 배경 위에 라이트 토큰(흰 알약·대비 역전)이 얹히는 회귀라 이 배선이 핵심.
 * 렌더 패턴은 mobileEditorShellFieldCoverage.test.tsx 미러(모듈 mock 없음).
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';

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

describe('앰비언트 다크 크롬 스코프 (#353)', () => {
  test('포스터 없음 → chrome-dark 미적용 + 앰비언트 투명', () => {
    render(<Harness />);
    const ambient = screen.getByTestId('chrome-ambient');
    expect(ambient.style.opacity).toBe('0');
    expect((ambient.parentElement as HTMLElement).classList.contains('chrome-dark')).toBe(false);
  });

  test('포스터 업로드 → 루트에 chrome-dark + 앰비언트 페이드인', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    const ambient = screen.getByTestId('chrome-ambient');
    expect(ambient.style.opacity).toBe('1');
    expect((ambient.parentElement as HTMLElement).classList.contains('chrome-dark')).toBe(true);
  });
});
