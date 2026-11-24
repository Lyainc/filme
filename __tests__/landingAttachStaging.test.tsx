/**
 * #826 S9 랜딩 첨부 시트의 문서 수명 · 진입 흐름 — 실제 셸(MobileEditorShell + usePhototicket)로 잠근다(Seed
 * docs/specs/826-s9-landing-attach.yaml constraint-7~11, acceptance-6~10). 표현층(DOM · 타이밍)은
 * landingS9Presentational, 훅 단위(스냅샷 · blob 해제)는 usePhototicketStaging이 맡고, 여기는 둘이 셸에서 맞물리는 자리다:
 *   - 직접 입력은 고른 무드로 새 문서(6) · 시트 의미와 만들기 비활성(7)
 *   - 첫 첨부 스냅샷 → 닫으면 문서 · 실행 취소 · OCR 되돌리기 원상, 저장분 무쓰기, 늦은 OCR 폐기(8)
 *   - 포스터 + 스크린샷 → 만들기가 랜딩을 걷고 디자인 모드 + 배너 + 이전 blob 해제 + 자동저장 재개(8)
 *   - 시트가 열린 동안 가운데에 실시간 티켓(9)
 *
 * runOcr · getCroppedImg · imageDb만 mock하고(스프레드 스냅샷 + afterAll 복원, docs/TESTING.md 5절) 나머지는 실물이다.
 * `received`에 DOM 엘리먼트를 넣지 않는다(docs/TESTING.md 8절).
 */
import { afterAll, afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mobileShellProps } from './shellHarness';
import {
  addPosterViaSheet,
  attachSheet,
  enterDirect,
  makeFromSheet,
  ocrFileInput,
  openAttachSheet,
  pngFile,
  posterFileInput,
  uploadScreenshotViaSheet,
} from './helpers/landingAttach';

let ocrImpl: (file: File) => Promise<Record<string, unknown>> = async () => ({});
const realOcr = { ...require('@/utils/ocr') };
mock.module('@/utils/ocr', () => ({
  ...realOcr,
  runOcr: (file: File) => ocrImpl(file),
}));

let cropN = 0;
const realImageCrop = { ...require('@/utils/imageCrop') };
mock.module('@/utils/imageCrop', () => ({
  ...realImageCrop,
  getCroppedImg: () => Promise.resolve(`blob:cropped-${++cropN}`),
}));

// IndexedDB는 인메모리 no-op — saveDraft의 이미지 저장이 실제 IDB를 안 타게 한다(awaitingPosterRestore와 같은 방식).
const realImageDb = { ...require('@/utils/imageDb') };
mock.module('@/utils/imageDb', () => ({
  saveImages: async () => {},
  loadImages: async () => ({}),
  clearImages: async () => {},
}));

const { usePhototicket, STORAGE_KEY } = require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');
const { MobileEditorShell } = require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');
const { clearKobisLookupCache } = require('@/utils/kobisLookup') as typeof import('@/utils/kobisLookup');

type Photo = ReturnType<typeof usePhototicket>;
let photo!: Photo;

function Harness() {
  const p = usePhototicket();
  photo = p;
  return (
    <>
      {/* 시트 전의 문서 — 복원된 draft + 살아 있는 포스터 blob을 흉내낸다(제목 · 무드 · 포스터 URL이 구분되는 값). */}
      <button
        type="button"
        onClick={() => {
          p.updateMovieInfo({ title: '인터스텔라', theater: '용산' });
          p.updateComponents({ layout: 'stub' });
          p.handleImageUpload('blob:old-poster');
        }}
      >
        seed-old-doc
      </button>
      <button type="button" onClick={() => p.updateMovieInfo({ seat: 'A1' })}>
        seed-edit
      </button>
      <MobileEditorShell {...mobileShellProps(p)} />
    </>
  );
}

