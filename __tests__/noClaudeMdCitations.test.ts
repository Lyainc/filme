/**
 * 코드·테스트·스크립트 주석이 CLAUDE.md를 근거 저장소로 인용하지 못하게 잠근다.
 *
 * CLAUDE.md는 매 세션 읽히는 규칙 문서라 언제든 줄어든다. 실제로 근거(실측·파괴 실험·PR 사유)를
 * docs/HARNESS.md·TESTING.md·CONTRIBUTING.md로 옮기자 "CLAUDE.md 📏" 같은 주석 포인터 25곳이
 * 한 단계 우회하는 낡은 링크가 됐다. 주석은 이슈 번호나 근거를 실제로 담은 docs 절을 가리킨다.
 */
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src', '__tests__', 'scripts'];
const SELF = join('__tests__', 'noClaudeMdCitations.test.ts');

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe('주석의 CLAUDE.md 인용 금지', () => {
  test('src·__tests__·scripts 어디에도 CLAUDE.md 인용이 없다', () => {
    const hits: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root, [])) {
        if (file === SELF || !/\.(tsx?|m?js|py|sh|md)$/.test(file)) continue;
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (line.includes('CLAUDE.md')) hits.push(`${file}:${i + 1}`);
          });
      }
    }
    expect(hits).toEqual([]);
  });
});
