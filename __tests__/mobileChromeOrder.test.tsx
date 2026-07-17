/**
 * #261 회귀 테스트 — 모바일 chrome 정보위계.
 * #315로 allVis(전체 표시)·ghost(빈 항목) 토글은 헤더 서브메뉴로 이전하고, Poster 드롭존은
 * 업로드 후 사라지도록 바뀌었다(#324). #363 랜딩 리디자인으로 업로드 전 위계가 뒤집혔다 —
 * 드롭존이 주연(히어로), OCR은 보조 액션으로 직하(#142 위계), 디자인 rail은 CSS hidden.
 *
 * #388로 업로드 후 본문 OCR 카드는 CSS hidden — OCR 진입점은 드로어(#355)로 일원화됐다.
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

describe('MobileEditorShell chrome 정보위계 (#261/#315/#363/#388)', () => {
  test('업로드 전(랜딩, #363): 드롭존 주연 → OCR 보조 순서, 디자인 rail은 CSS hidden', async () => {
    render(<Harness />);

    const poster = screen.getByText('포스터 업로드'); // 랜딩 히어로 드롭존
    const ocr = await screen.findByRole('button', { name: '티켓 스크린샷으로 자동입력' });
    const rail = screen.getByRole('button', { name: '무드' }); // 첫 rail 아이템

    expect(precedes(poster, ocr)).toBe(true);
    // rail dock은 마운트 유지(pop state 보존, #297 P1 패턴) + hidden 클래스로만 숨김.
    expect(rail.closest('.hidden')).not.toBeNull();
  });

  test('업로드 후: Poster 드롭존은 사라지고(#324) 본문 OCR 카드는 CSS hidden(#388, 드로어로 일원화), rail hidden 해제', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    const rail = await screen.findByRole('button', { name: '무드' });

    expect(screen.queryByText('포스터 업로드')).toBeNull();
    // 테스트 환경엔 Tailwind CSS가 로드되지 않아 getComputedStyle로 display:none이 안 잡히므로
    // (testing-library의 hidden:true는 "숨김 요소도 검색에 포함"일 뿐 숨김 단언이 아니다), 이
    // 레포 컨벤션대로 .hidden 클래스를 가진 조상 존재 여부로 직접 단언한다(rail과 동일 패턴).
    // 본문 OCR 카드는 여전히 DOM에 있다(unmount 아님) — 업로드 후 유일한 접근 가능 진입점은
    // 드로어(#355) 쪽 OcrUploadCard여야 한다.
    const ocr = screen.getByRole('button', { name: '티켓 스크린샷으로 자동입력' });
    expect(ocr.closest('.hidden')).not.toBeNull();
    expect(rail.closest('.hidden')).toBeNull();
  });

  test('OcrUploadCard는 랜딩→업로드·최대화 전환에도 remount되지 않는다 (PR #372 리뷰 P1, #388로 hidden 전환 후에도 유지)', async () => {
    // 분기별 별도 JSX로 심으면 전환 순간 remount되고, in-flight KOBIS 보강의 mountedRef 가드가
    // setInfo를 조용히 버려 titleOg·releaseDate(완료 게이트 필수)가 유실된다. 같은 DOM 노드면
    // 인스턴스 유지 — remount면 노드가 새로 생성돼 레퍼런스가 갈린다. #388로 업로드 후엔 이 카드가
    // hidden 조상을 갖게 되지만, 여전히 unmount는 아니어야 한다(같은 DOM 노드 참조 유지).
    render(<Harness />);
    const before = await screen.findByRole('button', { name: '티켓 스크린샷으로 자동입력' });

    fireEvent.click(screen.getByText('seed'));
    const afterSeed = screen.getByRole('button', { name: '티켓 스크린샷으로 자동입력' });
    expect(afterSeed === before).toBe(true);
    expect(afterSeed.closest('.hidden')).not.toBeNull();

    // max도 unmount가 아니라 CSS hidden — 최대화 왕복 중 동일 레이스 차단.
    fireEvent.click(screen.getByRole('button', { name: '최대화' }));
    const afterMax = screen.getByRole('button', { name: '티켓 스크린샷으로 자동입력' });
    expect(afterMax === before).toBe(true);
    expect(afterMax.closest('.hidden')).not.toBeNull();
  });

  test('업로드 후: 헤더 서브메뉴에서 전체표시·빈 항목·포스터 교체/재크롭 접근 가능(#315, 잉크는 #387에서 삭제 — 컬러 패널 White/Black 프리셋과 중복)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    await screen.findByRole('button', { name: '티켓 스크린샷으로 자동입력' });

    fireEvent.click(screen.getByRole('button', { name: '편집 메뉴' }));

    expect(screen.getByRole('switch', { name: '전체 표시' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: '빈 항목 미리보기' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '포스터 교체' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '재크롭' })).toBeTruthy();
  });
});
