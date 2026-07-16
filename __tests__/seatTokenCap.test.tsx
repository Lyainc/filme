/**
 * #381 — 좌석 텍스트 오버플로우.
 *
 * 1) capSeatTokens: 쉼표 토큰 4개 초과분을 자르는 순수 함수 회귀.
 * 2) usePhototicket.updateMovieInfo: 수동 입력·OCR이 공유하는 choke point에서 캡이 실제로
 *    걸리는지(단위 테스트가 아니라 훅 레벨에서).
 * 3) MoodEditorial/MoodStub: 좌석 텍스트가 fitFontSizeToWidth로 폭 맞춤되는지 — 1~2토큰(짧은
 *    값)은 maxSize 그대로, 길어지면(예산 초과) 축소되는지 실제 렌더로 확인.
 *    happy-dom은 canvas 2D를 지원하지 않아(getContext('2d') → null) 실제 measureText를 볼 수
 *    없으므로, fitFontSizeToWidth.test.ts와 동일하게 "폭 = 글자수 × 폰트크기 × 0.6"에 비례하는
 *    가짜 canvas 컨텍스트로 이진탐색 경로를 실제로 태운다.
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { capSeatTokens, usePhototicket } from '../src/hooks/usePhototicket';
import { MoodEditorial } from '../src/components/moods/MoodEditorial';
import { MoodStub } from '../src/components/moods/MoodStub';
import { FULL_MOVIE, makeMoodBase } from './fixtures';
import type { MovieInfo } from '../src/types';

describe('capSeatTokens(#381)', () => {
  test('4토큰 이하는 원문 그대로 둔다', () => {
    expect(capSeatTokens('H12')).toBe('H12');
    expect(capSeatTokens('H12, H13')).toBe('H12, H13');
    expect(capSeatTokens('H12, H13, H14, H15')).toBe('H12, H13, H14, H15');
  });

  test('5토큰 이상은 앞 4개만 남기고 ", "로 다시 합친다', () => {
    expect(capSeatTokens('H12, H13, H14, H15, H16')).toBe('H12, H13, H14, H15');
    // 공백 없이 쉼표만 있어도 동일 — 잘린 뒤엔 ", "로 정규화된다.
    expect(capSeatTokens('H12,H13,H14,H15,H16,H17')).toBe('H12, H13, H14, H15');
  });

  test('빈 문자열은 빈 문자열', () => {
    expect(capSeatTokens('')).toBe('');
  });

  test('쉼표 없는 단일 토큰은 길이와 무관하게 안 잘린다(좌석 개수 캡이지 글자수 캡이 아님)', () => {
    const long = '아주긴자유텍스트좌석표기예시';
    expect(capSeatTokens(long)).toBe(long);
  });
});

describe('usePhototicket.updateMovieInfo — 좌석 캡이 choke point에서 걸린다(#381)', () => {
  afterEach(() => cleanup());

  test('수동 입력·OCR이 공유하는 updateMovieInfo에 5토큰을 넣으면 4토큰으로 잘려 저장된다', () => {
    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.updateMovieInfo({ seat: 'H12, H13, H14, H15, H16' });
    });
    expect(result.current.state.movieInfo.seat).toBe('H12, H13, H14, H15');
  });

  test('seat 키가 없는 업데이트는 기존 seat 값을 건드리지 않는다', () => {
    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.updateMovieInfo({ seat: 'H12, H13, H14, H15, H16' });
    });
    act(() => {
      result.current.updateMovieInfo({ title: '기생충' });
    });
    expect(result.current.state.movieInfo.seat).toBe('H12, H13, H14, H15');
    expect(result.current.state.movieInfo.title).toBe('기생충');
  });
});

const CHAR_WIDTH_FACTOR = 0.6;

function installFakeCanvasContext() {
  let currentFont = '400 16px sans-serif';
  const fakeCtx = {
    set font(v: string) { currentFont = v; },
    get font() { return currentFont; },
    measureText(text: string) {
      const sizeMatch = /(\d+(?:\.\d+)?)px/.exec(currentFont);
      const size = sizeMatch ? parseFloat(sizeMatch[1]) : 16;
      return { width: text.length * size * CHAR_WIDTH_FACTOR };
    },
  } as unknown as CanvasRenderingContext2D;

  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string) {
    return kind === '2d' ? fakeCtx : null;
  } as typeof HTMLCanvasElement.prototype.getContext;

  return () => { HTMLCanvasElement.prototype.getContext = original; };
}

function movieWithSeat(seat: string): MovieInfo {
  return { ...FULL_MOVIE, seat };
}

describe('MoodEditorial 좌석 폭 맞춤 통합 (#381)', () => {
  let restore: () => void;
  afterEach(() => restore?.());

  test('짧은 좌석(1~2토큰)은 축소 없이 maxSize(56px) 그대로 렌더된다', () => {
    restore = installFakeCanvasContext();
    // widthAt(56) = 5자 × 56 × 0.6 = 168 <= 260(예산) → 축소 없음.
    const html = renderToStaticMarkup(
      <MoodEditorial movieInfo={movieWithSeat('H1,H2')} components={makeMoodBase('editorial')} croppedImageUrl="blob:x" />,
    );
    expect(html).toContain('font-size:56px');
  });

  test('긴 좌석(4토큰)은 예산(260px) 안에 들어오도록 축소된다', () => {
    restore = installFakeCanvasContext();
    // widthAt(size) = 11자 × size × 0.6 = 6.6×size. maxWidth=260 → size<=39에서 fit(39: 257.4, 40: 264).
    const html = renderToStaticMarkup(
      <MoodEditorial movieInfo={movieWithSeat('H1,H2,H3,H4')} components={makeMoodBase('editorial')} croppedImageUrl="blob:x" />,
    );
    expect(html).toContain('font-size:39px');
    expect(html).not.toContain('font-size:56px');
  });
});

describe('MoodStub 좌석 폭 맞춤 통합 (#381)', () => {
  let restore: () => void;
  afterEach(() => restore?.());

  test('짧은 좌석(1~2토큰)은 축소 없이 maxSize(48px) 그대로 렌더된다', () => {
    restore = installFakeCanvasContext();
    // widthAt(48) = 5자 × 48 × 0.6 = 144 <= 520(예산) → 축소 없음.
    const html = renderToStaticMarkup(
      <MoodStub movieInfo={movieWithSeat('H1,H2')} components={makeMoodBase('stub')} croppedImageUrl="blob:x" />,
    );
    expect(html).toContain('font-size:48px');
  });

  test('긴 좌석(4토큰, 자릿수 많은 실사용 예)은 예산(520px) 안에 들어오도록 축소된다', () => {
    restore = installFakeCanvasContext();
    // widthAt(size) = 23자 × size × 0.6 = 13.8×size. maxWidth=520 → size<=37에서 fit(37: 510.6, 38: 524.4).
    const html = renderToStaticMarkup(
      <MoodStub movieInfo={movieWithSeat('H1,H2,H3,H4,H5,H6,H7,H8')} components={makeMoodBase('stub')} croppedImageUrl="blob:x" />,
    );
    expect(html).toContain('font-size:37px');
    expect(html).not.toContain('font-size:48px');
  });
});
