/**
 * 랜딩에서 연 스크린샷 인식의 안내 자리(#826 S9 constraint-11 · acceptance-10, S5의 위치 표시 자리를 대체).
 *
 * 카드의 3000ms 안내 경로를 타는 문구 여덟 개가 전부 첨부 시트의 '티켓 스크린샷' 행 상태 줄(--pr-warn)에 뜬다.
 * 셸은 KOBIS 무매칭을 늘 제목 입력(onNeedManualTitle)으로 돌려 두 문구가 랜딩에 거의 안 닿으므로, 여기선
 * Landing과 카드 한 벌을 직접 렌더해 "카드가 띄우는 어떤 안내든 그 행으로 간다"를 문구마다 잰다.
 * 삭제: 전시 아래 안내 자리(landing-notice) · 위치 표시 숨김 단언 — 그 요소가 S9에서 없어졌다.
 */
import { afterAll, afterEach, describe, expect, jest, mock, test } from 'bun:test';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

let ocrImpl: (file: File) => Promise<Record<string, unknown>> = async () => ({});
let kobisImpl: (title: string) => Promise<Record<string, unknown>> = async () => ({});
// 스프레드 스냅샷 + afterAll 복원(#611) — docs/TESTING.md §5.
const realOcr = { ...require('@/utils/ocr') };
const realKobis = { ...require('@/utils/kobisLookup') };
mock.module('@/utils/ocr', () => ({ ...realOcr, runOcr: (file: File) => ocrImpl(file) }));
mock.module('@/utils/kobisLookup', () => ({ ...realKobis, triggerKobisLookup: (t: string) => kobisImpl(t) }));

const { Landing } = require('@/components/v2/Landing') as typeof import('@/components/v2/Landing');
const { OcrUploadCard } = require('@/components/v2/OcrUploadCard') as typeof import('@/components/v2/OcrUploadCard');

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  ocrImpl = async () => ({});
  kobisImpl = async () => ({});
});
afterAll(() => {
  mock.module('@/utils/ocr', () => realOcr);
  mock.module('@/utils/kobisLookup', () => realKobis);
});

const openRef: { current: (() => void) | null } = { current: null };

function Harness() {
  const [sheet, setSheet] = useState(false);
  return (
    <Landing
      mode="overlay"
      restoreTitle=""
      onRestore={() => {}}
      onDirect={() => {}}
      onOpenSheet={() => setSheet(true)}
      onCloseSheet={() => setSheet(false)}
      onPickScreenshot={() => openRef.current?.()}
      onPickPoster={() => {}}
      onMake={() => {}}
      livePreview={null}
      sheet={sheet ? { screenshot: { kind: 'empty' }, posterThumb: null, canMake: false } : null}
    >
      <OcrUploadCard
        openRef={openRef}
        setInfo={() => {}}
        currentInfo={{}}
        onOcrApply={() => {}}
        ocrEpochRef={{ current: 0 }}
        captureMovieSelection={() => () => true}
        captureDraft={() => () => true}
        onKobisDiscarded={() => {}}
        onKobisApplied={() => {}}
      />
    </Landing>
  );
}

const input = () => document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
const png = () => new File(['x'], 'ticket.png', { type: 'image/png' });

