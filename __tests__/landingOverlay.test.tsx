/**
 * 랜딩 오버레이(#614) 회귀 테스트 — 오버레이를 걷는 조건과 그 반대(안 걷히는 것)를 고정한다.
 *
 * 세 경로:
 *   1. 드래프 없음 → 랜딩이 뜬다(S9: 전시 + 주 버튼 + 직접 입력, 헤드카피 없음)
 *   2. 드래프 복원 → **랜딩이 그대로 뜨고**(#727 c1, #675 D7 뒤집기) 주 CTA 위에 복원 진입점
 *      ("이어서 만들기")이 선다. 눌러야 편집으로 들어가고, 그때 복원된 필드가 그대로 남는다.
 *   3. 주 버튼 1탭 → 첨부 시트가 열리고(S9), 시트 행이 숨은 OCR · 포스터 input을 **같은 제스처 안에서** click한다(라우트
 *      전환이 없어야 파일 다이얼로그가 열린다는 게 /studio 분리안을 버린 이유다).
 *      파일 선택만으로는 안 걷힌다(#727 c4) — 크롭 모달은 DOM 순서로 랜딩 위에 그려지고, 취소하면
 *      랜딩이 그 자리에 그대로 남아 빈 셸이 안 생긴다.
 *
 * 랜딩↔편집 전환에서 OcrUploadCard가 remount되지 않는 건 mobileChromeOrder.test.tsx가 이미
 * 노드 동일성으로 잡고 있어 여기서 겹쳐 재지 않는다.
 *
 * 표시 여부는 className으로 본다 — 이 레포엔 jest-dom이 없고 Tailwind CSS도 테스트에 안 실려
 * getComputedStyle이 클래스를 반영하지 않는다(레포 컨벤션, mobileChromeOrder와 동일).
 */
import { describe, expect, test, afterEach, beforeEach, jest, setSystemTime } from 'bun:test';
import { render, renderHook, screen, cleanup, fireEvent, within, act, waitFor } from '@testing-library/react';
import { UNOFFICIAL_TICKET_NOTICE } from '@/utils/ticketCleanup';
import { GALLERY_LAYOUTS, formatSavedDate } from '@/components/v2/Landing';
import { LayoutStrip } from '@/components/LayoutPicker';
import { LAYOUTS } from '@/utils/layouts';
import { mobileShellProps } from './shellHarness';

const { usePhototicket, STORAGE_KEY } = require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');
const { MobileEditorShell } =
  require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');