const landing = () => screen.getByTestId('landing');
const card = (label: string) => screen.getByRole('button', { name: label });
const selectedMode = () =>
  screen
    .getAllByRole('tab')
    .filter((t) => ['사진', '정보', '디자인'].some((m) => (t.textContent ?? '').startsWith(m)) && t.getAttribute('aria-selected') === 'true')
    .map((t) => (t.textContent ?? '').replace('필수 미입력', ''));
const snapshot = () => JSON.stringify({ state: photo.state, original: photo.posterCrop.originalSrc });

/** 저장 키에 쓰인 횟수 — 시트가 열린 동안은 0이어야 한다(constraint-9). */
let setItemSpy: ReturnType<typeof spyOn>;
// localStorage 인스턴스를 spy한다 — Storage.prototype을 spy하고 restore하면 뒤 테스트의 setItem이 안 불려 자동저장이 조용히 죽는다.
let writesBaseline = 0;
const allDraftWrites = () => setItemSpy.mock.calls.filter((c: unknown[]) => c[0] === STORAGE_KEY).length;
const draftWrites = () => allDraftWrites() - writesBaseline;

/** 옛 문서를 심고 자동저장이 한 번 끝날 때까지 기다린다 — 이후 쓰기 횟수가 0부터 시작한다. */
async function seedOldDocAndSettle(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('seed-old-doc'));
  await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY) ?? '').toContain('인터스텔라'), { timeout: 4000 });
  await new Promise((r) => setTimeout(r, 50));
  writesBaseline = allDraftWrites();
}

let revoke: ReturnType<typeof spyOn>;
beforeEach(() => {
  window.localStorage.clear();
  cropN = 0;
  // saveDraft가 blob: URL을 Blob으로 되읽는다 — happy-dom엔 그 경로가 없어 fetch를 스텁한다(posterCropPipeline과 같은 방식).
  spyOn(global, 'fetch').mockImplementation((async (url: string) => new Response(new Blob([String(url)]))) as unknown as typeof fetch);
  setItemSpy = spyOn(window.localStorage, 'setItem');
  writesBaseline = 0;
  revoke = spyOn(URL, 'revokeObjectURL');
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  ocrImpl = async () => ({});
  clearKobisLookupCache();
  mock.restore();
});
afterAll(() => {
  mock.module('@/utils/ocr', () => realOcr);
  mock.module('@/utils/imageCrop', () => realImageCrop);
  mock.module('@/utils/imageDb', () => realImageDb);
});

describe('직접 입력은 고른 무드로 새 문서를 연다 (acceptance-6)', () => {
  test('크라이테리언을 고르고 직접 입력 → layout criterion의 빈 문서 + 정보 모드, 랜딩이 걷힌다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(card('크라이테리언'));
    expect(card('크라이테리언').getAttribute('aria-pressed')).toBe('true');
    expect(landing().classList.contains('fixed')).toBe(true);

    await enterDirect(user);

    expect(photo.state.components.layout).toBe('criterion');
    expect(photo.state.movieInfo.title).toBe('');
    expect(photo.state.croppedImageUrl).toBeFalsy();
    expect(selectedMode()).toEqual(['정보']);
    expect(landing().classList.contains('hidden')).toBe(true);
  });

  test('아무것도 안 고르면 첫 카드(미니멀) 무드다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(card('미니멀').getAttribute('aria-pressed')).toBe('true');

    await enterDirect(user);

    expect(photo.state.components.layout).toBe('minimal');
    expect(selectedMode()).toEqual(['정보']);
  });
});

