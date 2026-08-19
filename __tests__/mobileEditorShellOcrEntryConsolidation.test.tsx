/**
 * #388 회귀 테스트 — 본문 OCR 카드를 업로드 후 CSS hidden으로 바꾸고 드로어로 일원화하면서,
 * #363(커밋 514baab)·PR #372 리뷰 P1이 고친 "in-flight KOBIS 보강이 mountedRef 가드에 조용히
 * 버려지는" 회귀가 재현되지 않는지 실제 타이밍으로 검증한다.
 *
 * 두 시나리오를 모두 다룬다:
 *  1. 랜딩→업로드 전환(본문 카드 hidden화, unmount 아님) 중 in-flight KOBIS 응답 도착.
 *  2. 드로어에서 OCR 시작 → 응답 전에 드로어를 닫음(FieldDrawer는 "닫힘 = 즉시 unmount") — 업로드
 *     후 유일한 접근 가능 OCR 진입점이 드로어이므로, 이 경로가 안전하지 않으면 #388 자체가 같은
 *     클래스의 리그레션을 새로 만든 것이다(claude-review PR #413 P0 지적).
 *
 * 두 경우 모두 setInfo(kobisInfo)는 OcrUploadCard 인스턴스가 아니라 셸이 쥔 photo 상태를
 * 갱신하므로, 그 인스턴스가 사라져도 응답이 여전히 최신이면(ocrEpochRef, #388 useOcrUndo.ts)
 * 반영돼야 한다.
 */
import { describe, expect, test, afterAll, afterEach, mock, spyOn } from 'bun:test';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PhototicketState } from '@/types';

// runOcr must be mocked BEFORE MobileEditorShell (which transitively imports it via
// OcrUploadCard) is loaded — bun's mock.module is not hoisted, so the shell is
// pulled in via require below, after this registration (ocrUndoRestore.test.tsx와 동일 패턴).
let ocrImpl: (file: File) => Promise<Record<string, unknown>> = async () => ({});
// 스프레드 스냅샷 + afterAll 복원(#611·#618) — `require()`가 주는 건 살아있는 네임스페이스라
// mock.module이 그 객체를 제자리에서 갈아끼운다. 복사본으로 떠 둬야 복원이 진짜 복원이 된다.
// 안 되돌리면 이 runOcr 스텁이 프로세스 끝까지 남아, 뒤 파일이 실제 OCR 호출 대신 이 파일이
// 마지막에 심어둔 ocrImpl을 받는다.
const realOcr = { ...require('@/utils/ocr') };
mock.module('@/utils/ocr', () => ({
  ...realOcr,
  runOcr: (file: File) => ocrImpl(file),
}));

// @/utils/kobisLookup은 mock.module하지 않고 global.fetch만 스텁한다 — mock.module하면
// kobisLookup.test.ts가 같은 프로세스에서 이 mock을 받아버린다(bun mock.module 전역 누수,
// ocrUndoRestore.test.tsx와 동일 근거).
const { clearKobisLookupCache } =
  require('@/utils/kobisLookup') as typeof import('@/utils/kobisLookup');
const { MobileEditorShell } =
  require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');
const { usePhototicket } =
  require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');

let captured: PhototicketState;

function MobileHarness() {
  const photo = usePhototicket();
  captured = photo.state;
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed-poster
      </button>
      <MobileEditorShell
        photo={photo}
        canExport
        theme="light"
        onThemeChange={() => {}}
        onDone={() => {}}
        disabledReason=""
        previewMovieInfo={photo.state.movieInfo}
        previewComponents={{ ...photo.state.components, layout: 'stub' }}
        fieldVisibility={photo.state.fieldVisibility}
      />
    </>
  );
}

/** The shell mounts multiple file inputs; the OCR card's is the only `image/*` one. */
function ocrFileInput(): HTMLInputElement {
  const inputs = Array.from(
    document.querySelectorAll('input[type="file"]'),
  ) as HTMLInputElement[];
  const input = inputs.find((i) => i.getAttribute('accept') === 'image/*');
  if (!input) throw new Error('OcrUploadCard file input not found');
  return input;
}

