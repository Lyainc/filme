const out = [];
for (const [w, h] of [[393, 852], [375, 812]]) {
  const t = await openTab('http://127.0.0.1:4826/index.html');
  await page.setViewportSize({ width: w, height: h });
  await sleep(300);
  const m = () => page.evaluate(() => ({
    ovX: document.documentElement.scrollWidth - innerWidth,
    cards: document.querySelectorAll('.card').length,
    visibleCards: [...document.querySelectorAll('.card')].filter(c => c.offsetParent).length,
    headCols: [...document.querySelectorAll('#feats thead th')].filter(th => getComputedStyle(th).display !== 'none').map(th => th.textContent).join('|'),
    frames: [...document.querySelectorAll('iframe')].filter(f => f.offsetParent).length,
    btn: document.getElementById('legacy-toggle').textContent + ' ' + document.getElementById('legacy-toggle').getAttribute('aria-expanded'),
    count: document.getElementById('feat-count').textContent.slice(0, 60)
  }));
  const closed = await m(); out.push({ w, state: 'closed', ...closed }); console.log(w, 'closed', JSON.stringify(closed));
  await page.locator('#legacy-toggle').click();
  await sleep(200);
  const opened = await m(); out.push({ w, state: 'open', ...opened }); console.log(w, 'open', JSON.stringify(opened));
  const shot = await page.screenshot();
  console.log('IMG index-legacy-open-' + w + '.png ' + Buffer.from(shot).toString('base64'));
  await closeTab(t);
}
console.log('REPORT ' + JSON.stringify(out));
