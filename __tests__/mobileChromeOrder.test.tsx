/**
 * #261 회귀 테스트 — 모바일 chrome 정보위계가 #212 시안 섹션 A 순서로 렌더되는지.
 *
 * 프리뷰 직하 chrome 순서: OCR 자동입력(최상단) → allVis(전체 표시)+ghost(빈 항목) 단일 토글 행
 * → 디자인 rail(최하단). DOM 순서를 compareDocumentPosition으로 단언한다(시각 좌표 아닌 트리 순서).
 * OcrUploadCard·DesignRail은 정적 import라 seed(포스터 업로드) 후 동기 렌더된다.
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
        onPendingFetchChange={() => {}}
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

describe('MobileEditorShell chrome 정보위계 (#261)', () => {
  test('프리뷰 직하 순서: OCR → allVis+ghost 토글 행 → 디자인 rail(최하단)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    const ocr = await screen.findByRole('button', { name: '티켓 스크린샷으로 자동 인식' });
    const allVis = screen.getByRole('switch', { name: '전체 표시' });
    const ghost = screen.getByRole('switch', { name: '빈 항목 미리보기' });
    const rail = screen.getByRole('button', { name: '무드' }); // 첫 rail 아이템

    // OCR이 최상단 → allVis·ghost 토글 행(같은 행) → rail 최하단 순.
    expect(precedes(ocr, allVis)).toBe(true);
    expect(precedes(allVis, ghost)).toBe(true);
    expect(precedes(ghost, rail)).toBe(true);
  });
});