/** 드로어가 열려 있으면 본문(hidden) 인스턴스와 드로어 인스턴스 둘 다 image/* input을 갖는다 —
 *  드로어 안으로 스코프해 특정한다. */
function ocrFileInputWithin(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement | null;
  if (!input) throw new Error('OcrUploadCard file input not found within container');
  return input;
}

/** KOBIS search+detail fetch를 수동으로 resolve 가능한 상태로 스텁 — in-flight 타이밍을 테스트가 직접 제어한다. */
function mockPendingKobisFetch() {
  let resolveSearch!: (value: unknown) => void;
  let resolveDetail!: (value: unknown) => void;
  const searchPromise = new Promise((resolve) => {
    resolveSearch = resolve;
  });
  const detailPromise = new Promise((resolve) => {
    resolveDetail = resolve;
  });

  spyOn(global, 'fetch').mockImplementation((async (url: string) => {
    if (url.includes('/api/kobis/search')) return searchPromise;
    if (url.includes('/api/kobis/detail')) return detailPromise;
    throw new Error(`unexpected url: ${url}`);
  }) as unknown as typeof fetch);

  return {
    resolveWithGrandBudapest() {
      resolveSearch({
        ok: true,
        json: async () => ({
          movieListResult: {
            movieList: [
              {
                movieCd: '20147727',
                movieNm: '그랜드 부다페스트 호텔',
                movieNmEn: 'The Grand Budapest Hotel',
                openDt: '20140320',
              },
            ],
          },
        }),
      });
      resolveDetail({ ok: true, json: async () => ({ movieInfoResult: { movieInfo: {} } }) });
    },
  };
}

afterEach(() => {
  cleanup();
  ocrImpl = async () => ({});
  clearKobisLookupCache();
  mock.restore();
});

afterAll(() => {
  mock.module('@/utils/ocr', () => realOcr);
});

