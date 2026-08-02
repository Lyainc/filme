/**
 * #635·#615 회귀 테스트.
 *
 *  - rate limit(shared 윈도우 소진)이 "인식된 정보가 없어요"와 다른 안내로 갈리고, 그 뒤에도
 *    이탈 경로(포스터부터 올리기 · 직접 입력)가 막히지 않는다(#635 c2 · ac2).
 *  - 랜딩 히어로의 무드칩 선택이 랜딩 로컬 state가 아니라 셸의 진짜 components.layout을
 *    커밋한다(#615, Seed spec blindspot 3번) — 그래야 이후 "포스터부터 올리기"로 넘어갔을 때
 *    크롭 프리셋이 랜딩에서 고른 무드와 어긋나지 않는다(#529).
 */
import { describe, expect, test, afterAll, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import type { PhototicketState } from '@/types';
import { mobileShellProps } from './shellHarness';

// runOcr must be mocked BEFORE MobileEditorShell (transitively imports it via OcrUploadCard) is
// loaded — bun's mock.module is not hoisted (같은 패턴, ocrUndoRestore.test.tsx 참고).
let ocrImpl: (file: File) => Promise<Record<string, unknown>> = async () => ({});
// 스프레드 스냅샷 + afterAll 복원(#611·#618) — CLAUDE.md 테스트 규칙.
const realOcr = { ...require('@/utils/ocr') };
mock.module('@/utils/ocr', () => ({
  ...realOcr,
  runOcr: (file: File) => ocrImpl(file),
}));

const { MobileEditorShell } =
  require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');
const { usePhototicket } =
  require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');

let captured: PhototicketState;

function Harness() {
  const photo = usePhototicket();
  captured = photo.state;
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

const landing = () => screen.getByTestId('landing');
const ocrFileInput = () =>
  document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;

afterEach(() => {
  cleanup();
  ocrImpl = async () => ({});
  localStorage.clear();
});

afterAll(() => {
  mock.module('@/utils/ocr', () => realOcr);
});

describe('OCR rate limit 이탈 경로 (#635 c2)', () => {
  test('shared 윈도우 소진 시 "인식 실패"와 다른 안내가 뜨고, 이탈 경로는 그대로 남는다', async () => {
    ocrImpl = async () => ({ rateLimited: true });
    render(<Harness />);

    fireEvent.change(ocrFileInput(), {
      target: { files: [new File(['x'], 'ticket.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(
        screen.getAllByText('지금 요청이 많아요. 잠시 후 다시 시도하거나 직접 입력해 주세요.').length
      ).toBeGreaterThan(0);
    });

    // 필드가 하나도 안 채워졌으니 랜딩은 계속 오버레이 — 이탈 경로가 여전히 화면에 있어야 한다.
    expect(landing().classList.contains('fixed')).toBe(true);
    expect(screen.getByRole('button', { name: '포스터부터 올리기' })).toBeDefined();
    expect(screen.getByTestId('landing-skip-poster')).toBeDefined();
    expect(captured.movieInfo.theater).toBe('');
  });
});

describe('랜딩 무드칩은 훑어보는 동안 진짜 state를 안 건드린다 (#615, fresh-context 리뷰가 잡은 회귀)', () => {
  test('무드칩 탭은 히어로 미리보기만 바꾸고 photo.state.components.layout·DesignRail은 그대로다', () => {
    render(<Harness />);
    expect(captured.components.layout).toBe('minimal');

    const stubChipInLanding = within(landing()).getByRole('radio', { name: 'Stub · 티켓 스텁 절취' });
    fireEvent.click(stubChipInLanding);

    // 즉시 커밋하면 dirtyTick이 올라 autosave-draft가 1초 뒤 draft를 써, 무드칩만 훑어본
    // 방문자에게도 다음 방문에 랜딩이 영구히 숨는다(회귀) — 그래서 여기서 실제 state는 안 바뀐다.
    expect(captured.components.layout).toBe('minimal');
    expect(stubChipInLanding.getAttribute('aria-checked')).toBe('true');
    // DesignRail의 같은 이름 라디오는 진짜 state(minimal)를 그대로 반영 — 랜딩 히어로와 갈린다.
    const allStubRadios = screen.getAllByRole('radio', { name: 'Stub · 티켓 스텁 절취' });
    expect(allStubRadios.length).toBeGreaterThan(1);
    const outsideLanding = allStubRadios.filter((r) => r !== stubChipInLanding);
    expect(outsideLanding.length).toBeGreaterThan(0);
    for (const radio of outsideLanding) {
      expect(radio.getAttribute('aria-checked')).toBe('false');
    }

    // 무드 탐색은 이탈이 아니다 — 랜딩은 여전히 오버레이로 남는다.
    expect(landing().classList.contains('fixed')).toBe(true);
  });

  test('"직접 입력"으로 진입하는 순간 훑어보던 무드가 진짜 state에 커밋된다', () => {
    render(<Harness />);
    fireEvent.click(within(landing()).getByRole('radio', { name: 'Stub · 티켓 스텁 절취' }));
    expect(captured.components.layout).toBe('minimal'); // 아직 커밋 전

    fireEvent.click(screen.getByTestId('landing-skip-poster'));

    // 진입 시점에 셸이 실제 state로 흘려보낸다 — 이후 크롭 프리셋·에디터가 이 무드를 쓴다(#529).
    expect(captured.components.layout).toBe('stub');
  });

  test('"포스터부터 올리기"로 진입하는 순간에도 커밋된다', () => {
    render(<Harness />);
    fireEvent.click(within(landing()).getByRole('radio', { name: 'Stub · 티켓 스텁 절취' }));

    fireEvent.click(screen.getByRole('button', { name: '포스터부터 올리기' }));

    expect(captured.components.layout).toBe('stub');
  });

  // 데스크톱 드래그드롭도 랜딩을 벗어나는 네 번째 경로다(#607) — CTA 클릭 3종만 잡으면 놓친다
  // (2차 fresh-context 리뷰가 잡은 회귀).
  test('랜딩에 포스터 파일을 드롭해 진입할 때도 커밋된다', () => {
    render(<Harness />);
    fireEvent.click(within(landing()).getByRole('radio', { name: 'Stub · 티켓 스텁 절취' }));
    expect(captured.components.layout).toBe('minimal'); // 아직 커밋 전

    fireEvent.drop(landing(), {
      dataTransfer: { files: [new File(['x'], 'poster.png', { type: 'image/png' })] },
    });

    expect(captured.components.layout).toBe('stub');
  });
});
