/**
 * `scripts/measure-chrome.mjs`의 dock/프리뷰 불변식이 `DesignRail.tsx`의 고정 슬롯 높이에
 * 종속이라는 사실을 **코드로** 잠근다 (#707 → #714).
 *
 * 왜 필요한가 — 종속 자체는 두 파일 주석과 CLAUDE.md에 이미 적혀 있었는데, 적혀만 있어서
 * #682가 슬롯을 `h-[118px]` → `h-[min(214px,26svh)]`로 올리고 불변식을 안 고쳤다. 그 결과
 * `measure-chrome.mjs`가 **main이 건강한데도 두 주 넘게 항상 exit 1**이었다. 증상이 침묵이
 * 아니라 상시 거짓 실패라 오히려 더 나빴다 — 그 두 주 동안 이 하네스는 어떤 진짜 회귀도
 * 알릴 수 없었고, 빨간불은 "원래 저래"로 읽혔다.
 *
 * 하네스는 브라우저가 필요해 CI(`ci.yml`)에 결선돼 있지 않다. 그래서 이 결합만이라도
 * `bun test`(= required check)로 내려, 슬롯을 건드린 PR이 **머지되기 전에** 신호를 받게 한다.
 * 이 테스트는 하네스를 대신하지 않는다 — "다시 재라"고 말할 뿐이다.
 *
 * 문자열 비교인 이유: `min(214px,26svh)`는 뷰포트에 따라 어느 쪽이 이기는지 갈리므로 숫자로
 * 환산해 비교하면 기준이 흔들린다. 여기서 잠그려는 건 계산 결과가 아니라 **선언이 바뀌었다는
 * 사실**이고, 바뀌었으면 무조건 다시 재는 게 맞다.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const RAIL_PATH = 'src/components/v2/DesignRail.tsx';
const HARNESS_PATH = 'scripts/measure-chrome.mjs';

/** DesignRail의 고정 슬롯 높이 클래스. 파일에 `h-[min(...)]`는 이 슬롯 하나뿐이다. */
function slotHeightClassFromRail(src: string): string[] {
  return [...src.matchAll(/h-\[min\([^\]]+\)\]/g)].map((m) => m[0]);
}

describe('measure-chrome 불변식 ↔ DesignRail 슬롯 높이 결합 (#707)', () => {
  const rail = readFileSync(RAIL_PATH, 'utf8');
  const harness = readFileSync(HARNESS_PATH, 'utf8');

  test('DesignRail의 고정 슬롯 높이 클래스가 정확히 하나다', () => {
    // 둘 이상이 되면 아래 대조가 "어느 쪽?"을 잃는다. 그때는 슬롯에 표식을 달고 이 추출을
    // 좁혀야지, 그냥 첫 번째를 집으면 조용히 엉뚱한 걸 잠그게 된다.
    expect(slotHeightClassFromRail(rail).length).toBe(1);
  });

  test('하네스가 전제하는 슬롯 높이가 선언돼 있다', () => {
    // 상수가 사라지면 결합이 다시 주석으로만 남는다 — 그 상태로 통과시키지 않는다.
    expect(/const BASELINE_SLOT_HEIGHT_CLASS = '[^']+';/.test(harness)).toBe(true);
  });

  test('둘이 같은 값이다 — 다르면 BASELINE 세 숫자를 다시 재야 한다', () => {
    const declared = harness.match(/const BASELINE_SLOT_HEIGHT_CLASS = '([^']+)';/)?.[1];
    expect(declared).toBe(slotHeightClassFromRail(rail)[0]);
  });
});
