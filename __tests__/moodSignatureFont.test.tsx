import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentType } from 'react';
import type { LayoutId } from '../src/types';
import type { MoodProps } from '../src/components/moods/_shared';
import { FULL_MOVIE, makeMoodBase } from './fixtures';
import { ALL_MOODS } from './setup/moods';

/**
 * 서명 텍스트 폰트 정합(#494) — 6무드 전부 라틴 서명은 'collected by' 라벨과 같은 FONT_DISPLAY
 * 이탤릭, 한글 서명은 글리프가 없는 FONT_DISPLAY 대신 손글씨 FONT_QUOTE_KR로 분기한다.
 * 이식 전엔 Minimal·Editorial·Stub이 양쪽 다 FONT_KR(Pretendard)이었고, 35mm 계열은 반대로
 * 양쪽 다 FONT_QUOTE_KR이라 라틴이 어긋나 있었다.
 */

const KR = '영화수집가';
const LATIN = 'Alex Carter';

/** 서명 텍스트를 담은 span의 style 속성만 뽑는다 — 무드 전체 마크업엔 다른 폰트 선언이 잔뜩 섞여 있다. */
function signatureStyle(html: string, signature: string): string {
  const m = html.match(new RegExp(`<span style="([^"]*)"[^>]*>${signature}</span>`));
  if (!m) throw new Error(`서명 span을 못 찾음: ${signature}`);
  return m[1];
}

function markup(Mood: ComponentType<MoodProps>, layout: LayoutId, signature: string) {
  return renderToStaticMarkup(
    <Mood movieInfo={{ ...FULL_MOVIE, signature }} components={makeMoodBase(layout)} croppedImageUrl="blob:x" />
  );
}

describe('서명 텍스트 폰트 정합 (#494)', () => {
  for (const [layout, Mood] of ALL_MOODS) {
    // weight 400 고정도 같이 본다 — 두 폰트 다 단일 웨이트라 600/500 상속이 남으면 합성 볼드로
    // 라벨과 톤이 다시 갈린다.
    test(`${layout} — 한글 서명은 FONT_QUOTE_KR(손글씨)`, () => {
      const style = signatureStyle(markup(Mood, layout, KR), KR);
      expect(style).toContain('--font-quote-kr');
      expect(style).not.toContain('--font-display');
      expect(style).toContain('font-weight:400');
    });

    test(`${layout} — 라틴 서명은 라벨과 같은 FONT_DISPLAY 이탤릭`, () => {
      const style = signatureStyle(markup(Mood, layout, LATIN), LATIN);
      expect(style).toContain('--font-display');
      expect(style).toContain('font-style:italic');
      expect(style).not.toContain('--font-quote-kr');
      expect(style).toContain('font-weight:400');
    });
  }
});
