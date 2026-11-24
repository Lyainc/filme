/**
 * #261 회귀 테스트 — 모바일 chrome 정보위계.
 * #315로 allVis(전체 표시)·ghost(빈 항목) 토글은 헤더 서브메뉴로 이전하고, Poster 드롭존은
 * 업로드 후 사라지도록 바뀌었다(#324). #635로 업로드 전 위계가 다시 뒤집혔다 —
 * OCR이 주연(#142 위계), 포스터 CTA는 그 아래 이탈 경로로 보조, 편집 도크(#826 S2, 옛 디자인 rail)는 CSS hidden.
 * allVis(전체 표시)는 #424에서 헤더 서브메뉴 → 필드 드로어로, #826 S2에서 도크 정보 모드 목록 끝으로 다시
 * 이전(필드 목록과 한 자리) — 이 파일의 헤더 서브메뉴 검증에선 대상에서 빠지고,
 * mobileEditorShellFieldCoverage.test.tsx가 정보 모드 쪽에서 커버한다.
 *
 * #388로 업로드 후 본문 OCR 카드는 CSS hidden — OCR 진입점은 정보 모드 버튼(#826 S2, 옛 드로어 #355)이 이어받아
 * 같은 카드의 업로드를 연다. DOM 순서를 compareDocumentPosition으로 단언한다(시각 좌표 아닌 트리 순서).
 * OcrUploadCard·EditorDock은 정적 import라 렌더 즉시 존재한다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
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

/**
 * "업로드 후" 상태를 만든다 — #727부터 두 단계다. 랜딩은 이제 포스터 유무와 무관하게 뜨므로
 * (croppedImageUrl이 랜딩 판정에서 빠졌다, c1) 이탈을 먼저 세우고 그 다음 포스터를 심는다.
 * **순서가 중요하다**: 이탈은 "새로 시작"이라 문서를 새 문서로 되돌리므로(c7) 포스터를 먼저
 * 심으면 그 자리에서 지워진다. 실제 사용자 경로(크롭 확정)는 이 둘을 한 번에 한다.
 */
function seedUploaded() {
  fireEvent.click(screen.getByTestId('landing-skip-poster'));
  fireEvent.click(screen.getByText('seed'));
}

/** OCR 카드의 숨은 파일 입력(S9: 랜딩 안에서 카드는 보이는 버튼 없이 이 입력만 낸다). */
const ocrInput = () => screen.getByLabelText('티켓 스크린샷으로 자동입력') as HTMLInputElement;

/** compareDocumentPosition: DOCUMENT_POSITION_FOLLOWING(4) 비트가 서면 b가 a보다 DOM 뒤. */
function precedes(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & 4) !== 0;
}

