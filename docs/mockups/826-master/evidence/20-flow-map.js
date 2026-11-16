/* 화면 묶음 사이 흐름 지도 + 전환 규칙. 프레임 단위 트리거는 각 프레임 옆 "흐름"에 있어요. */
EV({ id: 'flow-map', page: 'flow', title: '흐름 · 전환 규칙', html: function () {
  var nodes = [
    ['L', '랜딩', 'L-01~03', 20, 40], ['C', '크롭', 'C-01~03', 20, 200], ['E', '편집', 'E-01~06', 260, 40], ['P', '도크 모드', 'D · I · G', 500, 40],
    ['K', '입력 · 키보드', 'K-01~08', 740, 40], ['M', '메뉴', 'M-01~02', 260, 200], ['R', '결과', 'R-01~03', 500, 200], ['S', '공유 페이지', 'S-01', 740, 200]
  ];
  var pos = {}; nodes.forEach(function (n) { pos[n[0]] = n; });
  var edges = [['L', 'E', '카드 · 직접 입력 · 인식'], ['L', 'C', '포스터 업로드'], ['C', 'E', '적용'], ['E', 'P', '모드'], ['P', 'K', '필드'], ['K', 'P', '닫기(복원)'], ['E', 'M', '⋯'], ['M', 'L', '초기화'], ['E', 'R', '완료'], ['R', 'E', '‹'], ['R', 'S', '링크'], ['S', 'L', '나도 만들기'], ['P', 'C', '자르기 · 교체'], ['E', 'L', '‹(보존)']];
  var svg = '<svg class="flowsvg" viewBox="0 0 960 300" role="img" aria-label="화면 흐름 개요"><defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path class="ah" d="M0 0L8 4L0 8z"/></marker></defs>';
  edges.forEach(function (e, n) {
    var a = pos[e[0]], b = pos[e[1]]; var ax = a[3] + 100, ay = a[4] + 30, bx = b[3] + 100, by = b[4] + 30;
    var off = (n % 2 ? 10 : -10);
    var x1 = ax + (bx > ax ? 100 : bx < ax ? -100 : off), y1 = ay + (by > ay ? 30 : by < ay ? -30 : off);
    var x2 = bx + (bx > ax ? -100 : bx < ax ? 100 : off), y2 = by + (by > ay ? -30 : by < ay ? 30 : off);
    if ((e[0] === 'E' && e[1] === 'L') || (e[0] === 'K' && e[1] === 'P') || (e[0] === 'R' && e[1] === 'E')) { y1 += 14; y2 += 14; }
    svg += '<path class="ed" d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '" marker-end="url(#ah)"/><text class="sm" x="' + ((x1 + x2) / 2 + 4) + '" y="' + ((y1 + y2) / 2 - 4) + '">' + e[2] + '</text>';
  });
  nodes.forEach(function (n) { svg += '<rect class="bx' + (n[0] === 'E' ? ' pri' : '') + '" x="' + n[3] + '" y="' + n[4] + '" width="200" height="60" rx="6"/><text x="' + (n[3] + 14) + '" y="' + (n[4] + 27) + '" font-size="15" font-weight="600">' + n[1] + '</text><text class="sm" x="' + (n[3] + 14) + '" y="' + (n[4] + 46) + '">' + n[2] + '</text>'; });
  svg += '</svg>';
  return '<p class="m-lede">화면 묶음 사이의 주 흐름이에요. 프레임 단위 트리거·전환은 각 프레임 옆 "흐름"에 있어요.</p><div class="m-tblw" style="padding:12px">' + svg + '</div>' +
    '<h3>전환 규칙</h3><ul><li>도크 내용 교체(모드·도구 바뀜) 160ms, 입력 패널·화면 전환 240ms, 이징 하나.</li><li>도크 높이는 모드·도구와 상관없이 하나라 무대의 티켓은 입력 패널이 열릴 때만 배율이 바뀌어요.</li><li>동작 줄이기면 전환은 즉시, 키보드 확대는 이동만.</li><li>브라우저 뒤로: 결과 → 편집, 크롭·메뉴 → 닫기, 입력 → 키보드 닫기, 편집 → 랜딩(문서 보존).</li></ul>';
} });
