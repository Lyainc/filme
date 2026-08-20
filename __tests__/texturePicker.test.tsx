/**
 * Regression test for #276: TexturePicker's texture chips must stay visible
 * as live samples even before a poster is uploaded, and switch to the real
 * poster crop once one is provided — without swapping which component renders
 * the thumbnail (same TexturePreview, just a different `src`). #475: TexturePicker
 * is now axis-parametrized (material/coating) — this test drives it via the
 * material axis's option list, but the sample/crop-swap behavior is axis-agnostic.
 */
import { useState } from 'react';
import { describe, expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TexturePicker from '@/components/wizard/TexturePicker';
import { MATERIAL_OPTIONS } from '@/utils/constants';

afterEach(cleanup);

function ControlledTexturePicker() {
  const [value, setValue] = useState('original');
  return (
    <TexturePicker axis="material" options={MATERIAL_OPTIONS} value={value} onChange={setValue} croppedImageUrl={null} ariaLabel="재질" />
  );
}

describe('TexturePicker', () => {
  // #730 ac4 — 방향키가 칩 간 포커스와 선택을 같이 옮긴다(APG radiogroup 계약).
  test('방향키로 칩 간 포커스+선택이 이동한다', async () => {
    const user = userEvent.setup();
    render(<ControlledTexturePicker />);
    const radios = screen.getAllByRole('radio');

    await user.tab();
    expect(document.activeElement).toBe(radios[0]);
    expect(radios[0].getAttribute('aria-checked')).toBe('true');

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(radios[1]);
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
    expect(radios[0].getAttribute('aria-checked')).toBe('false');
  });

  test('renders bundled sample thumbnails when no poster is uploaded', () => {
    const { container } = render(
      <TexturePicker axis="material" options={MATERIAL_OPTIONS} value="original" onChange={() => {}} croppedImageUrl={null} ariaLabel="재질" />
    );

    const imgs = Array.from(container.querySelectorAll('img'));
    expect(imgs).toHaveLength(MATERIAL_OPTIONS.length);
    for (const img of imgs) {
      expect(img.getAttribute('src')).toBe('/assets/texture-sample.svg');
    }
  });

  test('switches every chip to the real poster crop once one is uploaded', () => {
    const posterUrl = 'blob:http://localhost/cropped-poster';
    const { container } = render(
      <TexturePicker axis="material" options={MATERIAL_OPTIONS} value="original" onChange={() => {}} croppedImageUrl={posterUrl} ariaLabel="재질" />
    );

    const imgs = Array.from(container.querySelectorAll('img'));
    expect(imgs).toHaveLength(MATERIAL_OPTIONS.length);
    for (const img of imgs) {
      expect(img.getAttribute('src')).toBe(posterUrl);
    }
  });

  // #563 — 선택 칩 자동 노출은 **가로만** 움직여야 한다. scrollIntoView는 세로 스크롤 조상까지
  // 끌어당기는데, 이 스트립이 rail의 고정 높이 슬롯 안에 들어간 뒤로는 그게 곧 "패널이 열리자마자
  // 위가 잘려 보인다"였다.
  test('선택 칩 자동 노출은 스트립의 가로 스크롤만 건드린다 (#563)', () => {
    const nativeRect = Element.prototype.getBoundingClientRect;
    const nativeScrollIntoView = Element.prototype.scrollIntoView;
    let scrollIntoViewCalls = 0;
    Element.prototype.scrollIntoView = () => {
      scrollIntoViewCalls += 1;
    };
    // 스트립은 0~200, 선택 칩(마지막 옵션)은 260~320이라 오른쪽으로 120px 벗어나 있다.
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.getAttribute('role') === 'radiogroup') return { left: 0, right: 200, width: 200 } as DOMRect;
      if (this.getAttribute('role') === 'radio' && this.getAttribute('aria-checked') === 'true')
        return { left: 260, right: 320, width: 60 } as DOMRect;
      return nativeRect.call(this);
    };

    try {
      const last = MATERIAL_OPTIONS[MATERIAL_OPTIONS.length - 1].value;
      const { container } = render(
        <TexturePicker axis="material" options={MATERIAL_OPTIONS} value={last} onChange={() => {}} croppedImageUrl={null} ariaLabel="재질" />
      );
      const strip = container.querySelector('[role="radiogroup"]') as HTMLElement;
      expect(strip.scrollLeft).toBe(120);
      expect(scrollIntoViewCalls).toBe(0);
    } finally {
      Element.prototype.getBoundingClientRect = nativeRect;
      Element.prototype.scrollIntoView = nativeScrollIntoView;
    }
  });
});
