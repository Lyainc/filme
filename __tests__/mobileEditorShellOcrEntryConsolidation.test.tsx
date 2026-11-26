/**
 * #388 회귀 테스트 — 본문 OCR 카드를 업로드 후 CSS hidden으로 바꾸고 드로어로 일원화하면서,
 * #363(커밋 514baab)·PR #372 리뷰 P1이 고친 "in-flight KOBIS 보강이 mountedRef 가드에 조용히
 * 버려지는" 회귀가 재현되지 않는지 실제 타이밍으로 검증한다.
 *
 * 두 시나리오를 모두 다룬다:
 *  1. 랜딩→업로드 전환(본문 카드 hidden화, unmount 아님) 중 in-flight KOBIS 응답 도착.
 *  2. (옛) 드로어에서 OCR 시작 → 응답 전에 드로어를 닫음 — #826 S2에서 드로어가 사라져 정보 모드 버튼에서
 *     시작해 모드를 옮기는 것으로 대체했다. 카드는 처음부터 하나라 unmount 자체가 없다.
 *
 * 두 경우 모두 setInfo(kobisInfo)는 OcrUploadCard 인스턴스가 아니라 셸이 쥔 photo 상태를
 * 갱신하므로, 그 인스턴스가 사라져도 응답이 여전히 최신이면(ocrEpochRef, #388 useOcrUndo.ts)
 * 반영돼야 한다.
 */
import { describe, expect, test, afterAll, afterEach, mock, spyOn } from 'bun:test';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PhototicketState } from '@/types';
import { enterDirect, enterWithOcrViaSheet, makeFromSheet, ocrFileInput, uploadScreenshotViaSheet } from './helpers/landingAttach';

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
const { usePhototicket, STORAGE_KEY } =
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
        themePreference="light"
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
  // draft를 심는 케이스가 있으므로 파일 안에서 반드시 비운다 — 안 비우면 같은 프로세스의
  // 뒤 테스트가 남은 저장분을 복원해 랜딩이 다른 상태로 시작한다.
  window.localStorage.clear();
  mock.restore();
});

afterAll(() => {
  mock.module('@/utils/ocr', () => realOcr);
});

