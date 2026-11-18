/* D07 한줄평 · 서명 서체와 크기 재시안(D04 후속). D07-quote-font-pt.html과 tools/gen-canvas.js가 같이 불러요.
   글꼴은 드롭다운, 크기는 pt 단위 위/아래 스텝 버튼으로 그려요. 라이트 한 가지만 그려요. */
(function () {
  var W = window, S = W.PR, i = S.i;
  var FONTS = ['자동', '고딕', '바탕', '자람', '잉크', '은영', '붓', '쿨가이', '꽃길'];
  /* 실제 티켓 폰트는 이 페이지에 없어서 비슷한 결의 기본 서체로 대신 그려요 */
  var FF = { '자동': 'inherit', '고딕': 'sans-serif', '바탕': 'serif', '자람': 'cursive', '잉크': 'cursive', '은영': 'fantasy', '붓': 'cursive', '쿨가이': 'monospace', '꽃길': 'fantasy' };
  var FS = { '잉크': 'italic', '꽃길': 'italic' }, FW = { '붓': 700 };
  function fs(x) { return 'font-family:' + FF[x] + ';' + (FS[x] ? 'font-style:' + FS[x] + ';' : '') + (FW[x] ? 'font-weight:' + FW[x] + ';' : ''); }
  var CUR = '바탕';
  var CHEV = '<svg class="i d7-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  function ihead(name, id) {
    return '<div class="c-ph" style="margin-top:0"><label class="t" for="' + id + '" style="font-size:13px;line-height:20px;font-weight:500;color:var(--pr-ink-2)">' + name + '</label><span class="gap"></span><button class="c-ib" aria-label="이전 항목">' + i('back') + '</button><button class="c-ib" aria-label="다음 항목">' + i('next') + '</button><button class="c-btn txt">닫기</button></div>';
  }
  function field(id) { return '<div class="c-field focus"><input id="' + id + '" value="파도 소리가 오래 남았다"></div>'; }
  function dropBtn() { return '<button class="d7-sel" aria-haspopup="listbox" aria-label="글꼴 ' + CUR + '"><span style="' + fs(CUR) + '">' + CUR + '</span>' + CHEV + '</button>'; }
  function step() { return '<div class="d7-step" role="group" aria-label="글자 크기"><button aria-label="0.5pt 줄이기">−</button><span>4.5pt</span><button aria-label="0.5pt 키우기">+</button></div>'; }
  function list(cls) {
    return '<ul class="d7-dd ' + cls + '" role="listbox" aria-label="글꼴">' + FONTS.map(function (x) {
      var on = x === CUR;
      return '<li role="option" aria-selected="' + on + '"><span style="' + fs(x) + '">' + x + '</span>' + (on ? i('check') : '') + '</li>';
    }).join('') + '</ul>';
  }
  var ZOOM = '<div class="c-canvas" style="overflow:hidden"><div style="position:absolute;left:50%;width:84%;margin-left:-42%;bottom:-2%;aspect-ratio:960/1534;transform:scale(1.18);transform-origin:50% 94%">' + S.ticket({}) + S.sel('foot', { nolab: true }) + '</div></div>';
  /* A: 필드 위에 떠 있는 미니 툴바. top은 선택 표시 바로 위(폰 기준 px) */
  var A_TOP = 336;
  function phoneA(open) {
    var bar = '<div class="d7-fb" style="top:' + A_TOP + 'px">' + dropBtn() + step() + '</div>' + (open ? list('down').replace('class="', 'style="top:' + (A_TOP + 52) + 'px" class="') : '');
    return S.phone(ZOOM + S.panel('inp', ihead('한줄평', 'd7a') + field('d7a'), { aria: '입력' }) + S.kbd('text') + bar);
  }
  function phoneB(open) {
    var line = '<div class="d7-line">' + dropBtn() + step() + (open ? list('up') : '') + '</div>';
    return S.phone(ZOOM + S.panel('inp', ihead('한줄평', 'd7b') + field('d7b') + line, { aria: '입력' }) + S.kbd('text'));
  }
  function fig(cap, html) { return '<figure class="d7-fig"><figcaption>' + cap + '</figcaption>' + html + '</figure>'; }
  function lst(t, a) { return '<div class="d7-b"><h3>' + t + '</h3><ul>' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>'; }
  function opt(k, name, rec, sum, figs, chg, good, risk) {
    return '<section class="d7-o' + (rec ? ' rec' : '') + '"><h2><span class="k">' + k + '</span>' + name + (rec ? ' <span class="d7-rec">추천</span>' : '') + '</h2><p class="d7-sum">' + sum + '</p><div class="d7-row">' + figs + '</div><div class="d7-bs">' + lst('무엇이 달라지나', chg) + lst('좋은 점', good) + lst('걸리는 점', risk) + '</div></section>';
  }

  W.D07_HTML = function () {
    var h = '<div class="d7">';
    h += '<p class="d7-q">#826 S2 착수 전 · 결정 D07 (D04 재시안)</p><h1>글꼴은 드롭다운, 크기는 pt 단위 스텝 버튼으로 어디에 둘까요</h1>' +
      '<p class="d7-lede">D04의 칩 줄과 슬라이더 대신, 글 편집기처럼 글꼴을 드롭다운으로 고르고 크기를 위/아래 버튼으로 올리고 내리는 모양을 두 자리에 놓아 봤어요.</p>';
    h += '<section class="d7-notes"><h2>두 안 모두에 해당하는 점</h2><p>pt는 실물 카드(54 × 86mm) 인쇄 크기 기준이에요. 티켓 원본 픽셀로 1pt ≈ 6.3px예요(내보내기 배율 0.05625mm/px). 0.5pt 단위로 올리고 내려요. 아래 한계는 인쇄 하한 12px(약 1.9pt, docs/PRINT_CALIBRATION.md), 위 한계는 무드의 한줄평 칸에 들어가는 최대값이에요. 긴 한줄평이 칸에 맞춰 자동으로 줄어드는 동작은 남고, 고른 pt는 그 최대값이 돼요. 크기 조절은 티켓 렌더 변경이라 S2 밖 별도 Seed예요.</p>' +
      '<p class="d7-cap">그림의 글꼴 이름은 실제 티켓 폰트가 이 페이지에 없어서 고딕 · 바탕 · 손글씨 · 고정폭 같은 기본 서체로 대신 그렸어요. 구현에서는 각 항목을 자기 서체로 그려요. 목록 한 줄은 44px예요.</p></section>';
    h += '<div class="d7-opts">';
    h += opt('A', '플로팅 미니 툴바', false, '한줄평 필드를 고르면 티켓 위, 선택 표시(재단 표시) 바로 위에 작은 막대가 떠요. 글꼴 드롭다운과 − 4.5pt + 가 들어 있어요. 키보드는 아래에, 입력 패널은 그대로예요.',
      fig('A · 닫힘', phoneA(false)) + fig('A · 글꼴 목록 펼침', phoneA(true)),
      ['티켓 위에 떠 있는 막대가 생기고, 입력 패널의 서체 칩 줄은 없어져요.', '위치 규칙: 필드 위쪽 여백이 모자라면 막대를 아래쪽에 붙여요. 선택 표시 이름표와 같은 순서(위 먼저, 안 되면 아래)예요.', '목록은 막대 아래로 열려서 입력 패널과 키보드 위를 덮어요(9종 모두 보임).'],
      ['글자가 바뀌는 티켓 바로 옆에서 만져서 가장 직관적이에요.', '입력 패널은 그대로라 패널 높이가 늘지 않아요.'],
      ['작은 화면에서 티켓과 키보드 사이 공간이 좁아 막대가 티켓 글자나 선택 표시와 겹칠 수 있어요.', '떠 있는 층이 하나 더 생겨요. S2가 떠 있는 툴바를 걷어 내는 방향과 결이 달라요.', '막대 위치를 계산해야 해서 구현과 검증이 더 들어요.']);
    h += opt('B', '패널 안 한 줄', true, '입력 아래 한 줄에 글꼴 드롭다운(가로로 늘어남)과 − 4.5pt + 를 놓아요. 슬라이더도 칩 줄도 없고 높이는 44px 한 줄이에요.',
      fig('B · 기본', phoneB(false)) + fig('B · 글꼴 목록 펼침(패널 위로)', phoneB(true)),
      ['입력 패널에 44px 한 줄이 더해져요. 서체 칩 줄과 슬라이더는 없어요.', '목록은 패널 위로 열려요. 키보드 위 공간이 모자라 9종 중 7칸 반쯤만 보이고 나머지는 스크롤해요.'],
      ['위치 계산이 없어요. 다른 필드 옵션 칩 줄과 같은 자리라 규칙이 하나예요.', '한 줄이라 티켓이 가려지는 높이가 한 줄(44px)만 늘어요.', 'S3에서 입력 패널로 옮길 때 이 줄을 그대로 가져가면 돼요.'],
      ['글자가 바뀌는 티켓과 조작 줄이 떨어져 있어서 A보다 덜 직관적이에요.', '목록이 스크롤돼서 9종을 한눈에 보지는 못해요.']);
    h += '</div></div>';
    return h;
  };
  W.D07_CSS = '.d7 { font-family: var(--pr-font); color: var(--pr-ink); padding: 32px 40px 56px; }' +
    '.d7 h1 { margin: 4px 0 0; font-size: 24px; line-height: 30px; font-weight: 600; letter-spacing: -.02em; }' +
    '.d7 h2 { margin: 0; font-size: 19px; line-height: 26px; font-weight: 600; display: flex; gap: 10px; align-items: baseline; }' +
    '.d7 h3 { margin: 0 0 6px; font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); }' +
    '.d7 h2 .k { font-variant-numeric: tabular-nums; color: var(--pr-ink-3); }' +
    '.d7-q { margin: 0; font-size: 13px; color: var(--pr-ink-2); font-weight: 500; }' +
    '.d7-lede { margin: 10px 0 24px; color: var(--pr-ink-2); max-width: 72ch; font-size: 15px; line-height: 1.55; }' +
    '.d7-now { background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; margin-bottom: 40px; }' +
    '.d7-nowrow { display: flex; gap: 24px; margin-top: 16px; align-items: flex-start; }' +
    '.d7-txt { flex: 1; min-width: 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d7-txt ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; }' +
    '.d7-hint { margin: 16px 0 0; font-size: 13px; color: var(--pr-ink-3); }' +
    '.d7-opts { display: flex; gap: 40px; align-items: flex-start; }' +
    '.d7-o { flex: 1; min-width: 0; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; }' +
    '.d7-o.rec { border-color: var(--pr-accent); border-width: 2px; padding: 23px; }' +
    '.d7-rec { font-size: 12px; font-weight: 600; border: 1px solid currentColor; border-radius: var(--pr-r-tag); padding: 0 5px; line-height: 18px; color: var(--pr-accent); }' +
    '.d7-sum { margin: 8px 0 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); min-height: 42px; }' +
    '.d7-row { display: flex; gap: 24px; margin-top: 16px; }' +
    '.d7-fig { margin: 0; flex: none; width: 393px; display: flex; flex-direction: column; gap: 8px; --fw: 393px; --fh: 852px; --sb: 54px; }' +
    '.d7-fig figcaption { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); background: var(--pr-page); padding: 4px 8px; }' +
    '.d7-bs { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d7-b ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }' +
    '.d7-notes { border: 1px solid color-mix(in srgb, var(--pr-warn) 60%, transparent); border-radius: var(--pr-r-ctl); padding: 20px 24px; margin-bottom: 40px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d7-notes h2 { color: var(--pr-warn); margin-bottom: 8px; } .d7-notes p { margin: 8px 0 0; max-width: 90ch; } .d7-notes .d7-cap { font-size: 13px; color: var(--pr-ink-3); }' +
    '.d7-chev { width: 18px; height: 18px; }' +
    '.d7-sel { box-sizing: border-box; flex: 1; min-width: 0; min-height: 44px; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); background: var(--pr-s2); color: var(--pr-ink); font-size: 16px; line-height: 24px; }' +
    '.d7-step { display: flex; align-items: center; flex: none; border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); background: var(--pr-s2); }' +
    '.d7-step button { width: 44px; height: 42px; border: 0; background: transparent; color: var(--pr-ink); font-size: 20px; line-height: 20px; }' +
    '.d7-step span { min-width: 52px; text-align: center; font-size: 14px; font-variant-numeric: tabular-nums; color: var(--pr-ink); }' +
    '.d7-fb { position: absolute; left: 16px; z-index: 30; display: flex; gap: 6px; padding: 4px; width: 361px; box-sizing: border-box; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); }' +
    '.d7-fb .d7-sel, .d7-line .d7-sel { border-color: var(--pr-hair); }' +
    '.d7-line { position: relative; display: flex; gap: 8px; margin-top: 8px; }' +
    '.d7-dd { position: absolute; z-index: 40; margin: 0; padding: 0; list-style: none; box-sizing: border-box; background: var(--pr-s2); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); overflow: hidden; }' +
    '.d7-dd.down { left: 16px; width: 220px; }' +
    '.d7-dd.up { left: 0; bottom: calc(100% + 8px); width: 220px; height: 330px; }' +
    '.d7-dd li { box-sizing: border-box; min-height: 44px; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 16px; line-height: 24px; color: var(--pr-ink); border-top: 1px solid var(--pr-hair); }' +
    '.d7-dd li:first-child { border-top: 0; } .d7-dd li[aria-selected="true"] { background: var(--pr-s1); font-weight: 600; }';
})();
