/**
 * 예시 티켓 6종을 자연 픽셀 크기로 스크린샷한다 (#샘플 데이터 검토용).
 *
 *   bun scripts/capture-samples.mjs --out /tmp/samples
 *   bun scripts/capture-samples.mjs --url http://localhost:3020/sample-sheet --out /tmp/samples
 *
 * `/sample-sheet`(dev 전용 페이지)이 무드를 스케일 없이 그리므로, 여기서 뜨는 픽셀은 폰트
 * 자동 축소·자간·말줄임이 실제 저장물과 같은 좌표에서 걸린 결과다. 검토 자료로 쓰려면 이게
 * 전제다 — 스케일이 끼면 무엇이 넘쳤는지 못 본다.
 *
 * bun에선 `await browser.close()`가 resolve하지 않아(#506와 같은 함정) 3초 race로 감싸고
 * 끝에 process.exit을 둔다.
 */
import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

// capture-export.mjs와 같은 호출 규약(이름만 넘기면 내부에서 `--`를 붙임) — 두 스크립트가
// 서로 다른 규약을 쓰면 옮겨 쓸 때 조용히 기본값으로 빠진다(code-review 지적).
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

const URL = arg('url', 'http://localhost:3020/sample-sheet');
const OUT = arg('out', '/tmp/samples');
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--force-device-scale-factor=1', '--hide-scrollbars'],
});

// 캡처 중 어디서 실패하든 헤드리스 Chrome이 떠 있는 채로 죽지 않게 close까지 finally로 보장한다
// (#반복 실행 시 프로세스 누적 방지, code-review 지적).
let exitCode = 0;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1700, height: 1200, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });

  // Next dev 인디케이터 뱃지가 뷰포트 왼쪽에 떠서 티켓 가장자리에 걸린다.
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  // 무드는 ssr:false라 마운트가 끝나야 내용이 생긴다.
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('[data-sample]')).every((e) => e.childElementCount > 0),
    { timeout: 30000 }
  );
  // 폰트가 앉기 전에 찍으면 fitFontSizeToWidth가 폴백 폭으로 계산한 크기가 박제된다.
  await page.evaluate(() => document.fonts.ready);
  // 포스터 <img> 디코드까지 기다린다 — 빈 프레임이 찍히는 걸 막는다.
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map((im) => (im.complete ? null : im.decode().catch(() => null)))
    )
  );
  await new Promise((r) => setTimeout(r, 600));

  const ids = await page.$$eval('[data-sample]', (els) => els.map((e) => e.dataset.sample));
  if (ids.length === 0) {
    console.error('[capture-samples] [data-sample] 요소가 하나도 없다 — dev 서버나 URL을 확인할 것');
    exitCode = 1;
  } else {
    for (const id of ids) {
      const el = await page.$(`[data-sample="${id}"]`);
      const box = await el.boundingBox();
      const path = `${OUT}/${id}.png`;
      await el.screenshot({ path });
      console.log(`${id.padEnd(16)} ${Math.round(box.width)}x${Math.round(box.height)} @2x → ${path}`);
    }
  }
} catch (err) {
  console.error('[capture-samples] 캡처 실패:', err);
  exitCode = 1;
} finally {
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
}
process.exit(exitCode);
