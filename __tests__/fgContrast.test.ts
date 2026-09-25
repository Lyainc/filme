import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

// WCAG AA 대비 검증(#650, scripts/check-fg-contrast.mjs 이관 — #811) — --fg-muted/--fg-faint가
// --bg 계열(불투명) 배경 위에서 하한을 지키는지 순수 계산으로 증명한다. 세 표면(--bg·--surface·
// --surface-elevated)은 전부 solid color라 픽셀 샘플링과 등가고, 라이트는 세 표면 중 가장 어두운
// --bg가, 다크는 가장 밝은 --surface-elevated가 각 방향으로 최악 케이스라 그 한 쌍만 재면 나머지
// 둘은 자동으로 통과한다. text-fg-faint는 아이콘/장식/disabled 전용이라 3:1, text-fg-muted는 실제
// 문장 텍스트도 그리므로 4.5:1을 기준으로 삼는다. 브라우저 없이 required CI(bun test)에서 도는 게
// 스크립트 시절과의 유일한 차이 — 토큰 소스·문턱은 그대로다.

function extractBlock(css: string, selectorRe: RegExp): string {
  const m = css.match(selectorRe);
  if (!m || m.index === undefined) throw new Error(`selector block not found: ${selectorRe}`);
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  while (depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return css.slice(start, i - 1);
}

function extractVar(block: string, name: string): string {
  const m = block.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`--${name} not found`);
  return m[1];
}

function hex2rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return [r, g, b];
}

function lin(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(hexA: string, hexB: string): number {
  const l1 = luminance(hex2rgb(hexA));
  const l2 = luminance(hex2rgb(hexB));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(join(__dirname, '..', 'src', 'styles', 'globals.css'), 'utf8');
const rootBlock = extractBlock(css, /:root\s*\{/);
const darkBlock = extractBlock(css, /\.theme-dark,\s*\n?\s*\.chrome-dark\s*\{/);

const light = {
  bg: extractVar(rootBlock, 'bg'),
  fgMuted: extractVar(rootBlock, 'fg-muted'),
  fgFaint: extractVar(rootBlock, 'fg-faint'),
};

const dark = {
  surfaceElevated: extractVar(darkBlock, 'surface-elevated'),
  fgMuted: extractVar(darkBlock, 'fg-muted'),
  fgFaint: extractVar(darkBlock, 'fg-faint'),
};

// 라이트: 세 표면 중 --bg가 최악(가장 어두움 = 어두운 잉크와 대비가 가장 작음).
// 다크: 세 표면 중 --surface-elevated가 최악(가장 밝음 = 밝은 잉크와 대비가 가장 작음).
describe('#650 — 전경색 토큰이 최악 표면 대비 WCAG AA 하한을 지킨다', () => {
  test.each([
    ['light fg-muted vs bg (text, 4.5:1)', light.fgMuted, light.bg, 4.5],
    ['light fg-faint vs bg (icon, 3:1)', light.fgFaint, light.bg, 3.0],
    ['dark fg-muted vs surface-elevated (text, 4.5:1)', dark.fgMuted, dark.surfaceElevated, 4.5],
    ['dark fg-faint vs surface-elevated (icon, 3:1)', dark.fgFaint, dark.surfaceElevated, 3.0],
  ])('%s', (_label, fg, bg, min) => {
    const ratio = contrast(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(min);
  });
});
