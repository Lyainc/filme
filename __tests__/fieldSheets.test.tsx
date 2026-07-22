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
import { MINIMAL_STAMP_MAX_SCALE } from '@/components/moods/MoodMinimal';
import type { TicketComponents } from '@/types';

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
      <div data-testid="signature">{movieInfo.signature}</div>
      <div data-testid="chainScale">{components.chainScale}</div>
      <div data-testid="signatureImage">{components.signatureImage}</div>
      <div data-testid="signatureScale">{components.signatureScale}</div>
      <FieldEditorBody target={field} photo={photo} />
    </>
  );
}

// 스탬프 이미지-있음 분기 검증용 — 마운트 시 로고 이미지 URL을 시드해 "이미지 제거"·크기 슬라이더
// 경로를 태운다. layout을 받아 Minimal 클램프(claude-review PR #487 P1) 검증에 재사용한다.
function StampImageHarness({
  target,
  imageUrl,
  layout = 'minimal',
}: {
  target: 'chain' | 'format';
  imageUrl: string;
  layout?: TicketComponents['layout'];
}) {
  const photo = usePhototicket();
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current) {
      seeded.current = true;
      photo.updateComponents({ [target]: imageUrl, layout });
    }
  }, [photo, target, imageUrl, layout]);
  const { components } = photo.state;
  return (
    <>
      <div data-testid="chain-img">{components.chain}</div>
      <div data-testid="format-img">{components.format}</div>
      <div data-testid="chainScale">{components.chainScale}</div>
      <div data-testid="formatScale">{components.formatScale}</div>
      <FieldEditorBody target={target} photo={photo} />
    </>
  );
}

// 서명 이미지-있음 분기 검증용 — StampImageHarness와 동형(#484).
function SignatureImageHarness({ imageUrl }: { imageUrl: string }) {
  const photo = usePhototicket();
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current) {
      seeded.current = true;
      photo.updateComponents({ signatureImage: imageUrl });
    }
  }, [photo, imageUrl]);
  const { components } = photo.state;
  return (
    <>
      <div data-testid="signatureImage">{components.signatureImage}</div>
      <div data-testid="signatureScale">{components.signatureScale}</div>
      <FieldEditorBody target="signature" photo={photo} />
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
    // 기본값은 미입력(0, #368) — 직접 입력 전엔 티켓에 평점이 노출되지 않는다.
    expect(screen.getByTestId('rating').textContent).toBe('0');
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

// claude-review PR #487 P1 — StampSheet가 신규 StampEditor로 리팩터되며 처음으로 필드 시트에
// 크기 슬라이더가 생겼는데, Minimal 무드의 실제 렌더 클램프(MoodMinimal.tsx의
// MINIMAL_STAMP_MAX_SCALE)를 몰라 상한이 항상 1.3이던 버그 — DesignRail/DesktopDesignPanel에서
// 이미 한 번 고쳤던 것과 같은 클래스(logoStampScale.test.tsx)가 이 표면에서 재발했다.
describe('StampEditor 크기 슬라이더 (#484 c2, claude-review PR #487 P1)', () => {
  test('Minimal 레이아웃: 상한이 MINIMAL_STAMP_MAX_SCALE로 클램프(죽은 구간 방지)', () => {
    render(<StampImageHarness target="chain" imageUrl="blob:logo" layout="minimal" />);
    const slider = screen.getByLabelText('크기');
    expect(slider.getAttribute('max')).toBe(String(MINIMAL_STAMP_MAX_SCALE));
    fireEvent.change(slider, { target: { value: '1.3' } }); // 상한 밖 입력 → max로 클램프
    expect(screen.getByTestId('chainScale').textContent).toBe(String(MINIMAL_STAMP_MAX_SCALE));
  });

  test('Minimal이 아닌 레이아웃: 상한이 전역 1.3 그대로', () => {
    render(<StampImageHarness target="format" imageUrl="blob:logo" layout="criterion" />);
    const slider = screen.getByLabelText('크기');
    expect(slider.getAttribute('max')).toBe('1.3');
    fireEvent.change(slider, { target: { value: '1.3' } });
    expect(screen.getByTestId('formatScale').textContent).toBe('1.3');
  });
});

describe('SignatureSheet (#484)', () => {
  test('텍스트 입력이 movieInfo.signature를 갱신(maxLength 20 유지, c7 — STAMP_LABEL_MAX 24 통일은 스코프 밖)', () => {
    render(<BodyHarness field="signature" />);
    const input = screen.getByRole('textbox', { name: '서명' }) as HTMLInputElement;
    expect(input.maxLength).toBe(20);
    fireEvent.change(input, { target: { value: '영화수집가' } });
    expect(screen.getByTestId('signature').textContent).toBe('영화수집가');
  });

  test('이미지 있음: "이미지 제거" 클릭 → signatureImage 클리어(텍스트 복귀, #141 비파괴 패턴)', async () => {
    render(<SignatureImageHarness imageUrl="blob:seeded-signature" />);
    const removeBtn = await screen.findByText('이미지 제거');
    expect(screen.getByTestId('signatureImage').textContent).toBe('blob:seeded-signature');
    fireEvent.click(removeBtn);
    expect(screen.getByTestId('signatureImage').textContent).toBe('');
  });

  // signature는 chain+format처럼 같은 그룹에 나란히 있어 폭 예산을 공유하지 않는 단독 렌더라
  // (stampWidthCap.test.tsx 예산 계산 대상 아님) Minimal에서도 클램프가 필요 없다 — 위 StampEditor
  // 크기 슬라이더 테스트와 대조되는 케이스.
  test('크기 슬라이더는 Minimal에서도 클램프 없이 전역 상한 1.3 그대로', () => {
    render(<SignatureImageHarness imageUrl="blob:seeded-signature" />);
    const slider = screen.getByLabelText('크기');
    expect(slider.getAttribute('max')).toBe('1.3');
    fireEvent.change(slider, { target: { value: '1.3' } });
    expect(screen.getByTestId('signatureScale').textContent).toBe('1.3');
  });
});
