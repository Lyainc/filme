import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mood35mm } from '../src/components/moods/Mood35mm';
import { Mood35mmLandscape } from '../src/components/moods/Mood35mmLandscape';
import { FULL_MOVIE, makeMoodBase } from './fixtures';

// FilmStripBand 엣지 코드 폰트 교체(#393) — DSEG7(LCD, ASCII 전용)엔 한글 글리프가 없어 title/signature
// 등 유저 입력이 섞인 code만 containsHangul로 감지해 FONT_KR로 개별 폴백한다. FULL_MOVIE는 signature가
// 실제 한글(영화수집가)이라 이 분기를 그대로 태운다. title은 두 35mm 무드(세로·Wide) 모두 원제(titleOgVal,
// 영문 — FULL_MOVIE.titleOg='The Grand Budapest Hotel')를 쓰고 없으면 title로 폴백한다(#423, 두 무드 통일).
describe.each([
  [
    'Mood35mm',
    (movieInfo: typeof FULL_MOVIE) => renderToStaticMarkup(<Mood35mm movieInfo={movieInfo} components={makeMoodBase('35mm')} croppedImageUrl="blob:x" onField={() => {}} />),
  ],
  [
    'Mood35mmLandscape',
    (movieInfo: typeof FULL_MOVIE) => renderToStaticMarkup(<Mood35mmLandscape movieInfo={movieInfo} components={makeMoodBase('35mm-landscape')} croppedImageUrl="blob:x" onField={() => {}} />),
  ],
])('%s FilmStripBand 엣지 코드 — 원제 사용 (#423)', (_name, render) => {
  const markup = () => render(FULL_MOVIE);

  test('title code는 titleOg(영문)라 FONT_KR 폴백 없이 상속, signature는 한글이라 개별 폴백', () => {
    const html = markup();
    expect(html).toContain('<span>The Grand Budapest Hotel</span>');
    expect(html).not.toMatch(/<span style="font-family:&quot;Pretendard Variable&quot;[^"]*">그랜드 부다페스트 호텔<\/span>/);
    expect(html).toMatch(/<span style="font-family:&quot;Pretendard Variable&quot;[^"]*">COLLECTED BY 영화수집가<\/span>/);
  });

  test('titleOg가 없으면 title로 폴백', () => {
    const html = render({ ...FULL_MOVIE, titleOg: '' });
    expect(html).toMatch(/<span style="font-family:&quot;Pretendard Variable&quot;[^"]*">그랜드 부다페스트 호텔<\/span>/);
  });

  test('ASCII code(SAFETY FILM 등)는 개별 style 없이 상속(FONT_LCD)', () => {
    const html = markup();
    expect(html).toContain('<span>SAFETY FILM</span>');
    expect(html).toContain('<span>MADE WITH FILME · 35MM</span>');
  });

  test('FilmStripBand 컨테이너 기본 폰트는 FONT_LCD(DSEG7)', () => {
    const html = markup();
    expect(html).toContain('font-family:var(--font-lcd)');
  });
});
