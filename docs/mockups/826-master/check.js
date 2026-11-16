/* 렌더 검사: 지금 보이는 페이지의 모든 폰 프레임(.ph)에서
   ① 글자 상자가 프레임 밖으로 넘침 ② 말줄임 없이 잘린 글자 ③ 서로 다른 글자 상자의 겹침을 찾아요.
   의도된 경우(가로 스크롤 줄, 전시의 곁 티켓, 떠 있는 층 vs 바탕, 레드라인, 티켓 자리표시 안쪽)는 제외해요.
   사용: window.MASTER_CHECK() → { frames, issues: [...] } */
(function () {
  var SCROLLERS = '.c-opts, .c-thumbs, .c-gal, .c-list .kt, .c-acc, .c-tools, .c-dock-body[data-scroll="intended"]';
  var LAYERS = '.c-toast, .c-sheet, .c-scrim, .c-osheet, .c-dlg, .c-banner, .c-sel, .home';
  function leafText(ph) {
    var out = [];
    ph.querySelectorAll('*').forEach(function (el) {
      if (el.closest('.rl, .tk, .c-kbd, svg')) return;
      /* 닫힌 details의 내용은 크롬이 상자를 남겨도 보이지 않아요(랜딩 이용 고지) */
      if (el.closest('details:not([open])') && !el.closest('summary')) return;
      var has = false;
      el.childNodes.forEach(function (n) { if (n.nodeType === 3 && n.textContent.trim()) has = true; });
      if (!has) return;
      var cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('.sr-only')) return;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      out.push({ el: el, r: r });
    });
    return out;
  }
  function label(el) { var t = (el.textContent || '').trim().replace(/\s+/g, ' '); return (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] + ' ' : el.tagName.toLowerCase() + ' ') + '"' + t.slice(0, 24) + '"'; }
  function hiddenByScroll(a) {
    var sc = a.el.closest(SCROLLERS); if (!sc) return false;
    var v = sc.getBoundingClientRect();
    return a.r.right <= v.left + 1 || a.r.left >= v.right - 1 || a.r.bottom <= v.top + 1 || a.r.top >= v.bottom - 1;
  }
  function layerOf(el) { var l = el.closest(LAYERS); return l || null; }
  window.MASTER_CHECK = function () {
    var issues = [], frames = 0;
    document.querySelectorAll('.m-page.on .ph').forEach(function (ph) {
      frames++;
      var fid = (ph.closest('figure') && ph.closest('figure').querySelector('.id') || {}).textContent || '?';
      var pr = ph.getBoundingClientRect();
      var items = leafText(ph);
      items.forEach(function (a) {
        var inScroll = a.el.closest(SCROLLERS);
        if (!inScroll && (a.r.left < pr.left - 0.5 || a.r.right > pr.right + 0.5 || a.r.top < pr.top - 0.5 || a.r.bottom > pr.bottom + 0.5)) issues.push({ frame: fid, kind: '프레임 밖', el: label(a.el) });
        var body = a.el.closest('.c-body, .c-dock-body');
        if (body && body.getAttribute('data-scroll') !== 'intended') { var br = body.getBoundingClientRect(); if (a.r.bottom > br.bottom + 0.5 || a.r.top < br.top - 0.5) issues.push({ frame: fid, kind: '스크롤 아래 가림', el: label(a.el) }); }
        var cs = getComputedStyle(a.el);
        if (!inScroll && a.el.scrollWidth > a.el.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && cs.overflow !== 'visible') issues.push({ frame: fid, kind: '잘림', el: label(a.el) });
      });
      /* 떠 있는 토스트가 바탕의 조작 글자(버튼·링크·입력)를 가리는지 */
      ph.querySelectorAll('.c-toast').forEach(function (t) {
        var tr = t.getBoundingClientRect();
        items.forEach(function (a) {
          if (layerOf(a.el) || !a.el.closest('button, a, input, label')) return;
          var w = Math.min(a.r.right, tr.right) - Math.max(a.r.left, tr.left), h = Math.min(a.r.bottom, tr.bottom) - Math.max(a.r.top, tr.top);
          if (w > 1 && h > 1) issues.push({ frame: fid, kind: '토스트가 조작 가림', el: label(a.el) });
        });
      });
      for (var i = 0; i < items.length; i++) for (var j = i + 1; j < items.length; j++) {
        var a = items[i], b = items[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (layerOf(a.el) !== layerOf(b.el)) continue; /* 떠 있는 층은 바탕 위에 겹치는 게 의도 */
        /* 스크롤 영역 밖으로 가려진 글자는 보이지 않으니 겹침 판정에서 빼요 */
        if (hiddenByScroll(a) || hiddenByScroll(b)) continue;
        var w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        var h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (w > 1 && h > 1) issues.push({ frame: fid, kind: '겹침', el: label(a.el) + ' × ' + label(b.el) });
      }
    });
    return { frames: frames, issues: issues };
  };
})();
