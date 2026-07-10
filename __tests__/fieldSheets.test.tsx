/**
 * #215 PART A 회귀 테스트 — 필드 편집 시트(FieldEditSheet/StampSheet).
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
import { act, useEffect, useRef } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import type { SheetTarget } from '@/constants/fields';
import { FieldEditSheet } from '@/components/v2/FieldEditSheet';

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
    // 헤더 제목("원제")과 입력 aria-label("원제")이 같은 접근명이라 role=textbox로 입력을 특정
    // (헤더는 heading이라 role이 갈려 textbox 필터로 충돌 없음).
    const input = await screen.findByRole('textbox', { name: '원제' });
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
    await screen.findByRole('textbox', { name: '제목' });
    expect(screen.queryByLabelText('제목 티켓에 표시')).toBeNull();
    expect(screen.getByTestId('vis-title').textContent).toBe('true');
  });
});

describe('StampSheet 극장/포맷 (#215 PART B)', () => {
  test('극장 텍스트 입력이 components.chainLabel을 갱신', async () => {
    render(<SheetHarness field="chain" />);
    const input = await screen.findByRole('textbox', { name: '극장 로고' });
    fireEvent.change(input, { target: { value: 'CGV' } });
    expect(screen.getByTestId('chainLabel').textContent).toBe('CGV');
  });

  test('포맷 텍스트 입력이 components.formatLabel을 갱신', async () => {
    render(<SheetHarness field="format" />);
    const input = await screen.findByRole('textbox', { name: '포맷 로고' });
    fireEvent.change(input, { target: { value: 'Dolby' } });
    expect(screen.getByTestId('formatLabel').textContent).toBe('Dolby');
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

// #274/#314 — 시트 크기의 visualViewport 추적. happy-dom엔 visualViewport가 없어(effect가
// 조기 반환해 '72dvh' 폴백) 가짜 EventTarget을 window에 심어 리사이즈 → 크기 갱신을 검증한다.
// happy-dom의 window.innerHeight는 768 고정이라, vv.height와의 차로 "키보드 열림"이 갈린다.
describe('FieldEditSheet visualViewport 키보드 캡 (#274, #314)', () => {
  class FakeVisualViewport extends EventTarget {
    height = 844;
  }

  afterEach(() => {
    // 전역 window 오염이 파일 간 새지 않게 원복(bun 전역 누수 주의).
    delete (window as unknown as { visualViewport?: unknown }).visualViewport;
  });

  test('키보드 닫힘(vv≈전체 높이): 기존 min(72dvh, vv-24) 캡 유지', async () => {
    const vv = new FakeVisualViewport();
    (window as unknown as { visualViewport: unknown }).visualViewport = vv;

    render(<SheetHarness field="title" />);
    const content = document.querySelector('[data-vaul-drawer]') as HTMLElement;
    expect(content).not.toBeNull();
    expect(content.getAttribute('style')).toContain('min(72dvh, 820px)');
  });

  test('키보드 열림(vv가 768보다 100px+ 작음): height를 고정해 필드 간 시트 크기를 통일(#314)', async () => {
    const vv = new FakeVisualViewport();
    (window as unknown as { visualViewport: unknown }).visualViewport = vv;
    render(<SheetHarness field="title" />);
    const content = document.querySelector('[data-vaul-drawer]') as HTMLElement;

    // 키보드가 뜬 상황 시뮬레이션 — visual viewport 축소(768 - 508 = 260px > 100px 임계값).
    await act(async () => {
      vv.height = 508;
      vv.dispatchEvent(new Event('resize'));
    });
    // 콘텐츠 높이가 아니라 vv.height - 헤더 여유(72px)로 고정 — 필드가 뭐든 동일한 크기.
    expect(content.getAttribute('style')).toContain('max-height: 436px');
    expect(content.getAttribute('style')).toContain('height: 436px');
  });

  test('visualViewport 미지원 환경은 72dvh 폴백', () => {
    render(<SheetHarness field="title" />);
    const content = document.querySelector('[data-vaul-drawer]') as HTMLElement;
    expect(content.getAttribute('style')).toContain('72dvh');
    expect(content.getAttribute('style')).not.toContain('px)');
  });
});
