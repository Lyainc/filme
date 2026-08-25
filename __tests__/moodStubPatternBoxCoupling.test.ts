/**
 * `MoodStub.tsx`의 배경 스탬프 고정 박스(`PATTERN_BOX`)가 Row/SectionHead 레이아웃·섹션 구성과
 * 안 겹치는 자리인지는 `capture-export.mjs --full-fields` 실측으로만 확인된다(#728 후속 #746) —
 * `space-evenly`가 필드 개수에 따라 빈 공간을 매 렌더 재분배해 코드로 좌표를 못 뽑기 때문에
 * PATTERN_BOX 자체가 눈으로 찾은 리터럴이다.
 *
 * `__tests__/designRailBackgroundPattern.test.tsx`는 "이 좌표가 DOM에 그대로 렌더되는가"만 잠그고
 * "그 좌표가 실제로 텍스트와 안 겹치는가"는 못 잡는다. 이 테스트는 PATTERN_BOX가 기대는 두 축 —
 * 박스 좌표 자체, 그리고 그 좌표가 안 겹칠 거라고 전제한 나머지 전부(POSTER_H·절취선 높이 →
 * Row/SectionHead 스타일 상수 → 페이퍼 스텁 본문의 티커·제목/원제·구분선·Admission/The Film
 * 섹션 구성) — 이 처음 측정 당시와 같은지를 잠근다. 두 번째 축의 시작점이 `POSTER_H` 선언까지
 * 올라가는 이유: PATTERN_BOX는 루트 기준 절대좌표(top:1188)라 페이퍼 스텁이 어디서 시작하든 안
 * 따라가는데, 페이퍼 스텁의 시작 y는 `POSTER_H`(640, 포스터 밴드)와 절취선 스트립 높이(16,
 * `height:16`)의 합으로 고정된다 — 처음엔 `space-evenly` 컨테이너부터만 잠갔다가 리뷰(PR #747)가
 * 두 라운드에 걸쳐 "Row/SectionHead도 섹션 구성도 안 건드리는 한 줄 변경이 조용히 새고 있다"는
 * 같은 실패 모드를 한 단계씩 더 위에서 찾아냈다. 다인/다줄 블록이라 손으로 옮겨 적으면 공백까지
 * 틀리기 쉬워 해시로 대조한다 — `measureChromeBaselineCoupling.test.ts`와 같은 이유로 숫자로
 * 환산해 겹침을 계산하진 않는다: 잠그려는 건 "겹치지 않는다"는 계산이 아니라 "그 계산의 전제가
 * 안 바뀌었다는 사실"이고, 바뀌었으면 무조건 다시 재는 게 맞다.
 *
 * **못 잠그는 축이 하나 남아 있다**: 제목/원제·배우 목록은 실제 영화 데이터 길이에 따라 런타임에
 * 폰트 크기·줄바꿈이 달라진다(`fitFontSizeToWidth`/`truncateActorsToWidth`, #318·#493) — 이건
 * 소스 텍스트가 조금도 안 바뀌어도 실제 렌더 높이가 달라질 수 있다는 뜻이라, 정적 소스 해시로는
 * 원리적으로 못 잡는다. `capture-export.mjs --full-fields`(양 극단 데이터로 실제 캡처)가 여전히
 * 최종 권위이고, 이 테스트는 그 실측의 "전제 소스가 안 바뀌었다"만 보장하는 하한선이다.
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

  test(`POSTER_H → Row/SectionHead 상수 → 페이퍼 스텁 본문 전체 — ${RECHECK}`, () => {
    // POSTER_H 선언부터 푸터 시작 전까지 — 포스터 밴드 높이·절취선 높이(페이퍼 스텁 시작 y를
    // 고정하는 두 값) + rowLabel/dottedFill/rowValue/sectionLabel + Row/SectionHead 함수 +
    // 티커·제목/원제·구분선·Admission/The Film 섹션 구성을 전부 포함한다. PATTERN_BOX는 절대좌표라
    // 이 구간 어디가 늘고 줄든 안 따라가므로, 이 범위 밖에서 시작하면 리뷰(PR #747)가 두 라운드에
    // 걸쳐 찾아낸 것과 같은 새는 자리가 남는다.
    const start = src.indexOf('const POSTER_H = 640;');
    const end = src.indexOf('{/* 푸터');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const block = src.slice(start, end).trim();
    expect(sha1(block)).toBe('0b92b1c2624c');
  });
});
