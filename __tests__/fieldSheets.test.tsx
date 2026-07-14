/**
 * #215 PART A 회귀 테스트 — 필드 편집 본문(FieldEditorBody/StampSheet).
 * 구 FieldEditSheet(vaul 하단시트) 하우징은 #355에서 제거 — 본문은 데스크톱 아코디언
 * (FieldAccordion)과 모바일 인플레이스 에디터(#354)가 공유하므로 FieldEditorBody를 직접 렌더한다.
 * (드로어 눈 토글·필수 필드 잠금은 fieldDrawer.test.tsx가 커버.)
 *
 * 셋업은 designRail.test.tsx 미러 — Harness가 usePhototicket()으로 실제 photo를 만들고, 상태는
 * DOM probe(data-testid)로 읽는다. 모듈 mock 없음(전역 누수 회피). localStorage는
 * usePhototicket 디바운스 저장분 격리를 위해 매 테스트 전후로 clear.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { useEffect, useRef } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import type { SheetTarget } from '@/constants/fields';
import { FieldEditorBody } from '@/components/v2/FieldEditorBody';

function BodyHarness({ field }: { field: SheetTarget }) {
  const photo = usePhototicket();
  const { movieInfo, components } = photo.state;
  return (
    <>
      <div data-testid="titleOg">{movieInfo.titleOg}</div>
      <div data-testid="watchDateFormat">{movieInfo.watchDateFormat}</div>
      <div data-testid="releaseDateFormat">{movieInfo.releaseDateFormat}</div>
      <div data-testid="rating">{movieInfo.rating}</div>
      <div data-testid="chainLabel">{components.chainLabel}</div>
      <div data-testid="formatLabel">{components.formatLabel}</div>
      <FieldEditorBody target={field} photo={photo} />
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
      <FieldEditorBody target={target} photo={photo} />
    </>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('FieldEditorBody 타입별 편집 (#215 PART A)', () => {
  test('text 본문: 원제 입력이 movieInfo.titleOg를 갱신', () => {
    render(<BodyHarness field="titleOg" />);
    const input = screen.getByRole('textbox', { name: '원제' });
    fireEvent.change(input, { target: { value: 'Interstellar' } });
    expect(screen.getByTestId('titleOg').textContent).toBe('Interstellar');
  });

  test('date 본문(관람일): 표기 칩이 watchDateFormat을 갱신', () => {
    render(<BodyHarness field="watchDate" />);
    expect(screen.getByTestId('watchDateFormat').textContent).toBe('kr-compact');
    // iso 샘플 칩.
    fireEvent.click(screen.getByRole('radio', { name: '2014-11-06' }));
    expect(screen.getByTestId('watchDateFormat').textContent).toBe('iso');
  });

  test('date 본문(개봉일): 표기 칩이 releaseDateFormat을 갱신', () => {
    render(<BodyHarness field="releaseDate" />);
    expect(screen.getByTestId('releaseDateFormat').textContent).toBe('kr-compact');
    fireEvent.click(screen.getByRole('radio', { name: '06·NOV·2014' }));
    expect(screen.getByTestId('releaseDateFormat').textContent).toBe('cinema-mono');
  });

  test('rating 본문: 별점 클릭이 movieInfo.rating을 갱신', () => {
    render(<BodyHarness field="rating" />);
    expect(screen.getByTestId('rating').textContent).toBe('5');
    // happy-dom의 getBoundingClientRect는 0 → computeRating이 정수 별점(4) 반환.
    fireEvent.click(screen.getByRole('radio', { name: '4점' }));
    expect(screen.getByTestId('rating').textContent).toBe('4');
  });
});

describe('StampSheet 극장/포맷 (#215 PART B)', () => {
  test('극장 텍스트 입력이 components.chainLabel을 갱신', () => {
    render(<BodyHarness field="chain" />);
    const input = screen.getByRole('textbox', { name: '극장 로고' });
    fireEvent.change(input, { target: { value: 'CGV' } });
    expect(screen.getByTestId('chainLabel').textContent).toBe('CGV');
  });

  test('포맷 텍스트 입력이 components.formatLabel을 갱신', () => {
    render(<BodyHarness field="format" />);
    const input = screen.getByRole('textbox', { name: '포맷 로고' });
    fireEvent.change(input, { target: { value: 'Dolby' } });
    expect(screen.getByTestId('formatLabel').textContent).toBe('Dolby');
  });

  test('이미지 있음: "이미지 제거" 클릭 → 이미지 URL 클리어(텍스트 복귀), revoke는 안 한다(#356)', async () => {
    const revoked: string[] = [];
    const origRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = ((u: string) => revoked.push(u)) as typeof URL.revokeObjectURL;
    try {
      render(<StampImageHarness target="chain" imageUrl="blob:seeded-logo" />);
      // 이미지 브랜치가 렌더돼 "이미지 제거" 버튼이 뜬다.
      const removeBtn = await screen.findByText('이미지 제거');
      expect(screen.getByTestId('chain-img').textContent).toBe('blob:seeded-logo');
      fireEvent.click(removeBtn);
      // 이미지 URL만 비워 텍스트 대표로 복귀. blob은 revoke하지 않는다 —
      // undo 히스토리(#356)가 이전 URL을 참조하므로 여기서 풀면 undo가 죽은 이미지를 복원한다.
      expect(revoked).toEqual([]);
      expect(screen.getByTestId('chain-img').textContent).toBe('');
    } finally {
      URL.revokeObjectURL = origRevoke;
    }
  });
});
