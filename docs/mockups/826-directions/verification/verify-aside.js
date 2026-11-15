// Aside REPL 스크립트: 방향 페이지를 393·375 폭에서 열고 잘림·겹침을 재고 .screen 별 스크린샷을 남긴다.
const BASE = 'http://127.0.0.1:4826/';
const PAGES = (globalThis.ONLY || ['index.html', 'a-workbench.html', 'b-flow.html', 'c-canvas.html', 'd-document.html']);
const WIDTHS = [[393, 852], [375, 812]];
const OUT = pwd + '/artifacts';

const report = [];

for (const file of PAGES) {
  for (const [w, h] of WIDTHS) {
    const tab = await openTab(BASE + file);
    await page.setViewportSize({ width: w, height: h });
    await sleep(400);
    const r = await page.evaluate(() => {
      const out = { docOverflowX: document.documentElement.scrollWidth - innerWidth, jsError: window.__err || null, screens: [] };
      const vis = (el) => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0.05 && el.getClientRects().length; };
      document.querySelectorAll('.screen').forEach((sc, idx) => {
        const cap = sc.closest('figure')?.querySelector('figcaption')?.textContent.trim().slice(0, 40) || ('#' + idx);
        const sr = sc.getBoundingClientRect();
        const res = { idx, cap, width: Math.round(sr.width), overflowX: sc.scrollWidth - sc.clientWidth, overflowY: sc.scrollHeight - sc.clientHeight, clipped: [], textClip: [], overlaps: [], pins: [] };
        sc.querySelectorAll('.rq').forEach(p => res.pins.push(p.textContent.trim()));
        const all = [...sc.querySelectorAll('*')].filter(el => vis(el) && !el.closest('.ticket') && !el.closest('.kbd') && !el.closest('.sr-only') && !el.closest('[data-slide][data-active="false"]'));
        for (const el of all) {
          const er = el.getBoundingClientRect();
          if (er.width < 1 || er.height < 1) continue;
          // 가장 가까운 클리핑 조상
          let a = el.parentElement, clipper = null;
          while (a && a !== sc.parentElement) {
            const s = getComputedStyle(a);
            if (s.overflowX !== 'visible' || s.overflowY !== 'visible') { clipper = a; break; }
            a = a.parentElement;
          }
          if (clipper) {
            const s = getComputedStyle(clipper);
            const scrollX = s.overflowX === 'auto' || s.overflowX === 'scroll';
            const scrollY = s.overflowY === 'auto' || s.overflowY === 'scroll';
            const cr = clipper.getBoundingClientRect();
            const outX = er.left < cr.left - 1 || er.right > cr.right + 1;
            const outY = er.top < cr.top - 1 || er.bottom > cr.bottom + 1;
            if ((outX && !scrollX) || (outY && !scrollY)) {
              // 일부만 잘린 경우만 기록(완전히 밖이면 의도된 숨김일 수 있어 따로 표시)
              const fully = er.right <= cr.left || er.left >= cr.right || er.bottom <= cr.top || er.top >= cr.bottom;
              res.clipped.push((fully ? '[밖]' : '[걸침]') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName) + ' ' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24));
            }
          }
          // 텍스트 잘림: 자식 요소 없는 텍스트 노드 컨테이너
          if (el.children.length === 0 && el.textContent.trim() && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'hidden') {
            res.textClip.push(el.textContent.trim().slice(0, 30));
          }
        }
        const ctrls = [...sc.querySelectorAll('button, input, a, select, [role="switch"], [role="tab"], .chip')].filter(el => vis(el) && !el.closest('.kbd') && !el.closest('[data-slide][data-active="false"]'));
        for (let i = 0; i < ctrls.length; i++) for (let j = i + 1; j < ctrls.length; j++) {
          const A = ctrls[i], B = ctrls[j];
          if (A.contains(B) || B.contains(A)) continue;
          if (A.closest('label') && A.closest('label') === B.closest('label')) continue;
          const visRect = (el) => { let r = el.getBoundingClientRect(); let L = r.left, T = r.top, R = r.right, Bm = r.bottom; let p = el.parentElement; while (p && p !== sc.parentElement) { const st = getComputedStyle(p); if (st.overflowX !== 'visible' || st.overflowY !== 'visible') { const q = p.getBoundingClientRect(); L = Math.max(L, q.left); T = Math.max(T, q.top); R = Math.min(R, q.right); Bm = Math.min(Bm, q.bottom); } p = p.parentElement; } return { left: L, top: T, right: R, bottom: Bm }; };
          const ra = visRect(A), rb = visRect(B);
          const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (ix > 2 && iy > 2) {
            const nm = el => (el.classList.contains('rq') ? 'pin' + el.textContent : el.tagName.toLowerCase()) + ':' + (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().slice(0, 16);
            res.overlaps.push(nm(A) + ' × ' + nm(B) + ' (' + Math.round(ix) + '×' + Math.round(iy) + ')');
          }
        }
        res.pinText = [];
        sc.querySelectorAll('.rq').forEach(pin => {
          const pr = pin.getBoundingClientRect();
          for (const el of sc.querySelectorAll('*')) {
            if (el === pin || pin.contains(el) || el.contains(pin) || el.closest('.ticket') || el.closest('.kbd') || !vis(el)) continue;
            const txt = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join('');
            if (!txt) continue;
            const rng = document.createRange(); rng.selectNodeContents(el);
            for (const tr of rng.getClientRects()) {
              const ix = Math.min(pr.right, tr.right) - Math.max(pr.left, tr.left), iy = Math.min(pr.bottom, tr.bottom) - Math.max(pr.top, tr.top);
              if (ix > 2 && iy > 2) { res.pinText.push('pin' + pin.textContent + '×"' + txt.slice(0, 12) + '"'); break; }
            }
          }
        });
        // 글자가 다른 요소에 덮였는지: 글자 사각형 중심에서 가장 위에 그려진 요소가 그 글자 자신(또는 자손)인지 본다.
        // 조작부 겹침 검사가 못 보는 축(티켓 자리표시·형제 블록이 라벨을 덮는 경우)을 잡는다.
        res.textOverlap = [];
        sc.scrollIntoView({ block: 'start' });
        const leaves = [...sc.querySelectorAll('*')].filter(el => vis(el) && !el.closest('.ticket') && !el.closest('.kbd') && !el.closest('.rq') && !el.closest('[data-slide][data-active="false"]') && getComputedStyle(el).pointerEvents !== 'none' && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
        for (const L of leaves) {
          const rg = document.createRange(); rg.selectNodeContents(L);
          for (const tr of rg.getClientRects()) {
            if (tr.width < 2 || tr.height < 2) continue;
            const x = tr.left + tr.width / 2, y = tr.top + tr.height / 2;
            if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) continue;
            const scR = sc.getBoundingClientRect();
            if (y < scR.top || y > scR.bottom || x < scR.left || x > scR.right) continue;
            let sp = L.parentElement, hidden = false;
            while (sp && sp !== sc) { const st = getComputedStyle(sp); if (st.overflowY !== 'visible' || st.overflowX !== 'visible') { const r = sp.getBoundingClientRect(); if (y < r.top || y > r.bottom || x < r.left || x > r.right) { hidden = true; break; } } sp = sp.parentElement; }
            if (hidden) continue;
            const top = document.elementFromPoint(x, y);
            if (top && top !== L && !L.contains(top) && !top.contains(L) && !top.classList.contains('rq') && !top.classList.contains('scrim')) {
              res.textOverlap.push('"' + L.textContent.trim().slice(0, 12) + '" ← ' + (top.className && typeof top.className === 'string' ? '.' + top.className.split(' ')[0] : top.tagName));
              break;
            }
          }
        }
        res.textOverlap = [...new Set(res.textOverlap)];
        out.screens.push(res);
      });
      out.pinsAll = [...new Set([...document.querySelectorAll('.screen .rq')].map(p => p.textContent.trim()))].sort();
      out.tables = { req: document.querySelectorAll('#requirements tr, #reqs tr').length, feat: document.querySelectorAll('#features tr, #feats tr').length, principle: (document.querySelector('#principle')?.textContent || '').length };
      return out;
    });
    report.push({ file, w, ...r });
    const shots = await page.locator('.screen').all();
    for (let i = 0; i < shots.length; i++) {
      await shots[i].evaluate(el => el.scrollIntoView({block:'start'})); await sleep(150);
      const buf = await shots[i].screenshot();
      console.log('IMG ' + `${file.replace('.html', '')}-${w}-${i + 1}.png` + ' ' + Buffer.from(buf).toString('base64'));
    }
    const full = await page.screenshot({ fullPage: file === 'index.html' ? false : false });
    console.log('IMG ' + `${file.replace('.html', '')}-${w}-page.png` + ' ' + Buffer.from(full).toString('base64'));
    await closeTab(tab);
  }
}
console.log('REPORT ' + JSON.stringify(report));
for (const r of report) {
  console.log(`== ${r.file} @${r.w} docOverflowX=${r.docOverflowX} pins=${r.pinsAll.join('')} tables=${JSON.stringify(r.tables)}`);
  for (const s of r.screens) {
    const bad = s.overflowX > 0 || s.clipped.filter(c => c.startsWith('[걸침]')).length || s.textClip.length || s.overlaps.length || s.pinText.length || s.textOverlap.length;
    console.log(`  ${bad ? '!!' : 'ok'} ${s.idx + 1} ${s.cap} w=${s.width} ovX=${s.overflowX} ovY=${s.overflowY}`);
    if (s.clipped.length) console.log('     clipped:', s.clipped.slice(0, 8).join(' | '));
    if (s.textClip.length) console.log('     textClip:', s.textClip.slice(0, 6).join(' | '));
    if (s.textOverlap.length) console.log('     textOverlap:', s.textOverlap.slice(0, 8).join(' | '));
    if (s.pinText.length) console.log('     pinText:', s.pinText.join(' | '));
    if (s.overlaps.length) console.log('     overlaps:', s.overlaps.slice(0, 8).join(' | '));
  }
}
console.log('OUT', OUT);
