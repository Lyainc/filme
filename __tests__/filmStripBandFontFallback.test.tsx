import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mood35mm } from '../src/components/moods/Mood35mm';
import { Mood35mmLandscape } from '../src/components/moods/Mood35mmLandscape';
import { FULL_MOVIE, makeMoodBase } from './fixtures';

// FilmStripBand 엣지 코드 폰트 교체(#393) — DSEG7(LCD, ASCII 전용)엔 한글 글리프가 없어 title/signature
// 등 유저 입력이 섞인 code만 containsHangul로 감지해 FONT_KR로 개별 폴백한다. FULL_MOVIE는 signature가
// 실제 한글(영화수집가)이라 이 분기를 그대로 태운다. title은 #423부터 Mood35mm만 원제(titleOgVal, 영문 —
// FULL_MOVIE.titleOg='The Grand Budapest Hotel')를 쓰고 Mood35mmLandscape는 그대로 한글 title 유지라 갈린다.
describe.each([
  ['Mood35mmLandscape', () => renderToStaticMarkup(<Mood35mmLandscape movieInfo={FULL_MOVIE} components={makeMoodBase('35mm-landscape')} croppedImageUrl="blob:x" onField={() => {}} />)],
])('%s FilmStripBand 엣지 코드 폰트 분기 (#393)', (_name, markup) => {
  test('한글 code(title·signature)는 FONT_KR로 개별 폴백', () => {
    const html = markup();
    expect(html).toMatch(/<span style="font-family:&quot;Pretendard Variable&quot;[^"]*">그랜드 부다페스트 호텔<\/span>/);
    expect(html).toMatch(/<span style="font-family:&quot;Pretendard Variable&quot;[^"]*">COLLECTED BY 영화수집가<\/span>/);
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

// Mood35mm는 스프로킷에 원제(titleOgVal)를 쓴다(#423) — 영문이라 FONT_KR 폴백 없이 상속, signature는
// 여전히 한글이라 개별 폴백 유지.
describe('Mood35mm FilmStripBand 엣지 코드 — 원제 사용 (#423)', () => {
  const markup = () =>
    renderToStaticMarkup(<Mood35mm movieInfo={FULL_MOVIE} components={makeMoodBase('35mm')} croppedImageUrl="blob:x" onField={() => {}} />);

  test('title code는 titleOg(영문)라 FONT_KR 폴백 없이 상속, signature는 한글이라 개별 폴백', () => {
    const html = markup();
    // 엣지 코드는 titleOg(영문)를 써 개별 style 없이 상속(ASCII code와 동일 패턴).
    expect(html).toContain('<span>The Grand Budapest Hotel</span>');
    // 캡션 타이틀(#423 스코프 밖, titleVal 그대로)엔 한글 제목이 남아있으므로 FONT_KR 폴백
    // span 패턴으로 좁혀서 "엣지 코드엔 한글 title이 없다"만 확인한다.
    expect(html).not.toMatch(/<span style="font-family:&quot;Pretendard Variable&quot;[^"]*">그랜드 부다페스트 호텔<\/span>/);
    expect(html).toMatch(/<span style="font-family:&quot;Pretendard Variable&quot;[^"]*">COLLECTED BY 영화수집가<\/span>/);
  });

  test('titleOg가 없으면 title로 폴백', () => {
    const html = renderToStaticMarkup(
      <Mood35mm movieInfo={{ ...FULL_MOVIE, titleOg: '' }} components={makeMoodBase('35mm')} croppedImageUrl="blob:x" onField={() => {}} />
    );
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
