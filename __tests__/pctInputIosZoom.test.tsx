/**
 * #585 — % 직접 입력 포커스 시 iOS Safari 줌 방어.
 *
 * 11px 입력에 포커스하면 iOS가 16/11(1.455)배 확대하고 포커스가 풀려도 안 돌린다(2026-10-21
 * iOS Simulator 실측 12/12). 방어는 globals.css의 iOS 전용 `.pct-input` 규칙이라, 입력이 그
 * 클래스를 잃거나 규칙의 16px가 빠지면 실기기에서만 조용히 되살아난다. 그 결합을 잠근다.
 */
import { readFileSync } from 'fs';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import BrightnessSlider from '../src/components/wizard/BrightnessSlider';

afterEach(cleanup);

describe('#585 % 입력 iOS 포커스 줌', () => {
  test('% 입력이 pct-input 클래스를 가진다', () => {
    render(<BrightnessSlider value={0.5} onChange={() => {}} label="포스터" id="zoom-test" />);
    expect(screen.getByLabelText('포스터 퍼센트').classList.contains('pct-input')).toBe(true);
  });

  test('iOS 전용 규칙이 16px 이상 글꼴을 준다 — 미만이면 Safari가 확대한다', () => {
    const css = readFileSync('src/styles/globals.css', 'utf8');
    const block = css.match(/@supports \(-webkit-touch-callout: none\) \{\s*\.pct-input \{([^}]*)\}/);
    expect(block).not.toBeNull();
    const px = Number(block![1].match(/font-size:\s*(\d+)px/)?.[1]);
    expect(px >= 16).toBe(true);
  });
});
