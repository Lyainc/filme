/**
 * #635·#615 회귀 테스트.
 *
 *  - rate limit(shared 윈도우 소진)이 "인식된 정보가 없어요"와 다른 안내로 갈리고, 그 뒤에도
 *    이탈 경로(포스터부터 올리기 · 직접 입력)가 막히지 않는다(#635 c2 · ac2).
 *  - 랜딩 히어로 auto-scroll 갤러리(#615, 2026-08-04 개정)의 샘플 클릭은 훑어보기가 아니라
 *    그 자리에서 셸의 진짜 components.layout을 커밋한다 — 그래야 크롭 프리셋이 방금 고른
 *    무드와 어긋나지 않는다(#529). 예전 무드칩(LayoutStrip)의 "훑어보고 다른 CTA가 나중에
 *    커밋" 미러 단계는 이 개정으로 폐기됐다(heroLayout/commitHeroLayout 삭제).
 */
import { useState } from 'react';
import { describe, expect, test, afterAll, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react';
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

describe('히어로 갤러리 샘플 클릭이 무드를 즉시 커밋한다 (#615, 2026-08-04 개정)', () => {
  const stubSample = () =>
    within(landing()).getByRole('button', { name: /^Stub 무드로 바로 시작/ });

  test('클릭 즉시 photo.state.components.layout이 그 무드로 바뀐다', () => {
    render(<Harness />);
    expect(captured.components.layout).toBe('minimal');

    fireEvent.click(stubSample());

    expect(captured.components.layout).toBe('stub');
  });

  test('클릭이 랜딩 오버레이를 걷는다 — 훑어보기용 중간 상태 없이 바로 편집 화면 진입', () => {
    render(<Harness />);
    expect(landing().classList.contains('fixed')).toBe(true);

    fireEvent.click(stubSample());

    expect(landing().classList.contains('fixed')).toBe(false);
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

  test('가로 슬롯 무드 샘플을 고른 직후 드롭해도 크롭 모달이 가로 프리셋(1.5)으로 연다', async () => {
    let photo!: ReturnType<typeof usePhototicket>;
    render(<DropRaceHarness onPhoto={(p) => { photo = p; }} />);
    expect(photo.state.components.layout).toBe('minimal'); // 기본값 — 세로 슬롯

    fireEvent.click(within(landing()).getByRole('button', { name: /^Stub 무드로 바로 시작/ }));

    fireEvent.drop(landing(), {
      dataTransfer: { files: [new File(['x'], 'poster.png', { type: 'image/png' })] },
    });

    // 갤러리 클릭이 먼저 실제 state를 'stub'으로 바꿨는지 확인 — previewComponents(고정된
    // 'minimal')와 갈라진 게 이 테스트의 전제다.
    expect(photo.state.components.layout).toBe('stub');

    const dialog = await screen.findByRole('dialog', { name: '포스터 크롭' });
    // ImageCropModal이 photo.state.components.layout('stub', 가로)을 읽으면 1.5, previewComponents
    // ('minimal', 고정)를 읽으면 0.6666...(2/3) — 고침 전엔 후자가 나와 이 assertion이 깨진다.
    const aspect = Number(within(dialog).getByTestId('crop-frame').getAttribute('data-aspect'));
    expect(aspect).toBeCloseTo(1.5, 2);
  });
});