const scenarios: {
  name: string;
  message: string;
  file: () => File;
  ocr?: () => Promise<Record<string, unknown>>;
  kobis?: () => Promise<Record<string, unknown>>;
}[] = [
  { name: '실패', message: '인식에 실패했어요', file: png, ocr: async () => ({ failed: true }) },
  { name: '요청 많음', message: '지금 요청이 많아요. 잠시 후 다시 시도하거나 직접 입력해 주세요.', file: png, ocr: async () => ({ rateLimited: true }) },
  { name: '형식', message: 'PNG, JPG, WebP만 인식할 수 있어요', file: () => new File(['x'], 'doc.pdf', { type: 'application/pdf' }) },
  { name: 'HEIC', message: 'HEIC는 지원하지 않아요', file: () => new File(['x'], 'ticket.heic', { type: 'image/heic' }) },
  { name: '용량', message: '10MB 이하 이미지만 돼요', file: () => new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }) },
  { name: '인식된 정보 없음', message: '인식된 정보가 없어요. 직접 입력해 주세요.', file: png, ocr: async () => ({}) },
  { name: '영화 정보 못 찾음', message: '영화 정보를 찾지 못했어요. 제목을 확인하고 다시 검색해 주세요.', file: png, ocr: async () => ({ title: '없는 영화', theater: 'CGV' }) },
  // KOBIS가 찾으면 뒤이은 무매칭 안내가 없어 이 문구가 그대로 남는다.
  { name: '제목으로 검색', message: '제목으로 영화 정보를 검색할게요.', file: png, ocr: async () => ({ title: '괴물' }), kobis: async () => ({ titleOg: 'The Host', actors: '송강호' }) },
];

describe('랜딩 안내는 첨부 시트의 스크린샷 행에 뜬다 (#826 S9 constraint-11)', () => {
  for (const sc of scenarios) {
    test(`${sc.name}: 시트 행 상태 줄에 3000ms 보이다 사라진다`, async () => {
      if (sc.ocr) ocrImpl = sc.ocr;
      if (sc.kobis) kobisImpl = sc.kobis;
      jest.useFakeTimers();
      render(<Harness />);
      // 랜딩에는 옛 안내 자리 · 위치 표시 · 보이는 OCR 버튼이 없다. 숨은 입력과 role=status만 남는다.
      expect(screen.queryByTestId('landing-notice') === null).toBe(true);
      expect(screen.queryByTestId('mood-gallery-index') === null).toBe(true);

      // 주 버튼은 파일 선택이 아니라 시트를 연다 — 그 시트의 '티켓 스크린샷' 행이 OCR 입력을 연다.
      fireEvent.click(screen.getByTestId('landing-cta'));
      const clickSpy = jest.spyOn(input(), 'click');
      fireEvent.click(screen.getByTestId('landing-sheet-screenshot'));
      expect(clickSpy).toHaveBeenCalledTimes(1);

      fireEvent.change(input(), { target: { files: [sc.file()] } });
      // OCR · KOBIS 응답은 마이크로태스크라 타이머를 안 돌리고 흘려보낸다.
      for (let i = 0; i < 10; i++) await act(async () => {});

      const err = screen.getByTestId('landing-sheet-screenshot-error');
      expect(err.textContent).toBe(sc.message);
      expect(screen.getByTestId('landing-sheet-screenshot').contains(err)).toBe(true);
      expect(err.className).toContain('text-warn');
      // 상시 마운트 role=status 리전에 같은 글자가 실린다.
      expect(screen.getByRole('status').textContent).toBe(sc.message);

      act(() => jest.advanceTimersByTime(2999));
      expect(screen.queryByTestId('landing-sheet-screenshot-error') === null).toBe(false);
      act(() => jest.advanceTimersByTime(1));
      expect(screen.queryByTestId('landing-sheet-screenshot-error') === null).toBe(true);
      expect(screen.getByRole('status').textContent).toBe('');
    });
  }

  test('랜딩 밖(자리를 빌려주는 Landing이 없을 때) 카드는 자기 아래 토스트로 남는다', async () => {
    render(
      <OcrUploadCard
        setInfo={() => {}}
        currentInfo={{}}
        onOcrApply={() => {}}
        ocrEpochRef={{ current: 0 }}
        captureMovieSelection={() => () => true}
        captureDraft={() => () => true}
        onKobisDiscarded={() => {}}
        onKobisApplied={() => {}}
      />,
    );
    fireEvent.change(input(), { target: { files: [new File(['x'], 'ticket.heic', { type: 'image/heic' })] } });
    expect(document.querySelector('.absolute.top-full')?.textContent).toBe('HEIC는 지원하지 않아요');
  });
});
