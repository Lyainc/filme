import { readFileSync } from 'fs';
import { join } from 'path';

// globals.css의 --pr 색 토큰을 읽는 테스트 공용 헬퍼(#826 S1). fgContrast · themeTokens가 같이 쓴다.

export const ROOT = join(__dirname, '..');
export const css = readFileSync(join(ROOT, 'src', 'styles', 'globals.css'), 'utf8');

export function extractBlock(src: string, selectorRe: RegExp): string {
  const m = src.match(selectorRe);
  if (!m || m.index === undefined) throw new Error(`selector block not found: ${selectorRe}`);
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  while (depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return src.slice(start, i - 1);
}

/** 블록 안 `--name: 값;`의 값(공백 정리). 없으면 null. */
export function readVar(block: string, name: string): string | null {
  const m = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

export const rootBlock = extractBlock(css, /:root\s*\{/);
export const darkBlock = extractBlock(css, /\.theme-dark,\s*\n?\s*\.chrome-dark\s*\{/);

/** 페이지 마스터(결정 10, D02-B)의 색 토큰 이름. 라이트 :root와 다크 블록 둘 다 빠짐없이 정의해야 한다. */
export const PR_COLORS = [
  'stage', 's1', 's2', 'hair', 'hair-strong', 'ink', 'ink-2', 'ink-3',
  'accent', 'accent-ink', 'accent-soft', 'accent-hover', 'focus-ring', 'warn', 'scrim',
] as const;

function lin(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(hexA: string, hexB: string): number {
  const l1 = luminance(hexA);
  const l2 = luminance(hexB);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** 불투명 hex 토큰만(대비 계산 대상). 아니면 throw. */
export function hexVar(block: string, name: string): string {
  const v = readVar(block, name);
  if (!v || !/^#[0-9A-Fa-f]{6}$/.test(v)) throw new Error(`--${name} is not an opaque #rrggbb: ${v}`);
  return v;
}
