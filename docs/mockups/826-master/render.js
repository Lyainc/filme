/* 페이지 목록·라우팅·토큰 표·추적표·흐름 렌더. */
(function () {
  var S = window.PR, FR = window.FRAMES, esc = S.esc;
  var root = document.documentElement;

  var PAGES = [
    { id: 'cover', k: '00', n: '표지 · 결정', grp: '시작' },
    { id: 'tokens', k: '01', n: '토큰', grp: '디자인 시스템' },
    { id: 'components', k: '02', n: '컴포넌트', grp: '디자인 시스템' },
    { id: 'flow', k: '03', n: '흐름', grp: '화면' },
    { id: 'landing', k: '04', n: '랜딩', grp: '화면' },
    { id: 'editor', k: '05', n: '편집 기본', grp: '화면' },
    { id: 'dock', k: '06', n: '도크 · 모드', grp: '화면' },
    { id: 'input', k: '07', n: '필드 편집 · 키보드', grp: '화면' },
    { id: 'crop', k: '08', n: '크롭', grp: '화면' },
    { id: 'menu', k: '09', n: '메뉴 · 설정', grp: '화면' },
    { id: 'result', k: '10', n: '결과 · 저장 · 공유', grp: '화면' },
    { id: 'errors', k: '11', n: '오류 · 빈 상태', grp: '화면' },
    { id: 'share', k: '12', n: '공유 페이지', grp: '화면' },
    { id: 'trace', k: '13', n: '기능 · 요구 추적', grp: '근거' },
    { id: 'copy', k: '14', n: '문구 변경', grp: '근거' },
    { id: 'refs', k: '15', n: '레퍼런스', grp: '근거' },
    { id: 'verify', k: '16', n: '검증 기록', grp: '근거' }
  ];
  function framesOf(p) { return FR.filter(function (f) { return f.page === p; }); }

  /* ---------- 네비 ---------- */
  var nav = '<h1>FILME 영사실</h1><p class="sub">#826 3단계 페이지 마스터</p>', g = '';
  PAGES.forEach(function (p) {
    if (p.grp !== g) { g = p.grp; nav += '<p class="grp">' + g + '</p>'; }
    var c = framesOf(p.id); var nv = c.reduce(function (a, f) { return a + f.variants.length; }, 0);
    nav += '<a href="#' + p.id + '" data-p="' + p.id + '"><span class="k">' + p.k + '</span>' + p.n + (c.length ? '<span class="c">' + c.length + '·' + nv + '</span>' : '') + '</a>';
  });
  document.getElementById('nav').innerHTML = nav;

  /* ---------- 프레임 페이지 ---------- */
  function compLink(id) { return '<a href="#components" data-jump="' + id + '">' + id + '</a>'; }
  function frameBlock(f) {
    var h = '<h3 id="' + f.id + '">' + f.id + ' · ' + esc(f.name) + '</h3><div class="fr-row">';
    f.variants.forEach(function (v, n) {
      h += '<figure class="fr" style="margin:0"><figcaption class="fr-h"><span class="id">' + f.id + (f.variants.length > 1 ? '.' + (n + 1) : '') + '</span><span class="nm">' + esc(v.st) + '</span></figcaption>' + v.html + '</figure>';
    });
    h += '</div><div class="fr-spec"><dl>';
    h += '<dt>상태</dt><dd><ul style="margin:0;padding-left:16px">' + f.states.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></dd>';
    h += '<dt>컴포넌트</dt><dd>' + f.comps.map(compLink).join(' · ') + '</dd>';
    if (f.flow.length) h += '<dt>흐름</dt><dd><ul class="flow">' + f.flow.map(function (x) { return '<li><b>' + esc(x[0]) + '</b> → ' + x[1].split(/\s*·\s*|\s*→\s*/).map(function (id) { return /^[A-Z]-\d\d/.test(id) ? '<a href="#' + pageOfFrame(id.slice(0, 4)) + '" data-jump="' + id.slice(0, 4) + '">' + esc(id) + '</a>' : esc(id); }).join(' · ') + (x[2] ? ' <span style="color:var(--pr-ink-3)">(' + esc(x[2]) + ')</span>' : '') + '</li>'; }).join('') + '</ul></dd>';
    if (f.notes.length) h += '<dt>메모</dt><dd>' + f.notes.map(esc).join('<br>') + '</dd>';
    var an = window.EV_FRAME_NOTES(f.id);
    if (an.copy.length) h += '<dt>문구 변경</dt><dd>' + an.copy.join('<br>') + '</dd>';
    if (an.trace.length) h += '<dt>기능 · 요구</dt><dd>' + an.trace.join(' · ') + '</dd>';
    return h + '</dl></div>';
  }
  function pageOfFrame(id) { for (var n = 0; n < FR.length; n++) if (FR[n].id === id) return FR[n].page; return 'flow'; }

  var INTRO = {
    landing: '앱 첫 화면이에요. 주 행동은 "티켓 스크린샷으로 자동입력" 하나이고, 전시는 무대 기둥 위에서 돌아가요.',
    editor: '편집의 바탕 화면이에요. 상단 줄 · 무대(티켓) · 높이가 고정된 하단 도크 세 층뿐이고 떠 있는 층이 없어요.',
    dock: '도크는 맨 아래 모드 셋으로 나뉘어요. 사진은 이미지 자산, 정보는 티켓에 찍히는 글, 디자인은 티켓 전체에 한 번에 적용되는 꾸미기예요. 높이는 모드·도구와 상관없이 하나예요.',
    input: '글 필드는 티켓을 누르거나 정보 행을 누르면 키보드 위 입력 패널로 바로 가요. 필드 옵션은 입력 아래 칩 한 줄이에요. 요구 3·4가 여기서 지켜져요.',
    crop: '크롭은 전체 화면 모달이고 사진 판독을 위해 테마와 무관하게 어두워요.',
    menu: '자주 안 쓰는 것과 파괴적인 것만 메뉴에 남겼어요.',
    result: '저장물 그대로의 티켓과 주 행동 "사진에 저장" 하나, 링크·공유는 텍스트 행이에요.',
    errors: '오류는 표면 + 앰버 점·테두리로 표시해요(결정 5-A). 아래 색인은 앱의 모든 오류·빈 문구가 어느 프레임에 그려졌는지예요.',
    share: '편집기 밖의 공유 링크 페이지예요.'
  };

  /* ---------- 컴포넌트 ---------- */
  function compsPage() {
    var h = '<h2>컴포넌트</h2><p class="m-lede">각 견본은 화면 프레임과 같은 빌더로 그려요. "대응 파일"은 main 203ee7c 기준 현재 구현이고, 리뉴얼은 cva + cn으로 직접 구현하는 현행 자세를 유지해요(새 UI 라이브러리 없음).</p><div class="cs">';
    window.COMPONENTS.forEach(function (c) {
      h += '<section class="cs-card pr" id="' + c.id + '"><h4><span class="id">' + c.id + '</span>' + esc(c.name) + '</h4><div class="cs-demo">' + c.demo + '</div><dl>' +
        '<dt>구성</dt><dd><ol class="an">' + c.anatomy.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ol></dd>' +
        '<dt>크기</dt><dd>' + esc(c.size) + '</dd><dt>토큰</dt><dd>' + esc(c.tokens) + '</dd><dt>변형</dt><dd>' + esc(c.variants) + '</dd><dt>상태</dt><dd>' + esc(c.states) + '</dd>' +
        '<dt>대응 파일</dt><dd><b>' + esc(c.files) + '</b></dd><dt>프레임</dt><dd>' + esc(c.frames) + '</dd></dl></section>';
    });
    return h + '</div>';
  }

  function verifyPage() { return '<h2>검증 기록</h2><div id="verify-body"><p class="m-lede">Aside로 393·375 × 라이트·다크 렌더를 확인한 기록이 여기 붙어요(verification/).</p></div>'; }

  /* ---------- 조립: 화면 페이지는 프레임, 나머지는 evidence/ 단위를 page별로 모아요 ---------- */
  var html = '';
  PAGES.forEach(function (p) {
    var body = '<h2>' + (p.id === 'cover' ? 'FILME 영사실 · 페이지 마스터' : p.n) + '</h2>';
    if (p.id === 'components') body = compsPage();
    else if (p.id === 'verify') body = verifyPage();
    else if (INTRO[p.id]) body += '<p class="m-lede">' + INTRO[p.id] + '</p>' + framesOf(p.id).map(frameBlock).join('');
    window.EVIDENCE.filter(function (u) { return u.page === p.id; }).forEach(function (u) { body += '<div class="ev-unit" data-unit="' + u.id + '">' + u.html() + '</div>'; });
    html += '<section class="m-page" id="pg-' + p.id + '" data-page="' + p.id + '">' + body + '</section>';
  });
  document.getElementById('pages').innerHTML = html;
  if (window.VERIFY_HTML) document.getElementById('verify-body').innerHTML = window.VERIFY_HTML;

  /* ---------- 라우팅 · 토글 ---------- */
  function show() {
    var id = (location.hash || '#cover').slice(1); if (!document.getElementById('pg-' + id)) id = 'cover';
    document.querySelectorAll('.m-page').forEach(function (s) { s.classList.toggle('on', s.dataset.page === id); });
    document.querySelectorAll('.m-nav a').forEach(function (a) { a.setAttribute('aria-current', a.dataset.p === id ? 'page' : 'false'); });
    var p = PAGES.filter(function (x) { return x.id === id; })[0];
    document.getElementById('crumb').innerHTML = '<b>' + p.k + ' ' + p.n + '</b>';
    root.removeAttribute('data-nav');
    redraw();
  }
  function redraw() { var pg = document.querySelector('.m-page.on'); if (!pg) return; requestAnimationFrame(function () { S.drawRedlines(pg); }); }
  window.addEventListener('hashchange', show);
  window.addEventListener('resize', function () { clearTimeout(window.__rt); window.__rt = setTimeout(redraw, 150); });
  document.addEventListener('click', function (e) {
    var j = e.target.closest('[data-jump]');
    if (j) { var pid = j.getAttribute('href').slice(1); setTimeout(function () { var el = document.getElementById(j.dataset.jump); if (el) el.scrollIntoView(); }, pid === (location.hash || '').slice(1) ? 0 : 60); }
  });
  document.querySelectorAll('[data-fw]').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.fw === '375') root.setAttribute('data-fw', '375'); else root.removeAttribute('data-fw'); document.querySelectorAll('[data-fw]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); redraw(); }); });
  document.querySelectorAll('[data-theme-set]').forEach(function (b) { b.addEventListener('click', function () { var v = b.dataset.themeSet; if (v === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', v); document.querySelectorAll('[data-theme-set]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }); });
  var rlb = document.getElementById('rltoggle');
  root.setAttribute('data-rl', 'on');
  rlb.addEventListener('click', function () { var on = root.getAttribute('data-rl') !== 'on'; root.setAttribute('data-rl', on ? 'on' : 'off'); rlb.setAttribute('aria-pressed', String(on)); });
  var nt = document.getElementById('navtoggle');
  nt.addEventListener('click', function () { var o = root.getAttribute('data-nav') === 'open'; if (o) root.removeAttribute('data-nav'); else root.setAttribute('data-nav', 'open'); nt.setAttribute('aria-expanded', String(!o)); });
  /* URL 쿼리로 검증 상태를 고정(Aside 자동화용): ?fw=375&theme=dark&rl=off */
  var q = new URLSearchParams(location.search);
  if (q.get('fw') === '375') document.querySelector('[data-fw="375"]').click();
  if (q.get('theme')) { var tb = document.querySelector('[data-theme-set="' + q.get('theme') + '"]'); if (tb) tb.click(); }
  if (q.get('rl') === 'off') rlb.click();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
  show();
})();
