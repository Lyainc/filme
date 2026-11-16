/* 기능 52 · 요구 6 추적. 데이터는 data/trace.js, 여기선 점검 + 표만 그려요.
   요구 6이 한 단위, 기능은 묶음(group)마다 한 단위라 묶음 하나를 고치면 그 보드만 바뀌어요. */
(function () {
  var esc = PR.esc;
  /* 누락(행선지 없는 기능)과 참조 오류(없는 프레임/컴포넌트)를 셉니다. gen-canvas도 이 값으로 생성을 막아요. */
  window.TRACE_CHECK = function () {
    var T = window.TRACE, R = window.REQ_TRACE;
    var fids = window.FRAMES.map(function (f) { return f.id; }), cids = window.COMPONENTS.map(function (c) { return c.id; });
    var bad = []; T.concat(R).forEach(function (t) { t.frames.forEach(function (x) { if (fids.indexOf(x) < 0) bad.push(t.id + '→' + x); }); t.comps.forEach(function (x) { if (cids.indexOf(x) < 0) bad.push(t.id + '→' + x); }); });
    var miss = T.filter(function (t) { return !t.frames.length && t.fate !== '제거'; }).map(function (t) { return t.id; });
    return { features: T.length, reqs: R.length, bad: bad, miss: miss };
  };
  EV({ id: 'trace-req', page: 'trace', title: '이관 요구 6 · 자동 점검', html: function () {
    var T = window.TRACE, R = window.REQ_TRACE, k = window.TRACE_CHECK();
    var cnt = { '유지': 0, '형태 변경': 0, '제거': 0 }; T.forEach(function (t) { cnt[t.fate]++; });
    return '<p class="m-lede">현재 기능 ' + T.length + '개와 #826 이관 요구 ' + R.length + '개가 어느 프레임·컴포넌트로 가는지예요. 유지 ' + cnt['유지'] + ' · 형태 변경 ' + cnt['형태 변경'] + ' · 제거 ' + cnt['제거'] + '. 기능 표는 묶음마다 나뉘고, 각 프레임 옆에도 그 프레임으로 간 기능이 붙어 있어요.</p>' +
      '<p class="m-note' + (k.bad.length || k.miss.length ? ' warn' : '') + '">자동 점검: 행선지 없는 기능 ' + k.miss.length + '개' + (k.miss.length ? '(' + k.miss.join(', ') + ')' : '') + ' · 없는 프레임/컴포넌트 참조 ' + k.bad.length + '개' + (k.bad.length ? '(' + k.bad.join(', ') + ')' : '') + '. 제거 행은 이유와 기능이 옮겨 간 곳을 적어요.</p>' +
      '<h3>이관 요구 6</h3>' + EV_TBL(['요구', '프레임', '컴포넌트', '마스터에서 지키는 방법'], R.map(function (r) { return ['<b>' + esc(r.name) + '</b>', r.frames.join(' · '), r.comps.join(' · '), esc(r.how)]; }), [null, 'n', 'n']);
  } });
  var groups = [];
  window.TRACE.forEach(function (t) { if (groups.indexOf(t.group) < 0) groups.push(t.group); });
  groups.forEach(function (g, n) {
    EV({ id: 'trace-f' + (n + 1), page: 'trace', title: '기능 · ' + g, html: function () {
      var rows = window.TRACE.filter(function (t) { return t.group === g; });
      return '<h3>기능 · ' + esc(g) + ' (' + rows.length + ')</h3>' + EV_TBL(['기능', '지금', '결과', '프레임', '컴포넌트', '마스터 위치', '바꾼 이유'], rows.map(function (t) {
        return ['<b>' + esc(t.name) + '</b><br><code>' + t.id + '</code>', esc(t.now), '<span class="' + (t.fate === '제거' ? 'gone' : t.fate === '형태 변경' ? 'chg' : '') + '">' + t.fate + '</span>', t.frames.join(' · '), t.comps.join(' · '), esc(t.where), esc(t.why)];
      }), [null, null, null, 'n', 'n']);
    } });
  });
})();
