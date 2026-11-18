/* D12 필드 입력 최종안(키보드 위 입력 패널). D10 B′와 N을 대신해요. D12-input-final.html과 tools/gen-canvas.js가 같이 불러요.
   고르는 안이 아니라 확정 스펙으로 그려요. 라이트가 기본이고 한줄평 입력 중만 다크도 그려요. */
(function () {
  var W = window, S = W.PR, i = S.i;
  var FONTS = ['자동', '고딕', '바탕', '자람', '잉크', '은영', '붓', '쿨가이', '꽃길'];
  /* 실제 티켓 폰트는 이 페이지에 없어서 비슷한 결의 기본 서체로 대신 그려요 */
  var FF = { '자동': 'inherit', '고딕': 'sans-serif', '바탕': 'serif', '자람': 'cursive', '잉크': 'cursive', '은영': 'fantasy', '붓': 'cursive', '쿨가이': 'monospace', '꽃길': 'fantasy' };
  var FS = { '잉크': 'italic', '꽃길': 'italic' }, FW = { '붓': 700 };
  function fs(x) { return 'font-family:' + FF[x] + ';' + (FS[x] ? 'font-style:' + FS[x] + ';' : '') + (FW[x] ? 'font-weight:' + FW[x] + ';' : ''); }
  var CUR = '바탕', PT_MIN = 2, PT_MAX = 6, TEXT = '파도 소리가 오래 남았다';
  var CHEV = '<svg class="i d12-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  /* 치수: 줄 44(누르는 높이), 보이는 컨트롤 36, 패널 = 윗선 1 + 위 8 + 줄 + 아래 8 */
  var ROW = 44, PAD = 8, HAIR = 1;
  function panelH(rows) { return HAIR + PAD + rows * ROW + PAD; }
  var ZOOM = 1.2;
  var FIELD = { quote: { fc: 0.901, sel: 'left:4.5%;top:87.2%;width:91%;height:5.8%' }, seat: { fc: 0.854 } };

  var seq = 0;
  function row1(o) {
    var id = 'd12i' + (seq++);
    return '<div class="d12-r"><label class="d12-in" for="' + id + '"><input id="' + id + '" class="v' + (o.focus === false ? '' : ' f') + '" placeholder="' + o.ph + '" value="' + (o.value || '') + '" enterkeyhint="next" autocomplete="off" aria-label="' + o.ph + '"></label><button class="d12-done' + (o.ringDone ? ' ring' : '') + '">완료</button></div>';
  }
  function fontBtn(o) {
    return '<button class="d12-font' + (o.open ? ' open' : '') + '" aria-haspopup="listbox" aria-expanded="' + !!o.open + '" aria-label="글꼴, 지금 ' + CUR + '"><span class="v' + (o.ring ? ' ring' : '') + '"><span style="' + fs(CUR) + '">' + CUR + '</span>' + CHEV + '</span></button>';
  }
  function step(v, ring) {
    return '<div class="d12-step" role="group" aria-label="글자 크기"><span class="v"><button tabindex="-1" aria-label="0.5pt 줄이기"' + (v <= PT_MIN ? ' disabled' : '') + '>−</button>' +
      '<span class="val' + (ring ? ' ring' : '') + '" role="spinbutton" tabindex="0" aria-label="글자 크기" aria-valuenow="' + v + '" aria-valuemin="' + PT_MIN + '" aria-valuemax="' + PT_MAX + '" aria-valuetext="' + v.toFixed(1) + 'pt">' + v.toFixed(1) + 'pt</span>' +
      '<button tabindex="-1" aria-label="0.5pt 키우기"' + (v >= PT_MAX ? ' disabled' : '') + '>+</button></span></div>';
  }
  function row2(o) { return '<div class="d12-r">' + fontBtn(o) + step(o.pt || 4.5, o.ringStep) + '</div>'; }
  /* 패널 한 장. o: {ph, value, two, open, pt, ring, ringStep, ringDone} */
  function panel(o) { return '<div class="d12-pn" role="region" aria-label="' + o.ph + ' 입력">' + row1(o) + (o.two ? row2(o) : '') + '</div>'; }

  function lbox(h) {
    return '<ul class="d12-dd" role="listbox" aria-label="글꼴" style="height:' + h + 'px">' + FONTS.map(function (x) {
      var on = x === CUR; return '<li role="option" aria-selected="' + on + '"><span style="' + fs(x) + '">' + x + '</span>' + (on ? i('check') : '') + '</li>';
    }).join('') + '</ul>';
  }
  /* 티켓 창: 1.2배 확대, 고른 필드가 패널 바로 위에 와요. 글꼴과 크기를 바꾸면 티켓이 바로 따라가요 */
  function win(WW, WH, field, o) {
    o = o || {};
    var tw = Math.round(WW * 0.82), th = tw * 1534 / 960, f = FIELD[field], top = Math.round((WH - 30) - f.fc * th), left = Math.round((WW - tw) / 2);
    var inner = S.ticket({});
    if (field === 'quote') {
      inner += o.empty ? '<div class="d12-gh" aria-hidden="true"></div>' : '<div class="d12-q" style="' + fs(CUR) + '">' + TEXT + '<i class="d12-caret"></i></div>';
      inner += '<div class="c-sel nolab" style="' + f.sel + '" aria-hidden="true"></div>';
    } else inner += S.sel('seat', { nolab: true });
    return '<div class="d12-win" style="height:' + WH + 'px"><div class="d12-tkw" style="width:' + tw + 'px;height:' + Math.round(th) + 'px;left:' + left + 'px;top:' + top + 'px;transform:scale(' + ZOOM + ');transform-origin:50% ' + (f.fc * 100) + '%">' + inner + '</div></div>';
  }
  /* 폰. o: {field, kb:'key'|'list', two, se, ...패널 옵션} */
  function phone(o) {
    var FHt = o.se ? 667 : 852, SB = o.se ? 44 : 54, KB = o.se ? 260 : 330, rows = o.two ? 2 : 1;
    var WH = FHt - SB - KB - panelH(rows), WW = o.se ? 375 : 393;
    var below = o.kb === 'list' ? '<div class="d12-kbs" style="height:' + KB + 'px">' + lbox(KB) + '</div>' : S.kbd('text');
    var html = S.phone(win(WW, WH, o.field, o) + panel(o) + below, { cls: 'd12-ph' + (o.se ? ' d12-se' : '') });
    return html;
  }
  W.D12_SIZE = function (se, two) { var FHt = se ? 667 : 852, SB = se ? 44 : 54, KB = se ? 260 : 330; return FHt - SB - KB - panelH(two ? 2 : 1); };
  function fig(cap, html, cls) { return '<figure class="d12-fig ' + (cls || '') + '"><figcaption>' + cap + '</figcaption>' + html + '</figure>'; }
  function sc(cap, html) { return '<figure class="d12-sc"><div class="d12-box">' + html + '</div><figcaption>' + cap + '</figcaption></figure>'; }
  function lst(t, a) { return '<div class="d12-b"><h3>' + t + '</h3><ul>' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>'; }
  var Q = { ph: '한줄평', value: TEXT, field: 'quote', two: true };

  W.D12_HTML = function () {
    seq = 0;
    var h = '<div class="d12">';
    h += '<p class="d12-q0">#826 S2 착수 전 · 결정 D12 (D10 최종안)</p><h1>필드 입력 패널</h1>' +
      '<p class="d12-lede">키보드 바로 위에 붙는 입력 패널의 최종 스펙이에요. 한 줄(옵션 없는 필드)과 두 줄(글꼴 · 크기가 있는 한줄평 · 서명)만 있고, 티켓은 남은 높이를 모두 써요. 크기 조절(pt)은 티켓 렌더 변경이라 S2 밖 별도 Seed예요.</p>';
    h += '<section class="d12-rules"><h2>정한 것</h2>' +
      lst('높이 예산', ['393 × 852에서 상태 막대 54, 키보드와 제안 줄 약 330을 빼면 입력 패널 두 줄은 <b>' + panelH(2) + 'px</b>, 한 줄은 <b>' + panelH(1) + 'px</b>이에요.', '티켓 창은 두 줄이면 <b>' + W.D12_SIZE(false, true) + 'px</b>, 한 줄이면 <b>' + W.D12_SIZE(false, false) + 'px</b>예요.', '375 × 667(SE)은 상태 막대 44, 키보드 약 260이라 티켓 창이 두 줄 <b>' + W.D12_SIZE(true, true) + 'px</b>, 한 줄 <b>' + W.D12_SIZE(true, false) + 'px</b>예요.']) +
      lst('줄 구성', ['첫째 줄은 입력란(남는 폭, 글자 16px, 안내 글자는 필드 이름)과 “완료”예요. 이름 줄은 따로 없어요. 이름은 입력란 안내 글자와 티켓의 선택 표시(재단 L자, 입력 중에는 작은 이름표 없음)가 맡아요.', '둘째 줄은 옵션이 있는 필드에만 있어요(한줄평 · 서명: 글꼴 드롭다운과 − 4.5pt +). pt 값이 스스로 단위를 말해서 “크기” 이름표는 없어요.']) +
      lst('‹ › 는 두지 않아요', ['키보드 Return이 “다음”이에요(enterkeyhint=next). 마지막 필드는 “완료”로 바뀌어요. 모든 필드에 같은 규칙이에요.', '이전 항목으로 가려면 확대된 티켓에서 그 필드를 바로 눌러요.', '이유: 입력란 폭을 약 309px로 지키고, 컨트롤을 한 묶음 줄이고, 필드마다 규칙이 갈리지 않아요. 대가는 이전 항목으로 한 번에 가지 못한다는 점이에요.']) +
      lst('모양', ['한 면(--pr-s1)이 키보드에 붙고 윗선 한 줄만 있어요. 카드도 그림자도 없어요.', '누르는 높이 44, 보이는 컨트롤 36이에요. 묶음 사이는 선이 아니라 8px 간격이에요.', '강조색은 입력란 포커스 테두리에만 써요.', '날짜 · 평점 · 로고처럼 글자가 아닌 필드는 S3 범위라 여기서는 그리지 않아요.']) +
      '</section>';
    h += '<section class="d12-sc0"><div class="d12-row">' +
      fig('한줄평 입력 중 · 두 줄', phone(Q)) +
      fig('글꼴 목록 · 키보드 자리에 열려요', phone({ ph: '한줄평', value: TEXT, field: 'quote', two: true, kb: 'list', open: true, focus: false })) +
      fig('좌석 입력 · 한 줄', phone({ ph: '좌석', value: 'H12', field: 'seat' })) +
      fig('한줄평 입력 중 · 다크', phone(Q), 'd12-dk') + '</div></section>';
    h += '<section class="d12-sc0"><div class="d12-row d12-row2">' +
      fig('375 × 667(SE) · 티켓 창 ' + W.D12_SIZE(true, true) + 'px', phone({ ph: '한줄평', value: TEXT, field: 'quote', two: true, se: true })) +
      '<div class="d12-side"><h2>치수 표</h2><table class="d12-t"><thead><tr><th>부분</th><th>치수</th><th>쓰는 토큰</th></tr></thead><tbody>' +
      '<tr><td>패널 전체</td><td>두 줄 ' + panelH(2) + 'px · 한 줄 ' + panelH(1) + 'px(윗선 1 + 위 8 + 줄 44씩 + 아래 8)</td><td>--pr-s1 · --pr-hair-strong</td></tr>' +
      '<tr><td>안쪽 여백 · 간격</td><td>좌우 12, 한 줄 안 컨트롤 사이 8, 줄 사이 0</td><td>--pr-s-3 · --pr-s-2</td></tr>' +
      '<tr><td>입력란</td><td>누르는 높이 44 · 보이는 36 · 글자 16px · 모서리 6 · 폭 약 309px</td><td>--pr-s2 · --pr-hair-strong · --pr-r-ctl</td></tr>' +
      '<tr><td>입력란 포커스</td><td>테두리 2px</td><td>--pr-accent</td></tr>' +
      '<tr><td>완료</td><td>글자 버튼 44 × 52 · 글자 16px</td><td>--pr-ink</td></tr>' +
      '<tr><td>글꼴 버튼</td><td>남는 폭 · 누르는 44 · 보이는 36 · 현재 글꼴 이름을 그 서체로 · 오른쪽 ▾ 20px</td><td>--pr-s2 · --pr-ink</td></tr>' +
      '<tr><td>pt 스텝</td><td>− · + 누르는 44 × 44, 보이는 묶음 36 × 144 · 값 14px 숫자 정렬 · 0.5pt씩</td><td>--pr-ink · 꺼짐은 투명도 .4</td></tr>' +
      '<tr><td>글꼴 목록</td><td>키보드 높이(330) · 줄 44 · 글자 16px · 현재 항목에 ✓ · 7.5줄이 보이고 나머지는 스크롤</td><td>--pr-s2 · --pr-hair</td></tr>' +
      '<tr><td>티켓 창</td><td>1.2배 확대 · 고른 필드가 패널 30px 위</td><td>--pr-ticket-shadow</td></tr></tbody></table>' +
      '<p class="d12-fam">익숙한 패턴: iOS 메모의 서식 막대와 Google Docs 모바일의 서식 줄처럼 키보드 위에 붙는 한두 줄이에요. 글꼴 목록이 키보드 자리에 열리는 건 키보드를 바꿔 끼우는 감각이에요(이모지 키보드). 입력란을 다시 누르면 키보드가 돌아와요.</p></div></div></section>';
    h += '<section class="d12-st"><h2>상태</h2><p class="d12-fam">패널만 잘라서 나란히 놓았어요. 글꼴 목록 항목은 목록 화면의 규칙(44px 줄, 각자 서체, 현재 항목 ✓)을 따라요.</p><div class="d12-strip">' +
      sc('pt 최소 2.0 · −가 꺼져요', panel({ ph: '한줄평', value: TEXT, two: true, pt: PT_MIN, focus: false })) +
      sc('pt 최대 6.0 · +가 꺼져요(무드마다 달라요)', panel({ ph: '한줄평', value: TEXT, two: true, pt: PT_MAX, focus: false })) +
      sc('포커스 · 글꼴 버튼과 pt 값에 링', panel({ ph: '한줄평', value: TEXT, two: true, ring: true, ringStep: true, focus: false })) +
      sc('빈 한줄평 · 안내 글자와 티켓의 점선 자리', win(393, 120, 'quote', { empty: true }) + panel({ ph: '한줄평', two: true })) + '</div></section>';
    h += '<section class="d12-memo"><h2>구현 메모</h2><ul>' +
      '<li><b>재사용</b> InPlaceFieldEditor의 visualViewport 측정(키보드 높이와 가시 높이)과 EDIT_ORDER 순서를 그대로 써요. 키보드 높이는 절대 고정값으로 두지 않아요. 서드파티 키보드나 제안 줄을 끈 경우 높이가 달라서 visualViewport로 재요.</li>' +
      '<li><b>제목만 예외</b> 제목은 KOBIS 결과 목록(기존 KobisResultList)이 둘째 줄 자리에 열려요. 목록은 최대 3줄이고 넘치면 스크롤해요. 목록을 고르면 패널은 한 줄로 돌아와요.</li>' +
      '<li><b>새 코드</b> 패널 컴포넌트 하나(cva 변형 oneRow · twoRow), 글꼴 listbox(APG), pt spinbutton(APG: ↑ ↓ 0.5pt, Home · End, aria-valuetext “4.5pt”)이에요. 헤드리스 라이브러리 없이 직접 써요.</li>' +
      '<li><b>접근성</b> 입력란은 label로 감싸서 누르는 영역이 44예요. 글꼴 버튼은 aria-haspopup=listbox, 목록 항목은 role=option과 aria-selected예요. 키보드 사용자는 Tab 순서가 입력란, 글꼴, pt 값, 완료 순이에요.</li>' +
      '<li><b>pt 저장</b> 고른 pt는 무드의 한줄평 칸 최대값이 되고 긴 글의 자동 줄임(fitFontSizeToWidth)은 그대로예요. 티켓 렌더 변경이라 S2 밖 별도 Seed예요.</li>' +
      '<li><b>위험</b> 키보드 높이가 기기와 입력 방식마다 달라서 티켓 창이 실제로는 더 작아질 수 있어요. SE에서 두 줄은 티켓 창이 ' + W.D12_SIZE(true, true) + 'px라 실기기 확인이 필요해요. Return = 다음으로 이전 항목 버튼을 없앤 점도 사용성 확인 대상이에요.</li></ul></section>';
    return h + '</div>';
  };
  W.D12_CSS = '.d12 { font-family: var(--pr-font); color: var(--pr-ink); padding: 32px 40px 56px; }' +
    '.d12 h1 { margin: 4px 0 0; font-size: 24px; line-height: 30px; font-weight: 600; letter-spacing: -.02em; }' +
    '.d12 h2 { margin: 0; font-size: 19px; line-height: 26px; font-weight: 600; display: flex; gap: 10px; align-items: baseline; }' +
    '.d12 h3 { margin: 0 0 6px; font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); }' +
    '.d12 h2 .k { font-variant-numeric: tabular-nums; color: var(--pr-ink-3); }' +
    '.d12-q { margin: 0; font-size: 13px; color: var(--pr-ink-2); font-weight: 500; }' +
    '.d12-lede { margin: 10px 0 24px; color: var(--pr-ink-2); max-width: 72ch; font-size: 15px; line-height: 1.55; }' +
    '.d12-now { background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; margin-bottom: 40px; }' +
    '.d12-nowrow { display: flex; gap: 24px; margin-top: 16px; align-items: flex-start; }' +
    '.d12-txt { flex: 1; min-width: 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d12-txt ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; }' +
    '.d12-hint { margin: 16px 0 0; font-size: 13px; color: var(--pr-ink-3); }' +
    '.d12-opts { display: flex; gap: 40px; align-items: flex-start; }' +
    '.d12-o { flex: 1; min-width: 0; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; }' +
    '.d12-o.rec { border-color: var(--pr-accent); border-width: 2px; padding: 23px; }' +
    '.d12-rec { font-size: 12px; font-weight: 600; border: 1px solid currentColor; border-radius: var(--pr-r-tag); padding: 0 5px; line-height: 18px; color: var(--pr-accent); }' +
    '.d12-sum { margin: 8px 0 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); min-height: 42px; }' +
    '.d12-row { display: flex; gap: 24px; margin-top: 16px; }' +
    '.d12-fig { margin: 0; flex: none; width: 393px; display: flex; flex-direction: column; gap: 8px; --fw: 393px; --fh: 852px; --sb: 54px; }' +
    '.d12-fig figcaption { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); background: var(--pr-page); padding: 4px 8px; }' +
    '.d12-bs { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d12-b ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }' +
    '.d12 { --pr-page: var(--pr-l-page); --pr-stage: var(--pr-l-stage); --pr-s1: var(--pr-l-s1); --pr-s2: var(--pr-l-s2); --pr-hair: var(--pr-l-hair); --pr-hair-strong: var(--pr-l-hair-strong); --pr-ink: var(--pr-l-ink); --pr-ink-2: var(--pr-l-ink2); --pr-ink-3: var(--pr-l-ink3); --pr-accent: var(--pr-l-accent); --pr-accent-ink: var(--pr-l-accent-ink); --pr-warn: var(--pr-l-warn); --pr-kbd: var(--pr-l-kbd); --pr-key: var(--pr-l-key); --pr-scrim: var(--pr-l-scrim); --pr-ticket-shadow: var(--pr-l-ticket-shadow); color-scheme: light; background: var(--pr-page); }' +
    '.d12 .d12-dk { --pr-page: var(--pr-d-page); --pr-stage: var(--pr-d-stage); --pr-s1: var(--pr-d-s1); --pr-s2: var(--pr-d-s2); --pr-hair: var(--pr-d-hair); --pr-hair-strong: var(--pr-d-hair-strong); --pr-ink: var(--pr-d-ink); --pr-ink-2: var(--pr-d-ink2); --pr-ink-3: var(--pr-d-ink3); --pr-accent: var(--pr-d-accent); --pr-accent-ink: var(--pr-d-accent-ink); --pr-warn: var(--pr-d-warn); --pr-kbd: var(--pr-d-kbd); --pr-key: var(--pr-d-key); --pr-scrim: var(--pr-d-scrim); --pr-ticket-shadow: var(--pr-d-ticket-shadow); color-scheme: dark; }' +
    '.d12 { --d12-ring: var(--pr-accent); --d12-ghost: rgba(30,27,24,.35); }' +
    '.d12 .ring { outline: 2px solid var(--d12-ring); outline-offset: 2px; }' +
    '.d12-memo { border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); background: var(--pr-s1); padding: 20px 24px; margin-top: 40px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d12-memo h2 { margin-bottom: 8px; } .d12-memo ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; max-width: 110ch; } .d12-memo b { color: var(--pr-ink); font-weight: 600; }' +
    '.d12-st { margin-top: 40px; } .d12-st h2 { margin-bottom: 4px; }' +
    '.d12-strip { display: flex; flex-wrap: wrap; gap: 24px; margin-top: 16px; align-items: flex-start; }' +
    '.d12-sc { margin: 0; width: 393px; display: flex; flex-direction: column; gap: 8px; }' +
    '.d12-sc figcaption { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); }' +
    '.d12-box { position: relative; box-sizing: border-box; border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); background: var(--pr-s1); overflow: hidden; }' +
    '.d12-fam { margin: 8px 0 0; font-size: 13px; line-height: 19px; color: var(--pr-ink-3); }' +
    '.d12-t { border-collapse: collapse; font-size: 14px; line-height: 21px; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); margin: 0 0 24px; } .d12-t th, .d12-t td { text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--pr-hair); vertical-align: top; } .d12-t th { background: var(--pr-s2); font-weight: 600; } .d12-t td:first-child { font-weight: 600; white-space: nowrap; }' +
    '.d12-q0 { margin: 0; font-size: 13px; color: var(--pr-ink-2); font-weight: 500; }' +
    '.d12 svg.i { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; flex: none; }' +
    '.d12-rules { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; margin-bottom: 40px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); } .d12-rules h2 { grid-column: 1 / -1; }' +
    '.d12-rules ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; } .d12-rules b { color: var(--pr-ink); font-weight: 600; }' +
    '.d12-sc0 { margin-bottom: 40px; } .d12-row { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; margin-top: 0; } .d12-row2 { gap: 40px; }' +
    '.d12-fig { --fw: 393px; --fh: 852px; --sb: 54px; width: auto; } .d12-fig .d12-se { --fw: 375px; --fh: 667px; --sb: 44px; }' +
    '.d12-side { flex: 1; min-width: 520px; max-width: 900px; } .d12-side h2 { margin-bottom: 12px; }' +
    '.d12-ph .c-kbd { height: 330px; } .d12-se .c-kbd { height: 260px; }' +
    '.d12-win { position: relative; overflow: hidden; flex: none; }' +
    '.d12-tkw { position: absolute; }' +
    '.d12-q { position: absolute; left: 6%; top: 88.5%; font-size: 9.4px; line-height: 1.2; color: var(--pr-l-ink); white-space: nowrap; }' +
    '.d12-caret { display: inline-block; width: 1.5px; height: 1.1em; background: var(--pr-l-accent); margin-left: 1px; vertical-align: -0.15em; }' +
    '.d12-gh { position: absolute; left: 6%; top: 88.5%; width: 40%; height: 3.4%; border: 1px dashed var(--d12-ghost); border-radius: 2px; box-sizing: border-box; }' +
    '.d12-pn { flex: none; box-sizing: border-box; background: var(--pr-s1); border-top: 1px solid var(--pr-hair-strong); padding: 8px 0; position: relative; z-index: 5; }' +
    '.d12-r { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; }' +
    '.d12-in { flex: 1; min-width: 0; height: 44px; display: flex; align-items: center; }' +
    '.d12-in .v { width: 100%; box-sizing: border-box; height: 36px; padding: 0 12px; font: inherit; font-size: 16px; line-height: 24px; color: var(--pr-ink); background: var(--pr-s2); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); }' +
    '.d12-in .v::placeholder { color: var(--pr-ink-3); opacity: 1; } .d12-in .v.f { outline: 2px solid var(--pr-accent); outline-offset: -1px; border-color: transparent; }' +
    '.d12-done { flex: none; height: 44px; min-width: 52px; padding: 0; border: 0; background: transparent; color: var(--pr-ink); font: inherit; font-size: 16px; font-weight: 600; }' +
    '.d12-font { flex: 1; min-width: 0; height: 44px; padding: 0; border: 0; background: transparent; display: flex; align-items: center; color: var(--pr-ink); }' +
    '.d12-font .v { width: 100%; box-sizing: border-box; height: 36px; padding: 0 8px 0 12px; display: flex; align-items: center; justify-content: space-between; font-size: 15px; line-height: 22px; background: var(--pr-s2); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); }' +
    '.d12-font.open .v { background: var(--pr-s1); }' +
    '.d12-chev { width: 20px; height: 20px; }' +
    '.d12-step { flex: none; height: 44px; display: flex; align-items: center; }' +
    '.d12-step .v { display: flex; align-items: center; height: 36px; box-sizing: border-box; background: var(--pr-s2); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); }' +
    '.d12-step button { width: 44px; height: 44px; margin: -4px 0; padding: 0; border: 0; background: transparent; color: var(--pr-ink); font: inherit; font-size: 20px; line-height: 20px; }' +
    '.d12-step button:disabled { opacity: .4; } .d12-step .val { min-width: 52px; text-align: center; font-size: 14px; line-height: 34px; font-variant-numeric: tabular-nums; border-radius: var(--pr-r-tag); }' +
    '.d12 .ring { outline-offset: -2px; }' +
    '.d12-kbs { flex: none; background: var(--pr-s2); overflow: hidden; border-top: 1px solid var(--pr-hair); }' +
    '.d12-dd { margin: 0; padding: 0; list-style: none; box-sizing: border-box; overflow: hidden; }' +
    '.d12-dd li { box-sizing: border-box; min-height: 44px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 16px; line-height: 24px; color: var(--pr-ink); border-top: 1px solid var(--pr-hair); } .d12-dd li:first-child { border-top: 0; } .d12-dd li[aria-selected="true"] { background: var(--pr-s1); font-weight: 600; }' +
    '.d12-box { width: 393px; border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); background: var(--pr-s1); overflow: hidden; } .d12-box .d12-pn { border-top: 0; }' +
    '.d12-box .d12-win { background: var(--pr-stage); }' +
    '.d12-t { width: 100%; } .d12-t td:first-child { white-space: normal; min-width: 100px; }';
})();
