/**
 * #215 PART A 회귀 테스트 — 필드 탭-투-에딧(FieldLauncher + FieldEditSheet) + EditorCanvas 폼 숨김.
 *
 * 셋업은 designRail.test.tsx 미러 — Harness가 usePhototicket()으로 실제 photo를 만들고, 상태는
 * DOM probe(data-testid)로 읽는다. 모듈 mock 없음(전역 누수 회피). vaul 시트 내부 상호작용은
 * fireEvent로 — userEvent의 pointer 시뮬레이션이 happy-dom의 빈 transform을 읽는 vaul 드래그
 * 핸들러를 건드리는 걸 피한다(resultSheetFocus.test.tsx 주석과 동일 이유). localStorage는
 * usePhototicket이 디바운스 저장하므로 파일 내/간 격리를 위해 매 테스트 전후로 clear.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { TicketField } from '@/types';
import { usePhototicket } from '@/hooks/usePhototicket';
import { FieldLauncher } from '@/components/v2/FieldLauncher';
import { FieldEditSheet } from '@/components/v2/FieldEditSheet';
import { EditorCanvas } from '@/components/v2/EditorCanvas';

function SheetHarness({ field }: { field: TicketField }) {
  const photo = usePhototicket();
  const { movieInfo, fieldVisibility } = photo.state;
  return (
    <>
      <div data-testid="titleOg">{movieInfo.titleOg}</div>
      <div data-testid="watchDateFormat">{movieInfo.watchDateFormat}</div>
      <div data-testid="releaseDateFormat">{movieInfo.releaseDateFormat}</div>
      <div data-testid="rating">{movieInfo.rating}</div>
      <div data-testid="vis-theater">{String(fieldVisibility.theater)}</div>
      <FieldEditSheet activeField={field} onClose={() => {}} photo={photo} />
    </>
  );
}

function LauncherHarness({ onSelect }: { onSelect: (f: TicketField) => void }) {
  const photo = usePhototicket();
  return <FieldLauncher photo={photo} onSelect={onSelect} />;
}

function EditorHarness({ hideForm }: { hideForm?: boolean }) {
  const photo = usePhototicket();
  return <EditorCanvas photo={photo} onPendingFetchChange={() => {}} hideFormSections={hideForm} />;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('FieldLauncher (#215 PART A)', () => {
  test('행 탭 → onSelect(field) 호출', () => {
    let picked: TicketField | null = null;
    render(<LauncherHarness onSelect={(f) => { picked = f; }} />);

    fireEvent.click(screen.getByRole('button', { name: '원제 편집' }));
    expect(picked).toBe('titleOg');

    fireEvent.click(screen.getByRole('button', { name: '관람일 편집' }));
    expect(picked).toBe('watchDate');
  });

  test('모든 필드(제목·개봉일 포함)에 눈 토글이 있다 — 데스크톱 폼과 표시여부 조작 parity', () => {
    render(<LauncherHarness onSelect={() => {}} />);
    // 눈 토글은 VisibilityCheckbox의 "…티켓에 표시" 접근명으로 식별. 데스크톱 MovieInfoForm이
    // title/releaseDate에도 VisibilityCheckbox를 두므로 모바일 런처도 동일하게 눈을 노출한다.
    expect(screen.queryByLabelText('제목 티켓에 표시')).not.toBeNull();
    expect(screen.queryByLabelText('개봉일 티켓에 표시')).not.toBeNull();
    expect(screen.queryByLabelText('극장 티켓에 표시')).not.toBeNull();
  });
});

describe('FieldEditSheet 타입별 편집 (#215 PART A)', () => {
  test('text 시트: 원제 입력이 movieInfo.titleOg를 갱신', async () => {
    render(<SheetHarness field="titleOg" />);
    // 헤더 제목("원제")과 입력 aria-label("원제")이 같은 접근명이라 placeholder로 입력을 특정.
    const input = await screen.findByPlaceholderText('Interstellar');
    fireEvent.change(input, { target: { value: 'Interstellar' } });
    expect(screen.getByTestId('titleOg').textContent).toBe('Interstellar');
  });

  test('date 시트(관람일): 표기 칩이 watchDateFormat을 갱신', async () => {
    render(<SheetHarness field="watchDate" />);
    expect(screen.getByTestId('watchDateFormat').textContent).toBe('kr-compact');
    // iso 샘플 칩.
    fireEvent.click(await screen.findByRole('radio', { name: '2014-11-06' }));
    expect(screen.getByTestId('watchDateFormat').textContent).toBe('iso');
  });

  test('date 시트(개봉일): 표기 칩이 releaseDateFormat을 갱신', async () => {
    render(<SheetHarness field="releaseDate" />);
    expect(screen.getByTestId('releaseDateFormat').textContent).toBe('kr-compact');
    fireEvent.click(await screen.findByRole('radio', { name: '06·NOV·2014' }));
    expect(screen.getByTestId('releaseDateFormat').textContent).toBe('cinema-mono');
  });

  test('rating 시트: 별점 클릭이 movieInfo.rating을 갱신', async () => {
    render(<SheetHarness field="rating" />);
    expect(screen.getByTestId('rating').textContent).toBe('5');
    // happy-dom의 getBoundingClientRect는 0 → computeRating이 정수 별점(4) 반환.
    fireEvent.click(await screen.findByRole('radio', { name: '4점' }));
    expect(screen.getByTestId('rating').textContent).toBe('4');
  });

  test('선택 필드 헤더 눈 토글이 fieldVisibility를 갱신', async () => {
    render(<SheetHarness field="theater" />);
    expect(screen.getByTestId('vis-theater').textContent).toBe('true');
    fireEvent.click(await screen.findByLabelText('극장 티켓에 표시'));
    expect(screen.getByTestId('vis-theater').textContent).toBe('false');
  });
});

describe('EditorCanvas hideFormSections (#215 PART A)', () => {
  test('true → MovieInfoForm·OptionalDetailsAccordion 미렌더, 포스터/표시항목/로고는 유지', () => {
    render(<EditorHarness hideForm />);
    expect(screen.queryByText('KOBIS lookup')).toBeNull(); // MovieInfoForm 신호
    expect(screen.queryByText('Optional details')).toBeNull(); // 아코디언 신호
    // 폼 밖 섹션은 그대로.
    expect(screen.queryByText(/표시 항목/)).not.toBeNull();
    expect(screen.queryByText('Logos')).not.toBeNull();
  });

  test('미전달(기본 false) → MovieInfoForm·OptionalDetailsAccordion 렌더', () => {
    render(<EditorHarness />);
    expect(screen.queryByText('KOBIS lookup')).not.toBeNull();
    expect(screen.queryByText('Optional details')).not.toBeNull();
  });
});
