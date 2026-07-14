/**
 * #355 회귀 테스트 — 모바일 필드 목록 우측 드로어.
 *
 * (a) 행 눈 토글 → fieldVisibility 갱신 (구 FieldEditSheet 헤더 눈 커버리지 이전).
 * (b) 필수 필드(제목)는 눈 스위치가 없고 자물쇠(토글 불가)만.
 * (c) 백드롭 탭 → onClose — 스와이프 닫기의 비드래그 대체 경로(WCAG 2.2 SC 2.5.7).
 * (d) 스탬프(로고) 행: 눈 토글이 chainVisible을 갱신 + 이미지 업로드 진입점 존재.
 * (e) 행 본문 탭 → onField(셸이 드로어를 닫고 인플레이스 편집을 여는 배선 계약).
 *
 * Harness가 usePhototicket()으로 실제 photo를 만들고 상태는 DOM probe로 읽는다(모듈 mock 없음).
 * localStorage는 usePhototicket 디바운스 저장분 격리를 위해 매 테스트 전후 clear.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import type { SheetTarget } from '@/constants/fields';
import { FieldDrawer } from '@/components/v2/FieldDrawer';

let opened: SheetTarget[];
let closed: number;

function Harness() {
  const photo = usePhototicket();
  const { fieldVisibility, components } = photo.state;
  return (
    <>
      <div data-testid="vis-theater">{String(fieldVisibility.theater)}</div>
      <div data-testid="vis-chain">{String(components.chainVisible)}</div>
      <FieldDrawer photo={photo} onField={(t) => opened.push(t)} onClose={() => closed++} />
    </>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  opened = [];
  closed = 0;
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('FieldDrawer (#355)', () => {
  test('(a) 행 눈 토글이 fieldVisibility를 갱신', () => {
    render(<Harness />);
    expect(screen.getByTestId('vis-theater').textContent).toBe('true');
    const eye = screen.getByRole('switch', { name: '극장 티켓에 표시' });
    expect(eye.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(eye);
    expect(screen.getByTestId('vis-theater').textContent).toBe('false');
    expect(eye.getAttribute('aria-checked')).toBe('false');
  });

  test('(b) 필수 필드(제목)는 눈 없이 자물쇠 — 토글 불가(#260)', () => {
    render(<Harness />);
    expect(screen.queryByRole('switch', { name: '제목 티켓에 표시' })).toBeNull();
    expect(screen.getByRole('img', { name: '제목 필수 항목' })).toBeDefined();
  });

  test('(c) 백드롭 탭 → onClose (스와이프의 비드래그 대체 경로, WCAG 2.2 SC 2.5.7)', () => {
    const { container } = render(<Harness />);
    const backdrop = container.querySelector('[aria-hidden="true"].absolute.inset-0') as HTMLElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop);
    expect(closed).toBe(1);
  });

  test('(d) 로고 행: 눈 토글이 chainVisible 갱신 + 이미지 업로드 진입점', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: '극장 로고 이미지 업로드' })).toBeDefined();
    const eye = screen.getByRole('switch', { name: '극장 로고 티켓에 표시' });
    fireEvent.click(eye);
    expect(screen.getByTestId('vis-chain').textContent).toBe('false');
  });

  test('(e) 행 본문 탭 → onField로 편집 위임', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '극장 편집' }));
    expect(opened).toEqual(['theater']);
  });
});