function Harness() {
  const photo = usePhototicket();
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

const landing = () => screen.getByTestId('landing');
// 랜딩은 두 모드다(overlay / hidden, #727 c3 — inline 삭제). 걷혔다 = 셸을 더는 안 덮는다이므로
// fixed 여부로 잰다. hidden도 unmount가 아니라 CSS다(#297 P1).
const landingOverlayShown = () => landing().classList.contains('fixed');
const restoreRow = () => screen.getByTestId('landing-restore');
const posterInput = () =>
  document.querySelector('input[type="file"][accept*="jpeg"]') as HTMLInputElement;
const ocrButton = () => screen.getByTestId('landing-cta');

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('랜딩 오버레이(#614)', () => {
  test('드래프가 없으면 랜딩이 뜨고 주 버튼 · 직접 입력 · 이용 고지 · 무드 전시만 있다 (S9)', () => {
    render(<Harness />);

    expect(landingOverlayShown()).toBe(true);
    // 헤드라인 · 서브카피 · 링크 쌍 · 상시 고지는 걷혔다(S9 constraint-3 · 12 · 13).
    expect(landing().textContent).not.toContain('내 굿즈가 돼요');
    expect(landing().textContent).not.toContain('사진으로 찍은 실물 티켓도 돼요.');
    expect(landing().textContent).not.toContain(UNOFFICIAL_TICKET_NOTICE);
    expect(screen.queryByRole('button', { name: '포스터 업로드' }) === null).toBe(true);
    expect(screen.queryByText('포스터 없이 직접 입력') === null).toBe(true);
    // 고지는 워드마크 줄의 '이용 고지' 버튼 뒤 시트에 있다(landingS9Presentational · appFooterNotice가 열림을 잰다).
    expect(!!within(landing()).getByRole('button', { name: '이용 고지' })).toBe(true);
    expect(ocrButton().textContent).toContain('티켓 스크린샷으로 자동입력');
    expect(screen.getByTestId('landing-skip-poster').textContent).toBe('직접 입력');
    // 무드 전시 — 목록은 LAYOUTS 전체가 아니라 GALLERY_LAYOUTS다(35mm Wide 제외, 2026-08-08 사용자 피드백).
    // 카드는 진입이 아니라 고르기 버튼이라 접근명이 정확히 '{label}'이고 aria-pressed를 든다(S9 constraint-5).
    for (const layout of GALLERY_LAYOUTS) {
      const buttons = within(landing()).getAllByRole('button', { name: layout.label });
      expect(buttons).toHaveLength(1);
      expect(buttons[0].hasAttribute('title')).toBe(false);
      expect(buttons[0].hasAttribute('aria-pressed')).toBe(true);
      // 히어로 이미지 매핑(HERO_IMAGES, #613) 회귀 방어 — 무드 추가·오타로 엔트리가 빠지면
      // <img src>가 비거나 잘못된 경로로 조용히 깨진다(claude-review PR #759 P1).
      expect(buttons[0].querySelector('img')?.getAttribute('src')).toBe(`/assets/landing/hero-${layout.id}.webp`);
    }
    expect(within(landing()).queryAllByRole('button', { name: '35mm 와이드' })).toHaveLength(0);
    expect(GALLERY_LAYOUTS.map((l) => l.label)).toEqual(['미니멀', '크라이테리언', '35mm', '에디토리얼', '스텁']);
  });

  // ac1 — #675 D7의 정확한 반대. 텍스트만 있던 draft가 여기, 포스터가 있던 draft는
  // awaitingPosterRestore.test.tsx가 IDB 게이트를 쥐고 잰다(복원이 **끝난 뒤에도** 유지되는지).
  test('드래프가 복원돼도 랜딩이 오버레이로 그대로 뜬다 (#727 c1, D7 뒤집기)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '인터스텔라' } }));

    render(<Harness />);

    expect(landingOverlayShown()).toBe(true);
    // 전시 · 주 버튼 · 직접 입력도 그대로다 — 재방문자도 같은 화면에서 무드를 고르고 시작한다.
    expect(!!screen.getByTestId('mood-gallery')).toBe(true);
    expect(!!screen.getByTestId('landing-skip-poster')).toBe(true);
    expect(!!ocrButton()).toBe(true);
  });

  // ac2 — 복원 진입점의 자리와 라벨. 라벨 규칙은 docs/COPY_TONE_GUIDE.md 축 2의 기계적 판별을
  // 그대로 옮긴 것이다(조건절·종결어미·마침표 금지). `-하기`는 금지가 아니다.
  test('복원 진입점이 주 CTA 위에 있고, 라벨이 조건절 없는 명령형에 제목을 싣는다', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '인터스텔라' } }));

    render(<Harness />);

    const label = restoreRow().textContent ?? '';
    expect(label.startsWith('이어서 만들기')).toBe(true);
    expect(label).toContain('인터스텔라');
    expect(/[.]|있으면|없으면|세요|까요/.test(label)).toBe(false);
    // DOCUMENT_POSITION_FOLLOWING(4) — 복원 행이 주 CTA보다 DOM 앞이다(= 위).
    expect((restoreRow().compareDocumentPosition(ocrButton()) & 4) !== 0).toBe(true);
    // 두 줄 행(마스터 L-02 · .c-resume) — 높이 56px 이상, 위 12px 보조 글자 '이어서 만들기', 아래 15px 600 제목 한 줄
    // 말줄임, 오른쪽 끝 › 아이콘. 테스트에 Tailwind가 안 실려 클래스로 잰다(레포 컨벤션).
    expect(restoreRow().className).toContain('min-h-[56px]');
    const [top, title] = Array.from(restoreRow().firstElementChild!.children) as HTMLElement[];
    expect(top.textContent).toBe('이어서 만들기');
    expect(top.className).toContain('text-caption');
    expect(top.className).toContain('text-ink-2');
    expect(title.textContent).toBe('인터스텔라');
    expect(title.className).toContain('text-[15px]');
    expect(title.className).toContain('font-semibold');
    expect(title.className).toContain('truncate');
    expect(restoreRow().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  test('제목이 빈 저장분은 "제목 없는 티켓"으로 보인다', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '' } }));

    render(<Harness />);

    expect(restoreRow().textContent).toContain('제목 없는 티켓');
  });

  // ac3 — 눌렀을 때 랜딩이 걷히고 복원된 문서가 그대로 편집 화면에 있다. 다섯 이탈 중 유일하게
  // 문서를 새 문서로 안 되돌리는 경로다(c7의 "새로 시작" 넷과 갈리는 지점).
  test('복원 진입점을 누르면 랜딩이 걷히고 복원된 필드가 편집 화면에 남는다', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '인터스텔라' } }));

    render(<Harness />);
    fireEvent.click(restoreRow());

    expect(landing().classList.contains('hidden')).toBe(true);
    expect(landingOverlayShown()).toBe(false);
    // 편집 크롬이 실제로 열렸는지 — posterlessCanvas.test.tsx와 같은 두 진입점(완료 · 편집 도크)으로 잰다.
    expect(!!screen.queryByRole('button', { name: '완료' })).toBe(true);
    expect(screen.getByTestId('editor-dock').classList.contains('hidden')).toBe(false);
    // 복원된 제목이 문서에 살아 있다 — 티켓 프리뷰가 그 값을 그린다.
    expect(document.body.textContent).toContain('인터스텔라');
  });

  test('주 CTA 1탭은 파일 선택이 아니라 첨부 시트를 연다 (S9 constraint-8)', () => {
    render(<Harness />);
    const input = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
    let clicked = 0;
    input.addEventListener('click', () => {
      clicked += 1;
    });

    fireEvent.click(ocrButton());
    expect(clicked).toBe(0);
    expect(!!screen.getByRole('dialog', { name: '티켓과 포스터' })).toBe(true);
    // 시트의 '티켓 스크린샷' 행이 OCR 파일 입력을 그 자리에서 연다.
    fireEvent.click(screen.getByTestId('landing-sheet-screenshot'));
    expect(clicked).toBe(1);
  });

  test('시트의 "포스터" 행 1탭이 포스터 input을 그 자리에서 click하고, 파일 선택 뒤에도 오버레이가 남는다 (#727 c4)', () => {
    render(<Harness />);
    const input = posterInput();
    let clicked = 0;
    // click()이 실제로 그 input에 도달했는지 — 라우트 전환 없이 같은 제스처 안에서 열린다는 것의
    // 관측 가능한 대리(파일 다이얼로그 자체는 테스트 환경에 없다).
    input.addEventListener('click', () => {
      clicked += 1;
    });

    fireEvent.click(ocrButton());
    fireEvent.click(screen.getByTestId('landing-sheet-poster'));
    expect(clicked).toBe(1);
    expect(landingOverlayShown()).toBe(true); // 아직 안 고름

    fireEvent.change(input, {
      target: { files: [new File(['x'], 'poster.png', { type: 'image/png' })] },
    });

    // #727 c4 — 크롭 모달이 z-50 + DOM 순서로 랜딩 위에 그려지므로 파일 선택만으로는 랜딩을 걷지 않는다.
    // 걷히는 건 '만들기'(S9) 시점이고 그 축은 posterCropPipeline · 셸 시트 테스트가 잠근다.
    // landingOverlayShown()은 getByTestId라 n≠1이면 throw하므로 개수를 먼저 세어 중복/소실 가설을 구분한다(#717).
    expect(document.querySelectorAll('[data-testid="landing"]').length).toBe(1);
    expect(landingOverlayShown()).toBe(true);
  });
});

