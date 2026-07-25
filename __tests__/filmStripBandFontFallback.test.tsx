import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mood35mm } from '../src/components/moods/Mood35mm';
import { Mood35mmLandscape } from '../src/components/moods/Mood35mmLandscape';
import { FULL_MOVIE, makeMoodBase } from './fixtures';

// FilmStripBand 엣지 코드 폰트 교체(#393) — DSEG7(LCD, ASCII 전용)엔 한글 글리프가 없어 title/signature
// 등 유저 입력이 섞인 code만 containsHangul로 감지해 FONT_KR로 개별 폴백한다. FULL_MOVIE는 signature가
// 실제 한글(영화수집가)이라 이 분기를 그대로 태운다. title은 두 35mm 무드(세로·Wide) 모두 원제(titleOgVal,
// 영문 — FULL_MOVIE.titleOg='The Grand Budapest Hotel')를 쓰고 없으면 title로 폴백한다(#423, 두 무드 통일).
// v5 재설계(#524)로 35mm 세로는 가로 밴드 대신 세로 레일(FilmRail)을 쓴다 — 레일 엣지 프린트는
// 코드를 한 줄로 이어 붙이므로 code 단위 폴백 자리가 없어 줄 전체를 FONT_KR로 돌린다(아래 별도 케이스).
describe.each([
  [
    'Mood35mmLandscape',
    (movieInfo: typeof FULL_MOVIE) => renderToStaticMarkup(<Mood35mmLandscape movieInfo={movieInfo} components={makeMoodBase('35mm-landscape')} croppedImageUrl="blob:x" onField={() => {}} />),
  ],
])('%s FilmStripBand 엣지 코드 — 원제 사용 (#423)', (_name, render) => {
  const markup = () => render(FULL_MOVIE);

  test('title code는 titleOg(영문)라 FONT_KR 폴백 없이 상속, signature는 한글이라 개별 폴백', () => {
    const html = markup();
    expect(html).toContain('<span>THE GRAND BUDAPEST HOTEL</span>');
    expect(html).not.toMatch(/<span style="font-family:&quot;Pretendard Variable&quot;[^"]*">그랜드 부다페스트 호텔<\/span>/);
    expect(html).toMatch(/<span style="font-family:&quot;Pretendard Variable&quot;[^"]*">COLLECTED BY 영화수집가<\/span>/);
  });

  test('titleOg가 없으면 title로 폴백(toUpperCase는 한글엔 no-op, #443 팔로업)', () => {
    const html = render({ ...FULL_MOVIE, titleOg: '' });
    expect(html).toMatch(/<span style="font-family:&quot;Pretendard Variable&quot;[^"]*">그랜드 부다페스트 호텔<\/span>/);
  });

  test('ASCII code(SAFETY FILM 등)는 개별 style 없이 상속(FONT_LCD)', () => {
    const html = markup();
    expect(html).toContain('<span>SAFETY FILM</span>');
    expect(html).toContain('<span>MADE WITH FILME · 35MM</span>');
  });

  test('FilmStripBand 컨테이너 기본 폰트는 FONT_LCD(Share Tech Mono)', () => {
    const html = markup();
    expect(html).toContain('font-family:var(--font-lcd)');
  });
});

// FilmRail(35mm 세로 v5, #524) — 엣지 프린트가 코드 배열이 아니라 한 문자열이라 code 단위 폴백을
// 걸 자리가 없다. 한글이 하나라도 섞이면(서명·한글 제목) 줄 전체를 FONT_KR로 돌려 tofu를 막는다.
describe('Mood35mm FilmRail 엣지 프린트 폰트 폴백 (#524)', () => {
  const render = (movieInfo: typeof FULL_MOVIE) =>
    renderToStaticMarkup(<Mood35mm movieInfo={movieInfo} components={makeMoodBase('35mm')} croppedImageUrl="blob:x" onField={() => {}} />);

  test('한글 서명이 섞이면 레일 프린트 줄 전체가 FONT_KR', () => {
    const html = render(FULL_MOVIE);
    expect(html).toMatch(/left:68px;top:-40px[^"]*font-family:&quot;Pretendard Variable&quot;/);
    expect(html).toContain('COLLECTED BY 영화수집가');
  });

  test('한글이 없으면 FONT_LCD 유지', () => {
    const html = render({ ...FULL_MOVIE, signature: 'JIWOO', title: 'GRAND BUDAPEST' });
    expect(html).toMatch(/left:68px;top:-40px[^"]*font-family:var\(--font-lcd\)/);
  });

  test('레일 프린트도 원제를 쓴다(#423) — 코드 런 4회 반복', () => {
    const html = render(FULL_MOVIE);
    expect(html.match(/THE GRAND BUDAPEST HOTEL/g)?.length).toBe(4);
  });
});
