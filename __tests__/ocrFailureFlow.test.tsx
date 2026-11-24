import { afterAll, afterEach, expect, mock, spyOn, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
// #826 S9 — 랜딩의 인식은 첨부 시트의 '티켓 스크린샷' 행에서만 열리고 안내도 그 행 상태 줄에 뜬다(constraint-11).
// 시트에서 연 인식은 시작 때 문서를 스냅샷하고 새 문서를 열므로(constraint-9) '문서 보존'은 실패 뒤 시트를 닫아
// 스냅샷으로 되돌렸을 때 시작 전 문서와 같다는 뜻이다.
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
      if (context === 'landing') fireEvent.click(screen.getByTestId('landing-cta'));
      expect(captured.movieInfo.title).toBe('기존 영화');
      expect(captured.components.chainLabel).toBe('메가박스');
      const inputs = document.querySelectorAll('input[type="file"][accept="image/*"]');
      expect(inputs.length).toBe(1); // 카드는 한 벌뿐이다(constraint-17)
      const input = inputs[0] as HTMLInputElement;
      // 랜딩은 시트의 '티켓 스크린샷' 행이, 편집은 정보 모드 버튼이 같은 카드의 파일 선택을 연다.
      const trigger = () =>
        fireEvent.click(context === 'landing' ? screen.getByTestId('landing-sheet-screenshot') : infoButton());
      // 정보 모드 버튼은 인식 중에 이름이 바뀌므로 노드를 한 번 잡아 속성으로 본다.
      const infoNode = context === 'info' ? screen.getByRole<HTMLButtonElement>('button', { name: '스크린샷으로 자동입력' }) : null;
      const infoButton = () => infoNode as HTMLButtonElement;
      const before = JSON.stringify(captured);

      for (let attempt = 1; attempt <= 2; attempt++) {
        let opened = 0;
        const onClick = () => { opened += 1; };
        input.addEventListener('click', onClick);
        trigger();
        input.removeEventListener('click', onClick);
        expect(opened).toBe(1);
        fireEvent.change(input, { target: { files: [file] } });
        if (context === 'info') {
          expect(infoButton().getAttribute('aria-busy')).toBe('true');
          await waitFor(() => expect(infoButton().getAttribute('aria-busy')).toBe('false'));
          expect(infoButton().disabled).toBe(false);
          expect(infoButton().getAttribute('aria-disabled')).not.toBe('true');
          expect(JSON.stringify(captured)).toBe(before);
        } else {
          // 시트의 행은 인식 중에 '인식 중'을 싣고(첫 시도), 끝나면 안내를 오류 상태 줄에 싣는다.
          if (attempt === 1) expect(screen.getByTestId('landing-sheet-screenshot').textContent).toContain('인식 중');
          await waitFor(() => expect(screen.getByTestId('landing-sheet-screenshot').textContent).not.toContain('인식 중'));
          // 둘째 시도는 첫 시도의 같은 안내가 남아 있어 상태 줄이 안 바뀐다 — 요청이 실제로 나갔고 응답이 흘러갈 틈을 준다.
          await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(attempt));
          await new Promise((r) => setTimeout(r, 30));
          // 처리가 풀렸다 — 같은 행이 다시 눌리고(비활성 아님) 다음 시도의 입력이 열린다.
          expect(screen.getByTestId('landing-sheet-screenshot').hasAttribute('disabled')).toBe(false);
          expect(screen.getByTestId('landing-sheet-make').getAttribute('aria-disabled')).toBe('true'); // 넣은 게 없다
          expect(screen.getByTestId('landing-sheet-screenshot-error').textContent).toBe(scenario.message);
          // role=status 라이브리전에도 같은 문구가 실린다.
          expect(within(screen.getByTestId('landing-card-slot')).getByRole('status').textContent).toBe(scenario.message);
          // 실패한 인식은 새 문서에 아무것도 안 썼다(랜딩 전체는 아직 시트 아래에 그대로).
          expect(captured.movieInfo.theater).toBe('');
          expect(screen.getByTestId('landing').classList.contains('fixed')).toBe(true);
        }
        expect(fetchMock).toHaveBeenCalledTimes(attempt);
        expect(input.value).toBe('');
        expect(!!screen.queryByRole('button', { name: '되돌리기' })).toBe(false);
        if (context === 'info') {
          // 랜딩이 걷힌 뒤엔 셸 토스트가 같은 문구를 보여준다.
          expect(screen.getByTestId('global-toast').textContent).toBe(scenario.message);
        }
      }
      if (context === 'landing') {
        // 시트를 닫으면 스냅샷으로 돌아가 시작 전 문서가 그대로다.
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        expect(JSON.stringify(captured)).toBe(before);
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
