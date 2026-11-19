/* D13 S3 정보 · 필드 입력 — 남은 결정. D12-input-final.js를 먼저 불러야 해요(D12_CSS · .d12-* 패널 모양을 그대로 빌려요).
   D13-s3-input.html과 tools/gen-canvas.js가 같이 불러요. 정한 것 두 개(2026-11-20)와 결정 대기 두 개를 그려요. */
(function () {
  var W = window, S = W.PR, i = S.i;
  var FONTS = ['자동', '고딕', '바탕', '자람', '잉크', '은영', '붓', '쿨가이', '꽃길'];
  var FF = { '자동': 'inherit', '고딕': 'sans-serif', '바탕': 'serif', '자람': 'cursive', '잉크': 'cursive', '은영': 'fantasy', '붓': 'cursive', '쿨가이': 'monospace', '꽃길': 'fantasy' };
  var FS = { '잉크': 'italic', '꽃길': 'italic' }, FW = { '붓': 700 };
  function fs(x) { return 'font-family:' + FF[x] + ';' + (FS[x] ? 'font-style:' + FS[x] + ';' : '') + (FW[x] ? 'font-weight:' + FW[x] + ';' : ''); }
  var CUR = '바탕', TEXT = '파도 소리가 오래 남았다';
  var CHEV = '<svg class="i d12-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var ROW = 44, PAD = 8, HAIR = 1;
  function panelH(rows) { return HAIR + PAD + rows * ROW + PAD; }
  /* 393 폭에서 [‹ 44][입력][› 44][완료 52], 좌우 12 · 사이 8 셋 → 입력란 폭 */
  var INPUT_W = 393 - 24 - 44 - 44 - 52 - 24;

  var seq = 0;
  /* 첫 줄: 2026-11-20 결정(‹ › 유지 + Return 다음) */
  function row1(o) {
    var id = 'd13i' + (seq++);
    return '<div class="d12-r d13-r1"><button class="d13-nav" aria-label="이전 항목">' + i('back') + '</button>' +
      '<label class="d12-in" for="' + id + '"><input id="' + id + '" class="v' + (o.focus === false ? '' : ' f') + '" placeholder="' + o.ph + '" value="' + (o.value || '') + '" enterkeyhint="next" autocomplete="off" aria-label="' + o.ph + '"></label>' +
      '<button class="d13-nav" aria-label="다음 항목">' + i('next') + '</button><button class="d12-done">완료</button></div>';
  }
  /* 둘째 줄 A: 글꼴 드롭다운(D12 모양, pt 스텝 없이 폭 전체) */
  function rowFontDrop() {
    return '<div class="d12-r"><button class="d12-font" aria-haspopup="listbox" aria-expanded="false" aria-label="글꼴, 지금 ' + CUR + '"><span class="v"><span style="' + fs(CUR) + '">' + CUR + '</span>' + CHEV + '</span></button></div>';
  }
  /* 둘째 줄 B: 서체 칩 9개(K-06 모양, 가로 스크롤) */
  function rowFontChips() {
    return '<div class="d12-r d13-chiprow"><div class="c-acc d13-acc" role="toolbar" aria-label="서체 옵션"><button class="c-opt act">이미지로</button><div role="radiogroup" aria-label="서체" style="display:contents">' +
      FONTS.map(function (x) { return '<button class="c-opt" role="radio" aria-checked="' + (x === CUR) + '" style="' + fs(x) + '">' + x + '</button>'; }).join('') + '</div></div></div>';
  }
  function panel(o, row2) { return '<div class="d12-pn" role="region" aria-label="' + o.ph + ' 입력">' + row1(o) + (row2 || '') + '</div>'; }

  /* 티켓 창: S4 전이라 지금 배율(1.08 리프트)로 그리고, 선택 표시는 재단 L자 · 이름표 없음(D12 · 결정 3-A) */
  function win(WH, sel) {
    var tw = Math.round(393 * 0.62), th = Math.round(tw * 1534 / 960), left = Math.round((393 - tw) / 2), top = WH - th - 16;
    return '<div class="d12-win" style="height:' + WH + 'px;background:var(--pr-stage)"><div class="d12-tkw" style="width:' + tw + 'px;height:' + th + 'px;left:' + left + 'px;top:' + top + 'px">' +
      S.ticket({}) + '<div class="c-sel nolab" style="' + sel + '" aria-hidden="true"></div></div></div>';
  }
  var QSEL = 'left:4.5%;top:87.2%;width:91%;height:5.8%';
  function phone(o, row2, rows) {
    var KB = 330, WH = 852 - 54 - KB - panelH(rows);
    var below = o.list ? '<div class="d12-kbs" style="height:' + KB + 'px">' + lbox(KB) + '</div>' : S.kbd('text');
    return S.phone(win(WH, o.sel || QSEL) + panel(o, row2) + below, { cls: 'd12-ph' });
  }
  function lbox(h) {
    return '<ul class="d12-dd" role="listbox" aria-label="글꼴" style="height:' + h + 'px">' + FONTS.map(function (x) {
      var on = x === CUR; return '<li role="option" aria-selected="' + on + '"><span style="' + fs(x) + '">' + x + '</span>' + (on ? i('check') : '') + '</li>';
    }).join('') + '</ul>';
  }
  /* D12 원안 첫 줄(‹ › 없음) — 확인용 비교 */
  function row1d12(o) {
    var id = 'd13i' + (seq++);
    return '<div class="d12-r"><label class="d12-in" for="' + id + '"><input id="' + id + '" class="v f" placeholder="' + o.ph + '" value="' + (o.value || '') + '" enterkeyhint="next" autocomplete="off" aria-label="' + o.ph + '"></label><button class="d12-done">완료</button></div>';
  }
  var SEAT = 'left:68%;top:82.2%;width:20%;height:6.4%';
  function phoneRow(r1, o) {
    var KB = 330, WH = 852 - 54 - KB - panelH(1);
    return S.phone(win(WH, SEAT) + '<div class="d12-pn" role="region" aria-label="' + o.ph + ' 입력">' + r1 + '</div>' + S.kbd('text'), { cls: 'd12-ph' });
  }
  /* 지금 main: 티켓 위 투명 입력(강조 옅은 채움) + 떠 있는 필드 편집 도구 + 키보드 위 떠 있는 aid 카드 */
  function phoneNow() {
    var KB = 330, WH = 852 - 54 - KB;
    var tw = Math.round(393 * 0.62), th = Math.round(tw * 1534 / 960), left = Math.round((393 - tw) / 2), top = 8; /* 지금 리프트: 고른 필드가 카드 위로 올라와요 */
    var bar = '<div class="d13-bar" role="toolbar" aria-label="필드 편집 도구" style="left:72%;top:81%"><button aria-label="이전 항목">' + i('back') + '</button><button aria-label="티켓 노출">' + i('eye') + '</button><button aria-label="다음 항목">' + i('next') + '</button><button class="ok" aria-label="편집 완료">' + i('check') + '</button></div>';
    var hl = '<div class="d13-hl" style="' + SEAT + '" aria-hidden="true"></div>';
    var aid = '<div class="d13-aid" style="bottom:' + (KB + 12) + 'px"><span>KOBIS 결과 · 날짜 · 평점이 뜨는 자리(좌석은 비어 있음)</span></div>';
    return S.phone('<div class="d12-win" style="height:' + WH + 'px;background:var(--pr-stage);overflow:visible"><div class="d12-tkw" style="width:' + tw + 'px;height:' + th + 'px;left:' + left + 'px;top:' + top + 'px">' + S.ticket({}) + hl + bar + '</div></div>' + aid + S.kbd('text'), { cls: 'd12-ph d13-rel' });
  }
  /* S3: 같은 자리(키보드 위 12px, 지금 측정값)에 D12 패널. 키보드에 붙이는 건 S4 */
  function phoneS3() {
    var KB = 330, GAP = 12, WH = 852 - 54 - KB - GAP - panelH(2);
    return S.phone(win(WH, SEAT) + '<div class="d12-pn" role="region" aria-label="좌석 입력">' + row1({ ph: '좌석', value: 'H12' }) +
      '<div class="d12-r"><div class="c-acc d13-acc" role="toolbar" aria-label="표시 옵션"><div role="radiogroup" aria-label="표시" style="display:contents"><button class="c-opt" role="radio" aria-checked="true">티켓에 표시</button><button class="c-opt" role="radio" aria-checked="false">숨김</button></div></div></div></div>' +
      '<div class="d13-gap" style="height:' + GAP + 'px"><span>12</span></div>' + S.kbd('text'), { cls: 'd12-ph' });
  }
  function fig(cap, html, cls) { return '<figure class="d12-fig ' + (cls || '') + '"><figcaption>' + cap + '</figcaption>' + html + '</figure>'; }
  function lst(t, a) { return '<div class="d12-b"><h3>' + t + '</h3><ul>' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>'; }
  function opt(key, title, sum, body, pros, cons, rec) {
    return '<div class="d12-o' + (rec ? ' rec' : '') + '"><h2><span class="k">' + key + '</span>' + title + (rec ? ' <span class="d12-rec">' + (rec === true ? '추천' : rec) + '</span>' : '') + '</h2>' +
      '<p class="d12-sum">' + sum + '</p>' + (body || '') +
      '<div class="d12-bs">' + lst('좋은 점', pros) + lst('대가', cons) + '</div></div>';
  }

  /* hit 44 그림: 프리뷰 219×350 티켓을 2배로. 필드 상자는 마스터 자리표시 티켓의 자리에서 어림한 크기예요(실측은 measure-field-taps). */
  function hitSvg(mode) {
    var K = 2, TW = 219 * K, TH = 350 * K, X0 = 24, Y0 = 16;
    var F = [
      ['제목', 13, 222, 110, 16], ['관람일', 13, 266, 30, 8], ['시간', 88, 266, 22, 8], ['상영관', 153, 266, 18, 8],
      ['극장', 13, 297, 70, 8], ['좌석', 153, 297, 16, 8], ['예매 번호', 13, 328, 60, 6]
    ];
    var s = '<svg class="d13-hit" viewBox="0 0 ' + (TW + 48 + 300) + ' ' + (TH + 32) + '" role="img" aria-label="' + (mode === 'a' ? '필드 중심 44×44 안에서 가장 가까운 필드를 여는 그림' : '필드 글자 상자만 받는 지금 상태 그림') + '">';
    s += '<rect x="' + X0 + '" y="' + Y0 + '" width="' + TW + '" height="' + TH + '" rx="8" class="tk"/>';
    s += '<rect x="' + X0 + '" y="' + Y0 + '" width="' + TW + '" height="' + Math.round(TH * 0.61) + '" class="po"/>';
    F.forEach(function (f) {
      var x = X0 + f[1] * K, y = Y0 + f[2] * K, w = f[3] * K, h = f[4] * K, cx = x + w / 2, cy = y + h / 2;
      if (mode === 'a') s += '<rect x="' + (cx - 44) + '" y="' + (cy - 44) + '" width="88" height="88" class="hit"/>';
      s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" class="fd"/>';
      s += '<text x="' + x + '" y="' + (y - 4) + '" class="lb">' + f[0] + ' ' + f[3] + '×' + f[4] + '</text>';
    });
    /* 누른 점: 관람일과 극장 사이 빈 곳(두 44 상자가 겹치는 자리) */
    var px = X0 + 40 * K, py = Y0 + 286 * K;
    s += '<circle cx="' + px + '" cy="' + py + '" r="7" class="tap"/>';
    var NX = X0 + TW + 28;
    if (mode === 'a') {
      var tx = X0 + 48 * K, ty = Y0 + 297 * K;
      s += '<path d="M' + px + ' ' + py + 'L' + tx + ' ' + (ty - 2) + '" class="ar"/>';
      s += '<text x="' + NX + '" y="' + (py - 20) + '" class="nt">● 누른 점: 글자 상자 밖</text>';
      s += '<text x="' + NX + '" y="' + (py + 2) + '" class="nt">이 점을 품는 44 상자: 관람일 · 극장</text>';
      s += '<text x="' + NX + '" y="' + (py + 24) + '" class="nt">중심이 더 가까운 극장이 열려요(17 대 20px)</text>';
      s += '<text x="' + NX + '" y="' + (py + 46) + '" class="nt">틀리면 ‹ › 나 정보 목록으로 복구</text>';
    } else {
      s += '<text x="' + NX + '" y="' + (py - 10) + '" class="nt">● 누른 점: 글자 상자 밖</text>';
      s += '<text x="' + NX + '" y="' + (py + 12) + '" class="nt">아무 필드도 안 열려요(지금 그대로)</text>';
      s += '<text x="' + NX + '" y="' + (py + 34) + '" class="nt">좌석 · 상영관은 8px 안팎</text>';
    }
    s += '<text x="' + X0 + '" y="' + (Y0 + TH + 14) + '" class="cap">프리뷰 219×350을 2배로 · 상자 크기는 어림</text>';
    return s + '</svg>';
  }

  W.D13_HTML = function () {
    seq = 0;
    var Q = { ph: '한줄평', value: TEXT };
    var h = '<div class="d12 d13">';
    h += '<p class="d12-q0">#826 S3 착수 전 · 결정 D13</p><h1>S3 정보 · 필드 입력 · 남은 결정</h1>' +
      '<p class="d12-lede">S3 Seed를 쓰기 전에, 마스터 프레임(K-01~K-07)과 D12 최종안이 서로 다르게 정한 곳과 원본이 정하지 않은 곳을 모았어요. 위 두 개는 2026-11-20에 정했고, 아래 D13-1 · D13-2가 결정 대기예요.</p>';
    h += '<section class="d12-rules"><h2>정한 것</h2>' +
      lst('이전 · 다음 (2026-11-20)', ['입력 패널 첫 줄을 <b>[‹] [입력] [›] [완료]</b>로 두고, 키보드 Return도 다음 항목이에요.', '근거: 요구 5 "오탭이면 정보 목록과 입력 머리의 이전/다음으로 복구". D12의 "‹ › 없음"을 이 부분만 되돌려요.', '대가: 입력란 폭이 D12의 약 309px에서 약 <b>' + INPUT_W + 'px</b>로 줄어요.']) +
      lst('패널 자리 (2026-11-20)', ['S3 동안 패널은 지금 KOBIS 결과가 뜨는 키보드 위 자리(기존 visualViewport 측정값 그대로)에 놓여요.', '티켓 위 투명 입력과 떠 있는 필드 편집 도구(둥근 막대)는 걷어요.', '키보드에 붙이기 · 1.18배 확대 · 닫기 네 경로는 지금 동작 그대로 두고 S4가 바꿔요.']) +
      lst('원본이 이미 정한 것', ['오른쪽 끝은 "완료"(D12, 프레임의 "닫기"를 대신).', '입력 중 선택 표시는 재단 L자, 이름표 없음(D12 · 결정 3-A).', '표시/숨김 · 표기 · 정밀도 · 재개봉 · 이미지로는 둘째 줄 칩(K-02 · K-04 · K-07). 평점은 별 44 + 숫자를 누르면 키패드(K-05).', 'KOBIS 문구: 검색 중… · 검색 결과가 없어요 · 검색에 실패했어요 + 다시 검색(문구 변경 표).']) +
      lst('S3 밖', ['pt 크기 조절(티켓 렌더 변경, 별도 Seed).', '키보드 위 붙임 · visualViewport 새 측정 · 확대 · 종료 경로(S4).', '무드 렌더(moods · _shared.tsx)는 0줄 변경.']) +
      '</section>';

    h += '<section class="d13-q"><h2><span class="k">정함 ①</span>이전 · 다음 — ‹ › 유지 + Return 다음 <span class="d13-ok">2026-11-20 결정 · 확인용</span></h2>' +
      '<p class="d12-fam">좌석 입력 한 줄짜리로 D12 원안과 정한 안을 나란히 놓았어요. 다른 건 첫 줄의 ‹ › 두 개와 입력란 폭뿐이에요.</p>' +
      '<div class="d12-opts d13-opts">' +
      opt('원안', 'D12 그대로', '[입력] [완료]. Return = 다음, 이전은 티켓 필드를 직접 눌러요.',
        '<div class="d12-row">' + fig('D12 · 입력란 약 309px', phoneRow(row1d12({ ph: '좌석', value: 'H12' }), { ph: '좌석' })) + '</div>',
        ['입력란이 넓어요.'], ['이전 항목으로 한 번에 못 가요. 요구 5 "입력 머리의 이전/다음"과 어긋나요.'], false) +
      opt('정함', '‹ › 유지 + Return 다음', '[‹] [입력] [›] [완료]. Return도 다음 항목, 마지막 필드에서는 Return이 완료예요.',
        '<div class="d12-row">' + fig('S3 · 입력란 약 ' + INPUT_W + 'px', phoneRow(row1({ ph: '좌석', value: 'H12' }), { ph: '좌석' })) + '</div>',
        ['요구 5와 착수 조건 (3)을 글자 그대로 채워요.', '‹ › 순서는 지금처럼 그 무드가 그리는 필드만 돌아요(EDIT_ORDER).'], ['입력란이 약 ' + INPUT_W + 'px로 줄어요. 한줄평처럼 긴 글은 보이는 글자가 줄어요.'], '정함') +
      '</div></section>';
    h += '<section class="d13-q"><h2><span class="k">정함 ②</span>패널 자리 — 지금 aid 자리 재사용 <span class="d13-ok">2026-11-20 결정 · 확인용</span></h2>' +
      '<p class="d12-fam">왼쪽이 지금 main, 오른쪽이 S3예요. 키보드 위 자리와 그 높이를 재는 방식은 그대로 두고, 그 안의 내용만 D12 패널로 바꿔요. 패널을 키보드에 딱 붙이고(지금은 12px 띄움) 티켓을 1.18배로 키우는 건 S4예요.</p>' +
      '<div class="d12-opts d13-opts">' +
      opt('지금', 'main(S2 뒤)', '티켓 위에 투명 입력과 옅은 강조 채움, 필드 옆에 떠 있는 둥근 도구 막대, 키보드 위에 떠 있는 카드(KOBIS · 날짜 · 평점 때만).',
        '<div class="d12-row">' + fig('지금 · 좌석 편집 중', phoneNow()) + '</div>',
        ['—'], ['입력 글자가 티켓 글꼴 크기라 작고, 도구 막대가 티켓을 가려요.', '둥근 막대(pill)와 그림자는 #826 금지 목록이에요.'], false) +
      opt('정함', 'S3 · 같은 자리에 D12 패널', '투명 입력 · 떠 있는 막대 · 카드를 걷고, 키보드 위 12px 자리에 패널 한 면(윗선 한 줄, 그림자 없음)을 둬요. 티켓에는 재단 L자만 남아요.',
        '<div class="d12-row">' + fig('S3 · 좌석 편집 중', phoneS3()) + '</div>',
        ['입력이 16px 패널로 옮겨 가 요구 3을 채워요.', '키보드 처리는 지금 코드 그대로라 S4 전에도 실기기에서 가려지지 않아요.', 'pill · 그라데이션 완료 버튼이 빠져요.'],
        ['S4 전까지는 패널과 키보드 사이 12px 틈 · 지금 배율(1.08) · 지금 닫기 경로가 남아요.'], '정함') +
      '</div></section>';

    h += '<section class="d13-q"><h2><span class="k">D13-1</span>한줄평 · 서명 서체 9종을 어떤 모양으로 고를까요?</h2>' +
      '<p class="d12-fam">착수 조건과 프레임 K-06은 서체를 "칩"으로 적었고, D04 결정 · D12 · S2 constraint-6은 글꼴 드롭다운이에요. 지금 main 코드는 드롭다운이에요. pt 스텝은 어느 쪽이든 넣지 않아요.</p>' +
      '<div class="d12-opts d13-opts">' +
      opt('A', '글꼴 드롭다운', '둘째 줄에 글꼴 버튼 하나(현재 글꼴 이름을 그 서체로). 누르면 키보드 자리에 목록이 열려요.',
        '<div class="d12-row">' + fig('A · 입력 중', phone(Q, rowFontDrop(), 2)) + fig('A · 목록 열림', phone({ ph: '한줄평', value: TEXT, focus: false, list: true }, rowFontDrop(), 2)) + '</div>',
        ['D04 결정과 지금 구현 그대로라 옮기기만 하면 돼요.', '9종 이름을 한 화면에 각자 서체로 비교해요(목록 7.5줄).', '둘째 줄이 날짜 · 표시 칩과 섞이지 않아요.'],
        ['한 번 더 눌러야 바꿔요(버튼 → 목록 → 항목).', '착수 조건의 "서체 칩"을 이 버튼이 맡는다고 Seed에 적어야 해요.'], true) +
      opt('B', '서체 칩 한 줄', '둘째 줄에 칩 9개를 각자 서체로 그리고 가로로 스크롤해요. 맨 앞은 "이미지로"(서명만).',
        '<div class="d12-row">' + fig('B · 입력 중', phone(Q, rowFontChips(), 2)) + '</div>',
        ['한 번에 바꿔요. 날짜 표기 칩과 같은 모양이라 규칙이 하나예요.', '프레임 K-06 그대로예요.'],
        ['393 폭에 칩이 4~5개만 보이고 나머지는 스크롤에 숨어요.', 'D04 결정을 뒤집고, 지금 드롭다운 구현과 테스트(inPlaceFontPicker)를 갈아야 해요.'], false) +
      '</div></section>';

    h += '<section class="d13-q"><h2><span class="k">D13-2</span>티켓 필드 hit area 44를 어떻게 만들까요?</h2>' +
      '<p class="d12-fam">프리뷰가 219×350이라 티켓이 원래의 약 0.23배예요. 좌석 · 상영관처럼 작은 필드는 화면에서 8px 안팎이고, 44 상자를 그리면 위아래 줄끼리 겹쳐요. 필드 탭은 무드 렌더(_shared.tsx의 FieldTap)가 붙이는데, 그 코드는 S3에서 고치지 않아요.</p>' +
      '<div class="d12-opts d13-opts">' +
      opt('A', '셸에서 가까운 필드로 위임', '글자 상자 안을 누르면 지금처럼 그 필드. 밖을 누르면, 누른 점을 중심 44×44 안에 품는 필드 중 중심이 가장 가까운 필드를 열어요.',
        '<div class="d13-svgbox">' + hitSvg('a') + '</div>',
        ['요구 5의 44를 S3에서 채워요.', '셸의 탭 처리 한 곳만 바뀌고 무드 렌더 · 저장물은 0줄이에요.', '오탭은 ‹ › 와 정보 목록이 받아요(요구 5가 전제한 복구).'],
        ['겹치는 자리에서는 손가락이 가리킨 것과 다른 필드가 열릴 수 있어요.', '포스터 없는 문서의 "포스터 추가" 탭(빈 곳 탭)과 영역이 겹쳐서, 44 안이면 필드가 먼저예요.'], true) +
      opt('B', '재기만 하고 뒤로 미룸', 'measure-field-taps로 지금 크기 · 간격만 기록하고 hit 확장은 하지 않아요.',
        '<div class="d13-svgbox">' + hitSvg('b') + '</div>',
        ['동작이 바뀌지 않아요.'],
        ['요구 5의 hit 44가 S3에서 미충족으로 남고, 완료 조건 (2)도 못 채워요.', '작은 필드는 정보 목록으로만 열기 쉬워요.'], false) +
      '</div></section>';
    h += '<section class="d12-memo"><h2>답하는 법</h2><ul><li>대화창에 "D13-1 A, D13-2 A"처럼 적어 주세요. 결정이 나면 이 보드 제목에 결과를 적고 지우지 않아요.</li>' +
      '<li>두 답이 오면 S3 Seed 초안에 그대로 옮기고, Seed 승인 전에는 src를 고치지 않아요.</li></ul></section>';
    return h + '</div>';
  };
  W.D13_CSS = (W.D12_CSS || '') +
    '.d13 { padding: 32px 40px 56px; }' +
    '.d13 .d12-rules { grid-template-columns: repeat(4, minmax(0, 1fr)); }' +
    '.d13-q { margin-bottom: 48px; } .d13-q > h2 { margin-bottom: 6px; } .d13-q > .d12-fam { max-width: 110ch; margin-bottom: 16px; }' +
    '.d13-opts { gap: 32px; } .d13-opts .d12-o { padding: 24px; } .d13-opts .d12-o.rec { padding: 23px; }' +
    '.d13-opts .d12-row { margin: 8px 0 16px; flex-wrap: nowrap; }' +
    '.d13-r1 { gap: 4px; } .d13-r1 .d12-in { margin: 0 4px; }' +
    '.d13-nav { flex: none; width: 44px; height: 44px; padding: 0; border: 0; background: transparent; color: var(--pr-ink); display: inline-flex; align-items: center; justify-content: center; }' +
    '.d13-chiprow { padding-right: 0; } .d13-acc { margin: 0; flex: 1; min-width: 0; flex-wrap: nowrap; overflow: hidden; }' +
    '.d13-svgbox { background: var(--pr-s2); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 12px; margin: 8px 0 16px; }' +
    '.d13-hit { width: 100%; height: auto; display: block; font-family: var(--pr-font); }' +
    '.d13-hit .tk { fill: var(--pr-l-s1); stroke: var(--pr-hair-strong); } .d13-hit .po { fill: var(--pr-hair); }' +
    '.d13-hit .fd { fill: none; stroke: var(--pr-ink); stroke-width: 1.5; }' +
    '.d13-hit .hit { fill: color-mix(in srgb, var(--pr-accent) 8%, transparent); stroke: var(--pr-accent); stroke-width: 1.5; stroke-dasharray: 4 3; }' +
    '.d13-hit .lb { font-size: 11px; fill: var(--pr-ink-2); } .d13-hit .cap { font-size: 12px; fill: var(--pr-ink-3); }' +
    '.d13-hit .tap { fill: var(--pr-ink); } .d13-hit .ar { stroke: var(--pr-ink); stroke-width: 2; fill: none; }' +
    '.d13-hit .nt { font-size: 15px; fill: var(--pr-ink); }' +
    '.d13-ok { font-size: 12px; font-weight: 600; line-height: 18px; padding: 0 6px; border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-tag); color: var(--pr-ink-2); }' +
    '.d13-rel .ph, .d13-rel { position: relative; }' +
    '.d13-hl { position: absolute; background: color-mix(in srgb, var(--pr-accent) 18%, transparent); border-radius: 3px; }' +
    '.d13-bar { position: absolute; display: flex; align-items: center; gap: 0; padding: 0 2px; background: var(--pr-s2); border: 1px solid var(--pr-hair); border-radius: 999px; box-shadow: 0 8px 20px -8px rgba(0,0,0,.4); transform: translate(-50%, -100%); z-index: 3; }' +
    '.d13-bar button { width: 30px; height: 30px; padding: 0; border: 0; background: transparent; color: var(--pr-ink-2); display: inline-flex; align-items: center; justify-content: center; }' +
    '.d13-bar button .i { width: 14px; height: 14px; } .d13-bar .ok { background: var(--pr-accent); color: var(--pr-accent-ink); border-radius: 999px; }' +
    '.d13-aid { position: absolute; left: 12px; right: 12px; height: 64px; display: flex; align-items: center; justify-content: center; text-align: center; padding: 0 12px; font-size: 12px; line-height: 17px; color: var(--pr-ink-3); background: var(--pr-s2); border: 1px dashed var(--pr-hair-strong); border-radius: 12px; z-index: 4; }' +
    '.d13-gap { flex: none; position: relative; background: var(--pr-stage); } .d13-gap span { position: absolute; left: 8px; top: -1px; font-size: 10px; line-height: 12px; color: var(--pr-accent); font-variant-numeric: tabular-nums; }';
})();
