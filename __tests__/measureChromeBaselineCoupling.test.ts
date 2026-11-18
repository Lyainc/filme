/**
 * `scripts/measure-chrome.mjs`의 dock/프리뷰 불변식이 `EditorDock.tsx`의 고정 높이 상수에 종속이라는
 * 사실을 **코드로** 잠근다 (#707 → #714 → #826 S2).
 *
 * 왜 필요한가 — 종속 자체는 두 파일 주석과 docs/HARNESS.md §5에 이미 적혀 있었는데, 적혀만 있어서
 * #682가 슬롯을 `h-[118px]` → `h-[min(214px,26svh)]`로 올리고 불변식을 안 고쳤다. 그 결과
 * `measure-chrome.mjs`가 **main이 건강한데도 두 주 넘게 항상 exit 1**이었다. 증상이 침묵이
 * 아니라 상시 거짓 실패라 오히려 더 나빴다 — 그 두 주 동안 이 하네스는 어떤 진짜 회귀도
 * 알릴 수 없었고, 빨간불은 "원래 저래"로 읽혔다.
 *
 * 하네스는 브라우저가 필요해 CI(`ci.yml`)에 결선돼 있지 않다. 그래서 이 결합만이라도
 * `bun test`(= required check)로 내려, 도크를 건드린 PR이 **머지되기 전에** 신호를 받게 한다.
 * 이 테스트는 하네스를 대신하지 않는다 — "다시 재라"고 말할 뿐이다.
 *
 * #826 S2에서 DesignRail의 `h-[min(214px,26svh)]` 가변 슬롯이 도크 고정 높이(본문 196 + 모드 바 52)로
 * 바뀌어 대조 대상이 클래스 문자열에서 숫자 상수 둘로 갔다. BASELINE 세 숫자(dock/프리뷰) 자체의 재측정은
 * 하네스 단위의 몫이다 — 이 테스트는 선언이 어긋났는지만 본다.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const DOCK_PATH = 'src/components/v2/dock/EditorDock.tsx';
const HARNESS_PATH = 'scripts/measure-chrome.mjs';

function declared(src: string, pattern: RegExp): number | null {
  const m = src.match(pattern);
  return m ? Number(m[1]) : null;
}

describe('measure-chrome 불변식 ↔ EditorDock 고정 높이 결합 (#707 → #826 S2)', () => {
  const dock = readFileSync(DOCK_PATH, 'utf8');
  const harness = readFileSync(HARNESS_PATH, 'utf8');

  test('도크 상수 둘이 각각 정확히 한 번 선언돼 있다', () => {
    // 둘 이상이 되면 아래 대조가 "어느 쪽?"을 잃는다.
    expect((dock.match(/export const DOCK_BODY_PX = \d+;/g) ?? []).length).toBe(1);
    expect((dock.match(/export const DOCK_MODEBAR_PX = \d+;/g) ?? []).length).toBe(1);
  });

  test('하네스가 전제하는 도크 높이가 선언돼 있다', () => {
    // 상수가 사라지면 결합이 다시 주석으로만 남는다 — 그 상태로 통과시키지 않는다.
    expect(declared(harness, /const BASELINE_DOCK_BODY_PX = (\d+);/)).not.toBeNull();
    expect(declared(harness, /const BASELINE_DOCK_MODEBAR_PX = (\d+);/)).not.toBeNull();
  });

  test('둘이 같은 값이다 — 다르면 BASELINE 숫자를 다시 재야 한다', () => {
    expect(declared(harness, /const BASELINE_DOCK_BODY_PX = (\d+);/)).toBe(declared(dock, /export const DOCK_BODY_PX = (\d+);/));
    expect(declared(harness, /const BASELINE_DOCK_MODEBAR_PX = (\d+);/)).toBe(
      declared(dock, /export const DOCK_MODEBAR_PX = (\d+);/),
    );
  });

  test('도크가 높이를 상수 두 개로만 정한다 — 본문·모드 바 높이를 클래스로 따로 두지 않는다', () => {
    // 상수 밖 `h-[...px]`가 슬그머니 도크 본문 높이를 정하면 위 대조가 하중을 잃는다.
    expect(/style=\{\{ height: DOCK_BODY_PX \}\}/.test(dock)).toBe(true);
    expect(/style=\{\{ height: DOCK_MODEBAR_PX \}\}/.test(dock)).toBe(true);
  });
});