/**
 * 랜딩 카피 구조(#615 → #786). 반복 배경 타일과 그 대비용 스크림은 #786에서 제거됐다 — 배경이
 * 사라지면 카피는 오버레이 자신의 불투명 bg-stage 위에 직접 서므로 스크림이 할 일이 없다. 남는 건
 * 헤드↔서브 간격과 landing-muted 토큰이다(이 레포엔 jest-dom도 Tailwind CSS도 테스트에 안 실려
 * getComputedStyle이 클래스를 반영하지 않으므로 클래스 문자열로 고정한다 — 위 파일 주석의 같은
 * 컨벤션). 대비 수치 자체는 브라우저에서만 잴 수 있다.
 */
describe('랜딩 구조 (#615 → #786 → #826 S9)', () => {
  // 삭제: '헤드·서브카피가 gap-1로 붙는다' · '서브카피와 이탈 경로 줄이 text-ink-2' — h1 · 서브카피 · 이탈 경로 줄이 S9에서 없어졌다
  // (없음 자체는 landingS9Presentational '헤드라인 · 빔 · details…' 가 잠근다). 여기선 남는 면 규칙만 둔다.
  test('반복 배경 · 아래 판이 없고 아래 버튼 묶음이 같은 stage 면 위에 선다', () => {
    render(<Harness />);
    expect(screen.queryByTestId('landing-backdrop') === null).toBe(true);
    expect(screen.queryByTestId('landing-panel') === null).toBe(true);
    expect(screen.queryByRole('heading', { level: 1 }) === null).toBe(true);
    expect(!!screen.getByTestId('landing-bottom')).toBe(true);
  });
});

