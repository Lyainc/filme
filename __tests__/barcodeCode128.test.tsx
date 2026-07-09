import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildBarcodeWidths } from '../src/components/moods/_shared';
import { MoodEditorial } from '../src/components/moods/MoodEditorial';
import type { MovieInfo, TicketComponents } from '../src/types';

// 표준 Code128B 참조 벡터: 입력 "20" (손계산, 숫자만 인코딩 — #312 이후 문자는 인코딩 전 제거됨)
//   '2'(ASCII 50) -> 값 18,  '0'(ASCII 48) -> 값 16
//   체크디짓 = (104 + 18*1 + 16*2) % 103 = 154 % 103 = 51
//   심볼 = [104=Start-B, 18, 16, 51=check, 106=Stop]
//   패턴 =  211214 · 223211 · 123122 · 213113 · 2331112
const DIGIT_SEQ = '211214' + '223211' + '123122' + '213113' + '2331112';

// 모듈 폭 문자열 -> bar로 시작해 교차하는 Bar[] (인코더와 독립인 참조 변환)
function seqToBars(seq: string) {
  let ink = true;
  return seq.split('').map((d) => {
    const bar = { ink, w: parseInt(d, 10) };
    ink = !ink;
    return bar;
  });
}

describe('buildBarcodeWidths — 표준 Code128B 인코딩 (#207)', () => {
  test('"20"이 손계산 참조 모듈 시퀀스와 정확히 일치(체크디짓 포함)', () => {
    expect(buildBarcodeWidths('20')).toEqual(seqToBars(DIGIT_SEQ));
  });

  test('임의 bookingNo는 Start-B로 시작하고 Stop(bar 종결)으로 끝난다', () => {
    const bars = buildBarcodeWidths('PT-2026-1234');
    const head = bars.slice(0, 6).map((b) => b.w).join('');
    const tail = bars.slice(-7).map((b) => b.w).join('');
    expect(head).toBe('211214'); // Start-B
    expect(tail).toBe('2331112'); // Stop
    expect(bars[bars.length - 1].ink).toBe(true); // 종결은 bar
  });

  test('모든 막대 폭은 1~4 모듈(유효 Code128 폭)', () => {
    for (const b of buildBarcodeWidths('CGV-98765')) {
      expect(b.w).toBeGreaterThanOrEqual(1);
      expect(b.w).toBeLessThanOrEqual(4);
    }
  });

  test('빈 입력은 폴백 bookingNo로 인코딩(throw 없이 비어있지 않음)', () => {
    expect(buildBarcodeWidths('').length).toBeGreaterThan(0);
  });
});

// bookingNo에 섞인 대시가 Code128 심볼을 차지해 바코드가 왜곡되던 버그(#312) 회귀.
describe('buildBarcodeWidths — 대시 포함 bookingNo (#312)', () => {
  const DASHED = 'T-20260510-0014';

  const MOVIE: MovieInfo = {
    title: '그랜드 부다페스트 호텔', titleOg: 'The Grand Budapest Hotel', actors: '랄프 파인즈', rating: 4.5,
    releaseDate: '2014-03-20', releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
    watchDate: '2024-03-15', watchDateFormat: 'kr-compact', watchTime: '19:30',
    theater: '메가박스 코엑스', screen: 'Dolby Cinema', seat: 'G14', runtime: '99분',
    bookingNumber: DASHED,
  };

  const COMPONENTS: TicketComponents = {
    layout: 'editorial', chain: '', format: '', chainLabel: '', formatLabel: '',
    texture: 'none', posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
    chainVisible: false, formatVisible: false,
  };

  test('바코드는 숫자만 인코딩하고(대시 무시), 티켓 텍스트는 대시 포함 원본을 그대로 표시한다', () => {
    expect(buildBarcodeWidths(DASHED)).toEqual(buildBarcodeWidths(DASHED.replace(/\D/g, '')));

    const html = renderToStaticMarkup(
      <MoodEditorial movieInfo={MOVIE} components={COMPONENTS} croppedImageUrl="blob:x" onField={() => {}} />
    );
    expect(html).toContain(`No. ${DASHED}`);
  });
});