describe('in-flight KOBIS 보강이 OCR 카드 인스턴스 소멸 이후에도 반영된다 (#388)', () => {
  test('랜딩(시트)에서 OCR 시작 → KOBIS 응답 전에 만들기(본문 카드 hidden 전환) → 응답 도착 시 titleOg/releaseDate가 폼에 반영된다', async () => {
    const { resolveWithGrandBudapest } = mockPendingKobisFetch();
    const user = userEvent.setup();

    render(<MobileHarness />);
    expect(captured.movieInfo.titleOg).toBe('');

    ocrImpl = async () => ({ title: '그랜드 부다페스트 호텔' });

    // 랜딩 첨부 시트에서 OCR 트리거 — title만 인식되면 직접 필드는 없어 "영화 정보 검색 중…"(#852, 마스터 E-05)
    // 안내가 뜬다(시트의 '티켓 스크린샷' 행 상태 줄 — S9 constraint-11). 이 시점에 KOBIS search fetch가 이미
    // 호출된 상태(searchPromise가 아직 pending).
    await uploadScreenshotViaSheet(user);
    await waitFor(() => {
      expect(screen.getByTestId('landing-sheet-screenshot').textContent).toContain('영화 정보 검색 중…');
    });

    // KOBIS 검색이 아직 in-flight인 동안 만들기로 랜딩을 걷는다 — OcrUploadCard가 CSS hidden으로 전환된다(#388).
    // 테스트 환경엔 Tailwind CSS가 없어 노드는 여전히 잡히므로(mobileChromeOrder.test.tsx와 동일 이유), .hidden 조상
    // 존재로 직접 확인한다 — 핵심은 이 시점에도 노드가 여전히 DOM에 존재(=unmount 아님)해야 한다는 것.
    await makeFromSheet(user);
    expect(ocrFileInput().closest('.hidden')).not.toBeNull();

    resolveWithGrandBudapest();

    await waitFor(() => {
      expect(captured.movieInfo.title).toBe('그랜드 부다페스트 호텔');
      expect(captured.movieInfo.titleOg).toBe('The Grand Budapest Hotel');
      expect(captured.movieInfo.releaseDate).toBe('2014-03-20');
    });
  });

  // 랜딩을 걷는 조건(#614 ③ → #826 S9) — OCR-only 경로는 포스터가 없는 채로 landingDismissed만으로 걷혀야 해서
  // croppedImageUrl로는 대체 관측이 안 된다. S9에서는 인식이 끝나도 랜딩은 시트에 머물고 '만들기'가 걷는다.
  //
  // 지키려던 명제("6개 항목이 자동 입력되었어요" 배너 옆에 방금 쓴 그 CTA가 남으면 안 된다)는 그대로다 —
  // 루트 hidden이 그걸 통째로 진다. unmount는 아니다(#297 P1, #614/#624 계약).
  test('포스터 없이 OCR로 직접 필드가 인식돼도 시트에 머물고, 만들기가 랜딩 컨테이너를 통째로 걷는다 (#614 ③ → #826 S9)', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);
    const landing = () => screen.getByTestId('landing');
    expect(landing().classList.contains('fixed')).toBe(true);

    // 제목-only가 아니라 직접 필드 — KOBIS 검색을 안 타고 onOcrApply가 그 자리에서 호출된다.
    ocrImpl = async () => ({ theater: 'CGV 용산아이파크몰' });

    const cta = screen.getByTestId('landing-cta');
    const direct = screen.getByTestId('landing-skip-poster');
    await uploadScreenshotViaSheet(user);

    await waitFor(() => {
      expect(captured.movieInfo.theater).toBe('CGV 용산아이파크몰');
    });
    await waitFor(() => {
      expect(screen.getByTestId('landing-sheet-screenshot').textContent).toContain('인식했어요');
    });
    // 인식만으로는 랜딩이 그대로다 — 걷는 건 만들기다.
    expect(landing().classList.contains('fixed')).toBe(true);

    await makeFromSheet(user);

    // 포스터는 여전히 없다 — 걷힌 근거가 croppedImageUrl이 아니라 landingDismissed임을 고정한다.
    expect(captured.croppedImageUrl).toBeFalsy();
    expect(landing().classList.contains('fixed')).toBe(false);
    // 캔버스가 섰으므로 컨테이너 자체가 hidden — unmount는 아니다(#674, #297 P1).
    expect(landing().classList.contains('hidden')).toBe(true);
    expect(screen.getByTestId('landing')).toBeTruthy();
    // 주 버튼 · 직접 입력은 unmount가 아니라 그 루트의 CSS hidden 안에 남는다(#614/#624 remount 금지 계약 유지) —
    // 트리에서 빠지면 OcrUploadCard 단일 인스턴스 계약이 깨진다. 같은 노드가 그대로 hidden 안에 있다.
    expect(screen.getByTestId('landing-cta')).toBe(cta);
    expect(screen.getByTestId('landing-skip-poster')).toBe(direct);
    expect(!!cta.closest('.hidden')).toBe(true);
    expect(!!direct.closest('.hidden')).toBe(true);
  });

  // claude-review P1(#727) — 다섯 이탈 중 OCR 경로만 "draft가 **있던** 상태"를 안 재고 있었다.
  // c7이 지키려는 건 두 명제고 여기서 함께 잠근다: ① 진입 커밋이 저장분을 안 지운다(오탭이
  // 새로고침 한 번으로 복구된다) ② 새 문서가 옛 필드를 안 물려받는다(리셋 위에 OCR 패치가
  // 얹히는 순서라, 뒤집히면 옛 극장명이 화면에 남는다).
  test('draft가 있어도 시트의 OCR 진입은 저장분을 안 지우고 새 문서로 시작한다 (#727 c7 → #826 S9)', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ movieInfo: { title: '인터스텔라', theater: 'CGV 용산아이파크몰' } })
    );
    render(<MobileHarness />);

    // 복원이 끝난 근거 — 랜딩 복원 행이 그 제목을 싣고 있다.
    await waitFor(() => {
      expect(screen.getByTestId('landing-restore').textContent).toContain('인터스텔라');
    });

    // 옛 draft와 겹치지 않는 값이어야 "새어나옴"과 "OCR이 채운 값"이 구분된다.
    ocrImpl = async () => ({ theater: 'CGV 왕십리' });
    const user = userEvent.setup();
    await uploadScreenshotViaSheet(user);

    await waitFor(() => {
      expect(captured.movieInfo.theater).toBe('CGV 왕십리');
    });

    // ① 저장분은 그대로다 — 시트가 열린 동안은 한 번도 안 써지고, 만들기 직후에도 새 문서의 첫 자동저장 전이다.
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('인터스텔라');
    await waitFor(() => {
      expect(screen.getByTestId('landing-sheet-screenshot').textContent).toContain('인식했어요');
    });
    await makeFromSheet(user);
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('인터스텔라');
    // ② 새 문서는 옛 필드를 안 물려받았다 — 제목은 비었고 극장은 OCR 값으로만 서 있다.
    expect(captured.movieInfo.title).toBeFalsy();
    expect(document.body.textContent).not.toContain('인터스텔라');
  });

  // claude-review PR #658 P1 — 초기화(handleClearTap)가 landingDismissed를 false로 되돌리는 줄을
  // 잠근다. 안 되돌아가면 새 문서를 열어도 랜딩이 영영 안 뜨고 빈 셸에 남는다(#614 → #727).
  test('OCR로 랜딩이 걷힌 뒤 초기화하면 오버레이 랜딩이 온전히 복귀한다 (#652 → #727)', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    ocrImpl = async () => ({ theater: 'CGV 용산아이파크몰' });
    await enterWithOcrViaSheet(user);
    await waitFor(() => {
      expect(captured.movieInfo.theater).toBe('CGV 용산아이파크몰');
    });
    const landing = () => screen.getByTestId('landing');
    expect(landing().classList.contains('fixed')).toBe(false);
    expect(!!screen.getByTestId('landing-cta').closest('.hidden')).toBe(true);

    // 초기화 2탭(#374) — 더블탭 가드(350ms) 밖에서 재탭해야 실행된다.
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(screen.getByRole('button', { name: '초기화' }));
    await new Promise((r) => setTimeout(r, 400));
    await user.click(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' }));

    // 새 문서 — 오버레이 랜딩이 다시 뜨고, 그 안 주 버튼·직접 입력도 더 이상 숨어 있지 않다. 시트는 닫혀 있다.
    expect(landing().classList.contains('fixed')).toBe(true);
    expect(!!screen.getByTestId('landing-cta').closest('.hidden')).toBe(false);
    expect(!!screen.getByTestId('landing-skip-poster').closest('.hidden')).toBe(false);
    expect(screen.queryByTestId('landing-attach-sheet') === null).toBe(true);
  });

  // #826 S2 — 필드 드로어(와 그 안의 두 번째 OcrUploadCard)가 사라졌다. 편집 화면의 OCR 진입점은 정보 모드의
  // '스크린샷으로 자동입력' 버튼이고, 그 버튼은 새 카드를 마운트하지 않고 랜딩 카드의 같은 파일 선택을 연다
  // (Seed constraint-17). 카드 인스턴스는 처음부터 끝까지 하나다.
  test('정보 모드 버튼은 랜딩의 단일 카드를 연다 — OCR 카드·파일 input은 셸 트리에 하나뿐이다 (#826 S2 constraint-17)', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    const countCards = () => document.querySelectorAll('input[type="file"][accept="image/*"]').length;
    expect(countCards()).toBe(1);

    await enterDirect(user); // 랜딩 이탈 → 편집 화면(정보 모드)
    const trigger = screen.getByRole('button', { name: '스크린샷으로 자동입력' });
    expect(countCards()).toBe(1);
    // 같은 카드의 이전 인스턴스가 사라지지 않았다는 증거 — 카드가 쥔 input 노드가 그대로다.
    const input = ocrFileInput();
    let clicks = 0;
    input.addEventListener('click', () => { clicks += 1; });
    await user.click(trigger);
    expect(clicks).toBe(1);
    expect(countCards()).toBe(1);

    // 모드를 오가도 카드는 하나다 — 정보 모드 버튼이 도크에 새 카드를 얹지 않는다.
    await user.click(screen.getByRole('tab', { name: '디자인' }));
    await user.click(screen.getByRole('tab', { name: /^정보/ }));
    expect(countCards()).toBe(1);
    expect(ocrFileInput()).toBe(input);
  });

  test('정보 모드 버튼에서 OCR 시작 → KOBIS 응답 전에 다른 모드로 옮겨도 응답 도착 시 titleOg/releaseDate가 폼에 반영된다 (claude-review PR #413 P0 → #826 S2)', async () => {
    const { resolveWithGrandBudapest } = mockPendingKobisFetch();
    const user = userEvent.setup();

    render(<MobileHarness />);
    await enterDirect(user);
    expect(captured.movieInfo.titleOg).toBe('');

    ocrImpl = async () => ({ title: '그랜드 부다페스트 호텔' });
    await user.upload(ocrFileInput(), new File(['x'], 'ticket.png', { type: 'image/png' }));
    // 랜딩이 걷힌 뒤라 카드 자체 토스트는 display:none 안이다 — 안내는 셸 토스트로 온다.
    await waitFor(() => {
      expect(screen.getByTestId('global-toast').textContent).toBe('영화 정보 검색 중…');
    });

    // 응답 전에 모드를 옮긴다 — 정보 모드 버튼(인식 중 표시)이 있던 본문이 통째로 바뀐다.
    await user.click(screen.getByRole('tab', { name: '디자인' }));
    resolveWithGrandBudapest();

    await waitFor(() => {
      expect(captured.movieInfo.title).toBe('그랜드 부다페스트 호텔');
      expect(captured.movieInfo.titleOg).toBe('The Grand Budapest Hotel');
      expect(captured.movieInfo.releaseDate).toBe('2014-03-20');
    });
  });

  test('인식 중에는 정보 모드 버튼이 \'티켓 인식 중…\'(aria-busy)로 바뀐다 — 모드를 옮겼다 돌아와도 이어진다 (#826 S2)', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    ocrImpl = () => new Promise((resolve) => { release = () => resolve({}); });
    render(<MobileHarness />);
    await enterDirect(user);

    await user.upload(ocrFileInput(), new File(['x'], 'ticket.png', { type: 'image/png' }));
    const busy = await screen.findByRole('button', { name: '티켓 인식 중…' });
    expect(busy.getAttribute('aria-busy')).toBe('true');

    await user.click(screen.getByRole('tab', { name: '디자인' }));
    await user.click(screen.getByRole('tab', { name: /^정보/ }));
    expect(screen.getByRole('button', { name: '티켓 인식 중…' }).getAttribute('aria-busy')).toBe('true');

    release();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '스크린샷으로 자동입력' }).getAttribute('aria-busy')).toBe('false');
    });
  });

  // 편집 메뉴 '스크린샷으로 자동입력' 행(#826 S2 D09, constraint-17)도 같은 단일 카드를 연다 — 메뉴에 카드를 새로 얹지 않는다.
  test('메뉴 행은 랜딩의 단일 카드 파일 선택을 열고, 인식 중에는 \'티켓 인식 중…\'(aria-busy, 비활성)로 바뀐다', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    ocrImpl = () => new Promise((resolve) => { release = () => resolve({}); });
    render(<MobileHarness />);
    await enterDirect(user);

    const input = ocrFileInput();
    let clicks = 0;
    input.addEventListener('click', () => { clicks += 1; });

    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    const menu = within(screen.getByRole('dialog', { name: '편집 메뉴' }));
    await user.click(menu.getByRole('button', { name: '스크린샷으로 자동입력' }));
    expect(clicks).toBe(1);
    expect(screen.queryByRole('dialog', { name: '편집 메뉴' }) === null).toBe(true); // 행을 누르면 시트가 닫힌다
    expect(document.querySelectorAll('input[type="file"][accept="image/*"]').length).toBe(1);

    await user.upload(input, new File(['x'], 'ticket.png', { type: 'image/png' }));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    const busy = within(screen.getByRole('dialog', { name: '편집 메뉴' })).getByRole('button', { name: '티켓 인식 중…' }) as HTMLButtonElement;
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect(busy.disabled).toBe(true);

    release();
    await waitFor(() => {
      expect(within(screen.getByRole('dialog', { name: '편집 메뉴' })).getByRole('button', { name: '스크린샷으로 자동입력' }).getAttribute('aria-busy')).toBe('false');
    });
  });
});
