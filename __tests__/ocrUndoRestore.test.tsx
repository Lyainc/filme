/**
 * Regression test for #163 (and the #141 review P1 it codifies).
 *
 * OCR injection mutates two separate slices of state at once:
 *  - form fields (theater/seat/... on `movieInfo`), and
 *  - chain components (`chainVisible`/`chainLabel`), which land in the
 *    exported ticket — the P1 bug was that undo reverted the form fields but
 *    NOT `chainLabel`, leaving a stale brand label baked into the export.
 *
 * This drives the real OcrUploadCard ↔ useOcrUndo state flow through
 * @testing-library/react + user-event, with only `runOcr` mocked, and asserts
 * that "되돌리기" (undo) restores BOTH slices atomically to the pre-OCR snapshot.
 * If handleCancelOcr stops reverting the component snapshot, this fails.
 *
 * Renders MobileEditorShell (the #261 production path), which itself owns
 * useOcrUndo + OcrUploadCard + OcrUndoBanner — the real wiring users hit. Guards the
 * shell's own prop wiring (ocr.apply / setComponents / currentComponents / banner onCancel).
 */
import { describe, expect, test, afterAll, afterEach, mock, spyOn } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PhototicketState } from '@/types';
import { STAMP_LABEL_MAX } from '@/constants/fields';

// runOcr must be mocked BEFORE MobileEditorShell (which transitively imports it via
// OcrUploadCard) is loaded — bun's mock.module is not hoisted, so the shell is
// pulled in via require below, after this registration.
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

// title 인식 시 OcrUploadCard가 트리거하는 비동기 KOBIS 보강(triggerKobisLookup)은 실제 모듈을
// 그대로 두고 global.fetch만 스텁한다 — @/utils/kobisLookup을 mock.module하면 실제 구현을
// 검증하는 kobisLookup.test.ts가 같은 프로세스에서 이 mock을 받아버린다(bun mock.module은
// 파일 간 격리가 안 되는 프로세스 전역이라 — bun-mock-module-global-leak 메모).
const { clearKobisLookupCache } =
  require('@/utils/kobisLookup') as typeof import('@/utils/kobisLookup');

// require (not top-level await import) so the shell loads AFTER the mock above
// without tripping the es5 target's no-top-level-await rule.
const { MobileEditorShell } =
  require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');
const { usePhototicket } =
  require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');

// The Harness owns the real phototicket state (like the page does) and exposes
// the latest snapshot so assertions read the source of truth, not the DOM.
let captured: PhototicketState;

// 프로덕션 OCR 배선은 MobileEditorShell이 직접 쥔 useOcrUndo/OcrUploadCard/OcrUndoBanner다. layout은
// preview 렌더와 무관한 'stub'(OCR은 croppedImageUrl 없이도 동작 — 카드가 collapse 밖·미게이팅).
function MobileHarness() {
  const photo = usePhototicket();
  captured = photo.state;
  return (
    <>
      {/* #328 max 회귀 테스트 전용 시드 — ZoomSegment pill은 croppedImageUrl이 있어야 렌더된다. */}
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed-poster
      </button>
      {/* #348 전용 시드 — formatVisible 기본값이 true라, OCR이 노출을 실제로 "켜는지" 보려면
          꺼둔 상태에서 출발해야 한다(기본값에 기대면 아무것도 검증 못 한다). */}
      <button type="button" onClick={() => photo.updateComponents({ formatVisible: false })}>
        seed-format-off
      </button>
      {/* #737 전용 시드 — 랜딩이 아직 안 걷힌 상태(landingDismissed=false)에서 이미 movieInfo가
          채워져 있는 걸 흉내낸다(복원된 draft). "새로 시작" OCR 경로가 이 값을 리셋해야 한다. */}
      <button
        type="button"
        onClick={() => photo.updateMovieInfo({ theater: '인터스텔라 극장', title: '인터스텔라' })}
      >
        seed-draft-theater
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
    document.querySelectorAll('input[type="file"]')
  ) as HTMLInputElement[];
  const input = inputs.find((i) => i.getAttribute('accept') === 'image/*');
  if (!input) throw new Error('OcrUploadCard file input not found');
  return input;
}