describe('첨부 시트 의미 (acceptance-7)', () => {
  test('주 버튼은 파일 선택이 아니라 dialog를 열고 포커스가 안으로 든다 · Escape · 닫기 · 시트 밖 탭이 닫고 포커스가 주 버튼으로 돌아온다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const clicked: HTMLInputElement[] = [];
    const orig = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
      clicked.push(this);
    };
    try {
      await user.click(screen.getByTestId('landing-cta'));
      expect(clicked).toHaveLength(0); // 파일 선택이 열리지 않았다
    } finally {
      HTMLInputElement.prototype.click = orig;
    }
    const dlg = screen.getByRole('dialog', { name: '티켓과 포스터' });
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    expect(attachSheet() === null).toBe(true);
    expect(document.activeElement === screen.getByTestId('landing-cta')).toBe(true);

    await user.click(screen.getByTestId('landing-cta'));
    await user.click(screen.getByRole('button', { name: '닫기' }));
    expect(attachSheet() === null).toBe(true);
    expect(document.activeElement === screen.getByTestId('landing-cta')).toBe(true);

    await user.click(screen.getByTestId('landing-cta'));
    await user.click(screen.getByTestId('landing-sheet-catcher'));
    expect(attachSheet() === null).toBe(true);
    expect(landing().classList.contains('fixed')).toBe(true);
  });

  test("'티켓 스크린샷' 행은 OCR 파일 입력을, '포스터' 행은 포스터 입력을 연다", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const ocrOpened = spyOn(ocrFileInput(), 'click');
    const posterOpened = spyOn(posterFileInput(), 'click');
    expect(ocrFileInput().getAttribute('aria-label')).toBe('티켓 스크린샷으로 자동입력');

    await openAttachSheet(user);
    await user.click(screen.getByTestId('landing-sheet-screenshot'));
    expect(ocrOpened).toHaveBeenCalledTimes(1);
    expect(posterOpened).toHaveBeenCalledTimes(0);
    await user.click(screen.getByTestId('landing-sheet-poster'));
    expect(posterOpened).toHaveBeenCalledTimes(1);
    expect(ocrOpened).toHaveBeenCalledTimes(1);
  });

  test('만들기는 아무것도 안 넣었을 때 · 인식 중에 aria-disabled이고 눌러도 아무 일이 없으며, 인식이 끝나면 활성이다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openAttachSheet(user);
    const make = () => screen.getByTestId('landing-sheet-make');
    expect(make().getAttribute('aria-disabled')).toBe('true');
    await user.click(make());
    expect(!!attachSheet()).toBe(true);
    expect(landing().classList.contains('fixed')).toBe(true);

    // 포스터를 넣어 활성이 된 뒤 인식을 시작하면 다시 비활성(인식 중)이 된다.
    await addPosterViaSheet(user, 'a.png');
    expect(make().getAttribute('aria-disabled')).toBeNull();
    let resolveOcr!: (r: Record<string, unknown>) => void;
    ocrImpl = () => new Promise((res) => { resolveOcr = res; });
    await uploadScreenshotViaSheet(user);
    expect(screen.getByTestId('landing-sheet-screenshot').textContent).toContain('인식 중');
    expect(make().getAttribute('aria-disabled')).toBe('true');
    await user.click(make());
    expect(!!attachSheet()).toBe(true);
    expect(landing().classList.contains('fixed')).toBe(true);

    resolveOcr({ theater: 'CGV 강남' });
    await waitFor(() => expect(make().getAttribute('aria-disabled')).toBeNull());
    expect(screen.getByTestId('landing-sheet-screenshot').textContent).toContain('인식했어요');
  });

  test('아무것도 안 넣고 시트를 열었다 닫으면 문서 · 저장분 · 쓰기가 그대로다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await seedOldDocAndSettle(user);
    const before = snapshot();
    const stored = window.localStorage.getItem(STORAGE_KEY);

    await openAttachSheet(user);
    await user.keyboard('{Escape}');
    await new Promise((r) => setTimeout(r, 1200)); // 자동저장 디바운스(1s)를 넘겨도

    expect(snapshot()).toBe(before);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(stored);
    expect(draftWrites()).toBe(0);
    expect(revoke.mock.calls.flat()).not.toContain('blob:old-poster');
  });
});

