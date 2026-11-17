import { describe, expect, test } from 'bun:test';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ROOT } from './cssTokens';

// #826 S1 — 옛 색 토큰 이름과 서비스 UI의 비-Pretendard 글꼴 클래스가 남지 않았는지 저장소를 스캔한다.
// 클래스 이름 교체로 안 잡히는 var(--옛이름)(인라인 style · 그라데이션 · 테스트 단언)이 조용히 색을 잃는 걸 막는다.
// 티켓 렌더(src/components/moods/**)는 범위 밖이라 스캔하지 않는다.

const files = execSync("git ls-files 'src/**' '__tests__/**' 'scripts/**'", { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.(tsx?|css|m?js)$/.test(f) && !f.startsWith('src/components/moods/') && f !== '__tests__/tokenNamesScan.test.ts');
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8');

const OLD_VARS = ['bg', 'surface', 'surface-elevated', 'paper', 'fg', 'fg-muted', 'fg-faint', 'landing-muted', 'border', 'border-strong',
  'accent-soft', 'accent-hover', 'accent-ink', 'focus-ring', 'danger', 'warn'];
const OLD_VAR_RE = new RegExp(`var\\(--(${OLD_VARS.join('|')})(?![\\w-])`, 'g');
const PREFIX = '(?:ring-offset|border-[trblxyse]|border|divide|outline|ring|bg|text|fill|stroke|from|via|to|decoration|placeholder|caret|shadow)';
const OLD_CLS = ['bg', 'surface', 'surface-elevated', 'paper', 'fg', 'fg-muted', 'fg-faint', 'landing-muted', 'line', 'border-strong', 'danger'];
const OLD_CLS_RE = new RegExp(`(?<![\\w-])${PREFIX}-(${OLD_CLS.join('|')})(?![\\w-])`, 'g');

function hits(re: RegExp, allow: (f: string) => boolean = () => false): string[] {
  const out: string[] = [];
  for (const f of files) {
    if (allow(f)) continue;
    for (const m of read(f).match(re) ?? []) out.push(`${f}: ${m}`);
  }
  return out;
}

describe('옛 색 토큰 이름 0건', () => {
  test('var(--옛이름)', () => {
    expect(hits(OLD_VAR_RE)).toEqual([]);
  });
  test('옛 Tailwind 색 클래스', () => {
    expect(hits(OLD_CLS_RE)).toEqual([]);
  });
  // 무드 전용 별칭은 티켓 렌더(_shared.tsx)만 읽는다. ghostMode 테스트는 그 무드 출력을 단언해서 허용한다.
  test('var(--accent)는 무드와 그 단언에서만', () => {
    expect(hits(/var\(--accent\)/g, (f) => f === '__tests__/ghostMode.test.tsx')).toEqual([]);
  });
});

describe('서비스 UI 글꼴은 Pretendard 하나', () => {
  test('text-mono · font-mono · font-display · font-serif 클래스 0건', () => {
    expect(hits(/(?<![\w-])(text-mono|font-mono|font-display|font-serif)(?![\w-])/g, (f) => !f.startsWith('src/'))).toEqual([]);
  });
});
