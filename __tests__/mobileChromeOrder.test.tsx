/**
 * #261 회귀 테스트 — 모바일 chrome 정보위계.
 * #315로 allVis(전체 표시)·ghost(빈 항목) 토글은 헤더 서브메뉴로 이전하고, Poster 드롭존은
 * 업로드 후 사라지도록 바뀌었다(#324). #363 랜딩 리디자인으로 업로드 전 위계가 뒤집혔다 —
 * 드롭존이 주연(히어로), OCR은 보조 액션으로 직하(#142 위계), 디자인 rail은 CSS hidden.
 *
 * 업로드 후 프리뷰 직하 chrome 순서는 그대로: OCR 자동입력(최상단) → 디자인 rail(최하단).
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

describe('MobileEditorShell chrome 정보위계 (#261/#315/#363)', () => {
  test('업로드 전(랜딩, #363): 드롭존 주연 → OCR 보조 순서, 디자인 rail은 CSS hidden', async () => {
    render(<Harness />);

    const poster = screen.getByText('포스터 업로드'); // 랜딩 히어로 드롭존
    const ocr = await screen.findByRole('button', { name: '티켓 스크린샷으로 자동 인식' });
    const rail = screen.getByRole('button', { name: '무드' }); // 첫 rail 아이템

    expect(precedes(poster, ocr)).toBe(true);
    // rail dock은 마운트 유지(pop state 보존, #297 P1 패턴) + hidden 클래스로만 숨김.
    expect(rail.closest('.hidden')).not.toBeNull();
  });

  test('업로드 후: Poster 드롭존은 사라지고(#324) OCR → rail 순서는 유지, rail hidden 해제', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    const ocr = await screen.findByRole('button', { name: '티켓 스크린샷으로 자동 인식' });
    const rail = screen.getByRole('button', { name: '무드' });

    expect(screen.queryByText('포스터 업로드')).toBeNull();
    expect(precedes(ocr, rail)).toBe(true);
    expect(rail.closest('.hidden')).toBeNull();
  });

  test('OcrUploadCard는 랜딩→업로드·최대화 전환에도 remount되지 않는다 (PR #372 리뷰 P1)', async () => {
    // 분기별 별도 JSX로 심으면 전환 순간 remount되고, in-flight KOBIS 보강의 mountedRef 가드가
    // setInfo를 조용히 버려 titleOg·releaseDate(완료 게이트 필수)가 유실된다. 같은 DOM 노드면
    // 인스턴스 유지 — remount면 노드가 새로 생성돼 레퍼런스가 갈린다.
    render(<Harness />);
    const before = await screen.findByRole('button', { name: '티켓 스크린샷으로 자동 인식' });

    fireEvent.click(screen.getByText('seed'));
    expect(screen.getByRole('button', { name: '티켓 스크린샷으로 자동 인식' }) === before).toBe(true);

    // max도 unmount가 아니라 CSS hidden — 최대화 왕복 중 동일 레이스 차단.
    fireEvent.click(screen.getByRole('button', { name: '최대화' }));
    expect(screen.getByRole('button', { name: '티켓 스크린샷으로 자동 인식', hidden: true }) === before).toBe(true);
  });

  test('업로드 후: 헤더 서브메뉴에서 전체표시·빈 항목·포스터 교체/재크롭 접근 가능(#315, 잉크는 #387에서 삭제 — 컬러 패널 White/Black 프리셋과 중복)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    await screen.findByRole('button', { name: '티켓 스크린샷으로 자동 인식' });

    fireEvent.click(screen.getByRole('button', { name: '편집 메뉴' }));

    expect(screen.getByRole('switch', { name: '전체 표시' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: '빈 항목 미리보기' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '포스터 교체' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '재크롭' })).toBeTruthy();
  });
});
