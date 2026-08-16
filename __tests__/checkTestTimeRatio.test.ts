import { describe, expect, it } from 'bun:test';

// scripts/check-test-time-ratio.mjs의 순수 로직(파싱·p90 기준선·배수 판정) 회귀 (#716).
const { parseJunit, findOutliers, DEFAULT_THRESHOLD } = require('../scripts/check-test-time-ratio.mjs');

// 12개짜리 인라인 픽스처: 11개가 1ms, 1개가 1000ms → p90 기준선은 1ms 자리에 앉는다.
const XML = `<?xml version="1.0"?>
<testsuites name="bun test">
  <testsuite name="__tests__/fast.test.ts" file="__tests__/fast.test.ts">
    ${Array.from({ length: 11 }, (_, i) => `<testcase name="fast ${i}" time="0.001" />`).join('\n    ')}
  </testsuite>
  <testsuite name="__tests__/slow.test.ts" file="__tests__/slow.test.ts">
    <testcase name="느린 테스트" time="1.000" />
  </testsuite>
</testsuites>`;

describe('check-test-time-ratio (#716)', () => {
  it('testcase의 file/name/ms를 뽑고, file은 부모 testsuite에서 물려받는다', () => {
    const cases = parseJunit(XML);
    expect(cases.length).toBe(12);
    expect(cases[0]).toEqual({ file: '__tests__/fast.test.ts', name: 'fast 0', ms: 1 });
    expect(cases[11]).toEqual({ file: '__tests__/slow.test.ts', name: '느린 테스트', ms: 1000 });
  });

  it('기준선은 p90이고, 그 배수가 문턱을 넘는 testcase만 잡는다', () => {
    const { baseline, outliers } = findOutliers(parseJunit(XML), 100);
    expect(baseline).toBe(1);
    expect(outliers.length).toBe(1);
    expect(outliers[0].name).toBe('느린 테스트');
    expect(outliers[0].ratio).toBe(1000);
  });

  it('문턱 위면 통과시킨다 (경계는 초과일 때만 실패)', () => {
    expect(findOutliers(parseJunit(XML), 1000).outliers.length).toBe(0);
    expect(findOutliers(parseJunit(XML), 999).outliers.length).toBe(1);
  });

  it('testcase가 없으면 기준선 0으로 떨어지되 터지지 않는다', () => {
    const { baseline, outliers } = findOutliers([], DEFAULT_THRESHOLD);
    expect(baseline).toBe(0);
    expect(outliers.length).toBe(0);
  });

  // 기준선 0은 "무엇도 못 잡는" 상태다 — 배수가 전부 0으로 떨어져 조용히 통과한다.
  // 그래서 CLI가 이 경우를 실패로 치는데(스크립트 본문), 그 전제인 "배수가 0이 된다"를 잠근다.
  it('기준선이 0이면 아무리 느린 테스트도 배수 0이라 안 잡힌다 (CLI가 별도로 실패시킨다)', () => {
    const { baseline, outliers } = findOutliers(
      [
        ...Array.from({ length: 10 }, (_, i) => ({ file: 'a', name: `0ms ${i}`, ms: 0 })),
        { file: 'a', name: '느림', ms: 99999 },
      ],
      1,
    );
    expect(baseline).toBe(0);
    expect(outliers.length).toBe(0);
  });
});
