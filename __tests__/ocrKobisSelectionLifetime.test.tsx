/**
 * #793 회귀 테스트 — OCR이 트리거하는 비동기 KOBIS 보강(triggerKobisLookup)이 진행 중일 때,
 * 사용자가 제목 편집기에서 **다른** 영화를 직접 고르면 늦게 도착한 OCR 결과가 그 선택을 덮으면
 * 안 된다(덮으면 제목이 바뀌면서 선택의 상세 보강(#784)까지 취소됐다).
 *
 * 고친 지점(src/components/v2/OcrUploadCard.tsx): KOBIS 결과를 `setInfo`가 아니라
 * `usePhototicket.captureMovieSelection()`이 돌려주는 적용기로만 쓴다 — 이 적용기는 캡처 시점의
 * movieSelectionRef/docEpochRef와 지금 값을 대조해, 그 사이 사용자가 다른 영화를 고르거나 제목을
 * 고치면 false를 돌려 적용을 스스로 포기한다(KOBIS 선택 자체(#784)가 쓰는 것과 같은 수명 판정).
 *
 * 하네스는 ocrUndoRestore.test.tsx와 동일 — 실제 usePhototicket + MobileEditorShell을 렌더하고
 * runOcr만 mock.module, KOBIS는 실제 kobisLookup.ts/useKobisSearch.ts 그대로 두고 global.fetch를
 * URL 라우팅으로 스텁한다(kobisLookup 자체를 mock.module하면 프로세스 전역이라 kobisLookup.test.ts가
 * 오염된다 — bun-mock-module-global-leak 메모). 지연 응답은 kobisDetailUnmount.test.tsx의
 * deferred fetch 패턴을 재사용한다.
 */
import { describe, expect, test, afterAll, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PhototicketState } from '@/types';

// runOcr는 MobileEditorShell(→ OcrUploadCard)이 로드되기 전에 mock해야 한다 — bun의 mock.module은
// hoisting되지 않는다. 스프레드 스냅샷 + afterAll 복원(#611) — require()가 주는 건 살아있는
// 네임스페이스라 mock.module이 그 객체를 제자리에서 갈아끼우므로, 복사본으로 떠 둬야 복원이 된다.
let ocrImpl: (file: File) => Promise<Record<string, unknown>> = async () => ({});
const realOcr = { ...require('@/utils/ocr') };
mock.module('@/utils/ocr', () => ({
  ...realOcr,
  runOcr: (file: File) => ocrImpl(file),
}));

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
  );
}

/** 셸이 마운트하는 파일 input 중 OCR 카드의 것(accept="image/*")만 골라낸다. */
function ocrFileInput(): HTMLInputElement {
  const inputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
  const input = inputs.find((i) => i.getAttribute('accept') === 'image/*');
  if (!input) throw new Error('OcrUploadCard file input not found');
  return input;
}