afterEach(() => {
  cleanup();
  ocrImpl = async () => ({});
  clearKobisLookupCache();
  // fetch spy는 중간 단언이 실패해도 항상 복원되도록 afterEach에서 처리한다(claude-review
  // PR #397 P2 — 테스트 끝에서만 수동 mockRestore하면 실패 시 다음 테스트로 누수될 수 있었다).
  mock.restore();
});

afterAll(() => {
  mock.module('@/utils/ocr', () => realOcr);
});

describe('OCR undo restoration (#163 / #141 P1)', () => {
  // #261 P1: 셸이 직접 소유한 배선(ocr.apply / setComponents / currentComponents / 배너 onCancel)을
  // 검증 — 프로덕션 모바일이 타는 실제 경로.
  test('MobileEditorShell 경로: undo가 chainVisible/chainLabel + 폼 필드를 원자 복원', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    expect(captured.components.chainLabel).toBe('');
    expect(captured.components.chainVisible).toBe(true);
    expect(captured.movieInfo.theater).toBe('');
    expect(captured.movieInfo.seat).toBe('');

    ocrImpl = async () => ({
      chain: 'cgv',
      theater: 'CGV 용산아이파크몰',
      seat: 'H12',
    });

    await user.upload(
      ocrFileInput(),
      new File(['x'], 'ticket.png', { type: 'image/png' })
    );

    const undoButton = await screen.findByRole('button', { name: '되돌리기' });
    expect(captured.components.chainLabel).toBe('CGV');
    expect(captured.components.chainVisible).toBe(true);
    expect(captured.movieInfo.theater).toBe('CGV 용산아이파크몰');
    expect(captured.movieInfo.seat).toBe('H12');

    await user.click(undoButton);

    expect(captured.components.chainLabel).toBe(''); // #141 P1: 라벨 원자 복원
    expect(captured.components.chainVisible).toBe(true);
    expect(captured.movieInfo.theater).toBe('');
    expect(captured.movieInfo.seat).toBe('');

    // `!!` 강제 변환 — 사유는 #693(CLAUDE.md 테스트 절).
    await waitFor(() => {
      expect(!!screen.queryByRole('button', { name: '되돌리기' })).toBe(false);
    });
  });

  // #348: chain과 대칭으로 format도 라벨 자동 채움 + 스탬프 노출 ON. 상태만이 아니라 티켓
  // 프리뷰에 스탬프가 실제로 찍히는 것까지 본다 — formatLabel은 export에 들어가므로 undo도
  // chain과 똑같이 원자 복원해야 한다(#141 리뷰 P1과 같은 이유).
  test('OCR이 인식한 format이 포맷 스탬프를 켜고, undo가 라벨·노출을 되돌린다', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    // 랜딩을 먼저 걷어야 한다 — #737부터 랜딩이 안 걷힌 채(landingDismissed=false) OCR을 돌리면
    // "새로 시작" 경로가 문서를 리셋해 아래 시드가 지워진다. 실제 프로덕션에서도 포스터가 있는
    // 문서는 항상 landingDismissed=true를 동반하므로(handlePosterCropComplete) 이 순서가 실제 흐름과 맞다.
    await user.click(screen.getByTestId('landing-skip-poster'));

    // 티켓 프리뷰(TicketRenderer)는 croppedImageUrl이 있어야 렌더된다 — 스탬프를 눈으로 보려면 필요.
    await user.click(screen.getByText('seed-poster'));
    await user.click(screen.getByText('seed-format-off'));
    expect(captured.components.formatVisible).toBe(false);
    expect(captured.components.formatLabel).toBe('');
    expect(screen.queryByText('IMAX')).toBeNull();

    ocrImpl = async () => ({
      chain: 'cgv',
      format: 'IMAX',
      theater: '영등포타임스퀘어',
    });

    await user.upload(
      ocrFileInput(),
      new File(['x'], 'ticket.png', { type: 'image/png' })
    );

    const undoButton = await screen.findByRole('button', { name: '되돌리기' });
    expect(captured.components.formatVisible).toBe(true);
    expect(captured.components.formatLabel).toBe('IMAX');
    expect(screen.getAllByText('IMAX').length).toBeGreaterThan(0);

    await user.click(undoButton);

    expect(captured.components.formatVisible).toBe(false);
    expect(captured.components.formatLabel).toBe('');
    expect(screen.queryByText('IMAX')).toBeNull();
    // chain 스냅샷이 format과 한 객체에 실려도 서로 덮지 않는지 — 같은 prevComponents를 공유한다.
    expect(captured.components.chainLabel).toBe('');
  });

  // #348 PR #351 리뷰 P1: format은 자유 문자열이라 chain의 enum 같은 길이 보장이 없다. 모델이
  // 프롬프트를 벗어나 상영관 줄을 통째로 뱉으면 TextStamp(nowrap·축소 로직 없음)가 티켓 레이아웃을
  // 민다 — 수동 입력(StampSheet의 maxLength)과 같은 상한으로 잘라야 한다.
  test('OCR format이 길게 와도 수동 입력과 같은 상한(STAMP_LABEL_MAX)으로 잘린다', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    ocrImpl = async () => ({ format: '  IMAX LASER 2D 전도연관[CGV아트하우스] 10층  ' });

    await user.upload(
      ocrFileInput(),
      new File(['x'], 'ticket.png', { type: 'image/png' })
    );

    await screen.findByRole('button', { name: '되돌리기' });
    expect(captured.components.formatLabel.length).toBeLessThanOrEqual(STAMP_LABEL_MAX);
    expect(captured.components.formatLabel).toBe(
      'IMAX LASER 2D 전도연관[CGV아트하우스] 10층'.slice(0, STAMP_LABEL_MAX)
    );
  });

  // #379 PR #397 claude-review P1: OCR이 인식한 title이 비동기 KOBIS 보강으로 movieCd를 채우는데,
  // kobisKeys 스냅샷에 movieCd가 빠져 있으면 undo가 title/actors 등은 되돌려도 movieCd는 그대로
  // 남아 바코드 fallback(#379)이 언두된 영화의 movieCd를 계속 반영한다 — #141 P1과 같은 클래스의
  // atomic-restore 버그.
  test('OCR title이 트리거한 KOBIS 보강의 movieCd도 undo가 원자 복원한다', async () => {
    const user = userEvent.setup();

    spyOn(global, 'fetch').mockImplementation((async (url: string) => {
      if (url.includes('/api/kobis/search')) {
        return {
          ok: true,
          json: async () => ({
            movieListResult: {
              movieList: [
                { movieCd: '20147727', movieNm: '그랜드 부다페스트 호텔', movieNmEn: 'The Grand Budapest Hotel', openDt: '20140320' },
              ],
            },
          }),
        };
      }
      if (url.includes('/api/kobis/detail')) {
        return { ok: true, json: async () => ({ movieInfoResult: { movieInfo: {} } }) };
      }
      throw new Error(`unexpected url: ${url}`);
    }) as unknown as typeof fetch);

    render(<MobileHarness />);

    expect(captured.movieInfo.movieCd).toBeUndefined();

    ocrImpl = async () => ({ title: '그랜드 부다페스트 호텔' });

    await user.upload(
      ocrFileInput(),
      new File(['x'], 'ticket.png', { type: 'image/png' })
    );

    const undoButton = await screen.findByRole('button', { name: '되돌리기' });
    await waitFor(() => {
      expect(captured.movieInfo.movieCd).toBe('20147727');
    });

    await user.click(undoButton);

    expect(captured.movieInfo.movieCd).toBeUndefined();
    expect(captured.movieInfo.title).toBe('');
  });

  // #328 claude-review 재검토 P1: max는 헤더·서브메뉴·pill·OCR과 함께 OCR 되돌리기 배너·토스트도
  // 숨겨야 "티켓만 노출"이라는 스펙이 성립한다 — 배너가 뜬 채로 최대화하면 풀스크린 위에 겹쳐 보이고
  // 탭도 되던 버그(PR #332)의 회귀 테스트.
  test('OCR 배너가 뜬 채로 최대화하면 배너가 숨고, 기본 복귀 시 다시 보인다', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    await user.click(screen.getByText('seed-poster'));

    ocrImpl = async () => ({ theater: 'CGV 용산아이파크몰' });
    await user.upload(ocrFileInput(), new File(['x'], 'ticket.png', { type: 'image/png' }));
    expect(await screen.findByRole('button', { name: '되돌리기' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '최대화' }));
    expect(screen.queryByRole('button', { name: '되돌리기' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '기본 크기로 돌아가기' }));
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeTruthy();
  });
});

