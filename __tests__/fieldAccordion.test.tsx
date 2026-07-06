/**
 * #226 회귀 테스트 — 데스크톱 INFO 필드 인라인 아코디언.
 *
 * (a) 행 클릭 → 그 자리에서 에디터 확장(FieldEditorBody 마운트) + aria-expanded 반영.
 * (b) 확장 본문 편집이 photo 상태에 반영(FieldEditorBody가 photo를 제대로 배선).
 * (c) rating 이중 eye 억제 — 행 eye는 rating만 생략, 확장 시 RatingPicker 자체 eye 하나만.
 *
 * Harness가 usePhototicket()으로 실제 photo를 만들어 넘긴다(designRail/desktopDesignPanel 미러).
 * 모듈 mock 없음. photo 상태는 DOM probe로 관찰. localStorage는 매 테스트 전후 clear.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { FieldAccordion } from '@/components/v2/FieldAccordion';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <div data-testid="seat">{photo.state.movieInfo.seat}</div>
      <FieldAccordion photo={photo} />
    </>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('FieldAccordion (#226)', () => {
  test('(a) 행 클릭 → 인라인 에디터 확장 + aria-expanded 반영', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 접힘 상태: 제목 편집 입력은 아직 마운트 안 됨.
    expect(screen.queryByRole('textbox', { name: '제목' })).toBeNull();

    const toggle = screen.getByRole('button', { name: '제목 편집' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await user.click(toggle);

    expect(screen.getByRole('textbox', { name: '제목' })).toBeDefined();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  test('(b) 확장 본문 편집이 photo 상태에 반영 (텍스트 필드)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByTestId('seat').textContent).toBe('');

    await user.click(screen.getByRole('button', { name: '좌석 편집' }));
    await user.type(screen.getByRole('textbox', { name: '좌석' }), 'G14');

    expect(screen.getByTestId('seat').textContent).toBe('G14');
  });

  test('(c) rating 이중 eye 억제 — 행 eye 없음, 확장 시 RatingPicker eye 하나만', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 접힘: 평점 표시 체크박스 0개(행 eye 억제 + 본문 미마운트). 다른 필드는 행 eye 있음.
    expect(screen.queryAllByRole('checkbox', { name: '평점 티켓에 표시' }).length).toBe(0);
    expect(screen.queryByRole('checkbox', { name: '제목 티켓에 표시' })).not.toBeNull();

    // 평점 행 확장 → RatingPicker eye 딱 하나(이중 아님).
    await user.click(screen.getByRole('button', { name: '평점 편집' }));
    expect(screen.queryAllByRole('checkbox', { name: '평점 티켓에 표시' }).length).toBe(1);
  });

  test('(d) 한 번에 하나만 열림 — 다른 행 클릭 시 전환, 같은 행 재클릭 시 닫힘', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const titleToggle = screen.getByRole('button', { name: '제목 편집' });
    const seatToggle = screen.getByRole('button', { name: '좌석 편집' });

    // 제목 열기 → 제목 입력 마운트.
    await user.click(titleToggle);
    expect(screen.queryByRole('textbox', { name: '제목' })).not.toBeNull();

    // 좌석 열기 → 제목은 자동 접힘(상호배타), 좌석만 열림.
    await user.click(seatToggle);
    expect(screen.queryByRole('textbox', { name: '제목' })).toBeNull();
    expect(titleToggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('textbox', { name: '좌석' })).not.toBeNull();
    expect(seatToggle.getAttribute('aria-expanded')).toBe('true');

    // 좌석 재클릭 → 닫힘.
    await user.click(seatToggle);
    expect(screen.queryByRole('textbox', { name: '좌석' })).toBeNull();
    expect(seatToggle.getAttribute('aria-expanded')).toBe('false');
  });

  test('(e) 스탬프(로고) 행 확장 → StampSheet 마운트 + 라벨 바인딩', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 접힘: 극장 로고 입력 미마운트.
    expect(screen.queryByRole('textbox', { name: '극장 로고' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '극장 로고 편집' }));

    // StampSheet 본문 — 텍스트 라벨 입력 + 로고 업로드 진입점.
    const labelInput = screen.getByRole('textbox', { name: '극장 로고' });
    expect(labelInput).not.toBeNull();
    expect(screen.getByRole('button', { name: '로고 업로드' })).not.toBeNull();

    // 라벨 타이핑이 TicketComponents(chainLabel)에 바인딩되는지 — 입력값이 그대로 반영.
    await user.type(labelInput, 'CGV');
    expect((labelInput as HTMLInputElement).value).toBe('CGV');
  });
});
