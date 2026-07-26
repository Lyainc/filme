import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mood35mm } from '../src/components/moods/Mood35mm';
import { Mood35mmLandscape } from '../src/components/moods/Mood35mmLandscape';
import { FULL_MOVIE, makeMoodBase } from './fixtures';

// 천공 지터(#498) — 완전 등간격이 공장제처럼 보여 홀 크기·간격에 미세한 어긋남을 넣었다. 지터가
// Math.random이면 html-to-image(pixelRatio 2)가 캡처 시점에 DOM을 다시 그리며 프리뷰와 다른
// 스프로켓을 내므로, seedFromString 기반 결정론을 여기서 못박는다(#524 c2와 같은 규약).
const renderBand = () =>
  renderToStaticMarkup(<Mood35mmLandscape movieInfo={FULL_MOVIE} components={makeMoodBase('35mm-landscape')} croppedImageUrl="blob:x" onField={() => {}} />);
const renderRail = () =>
  renderToStaticMarkup(<Mood35mm movieInfo={FULL_MOVIE} components={makeMoodBase('35mm')} croppedImageUrl="blob:x" onField={() => {}} />);

/** 천공 div의 width/height/margin 조합을 렌더 마크업에서 뽑는다(밴드=가로 margin, 레일=세로 margin). */
function holeShapes(html: string): string[] {
  return Array.from(html.matchAll(/width:(-?\d+)px;height:(-?\d+)px;margin:([^;]+);border-radius:9px;background:/g), m => m.slice(1).join('/'));
}

describe.each([
  ['35mm Wide 밴드', renderBand, 18 * 2],
  ['35mm 세로 레일', renderRail, 19 * 2],
])('%s 천공 지터 (#498)', (_name, render, expectedHoles) => {
  test('같은 입력이면 항상 같은 스프로켓 — 캡처가 프리뷰와 갈리지 않는다', () => {
    expect(render()).toBe(render());
  });

  test('홀이 전부 같은 모양은 아니다 — 크기·간격이 실제로 흐트러진다', () => {
    const shapes = holeShapes(render());
    expect(shapes.length).toBe(expectedHoles);
    expect(new Set(shapes).size).toBeGreaterThan(1);
  });
});
