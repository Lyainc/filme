/**
 * #266 PR-E 회귀 테스트 — FieldLauncher 제거 후 필드 편집 커버리지가 온-티켓 탭만으로 유지되는지.
 *
 * 별도 필드 목록(FieldLauncher)을 지운 뒤 남는 두 경로를 MobileEditorShell 통합으로 검증한다:
 *  1. 끄기: 티켓 위 필드 탭 → 인플레이스 필드바(#354, FieldEditSheet 대체) "티켓 노출" 눈 토글 → 필드 숨김.
 *  2. 다시 켜기 (a): ghost 켜짐(기본 on) → 숨긴 필드가 티켓에 "+ 라벨" 점선(FieldTap)으로 남아
 *     재탭 → 재노출.
 *  3. 다시 켜기 (b): 도크 정보 모드의 "전체 표시" 스위치(옛 필드 드로어 맨 위, #826 S2에서 목록 끝으로) → 전 필드 재노출.
 *  4. 끄기(전체): "전체 표시" off는 필수 필드(제목)를 남기고 나머지만 끈다(#260, 제목 없는 티켓 방지).
 *
 * 무드/시트는 dynamic(ssr:false)라 로드 대기에 findBy*를 쓴다. 상태는 Harness의 data-testid
 * 프로브로 읽는다(모듈 mock 없음 — bun mock.module 전역 누수 회피, 기존 셸 테스트 미러). 무드는
 * 'stub'로 고정 — 극장/상영관이 명확한 개별 FieldTap이라(onTicketFieldTap.test.tsx 검증) 여기선
 * 셸 배선만 겨눈다. localStorage는 usePhototicket 디바운스 저장분 격리를 위해 매 테스트 전후 clear.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { mobileShellProps } from './shellHarness';

function Harness() {
  const photo = usePhototicket();
  const { fieldVisibility } = photo.state;
  return (
    <>
      <div data-testid="vis-title">{String(fieldVisibility.title)}</div>
      <div data-testid="vis-theater">{String(fieldVisibility.theater)}</div>
      <div data-testid="vis-screen">{String(fieldVisibility.screen)}</div>
      <button
        type="button"
        onClick={() => {
          photo.handleImageUpload('blob:test-poster');
          photo.updateMovieInfo({ theater: 'CGVTEST', screen: 'IMAXTEST' });
        }}
      >
        seed
      </button>
      <MobileEditorShell
        {...mobileShellProps(photo, { previewComponents: { ...photo.state.components, layout: 'stub' } })}
      />
    </>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('MobileEditorShell 필드 커버리지 (#266 PR-E)', () => {
  test('끄기(필드바 눈) → ghost 재탭으로 다시 켜기 (path a)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    // 무드 로드 대기 후 극장 탭 → 인플레이스 에디터(#354, 시트 대체) 열림.
    fireEvent.click(await screen.findByRole('button', { name: '극장 편집' }));

    // 필드바 "티켓 노출" 눈 토글 → 극장 숨김.
    fireEvent.click(await screen.findByRole('switch', { name: '티켓 노출' }));
    expect(screen.getByTestId('vis-theater').textContent).toBe('false');

    // 숨긴 필드도 편집 중 ghost 강제 on으로 "극장 편집" FieldTap이 티켓에 남는다(재켜기 진입점)
    // → 재탭 → 재노출(handleField의 자동 표시 on).
    fireEvent.click(await screen.findByRole('button', { name: '극장 편집' }));
    expect(screen.getByTestId('vis-theater').textContent).toBe('true');
  });

  test('끄기(필드바 눈) → "전체 표시"로 다시 켜기 (path b)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    fireEvent.click(await screen.findByRole('button', { name: '상영관 편집' }));
    fireEvent.click(await screen.findByRole('switch', { name: '티켓 노출' }));
    expect(screen.getByTestId('vis-screen').textContent).toBe('false');

    // "전체 표시" 단일 스위치(#261)는 #315에서 헤더 서브메뉴로, #424에서 필드 드로어로, #826 S2에서 도크 정보
    // 목록 끝으로 옮겨 왔다 — 편집을 닫으면 정보 모드 본문에 바로 있다.
    fireEvent.click(await screen.findByRole('button', { name: '편집 완료' }));
    fireEvent.click(within(screen.getByTestId('dock-body')).getByRole('switch', { name: '전체 표시' }));
    expect(screen.getByTestId('vis-screen').textContent).toBe('true');
  });

  // #355 → #826 S2 — 정보 목록 행 탭이 인플레이스 편집을 여는 셸 배선. 행 onField는 handleField를 타므로
  // 숨겨둔 필드도 자동 표시 on이 걸려야 한다.
  test('정보 목록 행 탭 → 인플레이스 편집 + 자동 표시 on (#355 → #826 S2)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    // 먼저 상영관을 숨겨 자동 표시 on까지 검증(기존 경로: 온-티켓 탭 → 필드바 눈 → 편집 완료).
    fireEvent.click(await screen.findByRole('button', { name: '상영관 편집' }));
    fireEvent.click(await screen.findByRole('switch', { name: '티켓 노출' }));
    fireEvent.click(await screen.findByRole('button', { name: '편집 완료' }));
    expect(screen.getByTestId('vis-screen').textContent).toBe('false');

    // 도크는 정보 모드로 열린다. 상단의 OCR 진입점(#388의 후신)이 목록 위에 있다.
    const list = screen.getByTestId('dock-body');
    expect(within(list).getByRole('button', { name: '스크린샷으로 자동입력' })).toBeDefined();
    // 숨긴 행은 눈이 꺼진 상태로 보인다.
    expect(within(list).getByRole('button', { name: '상영관 티켓에 표시' }).getAttribute('aria-pressed')).toBe('false');

    // 행 본문 탭 → handleField가 자동 표시 on + 인플레이스 필드바 오픈('상영관'은 티켓 FieldTap과
    // 접근명이 겹치지 않는다 — 행 이름은 이름 + 값이다).
    fireEvent.click(within(list).getByRole('button', { name: /^상영관 (?!티켓에 표시)/ }));
    expect(screen.getByTestId('vis-screen').textContent).toBe('true');
    expect(await screen.findByRole('switch', { name: '티켓 노출' })).toBeDefined();
  });

  test('툴바의 항목 목록 버튼은 도크를 정보 모드로 바꾼다 (#826 S2, 옛 드로어 열기 대체)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    fireEvent.click(screen.getByRole('tab', { name: '디자인' }));
    expect(screen.getByRole('tab', { name: '디자인' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: '티켓 항목 목록' }));
    expect(screen.getByRole('tab', { name: /^정보/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('dialog') === null).toBe(true); // 모달이 아니다
  });

  // #260 경로 1(이관) — "전체 표시" off는 필수 필드(제목)를 남기고 나머지만 끈다(제목 없는 티켓 방지).
  // 셸 스위치가 ALL_FIELDS_OFF_KEEP_REQUIRED를 넘기는지 실제 상호작용으로 검증(구 인라인 폼 '전체 해제' 테스트 이관, #283).
  test('"전체 표시" off → title은 유지, 나머지는 off (#260)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    // "전체 표시"는 도크 정보 모드 목록 끝(#826 S2, 옛 #424 필드 드로어) — 정보 모드로 열린다.
    // 첫 업로드는 표시항목을 부분 기본값으로 리셋하므로, 먼저 "전체 표시"로 전 필드를 켠다.
    const allVis = within(screen.getByTestId('dock-body')).getByRole('switch', { name: '전체 표시' });
    fireEvent.click(allVis);
    expect(screen.getByTestId('vis-title').textContent).toBe('true');
    expect(screen.getByTestId('vis-theater').textContent).toBe('true');

    // 다시 끄면 KEEP_REQUIRED로 title만 남고 나머지는 off.
    fireEvent.click(allVis);
    expect(screen.getByTestId('vis-title').textContent).toBe('true');
    expect(screen.getByTestId('vis-theater').textContent).toBe('false');
  });
});
