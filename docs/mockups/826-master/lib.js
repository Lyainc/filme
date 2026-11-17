/* 프레임 조각 빌더. 각 함수는 HTML 문자열을 돌려줘요. 화면 정의는 pages.js, 데이터는 data/*.js. */
(function () {
  var P = {};
  var ICONS = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    undo: '<path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3"/>',
    redo: '<path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3"/>',
    more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.2 3.9M6.6 6.6C3.8 8.3 2 12 2 12s4 7 10 7a9.6 9.6 0 004.4-1.1"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>'
  };
  P.i = function (n, extra) { return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"' + (extra || '') + '>' + ICONS[n] + '</svg>'; };
  P.esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  P.sbar = function () { return '<div class="sbar"><span>9:41</span><i>●●● ▮</i></div>'; };
  P.home = function () { return '<span class="home" aria-hidden="true"></span>'; };
  P.rl = function (kind) { return ' data-rl="' + kind + '"'; };

  /* 상단 줄. o: {back:'랜딩으로 돌아가기', title, undo:{u:true,r:false}, menu:true, done:'enabled'|'blocked'|false} */
  P.topbar = function (o) {
    o = o || {};
    var h = '<div class="c-tb"' + P.rl('h') + '>';
    if (o.back !== false) h += '<button class="c-ib" aria-label="' + (o.back || '랜딩으로 돌아가기') + '">' + P.i('back') + '</button>';
    if (o.title) h += '<b class="ttl">' + o.title + '</b>'; else h += '<span class="sp"></span>';
    if (o.undo) {
      h += '<button class="c-ib" aria-label="실행 취소"' + (o.undo.u === false ? ' disabled' : '') + '>' + P.i('undo') + '</button>';
      h += '<button class="c-ib" aria-label="다시 실행"' + (o.undo.r === false ? ' disabled' : '') + '>' + P.i('redo') + '</button>';
    }
    if (o.menu) h += '<button class="c-ib" aria-label="편집 메뉴"' + (o.menuOpen ? ' aria-expanded="true" aria-pressed="true"' : '') + '>' + P.i('more') + '</button>';
    if (o.done) h += '<button class="c-btn pri"' + (o.done === 'blocked' ? ' aria-disabled="true"' : '') + (o.rlDone ? P.rl('hw') : '') + '>완료</button>';
    if (o.title && !o.menu && !o.done) h += '<span style="width:44px;flex:none"></span>';
    return h + '</div>';
  };

  /* 티켓 자리표시. o: {dark, wide, poster:'img'|'none'|'load', ghost, empty, title} */
  P.ticket = function (o) {
    o = o || {};
    var cls = 'tk' + (o.dark ? ' dark' : '') + (o.wide ? ' wide' : '');
    var po = o.poster === 'none' ? '<div class="po none">포스터 추가</div>' : o.poster === 'load' ? '<div class="po load"></div>' : '<div class="po"></div>';
    if (o.empty) {
      return '<div class="' + cls + '">' + po +
        '<div class="f ti empty-ti">' + (o.ghost ? '제목' : '') + '</div>' +
        (o.ghost ? '<div class="f c ghost" style="left:6%;top:74%"></div><div class="f c ghost" style="left:40%;top:74%"></div><div class="f c ghost" style="left:70%;top:74%"></div><div class="f c ghost" style="left:6%;top:83%;min-width:40%"></div><div class="f c ghost" style="left:70%;top:83%"></div>' : '') +
        '</div>';
    }
    var t = o.title || '먼 바다';
    if (o.wide) {
      return '<div class="' + cls + '">' + po + '<div class="f ti">' + t + '</div>' +
        '<div class="f c" style="left:45%;top:40%;font-size:3cqi"><small>관람일</small><span>2026.11.15 토 19:40</span></div>' +
        '<div class="f c" style="left:45%;top:58%;font-size:3cqi"><small>극장</small><span>CGV 용산아이파크몰 · 7관 H12</span></div>' +
        '<div class="f ft">No. 0481 · 일반</div></div>';
    }
    return '<div class="' + cls + '">' + po + (o.nologo ? '' : '<div class="f lg">CGV</div>') + '<div class="f ti">' + t + '</div>' +
      '<div class="f c" style="left:6%;top:74%"><small>날짜</small><span>11.15 토</span></div>' +
      '<div class="f c" style="left:40%;top:74%"><small>시간</small><span>19:40</span></div>' +
      '<div class="f c" style="left:70%;top:74%"><small>상영관</small><span>7관</span></div>' +
      '<div class="f c" style="left:6%;top:83%"><small>극장</small><span>CGV 용산아이파크몰</span></div>' +
      '<div class="f c" style="left:70%;top:83%"><small>좌석</small><span>H12</span></div>' +
      (o.ghost ? '<div class="f c ghost" style="left:6%;top:88.5%;min-width:52%"></div>' : '') +
      '<div class="f ft">No. 0481 · 일반</div></div>';
  };

  /* 선택 표시 좌표(티켓 기준 %) */
  P.SEL = {
    title: { x: 4.5, y: 63.6, w: 52, h: 7.6, lab: '제목' },
    seat: { x: 68, y: 82.2, w: 20, h: 6.4, lab: '좌석' },
    date: { x: 4.5, y: 73.2, w: 26, h: 6.4, lab: '관람일' },
    poster: { x: 0, y: 0, w: 100, h: 61, lab: '포스터', pos: 'inside' },
    logo: { x: 5, y: 2.6, w: 26, h: 5.6, lab: '극장 로고', pos: 'below' },
    foot: { x: 4.5, y: 91.6, w: 40, h: 4.6, lab: '예매 번호' },
    screen: { x: 68, y: 73.2, w: 20, h: 6.4, lab: '상영관' }
  };
  P.sel = function (k, o) {
    var s = P.SEL[k]; if (!s) return ''; o = o || {};
    return '<div class="c-sel' + (o.nolab ? ' nolab' : '') + '" style="left:' + s.x + '%;top:' + s.y + '%;width:' + s.w + '%;height:' + s.h + '%" aria-hidden="true"><span class="lab' + (s.pos ? ' ' + s.pos : '') + '">' + s.lab + '</span></div>';
  };

  /* 무대. o: {ticket:{}, sel:'title', wide} */
  P.canvas = function (o) {
    o = o || {};
    return '<div class="c-canvas"><div class="tkw' + (o.wide ? ' wide' : '') + '"' + (o.rl ? P.rl('tw') : '') + '>' + P.ticket(o.ticket || {}) + (o.sel ? P.sel(o.sel) : '') + (o.extra || '') + '</div>' + (o.after || '') + '</div>';
  };

  P.MOODS = [
    { k: 'minimal', n: '미니멀', paper: '#FBF8F3' }, { k: 'criterion', n: '크라이테리언', paper: '#E8E2D6' },
    { k: '35mm', n: '35mm', paper: '#1C1D20', dark: 1 }, { k: 'editorial', n: '에디토리얼', paper: '#F3EAE0', wide: 1 },
    { k: 'stub', n: '스텁', paper: '#EFE7DA' }, { k: '35mmw', n: '35mm 와이드', paper: '#22252A', dark: 1, wide: 1 }
  ];
  P.thumbs = function (sel) {
    var h = '<div class="c-thumbs" role="radiogroup" aria-label="무드">';
    P.MOODS.forEach(function (m) {
      h += '<button class="c-thumb" role="radio" aria-checked="' + (m.k === sel) + '"><span class="tb' + (m.wide ? ' wide' : '') + '"><span class="tk' + (m.dark ? ' dark' : '') + '" style="background:' + m.paper + ';display:block"><span class="po" style="display:block"></span></span></span><span class="nm">' + m.n + '</span></button>';
    });
    return h + '</div>';
  };
  /* 슬라이더: 트랙 hit 32 + 값 입력(탭하면 16px 숫자 입력) */
  P.slider = function (lb, v, o) {
    o = o || {};
    return '<div class="c-sl"' + (o.rl ? P.rl('h') : '') + '><span class="lb">' + lb + '</span><div class="c-rng' + (o.dis ? ' dis' : '') + '" role="slider" aria-label="' + lb + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + v + '"' + (o.dis ? ' aria-disabled="true"' : '') + (o.rlTrack ? P.rl('h') : '') + '><span class="tr"></span><span class="fi" style="width:' + v + '%"></span><span class="th" style="left:' + v + '%"></span></div><button class="val" aria-label="' + lb + ' 값 직접 입력">' + v + '%</button></div>';
  };
  P.opts = function (lb, items, sel, o) {
    o = o || {};
    return '<div class="c-row"><span class="lb">' + lb + '</span><div class="c-opts" role="radiogroup" aria-label="' + lb + '">' + items.map(function (x) { return '<button class="c-opt" role="radio" aria-checked="' + (x === sel) + '"' + (o.dis ? ' disabled' : '') + '>' + x + '</button>'; }).join('') + '</div></div>';
  };
  P.panel = function (cls, inner, o) { return '<div class="c-panel ' + (cls || '') + '" role="region" aria-label="' + ((o && o.aria) || '문맥 패널') + '"' + ((o && o.rl) ? P.rl('h') : '') + '>' + inner + '</div>'; };
  P.kbd = function (kind) {
    var r = function (n, cls) { var s = ''; for (var i = 0; i < n; i++) s += '<span' + (cls && cls[i] ? ' class="' + cls[i] + '"' : '') + '></span>'; return '<div class="row">' + s + '</div>'; };
    var body = kind === 'num' ? r(3) + r(3) + r(3) + r(3) : r(10) + r(9) + r(9, { 0: 'm', 8: 'm' }) + r(4, { 0: 'm', 1: 'm', 2: 'w', 3: 'm' });
    return '<div class="c-kbd" aria-hidden="true"' + P.rl('h') + '><span class="lbl">iOS 키보드 근사</span><div class="sug">' + (kind === 'num' ? '' : '<span>먼 바다</span><span>먼</span><span>바다</span>') + '</div>' + body + '</div>';
  };
  P.toast = function (text, o) {
    o = o || {};
    var st = o.top != null ? 'top:' + o.top + 'px' : 'bottom:' + (o.bottom != null ? o.bottom : 120) + 'px';
    return '<div class="c-toast' + (o.err ? ' err' : '') + '" role="' + (o.err ? 'alert' : 'status') + '" style="' + st + '"><span class="ic" aria-hidden="true"></span><span class="tx">' + text + '</span>' + (o.close ? '<button class="c-ib" aria-label="닫기">' + P.i('close') + '</button>' : '') + '</div>';
  };
  P.wordmark = function () {
    return '<div class="c-wm"><span class="mk" aria-hidden="true"><svg viewBox="0 0 100 100"><path fill="#FBF4EC" d="M21 27H79A8 8 0 0 1 87 35V65A8 8 0 0 1 79 73H21A8 8 0 0 1 13 65V35A8 8 0 0 1 21 27Z"/><rect x="21" y="34.5" width="30" height="9" rx="2.5" fill="#241C22"/><g fill="#FBF4EC"><path d="M24.5 34.5H28.5L25.5 43.5H21.5Z"/><path d="M32 34.5H36L33 43.5H29Z"/><path d="M39.5 34.5H43.5L40.5 43.5H36.5Z"/><path d="M47 34.5H51L48 43.5H44Z"/></g><rect x="22" y="49" width="28" height="3.4" rx="1.7" fill="#241C22"/><rect x="22" y="56.5" width="18" height="3.4" rx="1.7" fill="#241C22"/><line x1="58" y1="33" x2="58" y2="67" stroke="#241C22" stroke-width="2" stroke-dasharray="2 3.6" stroke-linecap="round"/><rect x="66" y="43.5" width="14" height="14" rx="3.5" fill="#241C22"/><circle cx="73" cy="50.5" r="3.4" fill="#FBF4EC"/><circle cx="73" cy="50.5" r="1.15" fill="#241C22"/></svg></span><span class="lt" role="img" aria-label="FILME">f<i>ı<b></b></i>l<em>me</em></span></div>';
  };
  /* 하단 도크: body + 모드 바. mode: 'photo'|'info'|'design' */
  P.dock = function (mode, body, o) {
    o = o || {};
    var M = [['photo', '사진'], ['info', '정보'], ['design', '디자인']];
    return '<div class="c-dock" role="region" aria-label="편집"' + P.rl('h') + '><div class="c-dock-body' + (o.scroll ? ' scroll' : '') + '"' + (o.scrollIntended ? ' data-scroll="intended"' : '') + '>' + body + '</div>' +
      '<div class="c-modes" role="tablist" aria-label="편집 모드"' + P.rl('h') + '>' + M.map(function (m) { return '<button role="tab" aria-selected="' + (m[0] === mode) + '">' + m[1] + (o.miss && m[0] === 'info' ? '<span class="dot" aria-hidden="true"></span><span class="sr-only"> 필수 미입력</span>' : '') + '</button>'; }).join('') + '</div><div class="safe-b"></div></div>';
  };
  P.tools = function (items, sel) {
    return '<div class="c-tools" role="tablist" aria-label="디자인 도구"' + P.rl('h') + '>' + items.map(function (t) { return '<button role="tab" aria-selected="' + (t === sel) + '">' + t + '</button>'; }).join('') + '</div>';
  };
  P.irow = function (k, v, o) {
    o = o || {};
    return '<div class="c-irow' + (o.off ? ' off' : '') + '"><span class="k">' + (o.miss ? '<span class="dot" aria-hidden="true"></span>' : '') + k + '</span><button class="v' + (v ? '' : (o.miss ? ' miss' : ' empty')) + '" style="border:0;background:transparent;padding:0;text-align:left;min-height:44px;color:inherit" aria-label="' + k + ' 입력">' + (v || (o.miss ? '필수' : '비어 있음')) + '</button>' +
      (o.noEye ? '' : '<button class="c-ib" aria-label="' + k + ' 티켓에 표시" aria-pressed="' + !o.off + '"' + (o.req ? ' disabled' : '') + '>' + P.i(o.off ? 'eyeoff' : 'eye') + '</button>') + '</div>';
  };
  P.phone = function (inner, o) { return '<div class="ph' + (o && o.cls ? ' ' + o.cls : '') + '">' + P.sbar() + inner + P.home() + '</div>'; };

  /* ---------- 레드라인: data-rl 요소를 실측해서 치수선을 그려요 ---------- */
  /* 치수 상자는 요소 위 점선, 숫자는 폰 프레임 오른쪽 바깥 여백(figure 기준)에 둬서 화면을 가리지 않아요.
     폭(w)은 프레임 위쪽 바깥 띠에 적어요. */
  function addRl(fig, ph, el, kind, used) {
    var fr = fig.getBoundingClientRect(), pr = ph.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var x = r.left - fr.left, y = r.top - fr.top, w = Math.round(r.width), h = Math.round(r.height);
    var d = document.createElement('div');
    d.className = 'rl box'; d.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
    fig.appendChild(d);
    if (kind.indexOf('h') >= 0) {
      var cy = Math.round(y + r.height / 2); while (used.h[cy] || used.h[cy - 8] || used.h[cy + 8]) cy += 9; used.h[cy] = 1;
      var g = document.createElement('div'); g.className = 'rl';
      var gx = pr.right - fr.left + 4;
      g.style.cssText = 'left:' + gx + 'px;top:' + y + 'px;height:' + r.height + 'px;width:28px';
      g.innerHTML = '<span class="ln" style="left:0;top:0;bottom:0;width:1px"></span><span class="ln" style="left:0;top:0;width:5px;height:1px"></span><span class="ln" style="left:0;bottom:0;width:5px;height:1px"></span><span class="lb" style="left:4px;top:' + (cy - y) + 'px;transform:translateY(-50%)">' + h + '</span>';
      fig.appendChild(g);
    }
    if (kind.indexOf('x') >= 0) { /* 프레임 왼쪽 가장자리에서 요소까지 */
      var inner = pr.left + ph.clientLeft, lx = inner - fr.left, gap = Math.round(r.left - inner), ly = Math.round(y + Math.min(r.height / 2, 12));
      var g3 = document.createElement('div'); g3.className = 'rl';
      g3.style.cssText = 'left:' + lx + 'px;top:' + ly + 'px;width:' + (r.left - inner) + 'px;height:1px';
      g3.innerHTML = '<span class="ln" style="left:0;right:0;top:0;height:1px"></span><span class="lb" style="left:0;top:2px">' + gap + '</span>';
      fig.appendChild(g3);
    }
    if (kind.indexOf('t') >= 0 && el.parentElement) { /* 부모 안 위 · 아래 간격 */
      var par = el.parentElement.getBoundingClientRect(), cx = x + 10;
      [[par.top, r.top], [r.bottom, par.bottom]].forEach(function (pair) {
        var d2 = Math.round(pair[1] - pair[0]); if (d2 < 2) return;
        var g4 = document.createElement('div'); g4.className = 'rl';
        g4.style.cssText = 'left:' + cx + 'px;top:' + (pair[0] - fr.top) + 'px;height:' + (pair[1] - pair[0]) + 'px;width:1px';
        g4.innerHTML = '<span class="ln" style="left:0;top:0;bottom:0;width:1px"></span><span class="lb" style="left:4px;top:50%;transform:translateY(-50%)">' + d2 + '</span>';
        fig.appendChild(g4);
      });
    }
    if (kind.indexOf('w') >= 0) {
      var gy = pr.bottom - fr.top + 4 + used.w * 14; used.w++;
      var g2 = document.createElement('div'); g2.className = 'rl';
      g2.style.cssText = 'left:' + x + 'px;top:' + gy + 'px;width:' + r.width + 'px;height:12px';
      g2.innerHTML = '<span class="ln" style="left:0;right:0;top:6px;height:1px"></span><span class="ln" style="left:0;top:2px;width:1px;height:9px"></span><span class="ln" style="right:0;top:2px;width:1px;height:9px"></span><span class="lb" style="left:50%;top:0;transform:translateX(-50%)">' + w + '</span>';
      fig.appendChild(g2);
    }
  }
  P.drawRedlines = function (root) {
    (root || document).querySelectorAll('.ph').forEach(function (ph) {
      var fig = ph.parentElement; if (!fig) return;
      fig.style.position = 'relative';
      fig.querySelectorAll(':scope > .rl').forEach(function (n) { n.remove(); });
      var used = { h: {}, w: 0 };
      ph.querySelectorAll('[data-rl]').forEach(function (el) { addRl(fig, ph, el, el.getAttribute('data-rl'), used); });
    });
  };
  window.PR = P;
})();