describe('시트를 닫으면 문서는 시트 전 그대로다 (acceptance-8, constraint-9)', () => {
  test('저장분이 있는 상태에서 포스터를 넣고 닫으면 제목 · 무드 · 포스터 URL이 복원되고, 옛 blob은 안 풀리고 새 blob만 풀리며, 저장 키는 안 바뀐다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await seedOldDocAndSettle(user);
    const stored = window.localStorage.getItem(STORAGE_KEY);
    expect(photo.state.components.layout).toBe('stub');
    expect(photo.state.croppedImageUrl).toBe('blob:old-poster');

    await user.click(card('크라이테리언'));
    await addPosterViaSheet(user, 'new.png');

    // 시트가 열린 동안: 고른 무드의 새 문서 + 새 포스터, 옛 포스터 blob은 스냅샷이 쥐고 있어 안 풀렸다.
    expect(photo.state.components.layout).toBe('criterion');
    expect(photo.state.movieInfo.title).toBe('');
    expect(photo.state.croppedImageUrl).toBe('blob:cropped-1');
    expect(revoke.mock.calls.flat()).not.toContain('blob:old-poster');
    await new Promise((r) => setTimeout(r, 1200)); // 자동저장 디바운스를 넘겨도 보류된다
    expect(draftWrites()).toBe(0);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(stored);

    await user.click(screen.getByRole('button', { name: '닫기' }));

    expect(attachSheet() === null).toBe(true);
    expect(landing().classList.contains('fixed')).toBe(true);
    expect(photo.state.movieInfo.title).toBe('인터스텔라');
    expect(photo.state.components.layout).toBe('stub');
    expect(photo.state.croppedImageUrl).toBe('blob:old-poster');
    expect(revoke.mock.calls.flat()).toContain('blob:cropped-1'); // 시트 중에 만든 포스터만 푼다
    expect(revoke.mock.calls.flat()).not.toContain('blob:old-poster');
    await new Promise((r) => setTimeout(r, 1200));
    expect(draftWrites()).toBe(0);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(stored);
  });

  test('스크린샷 인식 도중 닫으면 늦게 온 OCR 응답이 문서 · 배너 · 저장분을 안 바꾼다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await seedOldDocAndSettle(user);
    const before = snapshot();

    let resolveOcr!: (r: Record<string, unknown>) => void;
    ocrImpl = () => new Promise((res) => { resolveOcr = res; });
    await uploadScreenshotViaSheet(user);
    expect(photo.state.movieInfo.title).toBe(''); // 인식 시작 때 새 문서가 열렸다

    await user.click(screen.getByRole('button', { name: '닫기' }));
    expect(snapshot()).toBe(before);

    resolveOcr({ chain: 'cgv', theater: 'CGV 강남', seat: 'H12' });
    await new Promise((r) => setTimeout(r, 1300)); // 응답이 흘러가고 자동저장 디바운스도 넘긴다

    expect(snapshot()).toBe(before);
    expect(screen.queryByTestId('ocr-undo-banner') === null).toBe(true);
    expect(landing().classList.contains('fixed')).toBe(true);
    expect(draftWrites()).toBe(0);
  });

  test('실행 취소 기록 · OCR 되돌리기가 시트를 열기 전 그대로 돌아온다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await enterDirect(user);
    // 편집 중인 문서 — OCR(되돌리기 배너) + 직접 편집(실행 취소 기록).
    ocrImpl = async () => ({ theater: 'CGV 왕십리' });
    await user.click(screen.getByRole('button', { name: '스크린샷으로 자동입력' }));
    await user.upload(ocrFileInput(), pngFile('ticket.png'));
    await screen.findByRole('button', { name: '되돌리기' });
    await new Promise((r) => setTimeout(r, 450)); // OCR 직후 상태가 새 베이스라인으로 굳은 뒤(350ms 디바운스)에 편집해야 1스텝이 된다
    await user.click(screen.getByText('seed-edit'));
    expect(photo.state.movieInfo.seat).toBe('A1');
    await new Promise((r) => setTimeout(r, 450)); // 실행 취소 1스텝은 350ms 디바운스로 쌓인다
    expect((screen.getByRole('button', { name: '실행 취소' }) as HTMLButtonElement).disabled).toBe(false);

    // 랜딩으로 돌아가 시트에서 포스터를 넣는다 — 새 문서가 열리면 옛 배너 · 실행 취소 기록은 사라진다.
    await user.click(screen.getByRole('button', { name: '랜딩으로 돌아가기' }));
    await addPosterViaSheet(user, 'p.png');
    expect(photo.state.movieInfo.theater).toBe('');
    expect(screen.queryByRole('button', { name: '되돌리기' }) === null).toBe(true);

    // 닫으면 문서 · 배너 · 실행 취소가 돌아온다. 이어서 만들기로 들어가 확인한다.
    await user.click(screen.getByRole('button', { name: '닫기' }));
    expect(photo.state.movieInfo.theater).toBe('CGV 왕십리');
    expect(photo.state.movieInfo.seat).toBe('A1');
    await user.click(screen.getByTestId('landing-restore'));
    expect((screen.getByRole('button', { name: '실행 취소' }) as HTMLButtonElement).disabled).toBe(false);
    await user.click(screen.getByRole('button', { name: '실행 취소' }));
    expect(photo.state.movieInfo.seat).toBe('');
    expect(photo.state.movieInfo.theater).toBe('CGV 왕십리'); // 배너가 쥔 OCR 값은 실행 취소가 건드리지 않는다
    await user.click(await screen.findByRole('button', { name: '되돌리기' }));
    expect(photo.state.movieInfo.theater).toBe('');
  });
});

