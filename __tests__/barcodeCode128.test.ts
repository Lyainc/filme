import { describe, expect, test } from 'bun:test';
import { buildBarcodeWidths } from '../src/components/moods/_shared';

// 표준 Code128B 참조 벡터: 입력 "AB" (손계산)
//   A(ASCII 65) -> 값 33,  B(ASCII 66) -> 값 34
//   체크디짓 = (104 + 33*1 + 34*2) % 103 = 205 % 103 = 102
//   심볼 = [104=Start-B, 33, 34, 102=check, 106=Stop]
//   패턴 =  211214 · 111323 · 131123 · 411131 · 2331112
const AB_SEQ = '211214' + '111323' + '131123' + '411131' + '2331112';

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
  test('"AB"가 손계산 참조 모듈 시퀀스와 정확히 일치(체크디짓 포함)', () => {
    expect(buildBarcodeWidths('AB')).toEqual(seqToBars(AB_SEQ));
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
