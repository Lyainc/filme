import { afterAll, afterEach, expect, mock, spyOn, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PhototicketState } from '@/types';
import { mobileShellProps } from './shellHarness';

// 이미지 디코드만 생략하고 FileReader → runOcr → 셸의 실제 상태 갱신 경로를 검증한다.
const realPreprocess = { ...require('@/utils/ocrPreprocess') };
mock.module('@/utils/ocrPreprocess', () => ({
  ...realPreprocess,
  preprocessForOcr: async (file: File) => file,
}));
const { runOcr } = require('@/utils/ocr') as typeof import('@/utils/ocr');
const { usePhototicket } = require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');
const { MobileEditorShell } = require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');
let captured: PhototicketState;

function Harness() {
  const photo = usePhototicket();
  captured = photo.state;
  return <>
    <button onClick={() => {
      photo.updateMovieInfo({ title: '기존 영화', theater: '기존 극장', seat: 'A1' });
      photo.updateComponents({ chainLabel: '메가박스', formatLabel: 'Dolby' });
    }}>seed</button>
    <MobileEditorShell {...mobileShellProps(photo)} />
  </>;
}

afterEach(() => {
  cleanup();
  mock.restore();
  localStorage.clear();
});
afterAll(() => mock.module('@/utils/ocrPreprocess', () => realPreprocess));

const cases = [
  { name: '정상 빈 결과', response: () => Response.json({}), result: {}, message: '인식된 정보가 없어요. 직접 입력해 주세요.' },
  { name: 'HTTP 429', response: () => new Response('', { status: 429 }), result: { rateLimited: true }, message: '지금 요청이 많아요. 잠시 후 다시 시도하거나 직접 입력해 주세요.' },
  ...[500, 502].map(status => ({ name: `HTTP ${status}`, response: () => new Response('', { status }), result: { failed: true }, message: '인식에 실패했어요' })),
  { name: '네트워크 실패', response: () => { throw new TypeError('offline'); }, result: { failed: true }, message: '인식에 실패했어요' },
];

// #826 S2 — 두 번째 카드(필드 드로어)가 사라져 'drawer' 문맥은 정보 모드 버튼('info')으로 갔다. 카드는 랜딩 안
// 한 벌뿐이고, 랜딩이 걷힌 뒤에는 그 카드의 안내가 display:none 안이라 셸 토스트가 대신 보여준다.
for (const context of ['landing', 'info'] as const) {
  for (const scenario of cases) {
    test(`${context}: ${scenario.name} 안내·문서 보존·처리 해제·같은 파일 재시도 (#773)`, async () => {
      spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = spyOn(globalThis, 'fetch').mockImplementation((async () => scenario.response()) as unknown as typeof fetch);
      const file = new File(['ticket'], 'ticket.png', { type: 'image/png' });
      expect(await runOcr(file)).toEqual(scenario.result);
      fetchMock.mockClear();
      render(<Harness />);
      fireEvent.click(screen.getByText('seed'));
      if (context === 'info') fireEvent.click(screen.getByTestId('landing-restore'));
      expect(captured.movieInfo.title).toBe('기존 영화');
      expect(captured.components.chainLabel).toBe('메가박스');
      const inputs = document.querySelectorAll('input[type="file"][accept="image/*"]');
      expect(inputs.length).toBe(1); // 카드는 한 벌뿐이다(constraint-17)
      const input = inputs[0] as HTMLInputElement;
      const button = screen.getByRole<HTMLButtonElement>('button', { name: context === 'landing' ? '티켓 스크린샷으로 자동입력' : '스크린샷으로 자동입력' });
      const before = JSON.stringify(captured);

      for (let attempt = 1; attempt <= 2; attempt++) {
        if (context === 'info') {
          let opened = 0;
          const onClick = () => { opened += 1; };
          input.addEventListener('click', onClick);
          fireEvent.click(button);
          input.removeEventListener('click', onClick);
          expect(opened).toBe(1); // 정보 모드 버튼이 랜딩 카드의 파일 선택을 연다
        }
        fireEvent.change(input, { target: { files: [file] } });
        expect(button.getAttribute('aria-busy')).toBe('true');
        await waitFor(() => expect(button.getAttribute('aria-busy')).toBe('false'));
        expect(button.disabled).toBe(false);
        expect(button.getAttribute('aria-disabled')).not.toBe('true');
        expect(fetchMock).toHaveBeenCalledTimes(attempt);
        expect(JSON.stringify(captured)).toBe(before);
        expect(input.value).toBe('');
        expect(!!screen.queryByRole('button', { name: '되돌리기' })).toBe(false);
        if (context === 'landing') {
          // 시각 안내는 전시 아래 위치 표시 자리(주 CTA 바로 위)에 뜬다(#826 S5 constraint-11).
          expect(screen.getByTestId('landing-notice').textContent).toBe(scenario.message);
          expect(!!screen.getByTestId('mood-gallery').contains(screen.getByTestId('landing-notice'))).toBe(true);
        } else {
          // 랜딩이 걷힌 뒤엔 셸 토스트가 같은 문구를 보여준다.
          expect(screen.getByTestId('global-toast').textContent).toBe(scenario.message);
        }
      }
    });
  }
}

test('잘못된 JSON/응답 형태도 throw 없이 실패 표시로 반환한다', async () => {
  spyOn(console, 'error').mockImplementation(() => {});
  const fetchMock = spyOn(globalThis, 'fetch');
  for (const body of ['not json', 'null', '[]', '"text"']) {
    fetchMock.mockImplementation((async () => new Response(body)) as unknown as typeof fetch);
    expect(await runOcr(new File(['ticket'], 'ticket.png', { type: 'image/png' }))).toEqual({ failed: true });
  }
});
