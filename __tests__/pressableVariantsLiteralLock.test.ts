/**
 * `active:scale-[0.97]` 리터럴은 `src/components/ui/variants.ts`의 `pressableVariants` 한 곳에만
 * 산다(#731 전수 치환, 24개 파일). 다른 자리에 리터럴이 다시 등장하면 눌림 피드백이 두 군데서
 * 따로 관리되는 회귀라, 그 전수 치환 계약을 소스 스캔으로 잠근다.
 *
 * 주석 안 등장(#647·#731 리뷰 각주 등, 현재 4건 — ColorPicker.tsx·MobileEditorShell.tsx·
 * FloatingToolbar.tsx·Landing.tsx)은 위반이 아니라 통과여야 한다 — `//`·`/*`·` * `·`{/*` 줄과 각
 * 줄의 진짜 `//` 주석 뒷부분은 비교 대상에서 뺀다. 진짜 `//`는 `://`(URL)를 제외한 첫 등장이다 —
 * `code.split('//')[0]`으로 단순 분리하면 `<a href="https://x.com" className="active:scale-[0.97]">`
 * 처럼 리터럴보다 앞에 URL이 있는 줄에서 진짜 위반을 놓친다(claude-review PR #748 P1). `/* ... *\/`
 * 한 줄짜리 인라인 블록 주석까지는 못 잡는다 — 지금 코드베이스에 그런 형태가 없어 실사례로
 * 검증할 수 없었다.
 */
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_DIR = 'src';
const ALLOWED_FILE = join('src', 'components', 'ui', 'variants.ts');
const LITERAL = 'active:scale-[0.97]';

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listSourceFiles(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

// `://`(URL)는 진짜 줄 주석이 아니다 — `:` 뒤에 안 붙은 첫 `//`만 주석 시작으로 본다.
function stripTrailingComment(line: string): string {
  let idx = line.indexOf('//');
  while (idx > 0 && line[idx - 1] === ':') idx = line.indexOf('//', idx + 2);
  return idx === -1 ? line : line.slice(0, idx);
}

function nonCommentOccurrences(path: string): number[] {
  const lines = readFileSync(path, 'utf8').split('\n');
  const hits: number[] = [];
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('{/*')) return;
    const code = stripTrailingComment(line);
    // split 개수 - 1 = 한 줄 안 등장 횟수. includes만 쓰면 한 줄에 두 번 들어가도 1건으로 뭉개진다.
    const count = code.split(LITERAL).length - 1;
    for (let k = 0; k < count; k++) hits.push(i + 1);
  });
  return hits;
}

describe(`리터럴 ${LITERAL} 단일 소스 계약 (#731)`, () => {
  test('variants.ts 밖에는 등장하지 않는다', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(SRC_DIR)) {
      if (file === ALLOWED_FILE) continue;
      for (const line of nonCommentOccurrences(file)) offenders.push(`${file}:${line}`);
    }
    expect(offenders).toEqual([]);
  });

  test('variants.ts 안에는 정확히 한 번 등장한다', () => {
    expect(nonCommentOccurrences(ALLOWED_FILE).length).toBe(1);
  });
});
