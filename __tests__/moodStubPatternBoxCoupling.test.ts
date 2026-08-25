/**
 * `MoodStub.tsx`의 배경 스탬프 고정 박스(`PATTERN_BOX`)가 Row/SectionHead 레이아웃·섹션 구성과
 * 안 겹치는 자리인지는 `capture-export.mjs --full-fields` 실측으로만 확인된다(#728 후속 #746) —
 * `space-evenly`가 필드 개수에 따라 빈 공간을 매 렌더 재분배해 코드로 좌표를 못 뽑기 때문에
 * PATTERN_BOX 자체가 눈으로 찾은 리터럴이다.
 *
 * `__tests__/designRailBackgroundPattern.test.tsx`는 "이 좌표가 DOM에 그대로 렌더되는가"만 잠그고
 * "그 좌표가 실제로 텍스트와 안 겹치는가"는 못 잡는다. 이 테스트는 PATTERN_BOX가 기대는 세 축 —
 * 박스 좌표 자체, Row/SectionHead 스타일 상수(간격·폰트), Admission/The Film 섹션 구성(라벨·순서·
 * 그리드 간격) — 이 처음 측정 당시와 같은지를 잠근다. 뒤 둘은 다인/다줄 블록이라 손으로 옮겨
 * 적으면 공백까지 틀리기 쉬워 해시로 대조한다 — `measureChromeBaselineCoupling.test.ts`와 같은
 * 이유로 숫자로 환산해 겹침을 계산하진 않는다: 잠그려는 건 "겹치지 않는다"는 계산이 아니라
 * "그 계산의 전제가 안 바뀌었다는 사실"이고, 바뀌었으면 무조건 다시 재는 게 맞다.
 */
import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const STUB_PATH = 'src/components/moods/MoodStub.tsx';
const RECHECK = 'PATTERN_BOX 재확인 필요 — bun scripts/capture-export.mjs --full-fields로 다시 캡처해 좌표를 다시 잡을 것';

function sha1(text: string): string {
  return createHash('sha1').update(text).digest('hex').slice(0, 12);
}

describe('MoodStub 배경 스탬프 박스(PATTERN_BOX) 결합 (#746)', () => {
  const src = readFileSync(STUB_PATH, 'utf8');

  test(`박스 좌표 리터럴 — ${RECHECK}`, () => {
    const box = src.match(/const PATTERN_BOX = (\{[^}]+\});/)?.[1];
    expect(box).toBe('{ left: 604, top: 1188, width: 300, height: 42 }');
  });

  test(`Row/SectionHead 스타일 상수(간격·폰트) — ${RECHECK}`, () => {
    // rowLabel·dottedFill·rowValue·sectionLabel 상수 + Row/SectionHead 함수 전체 — 간격·폰트가 여기 산다.
    const start = src.indexOf('const rowLabel: CSSProperties');
    const end = src.indexOf('export const MoodStub');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const block = src.slice(start, end).trim();
    expect(sha1(block)).toBe('99527fa7c364');
  });

  test(`Admission/The Film 섹션 구성(라벨·순서·그리드 간격) — ${RECHECK}`, () => {
    // space-evenly 컨테이너부터 푸터 시작 전까지 — 어느 필드가 어느 섹션에, 어떤 간격으로 묶이는지.
    const start = src.indexOf("justifyContent: 'space-evenly'");
    const end = src.indexOf('{/* 푸터');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const block = src.slice(start, end).trim();
    expect(sha1(block)).toBe('4fb3c7296b82');
  });
});
