/* 방향 페이지 공용 렌더러. data.js의 FEATURES·REQUIREMENTS·DIRECTIONS를 읽어
   원칙 단락, 요구 6개 수용표, 기능 보존표를 그려요. file://로 열어도 동작해요. */
(function () {
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function renderPrinciple(dir) {
    var el = document.getElementById('principle');
    if (!el) return;
    el.innerHTML =
      '<p>' + esc(dir.principle) + '</p>' +
      '<ul class="three">' +
      '<li><b>정돈:</b> ' + esc(dir.problems.order) + '</li>' +
      '<li><b>공간:</b> ' + esc(dir.problems.space) + '</li>' +
      '<li><b>이음새:</b> ' + esc(dir.problems.seams) + '</li>' +
      '</ul>';
  }

  function renderRequirements(dir) {
    var el = document.getElementById('requirements');
    if (!el) return;
    var rows = window.REQUIREMENTS.map(function (r, i) {
      return '<tr><td><span class="rq inline">' + (i + 1) + '</span></td><td><b>' + esc(r.name) + '</b><br><span class="note">' +
        esc(r.issue) + '</span></td><td>' + esc(dir.reqs[r.id]) + '</td></tr>';
    }).join('');
    el.innerHTML = '<div class="table-wrap"><table class="grid"><thead><tr><th>#</th><th>요구</th><th>이 방향의 수용</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>';
  }

  function renderFeatures(dir) {
    var el = document.getElementById('features');
    if (!el) return;
    var html = '', group = null, gone = 0;
    window.FEATURES.forEach(function (f) {
      if (f.group !== group) {
        group = f.group;
        html += '<tr class="grp"><td colspan="3">' + esc(group) + '</td></tr>';
      }
      var to = dir.features[f.id];
      if (!to) throw new Error('feature mapping missing: ' + dir.id + ' / ' + f.id);
      var isGone = to.indexOf('제거:') === 0;
      if (isGone) gone++;
      html += '<tr><td>' + esc(f.name) + '</td><td class="note">' + esc(f.now) + '</td><td' + (isGone ? ' class="gone"' : '') + '>' + esc(to) + '</td></tr>';
    });
    el.innerHTML = '<p class="note">현재 앱 기능 ' + window.FEATURES.length + '개 중 사라지는 기능 ' + gone + '개. 사라지는 항목은 "제거:"로 시작하고 근거를 붙였어요.</p>' +
      '<div class="table-wrap"><table class="grid"><thead><tr><th>현재 기능</th><th>지금 위치</th><th>이 방향에서 가는 곳</th></tr></thead><tbody>' +
      html + '</tbody></table></div>';
  }

  /* 테마 전환: 라이트/다크 둘 다 같은 수준으로 확인하기 위한 토글 */
  function wireTheme() {
    var root = document.documentElement;
    document.querySelectorAll('[data-set-theme]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-set-theme');
        if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
        document.querySelectorAll('[data-set-theme]').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
      });
    });
  }

  /* 요구 1: 자동 재생 정지 수단. 정지/재생 버튼 + 버튼·카드 래퍼에 포커스·포인터가 들어오면 일시정지(#834),
     동작 줄이기 설정이면 처음부터 정지. 래퍼에 data-carousel, 슬라이드에 data-slide, 버튼에 data-carousel-toggle. */
  function wireCarousels() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('[data-carousel]').forEach(function (wrap) {
      var slides = wrap.querySelectorAll('[data-slide]');
      var btn = wrap.querySelector('[data-carousel-toggle]');
      var i = 0, userPaused = reduce, hover = false, timer = null;
      function show(n) {
        slides.forEach(function (s, k) { s.setAttribute('data-active', String(k === n)); });
      }
      function sync() {
        if (btn) {
          btn.setAttribute('aria-label', userPaused ? '자동 전환 재생' : '자동 전환 정지');
          btn.setAttribute('aria-pressed', String(userPaused));
          btn.querySelector('[data-icon]').textContent = userPaused ? '▶' : '❚❚';
        }
        clearInterval(timer);
        if (!userPaused && !hover) timer = setInterval(function () { i = (i + 1) % slides.length; show(i); }, 5000);
      }
      if (btn) btn.addEventListener('click', function () { userPaused = !userPaused; sync(); });
      wrap.addEventListener('pointerenter', function () { hover = true; sync(); });
      wrap.addEventListener('pointerleave', function () { hover = false; sync(); });
      wrap.addEventListener('focusin', function () { hover = true; sync(); });
      wrap.addEventListener('focusout', function (e) { if (!wrap.contains(e.relatedTarget)) { hover = false; sync(); } });
      show(0); sync();
    });
  }

  /* 슬라이더 값 표시 */
  function wireSliders() {
    document.querySelectorAll('input[type="range"].track32').forEach(function (r) {
      var out = r.parentElement.querySelector('.val');
      function upd() { if (out) out.textContent = r.value; }
      r.addEventListener('input', upd); upd();
    });
  }

  window.renderDirection = function (id) {
    var dir = window.DIRECTIONS.filter(function (d) { return d.id === id; })[0];
    if (!dir) throw new Error('unknown direction ' + id);
    document.title = dir.title;
    renderPrinciple(dir);
    renderRequirements(dir);
    renderFeatures(dir);
    wireTheme(); wireCarousels(); wireSliders();
  };
  window.wireCommon = function () { wireTheme(); wireCarousels(); wireSliders(); };
  window.escHtml = esc;
})();
