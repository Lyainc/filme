// 테스트 실행 시간 회귀 게이트 (#716).
//
// 절대 문턱("N초 넘으면 실패")은 기각됐다 — 러너 부하가 개별 테스트를 32.9×까지 늘리므로
// 절대선은 코드가 아니라 러너 상태를 재는 게이트가 된다. 대신 **같은 실행 안의 상대값**을 잰다.
//
// 기준선은 median이 아니라 **p90**이다. 이슈가 권고한 median 기준은 실측에서 무너졌다
// (2026-08-16, 이 레포 1180개 테스트, 한산 vs `yes` 40개 부하):
//
//   기준선     | 한산     | 부하      | 상위 2% 배수의 부하 전후 변화(중앙/최대)
//   median     | 1.27ms   | 0.91ms   | 3.71× / 5.78×   ← 부하에 전혀 안 강하다
//   mean       | 72.5ms   | 168.4ms  | 1.15× / 1.79×
//   p90        | 91.8ms   | 227.0ms  | 1.08× / 1.68×   ← 채택
//
// median이 무너지는 이유: 이 스위트의 중앙값은 순수 유닛 테스트 덩어리(1ms 미만)에 앉는데
// 부하는 그 덩어리를 안 늘린다(오히려 1.27→0.91ms로 줄었다). 정작 늘어나는 건 상위 꼬리라
// median 대비 배수는 부하 배수를 그대로 흡수한다. p90은 그 꼬리 안에 앉아 같이 늘어난다.
//
// 문턱 200×: 최댓값은 늘 captureDualRendererPixelDiff의 `@2x` 무리인데, 같은 트리 3회에서
// 88.0× / 101.7×(부하) / 109.1×로 흔들렸다(p90 기준선 자체가 88.7 → 204.4 → 64.2ms로 움직인다).
// 관측 최악값 위로 1.8× 여유를 둔 값이라, 잡는 건 "가장 느린 테스트가 2배 느려졌다"급이다.
// 더 조이면 게이트가 아니라 러너 소음을 잡는다.
//
// ponytail: p90은 스위트 구성이 크게 바뀌면(예: 무거운 테스트가 절반이 되면) 같이 움직인다.
// 그때는 위 표를 다시 재고 기준선/문턱을 고칠 것.

import { readFileSync } from 'node:fs';

export const DEFAULT_THRESHOLD = 200;

/** junit XML → [{ file, name, ms }] */
export function parseJunit(xml) {
  const cases = [];
  let file = '';
  for (const m of xml.matchAll(/<(testsuite|testcase)\b([^>]*)/g)) {
    const attrs = m[2];
    const f = /\bfile="([^"]*)"/.exec(attrs);
    if (m[1] === 'testsuite') {
      if (f) file = f[1];
      continue;
    }
    const name = /\bname="([^"]*)"/.exec(attrs);
    const time = /\btime="([^"]*)"/.exec(attrs);
    cases.push({
      file: f ? f[1] : file,
      name: name ? name[1] : '',
      ms: (time ? parseFloat(time[1]) : 0) * 1000,
    });
  }
  return cases;
}

/** 같은 실행 안의 p90 대비 배수가 문턱을 넘는 testcase */
export function findOutliers(cases, threshold = DEFAULT_THRESHOLD) {
  const times = cases.map((c) => c.ms).sort((a, b) => a - b);
  const baseline = times.length
    ? times[Math.min(times.length - 1, Math.floor(0.9 * times.length))]
    : 0;
  const outliers = cases
    .map((c) => ({ ...c, ratio: baseline > 0 ? c.ms / baseline : 0 }))
    .filter((c) => c.ratio > threshold)
    .sort((a, b) => b.ratio - a.ratio);
  return { baseline, outliers };
}

const entry = process.argv[1] && process.argv[1].endsWith('check-test-time-ratio.mjs');
if (entry) {
  const path = process.argv[2] || 'junit.xml';
  const threshold = Number(process.argv[3] || DEFAULT_THRESHOLD);
  const cases = parseJunit(readFileSync(path, 'utf8'));
  const { baseline, outliers } = findOutliers(cases, threshold);
  console.log(
    `[test-time] ${cases.length} testcases · p90 기준선 ${baseline.toFixed(1)}ms · 문턱 ${threshold}×`
  );
  if (!cases.length) {
    console.error(`[test-time] ${path}에 testcase가 없다 — 리포터 출력이 비었는지 확인할 것.`);
    process.exit(1);
  }
  // 기준선 0이면 모든 배수가 0으로 떨어져 무엇도 못 잡는다 — 못 재는 건 통과가 아니라 실패다
  // (하네스의 `checked:false`를 실패로 치는 것과 같은 자세, CLAUDE.md 📏 절).
  if (baseline <= 0) {
    console.error(`[test-time] p90 기준선이 0이다 — 리포터가 time을 안 실었는지 확인할 것.`);
    process.exit(1);
  }
  if (outliers.length) {
    console.error(`[test-time] 기준선의 ${threshold}배를 넘는 테스트 ${outliers.length}개:`);
    for (const o of outliers) {
      console.error(`  ${o.ratio.toFixed(1)}× (${o.ms.toFixed(0)}ms) ${o.file} › ${o.name}`);
    }
    process.exit(1);
  }
  const top = findOutliers(cases, 0).outliers.slice(0, 3);
  console.log(
    `[test-time] 통과. 최댓값 ${top.map((t) => `${t.ratio.toFixed(1)}× ${t.name}`).join(' / ')}`
  );
}