describe('MobileEditorShell chrome 정보위계 (#261/#315/#363/#388)', () => {
  test('업로드 전(랜딩, #363→#614→#635): OCR 주연 → 포스터 CTA 보조 순서, 편집 도크는 CSS hidden', async () => {
    render(<Harness />);

    // #635 위계(OCR 주연)는 S9에서 주 버튼 '티켓 스크린샷으로 자동입력'이 그대로 잇고, 보조는 '직접 입력'이다(링크 쌍 삭제).
    const direct = screen.getByRole('button', { name: '직접 입력' });
    const ocr = await screen.findByTestId('landing-cta');
    const dock = screen.getByTestId('editor-dock');

    expect(ocr.textContent).toContain('티켓 스크린샷으로 자동입력');
    expect(precedes(ocr, direct)).toBe(true);
    // 랜딩 안에는 OCR 카드의 보이는 버튼이 없다 — 숨은 입력(같은 라벨)과 role=status 리전만 남는다.
    expect(screen.getAllByRole('button', { name: '티켓 스크린샷으로 자동입력' }).length).toBe(1);
    expect(!!ocrInput()).toBe(true);
    // 도크는 마운트 유지(도구 선택 state 보존, #297 P1 패턴) + hidden 클래스로만 숨김.
    expect(dock.closest('.hidden')).not.toBeNull();
  });

  test('업로드 후: Poster 드롭존은 사라지고(#324) 본문 OCR 카드는 CSS hidden(#388), 도크 hidden 해제', async () => {
    render(<Harness />);
    seedUploaded();

    const dock = await screen.findByTestId('editor-dock');

    // 랜딩은 unmount가 아니라 CSS hidden이다(#614) — 그 안의 OcrUploadCard가 같은 트리
    // 위치의 단일 인스턴스로 남아야 하기 때문(아래 remount 테스트). 그래서 "사라졌다"는 DOM 부재가
    // 아니라 hidden 조상으로 잰다(도크·OCR 카드와 같은 패턴).
    expect(screen.getByTestId('landing').classList.contains('hidden')).toBe(true);
    // 테스트 환경엔 Tailwind CSS가 로드되지 않아 getComputedStyle로 display:none이 안 잡히므로
    // (testing-library의 hidden:true는 "숨김 요소도 검색에 포함"일 뿐 숨김 단언이 아니다), 이
    // 레포 컨벤션대로 .hidden 클래스를 가진 조상 존재 여부로 직접 단언한다(도크와 동일 패턴).
    // 본문 OCR 카드는 여전히 DOM에 있다(unmount 아님) — 업로드 후 접근 가능한 진입점은
    // 정보 모드 버튼이고, 그 버튼이 이 단일 카드의 파일 선택을 연다(#826 S2).
    const ocr = ocrInput();
    expect(ocr.closest('.hidden')).not.toBeNull();
    expect(dock.closest('.hidden') === null).toBe(true);
  });

  test('OcrUploadCard는 랜딩→업로드·전체 보기 전환에도 remount되지 않는다 (PR #372 리뷰 P1, #388로 hidden 전환 후에도 유지)', async () => {
    // 분기별 별도 JSX로 심으면 전환 순간 remount되고, in-flight KOBIS 보강의 mountedRef 가드가
    // setInfo를 조용히 버려 titleOg·releaseDate(완료 게이트 필수)가 유실된다. 같은 DOM 노드면
    // 인스턴스 유지 — remount면 노드가 새로 생성돼 레퍼런스가 갈린다. #388로 업로드 후엔 이 카드가
    // hidden 조상을 갖게 되지만, 여전히 unmount는 아니어야 한다(같은 DOM 노드 참조 유지).
    render(<Harness />);
    await screen.findByTestId('landing-cta');
    const before = ocrInput();

    seedUploaded();
    const afterSeed = ocrInput();
    expect(afterSeed === before).toBe(true);
    expect(afterSeed.closest('.hidden')).not.toBeNull();

    // max도 unmount가 아니라 CSS hidden — 전체 보기 왕복 중 동일 레이스 차단.
    fireEvent.click(screen.getByRole('button', { name: '전체 보기' }));
    const afterMax = ocrInput();
    expect(afterMax === before).toBe(true);
    expect(afterMax.closest('.hidden')).not.toBeNull();
  });

  test('업로드 후: 편집 메뉴에는 빈 항목 표시 스위치가 있고, 포스터 교체·재크롭은 메뉴가 아니라 도크 사진 모드에 있다(#826 S2)', async () => {
    render(<Harness />);
    seedUploaded();
    await screen.findByTestId('editor-dock');

    fireEvent.click(screen.getByRole('button', { name: '편집 메뉴' }));
    const menu = screen.getByRole('dialog', { name: '편집 메뉴' });

    expect(within(menu).getByRole('switch', { name: '빈 항목 표시' })).toBeTruthy();
    expect(within(menu).queryByRole('button', { name: '포스터 교체' }) === null).toBe(true);
    expect(within(menu).queryByRole('button', { name: '재크롭' }) === null).toBe(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('tab', { name: '사진' }));
    const body = within(screen.getByTestId('dock-body'));
    expect(body.getAllByRole('button', { name: '교체' }).length).toBeGreaterThan(0);
  });
});