describe("포스터 + 스크린샷 → '만들기' (acceptance-8)", () => {
  test('랜딩이 걷히고 고른 무드 · 포스터 · 인식 결과가 든 문서로 디자인 모드 + 배너, 이전 blob이 풀리고 자동저장이 다시 걸린다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await seedOldDocAndSettle(user);

    await user.click(card('크라이테리언'));
    await addPosterViaSheet(user, 'new.png');
    ocrImpl = async () => ({ chain: 'cgv', theater: 'CGV 강남', seat: 'H12' });
    await uploadScreenshotViaSheet(user);
    await waitFor(() => expect(screen.getByTestId('landing-sheet-screenshot').textContent).toContain('인식했어요'));

    // 만들기 전: 랜딩 그대로, 옛 blob 보류, 저장 없음.
    expect(landing().classList.contains('fixed')).toBe(true);
    expect(revoke.mock.calls.flat()).not.toContain('blob:old-poster');
    expect(draftWrites()).toBe(0);
    // OCR 되돌리기 배너는 시트 위에 뜨지 않는다 — '만들기'를 가렸던 회귀(헤드리스 캡처 2026-11-24).
    expect(screen.queryByTestId('ocr-undo-banner') === null).toBe(true);

    await makeFromSheet(user);

    expect(landing().classList.contains('hidden')).toBe(true);
    expect(attachSheet() === null).toBe(true);
    expect(photo.state.components.layout).toBe('criterion');
    expect(photo.state.croppedImageUrl).toBe('blob:cropped-1');
    expect(photo.state.movieInfo.theater).toBe('CGV 강남');
    expect(photo.state.movieInfo.seat).toBe('H12');
    expect(photo.state.components.chainLabel).toBe('CGV');
    expect(selectedMode()).toEqual(['디자인']);
    expect(!!screen.queryByTestId('ocr-undo-banner')).toBe(true);
    expect(revoke.mock.calls.flat()).toContain('blob:old-poster');
    expect(revoke.mock.calls.flat()).not.toContain('blob:cropped-1');

    // 자동저장이 다시 걸려 새 문서가 저장분을 덮는다.
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY) ?? '').toContain('CGV 강남'), { timeout: 4000 });
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toContain('인터스텔라');
  });

  test('포스터만 넣고 만들기 → 정보 모드, 배너 없음', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await addPosterViaSheet(user, 'a.png');
    await makeFromSheet(user);

    expect(landing().classList.contains('hidden')).toBe(true);
    expect(photo.state.croppedImageUrl).toBe('blob:cropped-1');
    expect(selectedMode()).toEqual(['정보']);
    expect(screen.queryByTestId('ocr-undo-banner') === null).toBe(true);
    // 포스터 업로드가 dirtyTick을 올리므로 확정 뒤 자동저장이 걸린다 — 포스터만 넣은 티켓도 새로고침에 살아남는다
    // (code-review PR #848의 '포스터만 확정하면 저장 안 됨' 지적을 잠근다).
    expect(window.localStorage.getItem(STORAGE_KEY) === null).toBe(true);
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}').hadPoster).toBe(true), { timeout: 4000 });
  });

  test('시트가 열린 동안 워드마크 줄 · 전시는 inert라 뒤로 새지 않는다 (code-review PR #848)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const gallery = screen.getByTestId('mood-gallery');
    const galleryWrap = gallery.parentElement!;
    expect(galleryWrap.hasAttribute('inert')).toBe(false);
    await user.click(screen.getByTestId('landing-cta'));
    expect(galleryWrap.hasAttribute('inert')).toBe(true);
    expect(screen.getByTestId('landing-notice-open').parentElement!.hasAttribute('inert')).toBe(true);
    await user.keyboard('{Escape}');
    expect(galleryWrap.hasAttribute('inert')).toBe(false);
  });
});