describe('in-flight KOBIS 보강이 OCR 카드 인스턴스 소멸 이후에도 반영된다 (#388)', () => {
  test('랜딩에서 OCR 시작 → KOBIS 응답 전에 포스터 업로드(본문 카드 hidden 전환) → 응답 도착 시 titleOg/releaseDate가 폼에 반영된다', async () => {
    const { resolveWithGrandBudapest } = mockPendingKobisFetch();

    render(<MobileHarness />);
    expect(captured.movieInfo.titleOg).toBe('');

    ocrImpl = async () => ({ title: '그랜드 부다페스트 호텔' });

    // 랜딩(포스터 업로드 전) 상태에서 OCR 트리거 — title만 인식되면 직접 필드는 없어
    // "제목으로 영화 정보를 검색할게요" 토스트가 뜬다. 이 시점에 KOBIS search fetch가 이미
    // 호출된 상태(searchPromise가 아직 pending).
    fireEvent.change(ocrFileInput(), {
      target: { files: [new File(['x'], 'ticket.png', { type: 'image/png' })] },
    });
    // OcrUploadCard는 토스트를 시각 div + sr-only 라이브리전 두 곳에 동시 렌더하므로(#199) 텍스트가
    // 항상 2곳에 잡힌다 — findByText(단일 매치 기대)가 아니라 findAllByText로 대기(mobileEditorShellMenu.test.tsx와 동일 컨벤션).
    await waitFor(() => {
      expect(screen.getAllByText('제목으로 영화 정보를 검색할게요.').length).toBeGreaterThan(0);
    });

    // KOBIS 검색이 아직 in-flight인 동안 포스터를 업로드 — 본문 OcrUploadCard가 CSS hidden으로
    // 전환된다(#388). 테스트 환경엔 Tailwind CSS가 없어 getByRole은 여전히 노드를 찾으므로(값
    // 자체는 mobileChromeOrder.test.tsx와 동일 이유), .hidden 조상 존재로 직접 확인한다 — 핵심은
    // 이 시점에도 노드가 여전히 DOM에 존재(=unmount 아님)해야 한다는 것.
    fireEvent.click(screen.getByText('seed-poster'));
    const ocrCard = screen.getByRole('button', { name: '티켓 스크린샷으로 자동입력' });
    expect(ocrCard.closest('.hidden')).not.toBeNull();

    resolveWithGrandBudapest();

    await waitFor(() => {
      expect(captured.movieInfo.title).toBe('그랜드 부다페스트 호텔');
      expect(captured.movieInfo.titleOg).toBe('The Grand Budapest Hotel');
      expect(captured.movieInfo.releaseDate).toBe('2014-03-20');
    });
  });

  // 랜딩을 걷는 세 번째 조건(#614 ③, claude-review PR #622 2R P1) — 앞의 두 조건(드래프 복원 D7,
  // CTA 파일 선택)은 landingOverlay.test.tsx가 잡지만, OCR-only 경로는 포스터가 없는 채로
  // landingDismissed만으로 걷혀야 해서 croppedImageUrl로는 대체 관측이 안 된다. 위 테스트는
  // seed-poster를 먼저 눌러 croppedImageUrl이 앞서므로 이 축을 우회한다.
  //
  // #652가 요구하던 "본문 주 CTA·이탈 경로도 함께 숨는다"는 #674(Landing 컨테이너 자체가 hidden)를
  // 거쳐 #727에서 **컨테이너 하나로 일원화**됐다: 랜딩 모드가 overlay/hidden 2값이 되면서 안쪽만
  // 숨겨야 하는 상태(inline)가 코드에서 사라졌고, 그래서 ocrApplied 프로퍼티도 함께 삭제됐다.
  // 지키려던 명제("6개 항목이 자동 입력되었어요" 배너 옆에 방금 쓴 그 CTA가 남으면 안 된다)는
  // 그대로다 — 이제 루트 hidden이 그걸 통째로 진다. unmount는 아니다(#297 P1, #614/#624 계약).
  test('포스터 없이 OCR로 직접 필드가 인식되면 랜딩 컨테이너가 통째로 걷힌다 (#614 걷는 조건 ③, #652 → #727)', async () => {
    render(<MobileHarness />);
    const landing = () => screen.getByTestId('landing');
    expect(landing().classList.contains('fixed')).toBe(true);

    // 제목-only가 아니라 직접 필드 — KOBIS 검색을 안 타고 onOcrApply가 그 자리에서 호출된다.
    ocrImpl = async () => ({ theater: 'CGV 용산아이파크몰' });

    const ocrCard = screen.getByRole('button', { name: '티켓 스크린샷으로 자동입력' });
    const posterExit = screen.getByRole('button', { name: '포스터 업로드' });
    fireEvent.change(ocrFileInput(), {
      target: { files: [new File(['x'], 'ticket.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(captured.movieInfo.theater).toBe('CGV 용산아이파크몰');
    });
    // 포스터는 여전히 없다 — 걷힌 근거가 croppedImageUrl이 아니라 landingDismissed임을 고정한다.
    expect(captured.croppedImageUrl).toBeFalsy();
    expect(landing().classList.contains('fixed')).toBe(false);
    // 캔버스가 섰으므로 컨테이너 자체가 hidden — unmount는 아니다(#674, #297 P1).
    expect(landing().classList.contains('hidden')).toBe(true);
    expect(screen.getByTestId('landing')).toBeTruthy();
    // 주 CTA·이탈 경로는 unmount가 아니라 그 루트의 CSS hidden 안에 남는다(#614/#624 remount 금지
    // 계약 유지) — 트리에서 빠지면 OcrUploadCard 단일 인스턴스 계약이 깨진다.
    // `closest('.hidden')`으로 재는 게 하중이다 — 둘이 같은 래퍼에 있다는 것만 재면 그 래퍼가
    // testid로 잡은 형제라 구조상 항상 참이라, 숨김이 통째로 사라져도 통과한다.
    const ctaWrap = screen.getByTestId('landing-exit-paths').parentElement!;
    expect(ctaWrap.contains(ocrCard)).toBe(true);
    expect(ctaWrap.contains(posterExit)).toBe(true);
    expect(!!ocrCard.closest('.hidden')).toBe(true);
    expect(!!posterExit.closest('.hidden')).toBe(true);
  });

  // claude-review PR #658 P1 — 초기화(handleClearTap)가 landingDismissed를 false로 되돌리는 줄을
  // 잠근다. 안 되돌아가면 새 문서를 열어도 랜딩이 영영 안 뜨고 빈 셸에 남는다(#614 → #727).
  test('OCR로 랜딩이 걷힌 뒤 초기화하면 오버레이 랜딩이 온전히 복귀한다 (#652 → #727)', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    ocrImpl = async () => ({ theater: 'CGV 용산아이파크몰' });
    fireEvent.change(ocrFileInput(), {
      target: { files: [new File(['x'], 'ticket.png', { type: 'image/png' })] },
    });
    await waitFor(() => {
      expect(captured.movieInfo.theater).toBe('CGV 용산아이파크몰');
    });
    const landing = () => screen.getByTestId('landing');
    expect(landing().classList.contains('fixed')).toBe(false);
    expect(!!screen.getByRole('button', { name: '포스터 업로드' }).closest('.hidden')).toBe(true);

    // 초기화 2탭(#374) — 더블탭 가드(350ms) 밖에서 재탭해야 실행된다.
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(screen.getByRole('button', { name: '초기화' }));
    await new Promise((r) => setTimeout(r, 400));
    await user.click(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' }));

    // 새 문서 — 오버레이 랜딩이 다시 뜨고, 그 안 CTA·이탈 경로도 더 이상 숨어 있지 않다.
    expect(landing().classList.contains('fixed')).toBe(true);
    expect(!!screen.getByRole('button', { name: '티켓 스크린샷으로 자동입력' }).closest('.hidden')).toBe(false);
    expect(!!screen.getByRole('button', { name: '포스터 업로드' }).closest('.hidden')).toBe(false);
  });

  test('드로어에서 OCR 시작 → KOBIS 응답 전에 드로어를 닫아도(unmount) 응답 도착 시 titleOg/releaseDate가 폼에 반영된다 (claude-review PR #413 P0)', async () => {
    const { resolveWithGrandBudapest } = mockPendingKobisFetch();

    render(<MobileHarness />);
    fireEvent.click(screen.getByText('seed-poster')); // 드로어는 croppedImageUrl이 있어야 열린다.
    expect(captured.movieInfo.titleOg).toBe('');

    ocrImpl = async () => ({ title: '그랜드 부다페스트 호텔' });

    fireEvent.click(screen.getByRole('button', { name: '티켓 항목 목록' }));
    const drawer = await screen.findByRole('dialog', { name: '티켓 항목' });

    fireEvent.change(ocrFileInputWithin(drawer), {
      target: { files: [new File(['x'], 'ticket.png', { type: 'image/png' })] },
    });
    await waitFor(() => {
      expect(within(drawer).getAllByText('제목으로 영화 정보를 검색할게요.').length).toBeGreaterThan(0);
    });

    // Escape로 드로어를 닫는다 — FieldDrawer는 "마운트 = 열림, 닫힘은 즉시 unmount"라(FieldDrawer.tsx)
    // 이 드로어 인스턴스의 OcrUploadCard는 이 시점에 정말로 사라진다(hidden이 아니라 unmount).
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '티켓 항목' })).toBeNull();

    // 드로어(및 그 안의 OcrUploadCard 인스턴스)가 사라진 뒤에 KOBIS 응답이 도착한다 — ocrEpochRef가
    // 셸 레벨에서 "이 실행이 여전히 최신"임을 판단하므로, 인스턴스 소멸과 무관하게 반영돼야 한다.
    resolveWithGrandBudapest();

    await waitFor(() => {
      expect(captured.movieInfo.title).toBe('그랜드 부다페스트 호텔');
      expect(captured.movieInfo.titleOg).toBe('The Grand Budapest Hotel');
      expect(captured.movieInfo.releaseDate).toBe('2014-03-20');
    });
  });
});