/**
 * 저장 날짜(#826 S5 D18-1 A, 소유자 결정 2026-11-22) — 저장분의 저장 시각을 복원 행 제목 오른쪽에 'M월 D일'(올해가 아니면
 * 'YYYY년 M월 D일')로 보인다. 로컬 시간대 기준이고 마침표가 없어 라벨 규칙(축 2) 단언을 그대로 통과한다.
 */
describe('복원 행 저장 날짜 (#826 S5 D18-1 A)', () => {
  afterEach(() => {
    setSystemTime();
  });

  const local = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();

  test('올해 저장분은 "11월 15일", 지난해 저장분은 "2025년 11월 15일"', () => {
    setSystemTime(new Date(2026, 10, 22, 12));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '인터스텔라' }, savedAt: local(2026, 11, 15) }));
    render(<Harness />);
    expect(screen.getByTestId('landing-restore-date').textContent).toBe('11월 15일');
    expect(/[.]/.test(restoreRow().textContent ?? '')).toBe(false);
    cleanup();

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '인터스텔라' }, savedAt: local(2025, 11, 15) }));
    render(<Harness />);
    expect(screen.getByTestId('landing-restore-date').textContent).toBe('2025년 11월 15일');
    expect(/[.]/.test(restoreRow().textContent ?? '')).toBe(false);
    const date = screen.getByTestId('landing-restore-date');
    expect(date.className).toContain('text-caption');
    expect(date.className).toContain('text-ink-2');
    expect(date.className).toContain('tabular-nums');
  });

  test('formatSavedDate는 로컬 시간대 날짜로 판정한다', () => {
    const now = new Date(2026, 0, 1, 0, 5).getTime();
    expect(formatSavedDate(new Date(2025, 11, 31, 23, 55).getTime(), now)).toBe('2025년 12월 31일');
    expect(formatSavedDate(new Date(2026, 0, 1, 0, 1).getTime(), now)).toBe('1월 1일');
  });

  test('저장 시각이 없는 옛 저장분은 날짜 없이 행과 복원이 정상이다', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '인터스텔라' } }));
    render(<Harness />);
    expect(screen.queryByTestId('landing-restore-date') === null).toBe(true);
    expect(restoreRow().textContent).toContain('인터스텔라');
    fireEvent.click(restoreRow());
    expect(landingOverlayShown()).toBe(false);
    expect(document.body.textContent).toContain('인터스텔라');
  });

  test('저장 시각은 매 저장마다 갱신된다', async () => {
    const { result } = renderHook(() => usePhototicket());
    setSystemTime(new Date(2026, 10, 15, 9));
    act(() => {
      result.current.updateMovieInfo({ title: '괴물' });
    });
    act(() => {
      result.current.saveDraft();
    });
    const first = JSON.parse(localStorage.getItem(STORAGE_KEY)!).savedAt;
    expect(first).toBe(new Date(2026, 10, 15, 9).getTime());
    setSystemTime(new Date(2026, 10, 22, 9));
    act(() => {
      result.current.saveDraft();
    });
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).savedAt).toBe(new Date(2026, 10, 22, 9).getTime()));
  });
});

