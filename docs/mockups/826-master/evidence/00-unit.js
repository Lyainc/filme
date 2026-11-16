/* 근거 단위 등록. 단위 하나 = 이 폴더의 파일 하나 = 캔버스 "근거" 페이지의 보드 하나.
   마스터(render.js)와 캔버스 생성기(tools/gen-canvas.js)가 같은 html()을 불러 그려요. 한 단위를 고치면 그 보드만 다시 올리면 돼요.
   필드: id(보드 파일 이름) · page(마스터에서 붙는 페이지) · title · html() · canvas:false(캔버스에 안 올림: 프레임 보드 옆 주석이나 읽는 법과 겹치는 것). */
(function () {
  var W = window;
  W.EVIDENCE = [];
  W.EV = function (u) { W.EVIDENCE.push(u); };
  /* 표 하나. rows의 칸은 이미 이스케이프된 HTML이에요. cls는 칸별 td 클래스(예: 'n'). */
  W.EV_TBL = function (heads, rows, cls) {
    cls = cls || [];
    return '<div class="m-tblw"><table class="m-tbl"><thead><tr>' + heads.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return r.g ? '<tr class="g"><td colspan="' + heads.length + '">' + r.g + '</td></tr>' : '<tr>' + r.map(function (c, n) { return '<td' + (cls[n] ? ' class="' + cls[n] + '"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div>';
  };
  /* "L-01~L-03 · E-02"나 "K-01~04" 같은 프레임 표기를 id 목록으로 펼쳐요. */
  W.EV_FRAMES = function (s) {
    var out = [];
    String(s).split(/\s*[·→,]\s*/).forEach(function (p) {
      var m = p.match(/^([A-Z])-(\d\d)(?:~(?:[A-Z]-)?(\d\d))?/);
      if (!m) return;
      var a = +m[2], b = m[3] ? +m[3] : a;
      for (var k = a; k <= b; k++) out.push(m[1] + '-' + (k < 10 ? '0' : '') + k);
    });
    return out;
  };
  /* 프레임 옆 주석: 그 프레임에 걸린 문구 변경과 기능·요구 추적 행. 마스터의 프레임 사양과 캔버스 프레임 보드가 같이 써요. */
  W.EV_FRAME_NOTES = function (fid) {
    var esc = W.PR.esc, has = function (s) { return W.EV_FRAMES(s).indexOf(fid) >= 0; };
    var copy = (W.COPY_LOCKED || []).filter(function (r) { return r[1] !== '그대로' && has(r[2]); }).map(function (r) { return esc(r[0]) + ' → ' + r[1].replace(/<[^>]+>/g, '').split('. 영향')[0]; })
      .concat((W.COPY_CHANGES || []).filter(function (r) { return has(r[3]); }).map(function (r) { return esc(r[1]) + ' → <b>' + esc(r[2]) + '</b>' + (r[4] === '예' ? ' (테스트 잠김)' : ''); }));
    var trace = (W.REQ_TRACE || []).concat(W.TRACE || []).filter(function (t) { return t.frames.indexOf(fid) >= 0; }).map(function (t) { return esc(t.name) + (t.fate && t.fate !== '유지' ? ' (' + t.fate + ')' : ''); });
    return { copy: copy, trace: trace };
  };
})();
