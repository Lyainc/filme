/**
 * #215 PART A 회귀 테스트 — 필드 편집 시트(FieldEditSheet/StampSheet) + EditorCanvas 폼 숨김.
 * (FieldLauncher 목록은 #266 PR-E에서 제거 — 필드 편집은 온-티켓 탭이 전담. 관련 커버리지는
 *  onTicketFieldTap.test.tsx·mobileEditorShellFieldCoverage.test.tsx로 이전.)
 *
 * 셋업은 designRail.test.tsx 미러 — Harness가 usePhototicket()으로 실제 photo를 만들고, 상태는
 * DOM probe(data-testid)로 읽는다. 모듈 mock 없음(전역 누수 회피). vaul 시트 내부 상호작용은
 * fireEvent로 — userEvent의 pointer 시뮬레이션이 happy-dom의 빈 transform을 읽는 vaul 드래그
 * 핸들러를 건드리는 걸 피한다(resultSheetFocus.test.tsx 주석과 동일 이유). localStorage는
 * usePhototicket이 디바운스 저장하므로 파일 내/간 격리를 위해 매 테스트 전후로 clear.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { useEffect, useRef } from 'react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import type { SheetTarget } from '@/constants/fields';
import { FieldEditSheet } from '@/components/v2/FieldEditSheet';
import { EditorCanvas } from '@/components/v2/EditorCanvas';

function SheetHarness({ field }: { field: SheetTarget }) {
  const photo = usePhototicket();
  const { movieInfo, fieldVisibility, components } = photo.state;
  return (
    <>
      <div data-testid="titleOg">{movieInfo.titleOg}</div>
      <div data-testid="watchDateFormat">{movieInfo.watchDateFormat}</div>
      <div data-testid="releaseDateFormat">{movieInfo.releaseDateFormat}</div>
      <div data-testid="rating">{movieInfo.rating}</div>
      <div data-testid="vis-title">{String(fieldVisibility.title)}</div>
      <div data-testid="vis-theater">{String(fieldVisibility.theater)}</div>
      <div data-testid="chainLabel">{components.chainLabel}</div>
      <div data-testid="formatLabel">{components.formatLabel}</div>
      <div data-testid="vis-chain">{String(components.chainVisible)}</div>
      <div data-testid="vis-format">{String(components.formatVisible)}</div>
      <FieldEditSheet activeField={field} onClose={() => {}} photo={photo} />
    </>
  );
}

function EditorHarness({ hideForm }: { hideForm?: boolean }) {
  const photo = usePhototicket();
  const { fieldVisibility } = photo.state;
  return (
    <>
      <div data-testid="vis-title">{String(fieldVisibility.title)}</div>
      <div data-testid="vis-actors">{String(fieldVisibility.actors)}</div>
      <EditorCanvas photo={photo} onPendingFetchChange={() => {}} hideFormSections={hideForm} />
    </>
  );
}

// 스탬프 이미지-있음 분기 검증용 — 마운트 시 로고 이미지 URL을 시드해 "이미지 제거" 경로를 태운다.
function StampImageHarness({ target, imageUrl }: { target: 'chain' | 'format'; imageUrl: string }) {
  const photo = usePhototicket();
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current) {
      seeded.current = true;
      photo.updateComponents({ [target]: imageUrl });
    }
  }, [photo, target, imageUrl]);
  const { components } = photo.state;
  return (
    <>
      <div data-testid="chain-img">{components.chain}</div>
      <div data-testid="format-img">{components.format}</div>
      <FieldEditSheet activeField={target} onClose={() => {}} photo={photo} />
    </>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
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

  // #260 경로 2 — 필수 필드(제목) 시트엔 헤더 눈 토글이 없어 숨길 방법이 없다.
  test('제목 시트: 헤더 눈 토글 미노출 → title 숨김 불가', async () => {
    render(<SheetHarness field="title" />);
    // 본문(제목 입력)은 렌더되지만 헤더 눈 토글은 없다.
    await screen.findByPlaceholderText('인터스텔라');
    expect(screen.queryByLabelText('제목 티켓에 표시')).toBeNull();
    expect(screen.getByTestId('vis-title').textContent).toBe('true');
  });
});

describe('StampSheet 극장/포맷 (#215 PART B)', () => {
  test('극장 텍스트 입력이 components.chainLabel을 갱신', async () => {
    render(<SheetHarness field="chain" />);
    const input = await screen.findByPlaceholderText('CGV');
    fireEvent.change(input, { target: { value: 'CGV' } });
    expect(screen.getByTestId('chainLabel').textContent).toBe('CGV');
  });

  test('포맷 텍스트 입력이 components.formatLabel을 갱신', async () => {
    render(<SheetHarness field="format" />);
    const input = await screen.findByPlaceholderText('IMAX');
    fireEvent.change(input, { target: { value: 'Dolby' } });
    expect(screen.getByTestId('formatLabel').textContent).toBe('Dolby');
  });

  test('포맷 자동완성: 타이핑이 프리셋을 필터하고 선택 시 formatLabel 지정', async () => {
    render(<SheetHarness field="format" />);
    const input = await screen.findByPlaceholderText('IMAX');
    // 'Do' → Dolby만 부분일치('D'는 4DX도 매치하므로 두 글자로 좁힌다).
    fireEvent.change(input, { target: { value: 'Do' } });
    const listbox = screen.getByRole('listbox', { name: '포맷 제안' });
    const opts = within(listbox).getAllByRole('option');
    expect(opts.length).toBe(1);
    expect(listbox.textContent).toContain('Dolby');
    // 옵션 클릭은 li(role=option)가 아니라 그 안의 버튼에 핸들러가 있으므로 버튼을 친다.
    // 프리셋 칩에도 'Dolby' 버튼이 있어 listbox 범위로 좁혀 특정한다.
    fireEvent.click(within(listbox).getByRole('button', { name: 'Dolby' }));
    expect(screen.getByTestId('formatLabel').textContent).toBe('Dolby');
  });

  test('포맷 자동완성: 매치 없는 값은 그대로 저장 + 안내 노출', async () => {
    render(<SheetHarness field="format" />);
    const input = await screen.findByPlaceholderText('IMAX');
    fireEvent.change(input, { target: { value: 'Laser' } });
    expect(screen.getByTestId('formatLabel').textContent).toBe('Laser');
    expect(screen.queryByRole('listbox', { name: '포맷 제안' })).toBeNull();
    expect(screen.queryByText(/목록에 없는 포맷이에요/)).not.toBeNull();
  });

  test('스탬프 헤더 눈 토글이 components.chainVisible/formatVisible를 갱신', async () => {
    render(<SheetHarness field="chain" />);
    expect(screen.getByTestId('vis-chain').textContent).toBe('true');
    fireEvent.click(await screen.findByLabelText('극장 로고 티켓에 표시'));
    expect(screen.getByTestId('vis-chain').textContent).toBe('false');
  });

  test('이미지 있음: "이미지 제거" 클릭 → blob revoke 후 이미지 URL 클리어(텍스트 복귀)', async () => {
    const revoked: string[] = [];
    const origRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = ((u: string) => revoked.push(u)) as typeof URL.revokeObjectURL;
    try {
      render(<StampImageHarness target="chain" imageUrl="blob:seeded-logo" />);
      // 이미지 브랜치가 렌더돼 "이미지 제거" 버튼이 뜬다.
      const removeBtn = await screen.findByText('이미지 제거');
      expect(screen.getByTestId('chain-img').textContent).toBe('blob:seeded-logo');
      fireEvent.click(removeBtn);
      // blob이면 revoke하고 이미지 URL을 비워 텍스트 대표로 복귀.
      expect(revoked).toContain('blob:seeded-logo');
      expect(screen.getByTestId('chain-img').textContent).toBe('');
    } finally {
      URL.revokeObjectURL = origRevoke;
    }
  });
});

describe('EditorCanvas hideFormSections (#215 PART A·B)', () => {
  // Logos 픽커(TheaterChainPicker/FormatPicker)는 렌더 경로가 사라져 제거됨(#231) — 이제 어느
  // 경로에서도 'Logos' 섹션은 없다. hideFormSections 게이트는 MovieInfoForm·아코디언만 남는다.
  test('true → MovieInfoForm·아코디언 미렌더, 포스터/표시항목은 유지', () => {
    render(<EditorHarness hideForm />);
    expect(screen.queryByText('KOBIS lookup')).toBeNull(); // MovieInfoForm 신호
    expect(screen.queryByText('Optional details')).toBeNull(); // 아코디언 신호
    // 포스터·표시항목은 그대로.
    expect(screen.queryByText(/표시 항목/)).not.toBeNull();
  });

  test('미전달(기본 false) → MovieInfoForm·아코디언 렌더(데스크톱)', () => {
    render(<EditorHarness />);
    expect(screen.queryByText('KOBIS lookup')).not.toBeNull();
    expect(screen.queryByText('Optional details')).not.toBeNull();
  });

  // #260 경로 1 — '전체 해제'는 필수 필드(제목)를 남기고 나머지만 끈다(제목 없는 티켓 방지).
  test("'전체 해제' 클릭 → title은 유지, 나머지는 off", () => {
    render(<EditorHarness />);
    expect(screen.getByTestId('vis-title').textContent).toBe('true');
    expect(screen.getByTestId('vis-actors').textContent).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '전체 해제' }));
    expect(screen.getByTestId('vis-title').textContent).toBe('true');
    expect(screen.getByTestId('vis-actors').textContent).toBe('false');
  });
});
