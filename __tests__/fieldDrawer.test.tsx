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
import { describe, expect, test, afterEach, beforeEach, spyOn } from 'bun:test';
import { act, render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { INITIAL_STATE, usePhototicket } from '@/hooks/usePhototicket';
import type { SheetTarget } from '@/constants/fields';
import { FieldDrawer } from '@/components/v2/FieldDrawer';

let opened: SheetTarget[];
let closed: number;

const FOCUS_PHOTO = {
  state: INITIAL_STATE,
  updateFieldVisibility: () => {},
  updateComponents: () => {},
} as unknown as ReturnType<typeof usePhototicket>;

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

function CloseFocusHarness({ removeOpener = false }: { removeOpener?: boolean }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openerMounted, setOpenerMounted] = useState(true);
  return (
    <>
      {openerMounted && (
        <button type="button" onClick={() => setDrawerOpen(true)}>
          드로어 열기
        </button>
      )}
      {drawerOpen && (
        <FieldDrawer
          photo={FOCUS_PHOTO}
          onField={() => {}}
          onClose={() => {
            setDrawerOpen(false);
            if (removeOpener) setOpenerMounted(false);
          }}
        />
      )}
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

  test('(f) Escape → onClose (백드롭 탭과 같은 비드래그 대체 경로)', () => {
    render(<Harness />);
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(closed).toBe(1);
  });

  test('(g) StrictMode에서도 Escape로 닫으면 드로어를 연 트리거로 포커스가 돌아온다', () => {
    render(
      <StrictMode>
        <CloseFocusHarness />
      </StrictMode>
    );
    const opener = screen.getByRole('button', { name: '드로어 열기' });
    opener.focus();
    act(() => {
      fireEvent.click(opener);
    });

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(document.activeElement === opener).toBe(true);
  });

  test('(h) 닫는 동안 opener가 사라져도 detached 노드에 포커스하지 않는다', () => {
    render(<CloseFocusHarness removeOpener />);
    const opener = screen.getByRole('button', { name: '드로어 열기' });
    const focus = spyOn(opener, 'focus');
    opener.focus();
    focus.mockClear();
    act(() => {
      fireEvent.click(opener);
    });

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(opener.isConnected).toBe(false);
    expect(focus).not.toHaveBeenCalled();
  });

  // #355 리뷰 P1 — 로고 크롭 모달(body 포털)이 떠 있는 동안 드로어는 Escape를 모달에 양보한다.
  // rawSrc 세팅(파일 선택)까지만 태우고 모달 dynamic 로드는 기다리지 않는다 — cropOpen 신호는
  // rawSrc 기반이라 즉시 검증 가능.
  test('(i) 로고 크롭 열림 동안 Escape가 드로어를 닫지 않는다', () => {
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = (() => 'blob:raw-logo') as typeof URL.createObjectURL;
    try {
      render(<Harness />);
      const fileInput = screen.getByLabelText('극장 로고 이미지 파일') as HTMLInputElement;
      const file = new File(['x'], 'logo.png', { type: 'image/png' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(closed).toBe(0);
    } finally {
      URL.createObjectURL = origCreate;
    }
  });

  test('(j) 로고 크롭을 닫으면 드로어가 업로드 트리거 포커스 복원을 덮지 않는다', async () => {
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = (() => 'blob:raw-logo') as typeof URL.createObjectURL;
    try {
      render(<Harness />);
      const upload = screen.getByRole('button', { name: '극장 로고 이미지 업로드' });
      upload.focus();
      fireEvent.change(screen.getByLabelText('극장 로고 이미지 파일'), {
        target: { files: [new File(['x'], 'logo.png', { type: 'image/png' })] },
      });

      const crop = await screen.findByRole('dialog', { name: '로고 크롭' });
      fireEvent.click(within(crop).getByRole('button', { name: '닫기' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: '로고 크롭' }) === null).toBe(true));

      expect(document.activeElement === upload).toBe(true);
    } finally {
      URL.createObjectURL = origCreate;
    }
  });
});
