/**
 * capture-export.mjs · measure-chrome.mjs · capture-samples.mjs가 공유하는 puppeteer 하네스 유틸.
 * 세 스크립트가 각자 구현하다 발산한 지점(#756)을 한 곳으로 모은다 — arg 파싱·CHROME_PATH
 * 폴백·랜딩 dismiss·browser-close 레이스.
 */

export function parseArgs(argv) {
  return (name, dflt) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
  };
}

export function resolveChromePath() {
  return process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
}

/**
 * 랜딩 "이어서 만들기"(`data-testid="landing-restore"`) 버튼을 클릭한다. 못 찾으면 반드시
 * throw한다(#756) — measure-chrome.mjs 쪽이 `?.click()`으로 조용히 no-op해 랜딩이 안 걷힌 채로
 * 이후 측정을 그대로 진행하던 발산을 여기서 닫는다.
 */
export async function dismissLanding(page, { timeout = 10000 } = {}) {
  await page.waitForSelector('[data-testid="landing-restore"]', { visible: true, timeout });
  await page.click('[data-testid="landing-restore"]');
}

/**
 * bun에선 `await browser.close()`가 resolve하지 않는다(실측, #506) — 3초 레이스로 대신한다.
 * `.catch(() => {})`가 없으면 close() 자신이 reject할 때 레이스가 그대로 reject한다.
 */
export async function closeBrowserSafely(browser, timeoutMs = 3000) {
  await Promise.race([
    browser.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
