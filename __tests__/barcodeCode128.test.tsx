import { describe, expect, test } from 'bun:test';
import { buildBarcodeWidths, buildBarcodeWidths128C } from '../src/components/moods/_shared';
import { BARCODE_WIDTH as EDITORIAL_BARCODE_WIDTH } from '../src/components/moods/MoodEditorial';
import { BARCODE_WIDTH as STUB_BARCODE_WIDTH } from '../src/components/moods/MoodStub';

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

// Code128C 참조 벡터(손계산, #444) — 숫자 2자리를 심볼 1개(값=자릿수 그대로, subset C)로 묶는다.
// "1234"(짝수): Start-C(105) + [12,34] + 체크디짓 + Stop.
//   체크디짓 = (105 + 12*1 + 34*2) % 103 = 185 % 103 = 82
//   패턴 = Start-C(211232) · 12(112232) · 34(131123) · 82(121241) · Stop(2331112)
const EVEN_SEQ = '211232' + '112232' + '131123' + '121241' + '2331112';
// "123"(홀수): 마지막 1자리는 Code B로 전환해 넣는다 — Start-C(105) + [12] + CodeB(100) + '3'(subset B, 값19) + 체크디짓 + Stop.
//   체크디짓 = (105 + 12*1 + 100*2 + 19*3) % 103 = 374 % 103 = 65
//   패턴 = Start-C(211232) · 12(112232) · CodeB(114131) · 19(221132) · 65(121124) · Stop(2331112)
const ODD_SEQ = '211232' + '112232' + '114131' + '221132' + '121124' + '2331112';

describe('buildBarcodeWidths128C — Code128C 인코딩(#444)', () => {
  test('짝수 자리("1234")는 숫자 2자리씩 심볼화해 손계산 참조와 일치', () => {
    expect(buildBarcodeWidths128C('1234')).toEqual(seqToBars(EVEN_SEQ));
  });

  test('홀수 자리("123")는 마지막 1자리를 Code B로 전환해 손계산 참조와 일치', () => {
    expect(buildBarcodeWidths128C('123')).toEqual(seqToBars(ODD_SEQ));
  });

  test('Code128B 대비 심볼 수가 거의 절반 — CGV 16자리 판매번호 기준 231유닛(quiet 포함) -> 143유닛', () => {
    const cgv = '2026071912345678';
    const unitsOf = (bars: ReturnType<typeof buildBarcodeWidths>) =>
      bars.reduce((sum, b) => sum + b.w, 0) + 20; // quiet zone 10모듈×2
    expect(unitsOf(buildBarcodeWidths(cgv))).toBe(231);
    expect(unitsOf(buildBarcodeWidths128C(cgv))).toBe(143);
  });

  test('막대 폭은 128B와 동일하게 항상 1~4 모듈, Stop으로 bar 종결', () => {
    for (const b of buildBarcodeWidths128C('20260719123456')) {
      expect(b.w).toBeGreaterThanOrEqual(1);
      expect(b.w).toBeLessThanOrEqual(4);
    }
    const bars = buildBarcodeWidths128C('CGV-2026-071912345');
    expect(bars[bars.length - 1].ink).toBe(true);
  });

  // 체인별 판매번호 자릿수(#444 후속 확인) — CGV 16자리·롯데시네마 8자리·메가박스 11자리(홀수, Code B
  // 폴백 경로 실사용). editorial·stub 실제 바코드 width(각 컴포넌트의 BARCODE_WIDTH export, 매직넘버
  // 하드코딩 금지 — nit barcode-width-test-magic-numbers)에서 전부 모듈당 2px 이상을 유지해야 화면
  // 표시 최소 기준(2px/모듈)을 만족한다. CGV 16자리가 가장 길어 최악 케이스 — 나머지 체인은 자릿수가
  // 짧을수록 심볼 수가 줄어 여유가 더 크다.
  test.each([
    ['CGV', '2026071912345678'],
    ['롯데시네마', '12345678'],
    ['메가박스', '12345678901'],
  ])('%s(%s자리) 실제 무드 폭에서 모듈당 2px 이상', (_chain, digits) => {
    const units = buildBarcodeWidths128C(digits).reduce((sum, b) => sum + b.w, 0) + 20;
    expect(EDITORIAL_BARCODE_WIDTH / units).toBeGreaterThanOrEqual(2);
    expect(STUB_BARCODE_WIDTH / units).toBeGreaterThanOrEqual(2);
  });
});
