/**
 * "볼록 압인(형압)이 먼저 서고 그 위에 하이라이트가 얹힌다"(#735, `_shared.tsx:1210` 주석)는
 * 순서가 프리뷰(`_shared.tsx`)와 저장물(`captureToImage.ts`) **두 파일에 따로** 인코딩돼 있다.
 * 렌더 물리(픽셀)가 아니라 이 순서 자체를 검증하는 자동 테스트가 없으면, 한쪽만 리팩터 중 순서가
 * 바뀌어도 `bun test`는 통과하고 미리보기·저장물 결과만 조용히 어긋난다(claude-review #736 P1).
 * `embossMaxZOrderCoupling.test.ts`와 같은 처방 — 렌더 자체가 아니라 소스 선언 순서만 잠근다.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

describe('relief(형압) → highlight(하이라이트) z-order 결합 (#735)', () => {
  test('_shared.tsx: relief EmbossOverlay가 highlight EmbossOverlay보다 먼저 선언된다', () => {
    const src = readFileSync('src/components/moods/_shared.tsx', 'utf8');
    const reliefIdx = src.indexOf('bitmapSvg={reliefBitmapSvg}');
    const highlightIdx = src.indexOf('bitmapSvg={embossBitmapSvg}');
    expect(reliefIdx).toBeGreaterThan(-1);
    expect(highlightIdx).toBeGreaterThan(-1);
    expect(reliefIdx).toBeLessThan(highlightIdx);
  });

  test('captureToImage.ts: relief 합성 단계가 emboss(하이라이트) 합성 단계보다 먼저 호출된다', () => {
    const src = readFileSync('src/utils/captureToImage.ts', 'utf8');
    const reliefIdx = src.indexOf("safeCompositeStep(ctx, 'relief'");
    const highlightIdx = src.indexOf("safeCompositeStep(ctx, 'emboss'");
    expect(reliefIdx).toBeGreaterThan(-1);
    expect(highlightIdx).toBeGreaterThan(-1);
    expect(reliefIdx).toBeLessThan(highlightIdx);
  });
});