/** 이용 고지(#826 S9 constraint-12) — details 접기는 걷히고 워드마크 줄 버튼이 여는 작은 시트로 바뀌었다. */
describe('이용 고지 시트 (#826 S9 L-01)', () => {
  test('details 고지는 없고, 워드마크 줄 버튼이 고지 · 크레딧 · GitHub가 든 dialog를 연다', () => {
    render(<Harness />);
    expect(screen.queryByTestId('legal-notice') === null).toBe(true);
    expect(landing().querySelector('details') === null).toBe(true);
    fireEvent.click(within(landing()).getByRole('button', { name: '이용 고지' }));
    const dlg = screen.getByRole('dialog', { name: '이용 고지' });
    expect(dlg.textContent).toContain(UNOFFICIAL_TICKET_NOTICE);
    expect(dlg.textContent).toContain('KCC은영체');
    expect(!!dlg.querySelector('a[aria-label="GitHub 저장소"]')).toBe(true);
  });

  test('시트를 닫으면 사라진다', () => {
    render(<Harness />);
    fireEvent.click(within(landing()).getByRole('button', { name: '이용 고지' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog') === null).toBe(true);
  });
});

describe('오버레이 걷힘 전환 (#826 S5 constraint-7)', () => {
  test('걷힐 때 240ms · cubic-bezier(.2,.7,.2,1)로 사라지고, 클래스는 즉시 hidden이다', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('landing-skip-poster'));
    expect(landing().classList.contains('hidden')).toBe(true);
    expect(landing().style.transition).toContain('240ms cubic-bezier(.2,.7,.2,1)');
    expect(landing().style.opacity).toBe('0');
  });

  test('사라지는 동안 마케팅 층은 탭을 받지 않고, 240ms 뒤 언마운트된다', () => {
    jest.useFakeTimers();
    try {
      render(<Harness />);
      fireEvent.click(screen.getByTestId('landing-skip-poster'));
      expect(!!screen.getByTestId('mood-gallery')).toBe(true);
      expect(landing().style.pointerEvents).toBe('none');
      // 카드 슬롯만은 되살린다 — 숨은 OCR 파일 input은 편집 화면의 버튼이 여는 한 벌이다.
      const slot = screen.getByTestId('landing-card-slot');
      expect(slot.style.pointerEvents).toBe('auto');
      expect(slot.contains(document.querySelector('input[type="file"][accept="image/*"]'))).toBe(true);
      act(() => jest.advanceTimersByTime(240));
      expect(screen.queryByTestId('mood-gallery') === null).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('도크 무드 칩이 한글 이름을 보인다 (#826 S5 constraint-8)', () => {
  test('LayoutStrip 칩 글자가 LAYOUTS의 한글 label이다', () => {
    render(<LayoutStrip value="minimal" onChange={() => {}} />);
    const chips = screen.getAllByRole('radio');
    expect(chips.map((c) => c.textContent)).toEqual(['미니멀', '크라이테리언', '35mm', '에디토리얼', '스텁', '35mm 와이드']);
    expect(LAYOUTS.map((l) => l.label)).toEqual(['미니멀', '크라이테리언', '35mm', '에디토리얼', '스텁', '35mm 와이드']);
  });
});