describe('시트가 열린 동안 가운데에 실시간 티켓이 선다 (acceptance-9)', () => {
  test('스냅샷 전엔 정적 견본 img, 포스터를 넣으면 고른 무드의 TicketRenderer 한 벌에 새 포스터 blob, 인식 뒤엔 제목 글자', async () => {
    const user = userEvent.setup();
    // 제목이 인식되면 KOBIS 조회가 따라온다 — 무매칭으로 스텁해 안내 경로만 탄다.
    (global.fetch as unknown as ReturnType<typeof spyOn>).mockImplementation(((async (url: string) => {
      if (String(url).includes('/api/kobis/search')) return { ok: true, json: async () => ({ movieListResult: { movieList: [] } }) };
      return new Response(new Blob([String(url)]));
    }) as unknown) as typeof fetch);
    render(<Harness />);
    act(() => card('에디토리얼').focus()); // 먼 카드는 포인터가 막혀 있어 키보드 포커스로 가운데에 온다(constraint-5)

    // 스냅샷 전(시트를 열었지만 아무것도 안 넣음): 정적 견본 이미지, 실시간 티켓 없음, 옆 카드는 숨는다.
    await openAttachSheet(user);
    expect(screen.queryByTestId('landing-live-preview') === null).toBe(true);
    expect(card('에디토리얼').querySelector('img') !== null).toBe(true);
    expect(card('미니멀').style.opacity).toBe('0');

    await addPosterViaSheet(user, 'new.png');

    const live = screen.getByTestId('landing-live-preview');
    expect(screen.getAllByTestId('landing-live-preview')).toHaveLength(1);
    expect(card('에디토리얼').getAttribute('aria-pressed')).toBe('true');
    expect(card('에디토리얼').contains(live)).toBe(true);
    expect(photo.state.components.layout).toBe('editorial');
    // TicketRenderer 한 벌, 에디토리얼(가로 1534×960)의 자연 크기 트리다.
    const wrappers = live.querySelectorAll('[data-ticket-scale-wrapper]');
    expect(wrappers).toHaveLength(1);
    expect((wrappers[0] as HTMLElement).style.width).toBe('1534px');
    expect((wrappers[0] as HTMLElement).style.height).toBe('960px');
    expect(live.querySelector('img[src="blob:cropped-1"]') !== null).toBe(true);
    expect(card('에디토리얼').querySelector('img[src^="/assets/landing/"]') === null).toBe(true); // 정적 견본은 자리를 비켰다

    ocrImpl = async () => ({ title: '기생충', theater: 'CGV 강남' });
    await uploadScreenshotViaSheet(user);
    await waitFor(() => expect(screen.getByTestId('landing-live-preview').textContent).toContain('기생충'));
  });
});
