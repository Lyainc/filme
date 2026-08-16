/**
 * 로컬 `bun run test`와 CI가 **같은 per-test timeout으로 잰다**는 걸 잠근다 (#714).
 *
 * 왜 이 축이 필요한가 — 이 레포에서 실제로 갈렸다. CI(`.github/workflows/ci.yml`)는
 * `bun test --timeout 30000`으로 도는데 `package.json`의 `test`는 그냥 `bun test`라 bun 기본
 * 5000ms였다. 그래서 CLAUDE.md와 goal 완료조건이 전부 "bun test가 exit 0"으로 적혀 있는데도
 * 그 명령이 재는 건 CI 게이트보다 6배 엄한 문턱이었고, 부하가 걸리면 CI가 절대 못 내는 실패가
 * 로컬에서만 났다(2026-08-16 실측: dev 서버 3대 + 헤드리스 Chrome과 함께 돌린 전 스위트에서
 * 최댓값 4.976초 — 기본 5000ms까지 여유 24ms).
 *
 * 이 어긋남은 **조용하다**: 양쪽 다 초록이면 아무도 안 보고, 빨간불이 나면 코드를 의심하지
 * 설정을 의심하지 않는다. 그래서 값을 맞추는 것만으론 부족하고, 한쪽만 바뀌면 깨지는 장치가
 * 같이 서야 한다.
 *
 * **소요 시간 문턱을 재는 게이트를 대신 두지 않은 이유**: 실측 부하 배수가 중앙 1.42× · p90 1.88×인데
 * 개별로는 33×까지 튄다. 그런 분포에 "N초 넘으면 실패" 선을 그으면 러너 상태에 따라 갈리는
 * 게이트가 하나 더 느는 것뿐이라, #714가 없애려던 바로 그 성질을 재도입한다. 여기서 잠글 수
 * 있는 결정적 명제는 "두 설정이 같은 값인가" 하나다.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

/** `bun test ... --timeout <ms>` 에서 ms를 뽑는다. 없으면 null(= bun 기본 5000). */
function timeoutOf(command: string): number | null {
  const m = command.match(/--timeout\s+(\d+)/);
  return m ? Number(m[1]) : null;
}

describe('로컬 test 스크립트와 CI가 같은 per-test timeout으로 잰다 (#714)', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');

  // ci.yml에서 실제로 도는 `bun test` 줄을 찾는다. 주석에 같은 문자열이 있으므로 `- run:` 줄만 본다.
  const ciTestRun = ci
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('- run:') && /\bbun test\b/.test(l));

  test('ci.yml에 bun test를 실행하는 run 줄이 있다', () => {
    // 이게 깨지면 아래 두 단언이 비교할 기준을 잃는다 — 조용히 통과하지 않게 먼저 못 박는다.
    expect(typeof ciTestRun).toBe('string');
  });

  test('CI가 명시 timeout으로 돈다 (기본 5000ms에 안 기댄다)', () => {
    expect(timeoutOf(ciTestRun ?? '')).not.toBeNull();
  });

  test('package.json의 test 스크립트가 CI와 같은 timeout을 쓴다', () => {
    expect(timeoutOf(pkg.scripts.test)).toBe(timeoutOf(ciTestRun ?? ''));
  });

  test('test:watch도 같은 값이다 — watch가 더 엄하면 개발 중에만 나는 실패가 생긴다', () => {
    expect(timeoutOf(pkg.scripts['test:watch'])).toBe(timeoutOf(pkg.scripts.test));
  });
});
