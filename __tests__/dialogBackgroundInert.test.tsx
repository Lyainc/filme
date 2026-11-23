/**
 * #685 회귀 — 다이얼로그 배경 inert (ImageCropModal + useBodyScrollLock을 쓰는 다이얼로그 일반).
 *
 * aria-modal·포커스 트랩만으론 스크린리더 가상 커서(VoiceOver·TalkBack 스와이프 탐색)가 배경을
 * 읽는 걸 못 막는다 — 별도로 배경에 inert가 걸려야 한다. useBodyScrollLock이 두 층으로 관리한다:
 *  1. "앱 배경"(APP_BACKGROUND_ID — 헤더·본문·도크·툴바) 전체는 다이얼로그가 하나라도 열리면 inert.
 *  2. 다이얼로그끼리는 스택 최상위만 남기고 나머지(예: 다른 다이얼로그 위에 뜬 크롭 모달)는 inert.
 *
 * 앱 배경 **밖**의 토스트류(OcrUndoBanner·에러 토스트·ErrorToastHost)는 일부러 안 건드린다 —
 * z-60/70이 다이얼로그(z-50/55) 위에 계속 보이는 계약(PhoneFrame.tsx APP_BACKGROUND_ID 주석)이라
 * 다이얼로그가 열려도 안내·해제 기능이 죽으면 안 된다. 첫 구현(DOM 조상 경로를 걸어 올라가며
 * 형제를 지우는 방식)은 이 토스트 레이어까지 같이 삼켰다(#685 fresh-eyes 리뷰 지적) — 아래
 * 'toast-layer는 다이얼로그가 열려도 inert되지 않는다' 테스트가 그 회귀를 못박는다.
 *
 * 핵심 케이스는 중첩(#355 리뷰 P1) — 다이얼로그 위에 크롭 모달이 뜨면(필드 드로어 · 고급 설정이 사라진 #826 S2부터는
 * 도크 로고 행의 크롭 모달 위에 또 크롭이 뜨는 식의 중첩이 남는다. 아래 자리표시 다이얼로그가 그 아래층을 맡는다):
 *  1. 앱 배경은 계속 inert.
 *  2. 아래 다이얼로그 자신도 inert(더 이상 최상위가 아니므로).
 *  3. 크롭 모달이 닫히면 그 다이얼로그의 inert가 정확히 풀린다(다시 최상위).
 *
 * 실제 컴포넌트를 그대로 마운트/언마운트해 훅의 진짜 로직을 태운다 — mock 없음.
 * ImageCropModal은 dynamic() 래퍼가 아니라 직접 import(next/dynamic의 비동기
 * 청크 로딩 타이밍에 기대지 않기 위함).
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { useRef, useState } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import ImageCropModal from '@/components/ImageCropModal';
import { PHONE_FRAME_ID, APP_BACKGROUND_ID } from '@/components/v2/PhoneFrame';
// useBodyScrollLock에 dialogRef를 넘기는 최소 다이얼로그 — 삭제된 고급 설정 모달이 맡던 "아래층" 자리표시.
function StubDialog() {
  const rootRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(true, rootRef);
  return (
    <div ref={rootRef}>
      <div role="dialog" aria-modal="true" aria-label="자리표시 다이얼로그" />
    </div>
  );
}

// 실제 MobileEditorShell의 배치를 축약: 앱 배경(헤더·본문 등 대역) 안에 bg 프로브, 밖에
// 토스트 대역 프로브. 다이얼로그는 항상 이 둘과 형제로 붙는다(포털이면 #phone-frame에, 아니면
// 그 자리 그대로) — 실제 앱도 다이얼로그가 앱 배경 래퍼의 형제다(MobileEditorShell.tsx).
function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <div id={PHONE_FRAME_ID}>
      <div id={APP_BACKGROUND_ID}>
        <div data-testid="bg">배경</div>
      </div>
      <div data-testid="toast-layer">토스트</div>
      {children}
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('배경 inert — 단일 다이얼로그(#685)', () => {
  test('자리표시 다이얼로그: 앱 배경은 inert, 모달·토스트 레이어는 아님', () => {
    render(
      <Chrome>
        <StubDialog />
      </Chrome>,
    );
    expect(!!screen.getByTestId('bg').closest('[inert]')).toBe(true);
    expect(!!screen.getByTestId('toast-layer').closest('[inert]')).toBe(false);
    expect(screen.getByRole('dialog', { name: '자리표시 다이얼로그' }).parentElement?.inert).toBe(false);
  });

  test('ImageCropModal: 앱 배경은 inert, 모달·토스트 레이어는 아님', () => {
    // 포털 타깃(#phone-frame)은 첫 렌더에 한 번만 고정 조회한다(ImageCropModal.tsx 주석) — 같은
    // 커밋에 프레임과 모달을 같이 마운트하면 프레임이 아직 DOM에 없어 body로 폴백한다(실제 앱은
    // 프레임이 먼저 서고 모달이 나중에 열려 문제 없음). 테스트도 프레임을 먼저 커밋해야 한다.
    function CropOnlyHarness() {
      const [open, setOpen] = useState(false);
      return (
        <Chrome>
          <button type="button" onClick={() => setOpen(true)}>open-crop</button>
          {open && <ImageCropModal imageSrc="data:image/png;base64,x" onClose={() => {}} onComplete={() => {}} target="poster" accept="image/*" onPickFile={() => {}} />}
        </Chrome>
      );
    }
    render(<CropOnlyHarness />);
    fireEvent.click(screen.getByText('open-crop'));
    expect(!!screen.getByTestId('bg').closest('[inert]')).toBe(true);
    expect(!!screen.getByTestId('toast-layer').closest('[inert]')).toBe(false);
    expect(screen.getByRole('dialog', { name: '포스터 자르기' }).inert).toBe(false);
  });
});

// 중첩 — 다이얼로그 위 크롭 모달(#355 리뷰 P1이 필드 드로어로 잡던 계약). 크롭 모달은 파일 업로드 대신
// 버튼으로 마운트/언마운트를 직접 제어해 훅 로직만 격리 검증한다.
function NestedHarness() {
  const [cropOpen, setCropOpen] = useState(false);
  return (
    <Chrome>
      <StubDialog />
      <button type="button" onClick={() => setCropOpen((v) => !v)}>
        crop-toggle
      </button>
      {cropOpen && (
        <ImageCropModal imageSrc="data:image/png;base64,x" onClose={() => setCropOpen(false)} onComplete={() => {}} target="poster" accept="image/*" onPickFile={() => {}} />
      )}
    </Chrome>
  );
}

describe('배경 inert — 중첩(다이얼로그 위 크롭 모달, #355 리뷰 P1)', () => {
  test('크롭 모달이 열리면 앱 배경 + 아래 다이얼로그 자신까지 inert, 크롭 모달·토스트 레이어만 예외', () => {
    render(<NestedHarness />);
    const dialogRoot = () => screen.getByRole('dialog', { name: '자리표시 다이얼로그' }).parentElement as HTMLElement;

    // 아래 다이얼로그만 열린 상태 — 앱 배경만 inert, 다이얼로그는 아님.
    expect(!!screen.getByTestId('bg').closest('[inert]')).toBe(true);
    expect(!!screen.getByTestId('toast-layer').closest('[inert]')).toBe(false);
    expect(dialogRoot().inert).toBe(false);

    // 크롭 모달을 얹는다 — 최상위가 바뀐다.
    fireEvent.click(screen.getByText('crop-toggle'));
    expect(!!screen.getByTestId('bg').closest('[inert]')).toBe(true); // 앱 배경은 계속 inert
    expect(!!screen.getByTestId('toast-layer').closest('[inert]')).toBe(false); // 토스트 레이어는 여전히 예외
    expect(dialogRoot().inert).toBe(true); // 아래 다이얼로그 자신도 이제 inert(#355 요구사항)
    expect(screen.getByRole('dialog', { name: '포스터 자르기' }).inert).toBe(false); // 크롭 모달만 예외

    // 크롭 모달을 닫는다 — 아래 다이얼로그가 다시 최상위.
    fireEvent.click(screen.getByText('crop-toggle'));
    expect(!!screen.getByTestId('bg').closest('[inert]')).toBe(true); // 앱 배경은 여전히 inert(아래 다이얼로그가 아직 열려 있음)
    expect(!!screen.getByTestId('toast-layer').closest('[inert]')).toBe(false); // 토스트 레이어는 계속 예외
    expect(dialogRoot().inert).toBe(false); // 다이얼로그의 inert가 정확히 풀린다 — 이 회귀의 핵심 단언
  });
});
