/* D04 한줄평 · 서명 서체(와 크기) 비교판. D04-quote-font.html과 tools/gen-canvas.js가 같이 불러요.
   프레임은 lib.js 빌더와 frames.js(K-06 · kb · ihead · chips)의 패턴으로 그려요. 라이트 한 가지만 그려요. */
(function () {
  var W = window, S = W.PR, i = S.i;
  var DT = ['무드', '색상', '재질', '코팅', '투명도', '커스텀'];
  var FONTS = ['자동', '고딕', '바탕', '자람', '잉크', '은영', '붓', '쿨가이', '꽃길'];
  /* 실제 티켓 폰트는 이 페이지에 없어서 비슷한 결의 기본 서체로 대신 그려요 */
  var FF = { '자동': 'inherit', '고딕': 'sans-serif', '바탕': 'serif', '자람': 'cursive', '잉크': 'cursive', '은영': 'fantasy', '붓': 'cursive', '쿨가이': 'monospace', '꽃길': 'fantasy' };
  var FS = { '잉크': 'italic', '꽃길': 'italic' }, FW = { '붓': 700 };
  function tb() {
    return '<div class="c-tb"><button class="c-ib" aria-label="랜딩으로 돌아가기">' + i('back') + '</button><span class="sp"></span><button class="c-ib" aria-label="실행 취소">' + i('undo') + '</button><button class="c-ib" aria-label="다시 실행" disabled>' + i('redo') + '</button><button class="c-ib" aria-label="전체 보기">' + i('expand') + '</button><button class="c-ib" aria-label="편집 메뉴">' + i('more') + '</button><button class="c-btn pri">완료</button></div>';
  }
  function ihead(name, id) {
    return '<div class="c-ph" style="margin-top:0"><label class="t" for="' + id + '" style="font-size:13px;line-height:20px;font-weight:500;color:var(--pr-ink-2)">' + name + '</label><span class="gap"></span><button class="c-ib" aria-label="이전 항목">' + i('back') + '</button><button class="c-ib" aria-label="다음 항목">' + i('next') + '</button><button class="c-btn txt">닫기</button></div>';
  }
  function plain(items, sel, label) { return '<div class="c-acc" role="toolbar" aria-label="' + label + ' 옵션"><div role="radiogroup" aria-label="' + label + '" style="display:contents">' + items.map(function (x) { return '<button class="c-opt" role="radio" aria-checked="' + (x === sel) + '">' + x + '</button>'; }).join('') + '</div></div>'; }
  /* 서체 칩: 칩 글자를 각자 서체로 그려요 */
  function fontChips(sel, label) {
    return '<div class="c-acc" role="toolbar" aria-label="' + label + ' 옵션"><div role="radiogroup" aria-label="' + label + '" style="display:contents">' + FONTS.map(function (x) { return '<button class="c-opt" role="radio" aria-checked="' + (x === sel) + '" style="font-family:' + FF[x] + ';' + (FS[x] ? 'font-style:' + FS[x] + ';' : '') + (FW[x] ? 'font-weight:' + FW[x] + ';' : '') + '">' + x + '</button>'; }).join('') + '</div></div>';
  }
  function kbPhone(extra) {
    var zoom = '<div class="c-canvas" style="overflow:hidden"><div style="position:absolute;left:50%;width:84%;margin-left:-42%;bottom:-2%;aspect-ratio:960/1534;transform:scale(1.18);transform-origin:50% 94%">' + S.ticket({}) + S.sel('foot', { nolab: true }) + '</div></div>';
    var inner = ihead('한줄평', 'd4') + '<div class="c-field focus"><input id="d4" value="파도 소리가 오래 남았다"></div>' + extra;
    return S.phone(zoom + S.panel('inp', inner, { aria: '입력' }) + S.kbd('text'));
  }
  function railPhone() {
    var rows = S.opts('한줄평 서체', FONTS, '자동') + S.opts('서명 서체', FONTS, '자동');
    return S.phone(tb() + S.canvas({ ticket: {} }) + S.dock('design', S.tools(DT, '커스텀') + '<div class="c-ctl">' + rows + '</div>', { scroll: true }));
  }
  function fig(cap, html) { return '<figure class="d4-fig"><figcaption>' + cap + '</figcaption>' + html + '</figure>'; }
  function list(t, a) { return '<div class="d4-b"><h3>' + t + '</h3><ul>' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>'; }
  function opt(k, name, rec, sum, figs, chg, good, risk) {
    return '<section class="d4-o' + (rec ? ' rec' : '') + '"><h2><span class="k">' + k + '</span>' + name + (rec ? ' <span class="d4-rec">추천</span>' : '') + '</h2><p class="d4-sum">' + sum + '</p><div class="d4-row">' + figs + '</div><div class="d4-bs">' + list('무엇이 달라지나', chg) + list('좋은 점', good) + list('걸리는 점', risk) + '</div></section>';
  }

  W.D04_HTML = function () {
    var h = '<div class="d4">';
    h += '<p class="d4-q">#826 S2 착수 전 · 결정 D04</p><h1>한줄평 · 서명 서체를 입력할 때 고르고, 크기도 고르게 할까요</h1>' +
      '<p class="d4-lede">서체는 한줄평(서명)을 적을 때 그 자리에서 고르기로 정했어요. 여기서 정할 것은 서체 칩 줄에 더해 글자 크기 조절도 같이 둘지, 둔다면 어떤 모양일지예요.</p>';
    h += '<section class="d4-now"><h2>지금은 이래요</h2><div class="d4-nowrow"><div class="d4-txt"><ul>' +
      '<li>하단 도구 줄의 “커스텀”을 열면 칩이 두 줄 있어요. 한줄평 서체 9종, 서명 서체 9종이에요.</li>' +
      '<li>9종은 자동 · 고딕 · 바탕 · 자람 · 잉크 · 은영 · 붓 · 쿨가이 · 꽃길이에요.</li>' +
      '<li>글자를 적는 곳(티켓 위 입력)과 서체를 고르는 곳이 달라서, 적다가 서체를 바꾸려면 화면을 옮겨 다녀야 해요.</li>' +
      '<li>글자 크기를 고르는 방법은 없어요. 한줄평이 길면 칸에 맞게 자동으로 줄어들기만 해요.</li></ul></div>' +
      fig('커스텀 · 서체 칩 두 줄', railPhone()) + '</div></section>';
    h += '<section class="d4-warn"><h2>세 안을 보기 전에 알아둘 점</h2><p>크기 조절은 티켓 렌더(무드) 쪽 변경이라 S2 범위 밖이에요. 고르면 별도 Seed가 필요하고, 인쇄 하한(docs/PRINT_CALIBRATION.md 최소 글자 크기) 안에서만 줄일 수 있어요. 한줄평이 길면 지금은 자동으로 줄어드는데(fitFontSizeToWidth), 크기 선택은 그 위의 최대값을 정하는 방식이 돼요.</p>' +
      '<p><b>S2에서는</b> 지금의 티켓 위 입력(필드바)에 같은 서체 칩 줄을 붙이고, S3가 그 칩 줄을 입력 패널로 옮겨요. 아래 화면은 S3에서 완성될 입력 패널 모양이에요.</p>' +
      '<p class="d4-cap">그림의 서체 칩은 실제 티켓 폰트가 이 페이지에 없어서 고딕 · 바탕 · 손글씨 · 고정폭 같은 기본 서체로 대신 그렸어요. 구현에서는 각 칩을 자기 서체로 그려요.</p></section>';
    h += '<div class="d4-opts">';
    h += opt('A', '서체 칩 한 줄만', false, '입력 아래에 서체 칩 한 줄이 붙어요. 가로로 밀어서 넘기고, 오른쪽이 살짝 잘려 더 있다는 걸 알려 줘요(의도된 잘림).',
      fig('서체 칩 한 줄', kbPhone(fontChips('바탕', '서체'))),
      ['한줄평 · 서명을 적는 그 자리에서 서체를 골라요.', '크기 조절은 없고, 길면 지금처럼 자동으로 줄어요.'],
      ['입력 패널이 가장 낮아서 티켓이 제일 크게 보여요.', 'S2 범위 안이라 바로 만들 수 있어요.'],
      ['글자를 크게 하거나 작게 하고 싶은 사람은 방법이 없어요.']);
    h += opt('B', '서체 칩 줄 + 크기 3단', true, '서체 줄 위에 “작게 · 보통 · 크게” 세 칸이 붙어요. 서체 칩과 같은 44px 선택 상자예요.',
      fig('크기 3단 + 서체 칩', kbPhone(plain(['작게', '보통', '크게'], '보통', '크기') + fontChips('바탕', '서체'))),
      ['서체 줄 앞에 크기 세 칸이 생겨요.', '고른 크기는 자동 줄임의 최대값이 돼요.'],
      ['고르는 단계가 셋뿐이라 인쇄 하한을 지키기 쉬워요.', '칩과 모양이 같아서 새 컨트롤을 배울 필요가 없어요.'],
      ['티켓 렌더(무드) 변경이 따라서 별도 Seed가 필요해요.', '입력 패널이 한 줄 더 높아져서 티켓 보이는 영역이 줄어요.']);
    h += opt('C', '서체 칩 줄 + 크기 슬라이더', false, '서체 줄 아래에 80~120% 슬라이더가 붙어요.',
      fig('서체 칩 + 슬라이더', kbPhone(fontChips('바탕', '서체') + S.slider('크기', 50).replace('>50%<', '>100%<'))),
      ['서체 줄 아래에 크기 슬라이더가 생겨요.', '80%부터 120%까지 연속으로 골라요.'],
      ['원하는 크기에 맞게 세밀하게 고를 수 있어요.'],
      ['인쇄 하한에 걸리는 80%대는 무드마다 달라서 제한을 따로 정해야 해요.', '손가락으로 미세하게 맞추기 어렵고, 슬라이더가 키보드 위에서 좁아요.', '티켓 렌더(무드) 변경이 따라서 별도 Seed가 필요해요.']);
    h += '</div></div>';
    return h;
  };
  W.D04_CSS = '.d4 { font-family: var(--pr-font); color: var(--pr-ink); padding: 32px 40px 56px; }' +
    '.d4 h1 { margin: 4px 0 0; font-size: 24px; line-height: 30px; font-weight: 600; letter-spacing: -.02em; }' +
    '.d4 h2 { margin: 0; font-size: 19px; line-height: 26px; font-weight: 600; display: flex; gap: 10px; align-items: baseline; }' +
    '.d4 h3 { margin: 0 0 6px; font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); }' +
    '.d4 h2 .k { font-variant-numeric: tabular-nums; color: var(--pr-ink-3); }' +
    '.d4-q { margin: 0; font-size: 13px; color: var(--pr-ink-2); font-weight: 500; }' +
    '.d4-lede { margin: 10px 0 24px; color: var(--pr-ink-2); max-width: 72ch; font-size: 15px; line-height: 1.55; }' +
    '.d4-now { background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; margin-bottom: 24px; }' +
    '.d4-nowrow { display: flex; gap: 24px; margin-top: 16px; align-items: flex-start; }' +
    '.d4-txt { flex: 1; min-width: 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d4-txt ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; }' +
    '.d4-warn { border: 1px solid color-mix(in srgb, var(--pr-warn) 60%, transparent); border-radius: var(--pr-r-ctl); padding: 20px 24px; margin-bottom: 40px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d4-warn h2 { color: var(--pr-warn); margin-bottom: 8px; }' +
    '.d4-warn p { margin: 8px 0 0; max-width: 90ch; } .d4-warn b { color: var(--pr-ink); font-weight: 600; }' +
    '.d4-warn .d4-cap { font-size: 13px; color: var(--pr-ink-3); }' +
    '.d4-opts { display: flex; gap: 40px; align-items: flex-start; }' +
    '.d4-o { flex: 1; min-width: 0; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; }' +
    '.d4-o.rec { border-color: var(--pr-accent); border-width: 2px; padding: 23px; }' +
    '.d4-rec { font-size: 12px; font-weight: 600; border: 1px solid currentColor; border-radius: var(--pr-r-tag); padding: 0 5px; line-height: 18px; color: var(--pr-accent); }' +
    '.d4-sum { margin: 8px 0 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); min-height: 63px; }' +
    '.d4-row { display: flex; gap: 24px; margin-top: 16px; }' +
    '.d4-fig { margin: 0; flex: none; width: 393px; display: flex; flex-direction: column; gap: 8px; --fw: 393px; --fh: 852px; --sb: 54px; }' +
    '.d4-fig figcaption { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); background: var(--pr-page); padding: 4px 8px; }' +
    '.d4-bs { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d4-b ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }';
})();