describe('OCR undo가 새 문서 리셋 위에서 일어나면 옛 draft가 아니라 빈 문서로 돌아간다 (#737)', () => {
  test('랜딩이 안 걷힌 채(새로 시작) OCR을 적용하면, 되돌리기가 리셋 전 draft 값이 아니라 빈 값으로 돌아간다', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    // "이어서 만들기" 없이 곧장 OCR로 진입하는 시나리오 — landingDismissed는 아직 false다.
    // 그 상태에서 movieInfo가 이미 채워져 있는 건 방금 떠난 옛 draft를 흉내낸다.
    await user.click(screen.getByText('seed-draft-theater'));
    expect(captured.movieInfo.theater).toBe('인터스텔라 극장');

    // 새 티켓의 실제 인식 결과 — 옛 draft와 다른 극장이라 restore-vs-reset 차이가 드러난다.
    ocrImpl = async () => ({ theater: 'CGV 강남', seat: 'H12' });

    await user.upload(
      ocrFileInput(),
      new File(['x'], 'ticket.png', { type: 'image/png' })
    );

    const undoButton = await screen.findByRole('button', { name: '되돌리기' });
    // "새로 시작" 경로가 옛 draft를 먼저 지운 위에 OCR 값이 얹힌다.
    expect(captured.movieInfo.theater).toBe('CGV 강남');
    expect(captured.movieInfo.seat).toBe('H12');

    await user.click(undoButton);

    // 회귀 지점: 고치기 전엔 prevValues가 리셋 전 currentInfo에서 떠서 '인터스텔라 극장'이 되살아났다.
    expect(captured.movieInfo.theater).toBe('');
    expect(captured.movieInfo.seat).toBe('');
    expect(captured.movieInfo.title).toBe('');
  });

  // fresh-context 리뷰 지적 — resetFresh를 문서 전체 리셋으로 구현하면, OCR 적용~되돌리기 사이에
  // 사용자가 한 다른 편집(포스터 추가 등)까지 undo가 통째로 삼킨다. undo는 OCR이 채운 필드만
  // 되돌려야 한다.
  test('OCR 적용 뒤 다른 편집(포스터 추가)을 했다면, 되돌리기가 그 편집까지 지우지 않는다', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    ocrImpl = async () => ({ theater: 'CGV 강남' });
    await user.upload(ocrFileInput(), new File(['x'], 'ticket.png', { type: 'image/png' }));
    const undoButton = await screen.findByRole('button', { name: '되돌리기' });
    expect(captured.movieInfo.theater).toBe('CGV 강남');

    // OCR 배너가 뜬 채로 무관한 편집을 한다 — 포스터 추가.
    await user.click(screen.getByText('seed-poster'));
    expect(captured.croppedImageUrl).toBe('blob:test-poster');

    await user.click(undoButton);

    // OCR이 채운 필드만 되돌아가고, 그 뒤에 한 편집(포스터)은 살아남는다.
    expect(captured.movieInfo.theater).toBe('');
    expect(captured.croppedImageUrl).toBe('blob:test-poster');
  });
});
