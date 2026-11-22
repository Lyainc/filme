/**
 * 랜딩에서 연 스크린샷 인식의 안내 자리(#826 S5 constraint-11 · acceptance-10, 마스터 L-03).
 *
 * 카드의 3000ms 안내 경로를 타는 문구 여덟 개가 전부 **같은 자리** — 전시 아래쪽 위치 표시 자리(주 CTA 바로 위)에
 * 오류 변형(--pr-warn)으로 뜨고, 그동안 위치 표시는 숨는다. 셸은 KOBIS 무매칭을 늘 제목 입력(onNeedManualTitle)으로
 * 돌려 '영화 정보를 찾지 못했어요…' · '제목으로 영화 정보를 검색할게요.'가 랜딩 화면에 거의 안 닿으므로, 여기선
 * Landing과 카드 한 벌을 직접 렌더해 "카드가 띄우는 어떤 안내든 그 자리로 간다"를 문구마다 잰다.
 */
import { afterAll, afterEach, describe, expect, jest, mock, test } from 'bun:test';
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

function Harness() {
  return (
    <Landing mode="overlay" onCta={() => {}} onSkip={() => {}} onRestore={() => {}} restoreTitle="" onEnterMood={() => {}}>
      <OcrUploadCard
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
const cta = () => screen.getByRole('button', { name: '티켓 스크린샷으로 자동입력' });

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

describe('랜딩 안내는 전부 위치 표시 자리에 뜬다 (#826 S5 L-03)', () => {
  for (const sc of scenarios) {
    test(`${sc.name}: 같은 자리에 3000ms 보이다 사라지고, 그동안 위치 표시가 없다`, async () => {
      if (sc.ocr) ocrImpl = sc.ocr;
      if (sc.kobis) kobisImpl = sc.kobis;
      jest.useFakeTimers();
      render(<Harness />);
      expect(screen.getByTestId('mood-gallery-index').textContent).toBe('1 / 5');

      fireEvent.change(input(), { target: { files: [sc.file()] } });
      // OCR · KOBIS 응답은 마이크로태스크라 타이머를 안 돌리고 흘려보낸다.
      for (let i = 0; i < 10; i++) await act(async () => {});
      expect(screen.queryByTestId('landing-notice')?.textContent).toBe(sc.message);

      const notice = screen.getByTestId('landing-notice');
      // 자리: 전시 컨테이너 안, DOM 순서상 주 CTA보다 앞(= 위), 위치 표시는 숨음.
      expect(screen.getByTestId('mood-gallery').contains(notice)).toBe(true);
      expect((notice.compareDocumentPosition(cta()) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
      expect(screen.queryByTestId('mood-gallery-index') === null).toBe(true);
      // 오류 변형(--pr-warn 계열, 결정 5) — 카드 아래 옛 토스트는 없다.
      expect(notice.className).toContain('var(--pr-warn)');
      expect(notice.querySelector('.bg-warn') !== null).toBe(true);
      expect(document.querySelector('.absolute.top-full') === null).toBe(true);
      // 상시 마운트 role=status 리전에 같은 글자가 실린다.
      expect(screen.getByRole('status').textContent).toBe(sc.message);

      act(() => jest.advanceTimersByTime(2999));
      expect(screen.queryByTestId('landing-notice') === null).toBe(false);
      act(() => jest.advanceTimersByTime(1));
      expect(screen.queryByTestId('landing-notice') === null).toBe(true);
      expect(screen.getByTestId('mood-gallery-index').textContent).toBe('1 / 5');
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
