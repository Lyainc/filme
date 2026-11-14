/**
 * 프로젝트 스킬의 정본은 `.agents/skills/<name>`이고 `.claude/skills/<name>`은 그걸 가리키는 symlink다.
 * 두 트리가 같은 사본을 따로 들던 시절엔 한쪽만 고쳐 갈라질 수 있었다. 실제 디렉터리가 다시 생기거나
 * symlink가 풀려 1줄 텍스트 파일이 되면(symlink 없는 체크아웃) 스킬이 조용히 비어 로드된다.
 */
import { describe, expect, test } from 'bun:test';
import { lstatSync, readdirSync, readlinkSync } from 'node:fs';

describe('스킬 정본은 .agents/skills', () => {
  test('.claude/skills의 모든 항목은 같은 이름의 .agents/skills를 가리키는 symlink다', () => {
    const canonical = readdirSync('.agents/skills').sort();
    const linked = readdirSync('.claude/skills').sort();
    expect(linked).toEqual(canonical);
    for (const name of linked) {
      const p = `.claude/skills/${name}`;
      expect(`${p} symlink=${lstatSync(p).isSymbolicLink()}`).toBe(`${p} symlink=true`);
      expect(readlinkSync(p)).toBe(`../../.agents/skills/${name}`);
    }
  });
});
