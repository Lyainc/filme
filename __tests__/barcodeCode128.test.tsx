import { describe, expect, test } from 'bun:test';
import { buildBarcodeWidths } from '../src/components/moods/_shared';

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

  // #190 rolling nit(PR #329 리뷰) — bookingNo가 숫자 없는 값(예: 순한글 OCR 오인식)이면
  // `\D` 제거 후 빈 문자열이 돼 데이터 심볼 없는 "빈" 바코드(Start+체크디짓+Stop 3개뿐)가 그려졌다.
  test('숫자가 하나도 없는 값은 빈 데이터가 아니라 폴백 bookingNo로 인코딩된다', () => {
    const noDigits = buildBarcodeWidths('가나다');
    expect(noDigits).toEqual(buildBarcodeWidths(''));
  });
});

// bookingNo에 섞인 대시가 Code128 심볼을 차지해 바코드가 왜곡되던 버그(#312) 회귀.
// Editorial의 "No. {bookingNo}" 텍스트는 #423에서 제거됐고 어느 무드도 원본 텍스트를
// 노출하지 않으므로(showText={false}), 여기선 인코딩 자체(대시 무시)만 검증한다.
describe('buildBarcodeWidths — 대시 포함 bookingNo (#312)', () => {
  test('바코드는 숫자만 인코딩한다(대시 무시)', () => {
    const dashed = 'T-20260510-0014';
    expect(buildBarcodeWidths(dashed)).toEqual(buildBarcodeWidths(dashed.replace(/\D/g, '')));
  });
});
