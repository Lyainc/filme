/* 프레임별 흐름 전체(frames.js의 flow를 모은 것). 캔버스에선 각 프레임 보드 옆에 이미 있어서 올리지 않아요. */
EV({ id: 'flow-table', page: 'flow', title: '프레임별 흐름 전체', canvas: false, html: function () {
  var rows = [];
  window.FRAMES.forEach(function (f) { f.flow.forEach(function (x) { rows.push(['<a href="#' + f.page + '" data-jump="' + f.id + '">' + f.id + '</a>', PR.esc(x[0]), PR.esc(x[1]), PR.esc(x[2])]); }); });
  return '<h3>프레임별 흐름 전체</h3>' + EV_TBL(['출발', '트리거', '도착', '전환'], rows, ['n']);
} });
