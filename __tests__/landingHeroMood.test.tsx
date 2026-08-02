/**
 * #635·#615 회귀 테스트.
 *
 *  - rate limit(shared 윈도우 소진)이 "인식된 정보가 없어요"와 다른 안내로 갈리고, 그 뒤에도
 *    이탈 경로(포스터부터 올리기 · 직접 입력)가 막히지 않는다(#635 c2 · ac2).
 *  - 랜딩 히어로의 무드칩 선택이 랜딩 로컬 state가 아니라 셸의 진짜 components.layout을
 *    커밋한다(#615, Seed spec blindspot 3번) — 그래야 이후 "포스터부터 올리기"로 넘어갔을 때
 *    크롭 프리셋이 랜딩에서 고른 무드와 어긋나지 않는다(#529).
 */
import { useState } from 'react';
import { describe, expect, test, afterAll, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// draft 복원(usePhototicket 마운트 후 useEffect, 비동기)이 heroLayout의 useState 초기화보다
// 늦게 끝나면, 무드칩을 한 번도 안 건드린 재방문자가 "직접 입력"·"포스터부터 올리기"를 눌렀을 때
// commitHeroLayout이 굳어 있던 기본값('minimal')으로 복원된 무드를 되돌려버린다(fresh-context
// 리뷰 P0). MobileEditorShell의 draftRestored 재동기화 effect가 이걸 막는지 검증한다.
describe('draft 복원 무드가 진입 시 덮이지 않는다 (fresh-context 리뷰 P0)', () => {
  const STORAGE_KEY = 'filme:phototicket:v1';

  afterEach(() => {
    localStorage.clear();
  });

  test('non-default 무드로 복원된 draft에서 "직접 입력"을 눌러도 무드가 유지된다', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ movieInfo: { title: '인터스텔라' }, components: { layout: 'stub' } })
    );

    await act(async () => {
      render(<Harness />);
    });
    await waitFor(() => expect(captured.components.layout).toBe('stub'));

    fireEvent.click(screen.getByTestId('landing-skip-poster'));

    // commitHeroLayout이 heroLayout(재동기화됐다면 'stub')과 실제 state('stub')가 같다고 보고
    // no-op해야 한다 — 재동기화가 안 됐다면 heroLayout이 'minimal'에 굳어 있어 여기서 되돌아간다.
    expect(captured.components.layout).toBe('stub');
  });
});

// 드롭존 onDrop이 commitHeroLayout()과 crop.openFile(file)을 같은 동기 핸들러에서 연달아 부른다
// (claude-review PR #636 2차 P0). ImageCropModal이 previewComponents.layout(pages/index.tsx의
// 280ms debounce)을 읽으면 방금 커밋한 무드가 아니라 그 debounce가 아직 안 따라잡은 직전 무드의
// 크롭 프리셋으로 열린다 — #529 invariant 위반. 실제 앱에선 debounce가 있지만 이 하네스의
// mobileShellProps는 previewComponents를 photo.state.components로 그대로 넘겨 항상 동기라
// 그 지연을 재현하지 못한다(2차 리뷰가 지적한 지점) — 그래서 여기서는 previewComponents를
// 마운트 시점 값에 고정해 "debounce가 영원히 안 따라잡은" 극단 케이스로 그 레이스를 강제한다.
describe('드롭존 진입이 debounce된 previewComponents가 아니라 실시간 무드로 크롭 프리셋을 연다 (claude-review PR #636 2차 P0)', () => {
  function DropRaceHarness({ onPhoto }: { onPhoto?: (p: ReturnType<typeof usePhototicket>) => void }) {
    const photo = usePhototicket();
    onPhoto?.(photo);
    // 마운트 시점('minimal', 세로 슬롯)에 고정 — 이후 photo.state.components.layout이 바뀌어도
    // 이 값은 안 따라간다. previewComponents가 debounce 중 멈춰 있는 순간을 그대로 흉내낸다.
    const [staleComponents] = useState(photo.state.components);
    return <MobileEditorShell {...mobileShellProps(photo, { previewComponents: staleComponents })} />;
  }

  test('가로 슬롯 무드로 갈아탄 직후 드롭해도 크롭 모달이 가로 프리셋(1.5)으로 연다', async () => {
    let photo!: ReturnType<typeof usePhototicket>;
    render(<DropRaceHarness onPhoto={(p) => { photo = p; }} />);
    expect(photo.state.components.layout).toBe('minimal'); // 기본값 — 세로 슬롯

    fireEvent.click(within(landing()).getByRole('radio', { name: 'Stub · 티켓 스텁 절취' }));

    fireEvent.drop(landing(), {
      dataTransfer: { files: [new File(['x'], 'poster.png', { type: 'image/png' })] },
    });

    // commitHeroLayout이 먼저 실제 state를 'stub'으로 바꿨는지 확인 — previewComponents(고정된
    // 'minimal')와 갈라진 게 이 테스트의 전제다.
    expect(photo.state.components.layout).toBe('stub');

    const dialog = await screen.findByRole('dialog', { name: '포스터 크롭' });
    // ImageCropModal이 photo.state.components.layout('stub', 가로)을 읽으면 1.5, previewComponents
    // ('minimal', 고정)를 읽으면 0.6666...(2/3) — 고침 전엔 후자가 나와 이 assertion이 깨진다.
    const aspect = Number(within(dialog).getByTestId('crop-frame').getAttribute('data-aspect'));
    expect(aspect).toBeCloseTo(1.5, 2);
  });
});

// heroLayout은 초기화(handleClearTap) 경로에서 재동기화되지 않았다(claude-review PR #636 3차
// P0) — 편집 중 바꾼 무드가 로컬 미러에 남은 채로 clearDraft가 실제 state만 'minimal'로 되돌리면,
// 리셋 직후 재진입에서 commitHeroLayout이 리셋 직전 무드를 되살린다.
describe('초기화(#310)가 heroLayout도 함께 되돌린다 (claude-review PR #636 3차 P0)', () => {
  test('편집 중 바꾼 무드로 진입했다가 초기화하면, 재진입 시 리셋 직전 무드가 되살아나지 않는다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 무드를 'stub'으로 골라 랜딩에서 커밋 — heroLayout이 'stub'으로 굳는다.
    fireEvent.click(within(landing()).getByRole('radio', { name: 'Stub · 티켓 스텁 절취' }));
    fireEvent.click(screen.getByTestId('landing-skip-poster'));
    expect(captured.components.layout).toBe('stub');

    // 초기화 2탭(#374 arm) — clearDraft가 실제 state를 'minimal'로 되돌린다.
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(screen.getByRole('button', { name: '초기화' }));
    await new Promise((r) => setTimeout(r, 400));
    await user.click(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' }));
    expect(captured.components.layout).toBe('minimal');

    // 랜딩이 다시 뜨고, 무드칩을 안 건드린 채 바로 재진입 — heroLayout이 같이 리셋 안 됐다면
    // commitHeroLayout이 여기서 'stub'을 되살린다.
    fireEvent.click(screen.getByTestId('landing-skip-poster'));
    expect(captured.components.layout).toBe('minimal');
  });
});