/** resolve를 밖으로 꺼낸 지연 Promise — kobisDetailUnmount.test.tsx와 동일 패턴. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function fakeResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

const movieNmFromUrl = (url: string) => decodeURIComponent(url.match(/movieNm=([^&]+)/)?.[1] ?? '');

// fetch는 spyOn이 아니라 직접 대입하므로 mock.restore()가 못 되돌린다 — 원본을 떠 두고 afterEach에서
// 복원한다(kobisDetailUnmount.test.tsx와 같은 패턴). 안 그러면 스텁이 뒤에 도는 파일로 새어 나간다.
const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  ocrImpl = async () => ({});
  clearKobisLookupCache();
  globalThis.fetch = originalFetch;
});

afterAll(() => {
  mock.module('@/utils/ocr', () => realOcr);
});

describe('OCR의 KOBIS 보강 도중 사용자가 다른 영화를 고르면, 그 선택이 늦은 OCR 결과를 이긴다 (#793)', () => {
  test('제목 편집기에서 고른 영화(괴물)가 조회 중이던 OCR 결과(기생충)를 덮지 않는다', async () => {
    const user = userEvent.setup();

    // OCR이 트리거하는 검색과, 사용자가 고른 영화의 상세 조회는 둘 다 응답을 미룬다 — 순서를
    // 테스트가 직접 정한다(1: 사용자 선택 먼저 → 2: OCR 검색 응답 → 3: 사용자가 고른 영화의 상세).
    const ocrSearch = deferred<unknown>();
    const hostDetail = deferred<unknown>();
    // OCR 조회가 끝까지(검색 → PARASITE 상세) 갔는지 — 5단계 단언이 그 뒤에 서게 하는 기준점.
    let parasiteDetailRequested = false;

    globalThis.fetch = (async (url: string) => {
      if (url.includes('/api/kobis/search')) {
        const movieNm = movieNmFromUrl(url);
        if (movieNm === '기생충') return ocrSearch.promise;
        if (movieNm === '괴물') {
          return fakeResponse({
            movieListResult: {
              movieList: [
                { movieCd: 'HOST', movieNm: '괴물', movieNmEn: 'The Host', openDt: '20060727' },
              ],
            },
          });
        }
        throw new Error(`unexpected search url: ${url}`);
      }
      if (url.includes('/api/kobis/detail')) {
        if (url.includes('movieCd=PARASITE')) {
          parasiteDetailRequested = true;
          return fakeResponse({
            movieInfoResult: { movieInfo: { actors: [{ peopleNm: '송강호' }], showTm: '132' } },
          });
        }
        if (url.includes('movieCd=HOST')) return hostDetail.promise;
        throw new Error(`unexpected detail url: ${url}`);
      }
      throw new Error(`unexpected url: ${url}`);
    }) as unknown as typeof fetch;

    render(<MobileHarness />);

    // 1. OCR 스크린샷 업로드 — title만 인식(기생충). triggerKobisLookup의 검색 fetch는 아직 안 뜬다.
    //    onOcrApply가 랜딩을 걷어(#727 "새로 시작") 편집 캔버스를 연다.
    ocrImpl = async () => ({ title: '기생충' });
    await user.upload(ocrFileInput(), new File(['x'], 'ticket.png', { type: 'image/png' }));

    // 2. 필드 드로어 → 제목 편집기(InPlaceFieldEditor)를 실제 사용자처럼 탭으로 연다.
    const handle = await screen.findByRole('button', { name: '티켓 항목 목록 열기' });
    await user.click(handle);
    const dialog = await screen.findByRole('dialog', { name: '티켓 항목' });
    // 온-티켓 필드 탭도 같은 aria-label("제목 편집")을 쓰므로(FieldTap) 드로어 안으로 좁힌다.
    await user.click(within(dialog).getByRole('button', { name: '제목 편집' }));
    const titleInput = await screen.findByRole('textbox', { name: '제목' });

    // 3. '괴물'을 입력 — 300ms 디바운스 뒤 KOBIS 검색 결과 행이 뜬다(useKobisSearch.scheduleSearch).
    await user.type(titleInput, '괴물');
    const listbox = await screen.findByRole('listbox', { name: '검색 결과' }, { timeout: 2000 });
    const resultButton = within(listbox).getByRole('button');
    expect(resultButton.textContent).toContain('괴물');

    // 4. 결과를 선택 — beginMovieSelection이 새 영화 수명을 잡고(movieSelectionRef 증가) HOST
    //    상세 조회를 건다. 이 fetch도 아직 응답하지 않는다.
    await user.click(resultButton);
    expect(captured.movieInfo.title).toBe('괴물');
    expect(captured.movieInfo.movieCd).toBe('HOST');

    // 5. OCR의 검색이 이제야 응답한다 — 1건 매치라 PARASITE 상세까지 곧바로 이어진다.
    ocrSearch.resolve(
      fakeResponse({
        movieListResult: {
          movieList: [
            { movieCd: 'PARASITE', movieNm: '기생충', movieNmEn: 'Parasite', openDt: '20190530' },
          ],
        },
      })
    );
    // 회귀 지점: 고치기 전엔 setInfo가 무조건 적용돼 여기서 title이 '기생충'/movieCd가 'PARASITE'로
    // 되돌아갔다. captureMovieSelection이 낡은 선택을 들고 있어 applyKobis가 false를 돌려주므로
    // 사용자가 고른 '괴물'이 그대로 남아야 한다.
    // title 단언을 waitFor에 걸면 첫 검사에서 이미 참이라 OCR 체인이 끝나기 전에 통과한다 — OCR의
    // 상세 요청이 실제로 나가고 그 응답까지 흘러간 뒤에 잰다.
    await waitFor(() => {
      expect(parasiteDetailRequested).toBe(true);
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(captured.movieInfo.title).toBe('괴물');
    expect(captured.movieInfo.movieCd).toBe('HOST');

    // 6. 사용자가 고른 영화(괴물)의 상세도 늦게 도착한다 — 이건 여전히 유효한 선택이라 반영돼야 한다.
    hostDetail.resolve(
      fakeResponse({
        movieInfoResult: { movieInfo: { actors: [{ peopleNm: '변희봉' }], showTm: '119' } },
      })
    );
    await waitFor(() => {
      expect(captured.movieInfo.actors).toBe('변희봉');
    });

    expect(captured.movieInfo.title).toBe('괴물');
    expect(captured.movieInfo.movieCd).toBe('HOST');
    expect(captured.movieInfo.runtime).toBe('119 MIN');
  });
});
