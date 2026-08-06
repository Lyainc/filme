// WCAG AA 대비 검증(#650) — --fg-muted/--fg-faint가 --bg 계열(불투명) 배경 위에서 하한을
// 지키는지 순수 계산으로 증명한다. 세 표면(--bg·--surface·--surface-elevated)은 전부 solid
// color라 픽셀 샘플링과 등가고, 라이트는 세 표면 중 가장 어두운 --bg가, 다크는 가장 밝은
// --surface-elevated가 각 방향으로 최악 케이스라 그 한 쌍만 재면 나머지 둘은 자동으로 통과한다.
// text-fg-faint는 이 검증 이후로 아이콘/장식/disabled 전용이라 3:1, text-fg-muted는 실제
// 문장 텍스트도 그리므로 4.5:1을 기준으로 삼는다.
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8');

function extractBlock(css, selectorRe) {
  const m = css.match(selectorRe);
  if (!m) throw new Error(`selector block not found: ${selectorRe}`);
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

function extractVar(block, name) {
  const m = block.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`--${name} not found`);
  return m[1];
}

const rootBlock = extractBlock(css, /:root\s*\{/);
const darkBlock = extractBlock(css, /\.theme-dark,\s*\n?\s*\.chrome-dark\s*\{/);

const light = {
  bg: extractVar(rootBlock, 'bg'),
  surface: extractVar(rootBlock, 'surface'),
  surfaceElevated: extractVar(rootBlock, 'surface-elevated'),
  fgMuted: extractVar(rootBlock, 'fg-muted'),
  fgFaint: extractVar(rootBlock, 'fg-faint'),
};

const dark = {
  bg: extractVar(darkBlock, 'bg'),
  surface: extractVar(darkBlock, 'surface'),
  surfaceElevated: extractVar(darkBlock, 'surface-elevated'),
  fgMuted: extractVar(darkBlock, 'fg-muted'),
  fgFaint: extractVar(darkBlock, 'fg-faint'),
};

function hex2rgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function lin(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]) {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(hexA, hexB) {
  const l1 = luminance(hex2rgb(hexA));
  const l2 = luminance(hex2rgb(hexB));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// 라이트: 세 표면 중 --bg가 최악(가장 어두움 = 어두운 잉크와 대비가 가장 작음).
// 다크: 세 표면 중 --surface-elevated가 최악(가장 밝음 = 밝은 잉크와 대비가 가장 작음).
const checks = [
  { label: 'light fg-muted vs bg (text, 4.5:1)', fg: light.fgMuted, bg: light.bg, min: 4.5 },
  { label: 'light fg-faint vs bg (icon, 3:1)', fg: light.fgFaint, bg: light.bg, min: 3.0 },
  { label: 'dark fg-muted vs surface-elevated (text, 4.5:1)', fg: dark.fgMuted, bg: dark.surfaceElevated, min: 4.5 },
  { label: 'dark fg-faint vs surface-elevated (icon, 3:1)', fg: dark.fgFaint, bg: dark.surfaceElevated, min: 3.0 },
];

let failed = false;
for (const { label, fg, bg, min } of checks) {
  const ratio = contrast(fg, bg);
  const ok = ratio >= min;
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${ratio.toFixed(2)}:1 (min ${min}:1, ${fg} vs ${bg})`);
}

process.exit(failed ? 1 : 0);
