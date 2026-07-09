/**
 * #261 회귀 테스트 — 모바일 chrome 정보위계가 #212 시안 섹션 A 순서로 렌더되는지.
 * #315로 allVis(전체 표시)·ghost(빈 항목) 토글은 헤더 서브메뉴로 이전하고, Poster 드롭존은
 * 업로드 후 사라지도록 바뀌었다(#324) — 이 테스트는 남은 불변식(OCR → 디자인 rail 순서, 업로드
 * 전 Poster 드롭존 존재)만 검증하고, 토글 이전은 별도 서브메뉴 테스트로 옮긴다.
 *
 * 프리뷰 직하 chrome 순서: OCR 자동입력(최상단) → (업로드 전 Poster 드롭존) → 디자인 rail(최하단).
 * DOM 순서를 compareDocumentPosition으로 단언한다(시각 좌표 아닌 트리 순서). OcrUploadCard·
 * DesignRail은 정적 import라 렌더 즉시 존재한다.
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

/** compareDocumentPosition: DOCUMENT_POSITION_FOLLOWING(4) 비트가 서면 b가 a보다 DOM 뒤. */
function precedes(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & 4) !== 0;
}

describe('MobileEditorShell chrome 정보위계 (#261/#315)', () => {
  test('업로드 전: OCR → Poster 드롭존 → 디자인 rail(최하단)', async () => {
    render(<Harness />);

    const ocr = await screen.findByRole('button', { name: '티켓 스크린샷으로 자동 인식' });
    const poster = screen.getByText('Poster'); // 업로드 전 인라인 드롭존 섹션 eyebrow
    const rail = screen.getByRole('button', { name: '무드' }); // 첫 rail 아이템

    expect(precedes(ocr, poster)).toBe(true);
    expect(precedes(poster, rail)).toBe(true);
  });

  test('업로드 후: Poster 드롭존은 사라지고(#324) OCR → rail 순서는 유지', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    const ocr = await screen.findByRole('button', { name: '티켓 스크린샷으로 자동 인식' });
    const rail = screen.getByRole('button', { name: '무드' });

    expect(screen.queryByText('Poster')).toBeNull();
    expect(precedes(ocr, rail)).toBe(true);
  });

  test('업로드 후: 헤더 서브메뉴에서 전체표시·빈 항목·잉크·포스터 교체/재크롭 접근 가능(#315)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    await screen.findByRole('button', { name: '티켓 스크린샷으로 자동 인식' });

    fireEvent.click(screen.getByRole('button', { name: '편집 메뉴' }));

    expect(screen.getByRole('switch', { name: '전체 표시' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: '빈 항목 미리보기' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /잉크 색상 전환/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: '포스터 교체' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '재크롭' })).toBeTruthy();
  });
});
