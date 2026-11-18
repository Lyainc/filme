/* D06 메뉴 공간 정리 비교판(D03 A의 후속). D06-menu-space.html과 tools/gen-canvas.js가 같이 불러요.
   프레임은 frames.js M-01(menu())을 기준으로 lib.js 빌더로 그려요. 라이트 한 가지만 그려요. */
(function () {
  var W = window, S = W.PR, i = S.i;
  var DT = ['무드', '색상', '재질', '코팅', '투명도', '크기'];
  function frame(id, n) { return W.FRAMES.filter(function (f) { return f.id === id; })[0].variants[n].html; }
  function tb() {
    return '<div class="c-tb"><button class="c-ib" aria-label="랜딩으로 돌아가기">' + i('back') + '</button><span class="sp"></span><button class="c-ib" aria-label="실행 취소">' + i('undo') + '</button><button class="c-ib" aria-label="다시 실행" disabled>' + i('redo') + '</button><button class="c-ib" aria-label="전체 보기">' + i('expand') + '</button><button class="c-ib" aria-label="편집 메뉴" aria-expanded="true">' + i('more') + '</button><button class="c-btn pri">완료</button></div>';
  }
  function base(sheet) {
    return S.phone(tb() + S.canvas({}) + S.dock('design', S.tools(DT, '무드') + '<div class="c-ctl">' + S.thumbs('minimal') + '</div>') + '<div class="c-scrim" aria-hidden="true"></div>' + sheet);
  }
  function sw(label, on) { return '<span class="c-sw' + (on ? ' on' : '') + '" role="switch" aria-checked="' + !!on + '" aria-label="' + label + '"></span>'; }
  var SEG = '<span class="d6-seg" role="group" aria-label="테마"><span class="on">시스템</span><span>라이트</span><span>다크</span></span>';
  var RESET = '한 번 더 눌러 전체 삭제';
  /* A: 설정 카드 + 문서 카드, 머리줄 없음 */
  function menuA(armed) {
    var set = '<div class="d6-card"><div class="d6-r"><span class="lb">빈 항목 표시</span>' + sw('빈 항목 표시', false) + '</div>' +
      '<div class="d6-r"><span class="lb">테마</span>' + SEG + '</div>' +
      '<div class="d6-r"><span class="lb">자동저장 <small>11:42 저장</small></span>' + sw('자동저장', true) + '</div></div>';
    var doc = '<div class="d6-card"><button class="d6-r"><span class="lb">스크린샷으로 자동입력</span></button><button class="d6-r"><span class="lb">임시저장</span></button>' +
      '<button class="d6-r' + (armed ? ' armed' : '') + '"><span class="lb">' + (armed ? RESET : '초기화') + '</span></button></div>';
    return base('<div class="d6-sh" role="dialog" aria-label="편집 메뉴">' + set + doc + '</div>');
  }
  /* B: 위에 액션 셋 한 줄, 아래 설정 3행 */
  function menuB(armed) {
    var acts = '<div class="d6-grid"><button class="d6-cell">' + i('search') + '<span>자동입력</span></button><button class="d6-cell">' + i('check') + '<span>임시저장</span></button>' +
      (armed ? '<button class="d6-cell armed"><span>' + RESET + '</span></button>' : '<button class="d6-cell">' + i('close') + '<span>초기화</span></button>') + '</div>';
    var set = '<div class="d6-card"><div class="d6-r"><span class="lb">빈 항목 표시</span>' + sw('빈 항목 표시', false) + '</div>' +
      '<div class="d6-r"><span class="lb">테마</span>' + SEG + '</div>' +
      '<div class="d6-r"><span class="lb">자동저장 <small>11:42 저장</small></span>' + sw('자동저장', true) + '</div></div>';
    return base('<div class="d6-sh" role="dialog" aria-label="편집 메뉴">' + acts + set + '</div>');
  }
  function fig(cap, html) { return '<figure class="d6-fig"><figcaption>' + cap + '</figcaption>' + html + '</figure>'; }
  function list(t, a) { return '<div class="d6-b"><h3>' + t + '</h3><ul>' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>'; }
  function opt(k, name, rec, sum, figs, chg, good, risk) {
    return '<section class="d6-o' + (rec ? ' rec' : '') + '"><h2><span class="k">' + k + '</span>' + name + (rec ? ' <span class="d6-rec">추천</span>' : '') + '</h2><p class="d6-sum">' + sum + '</p><div class="d6-row">' + figs + '</div><div class="d6-bs">' + list('무엇이 달라지나', chg) + list('좋은 점', good) + list('걸리는 점', risk) + '</div></section>';
  }

  W.D06_HTML = function () {
    var h = '<div class="d6">';
    h += '<p class="d6-q">#826 S2 착수 전 · 결정 D06 (D03 A의 후속)</p><h1>편집 메뉴의 공간을 어떻게 줄일까요</h1>' +
      '<p class="d6-lede">D03에서 빈 항목 스위치를 메뉴에 두기로 했어요. 메뉴에 들어갈 것은 그대로 여섯 가지예요: 스크린샷으로 자동입력, 빈 항목 표시, 테마(시스템 · 라이트 · 다크), 자동저장(마지막 저장 시각 포함), 임시저장, 초기화(두 번 눌러야 지워져요). 이 여섯 가지를 더 작은 자리에 담는 방법을 비교해요.</p>';
    h += '<section class="d6-now"><h2>지금은 이래요 (마스터 M-01)</h2><div class="d6-nowrow"><div class="d6-txt"><ul>' +
      '<li>편집 화면 위의 ⋯를 누르면 아래에서 시트가 올라와요.</li>' +
      '<li>맨 위에 “메뉴” 제목과 닫기 버튼이 있고, 그 아래로 여섯 줄이 모두 한 줄씩 차례로 이어져요.</li>' +
      '<li>한 줄은 52px이고, 시트 높이는 약 <b>407px</b>(제목줄 52 + 여섯 줄 312 + 위아래 여백 42 + 줄 경계선)예요. 화면 높이 852px의 절반 가까이를 덮어요.</li>' +
      '<li>초기화는 두 번 눌러야 하고, 첫 번째 누르면 줄 글자가 앰버색 “한 번 더 눌러 전체 삭제”로 바뀌어요(3.2초 동안).</li></ul></div>' +
      fig('M-01 · 기본', frame('M-01', 0)) + fig('M-01 · 초기화 확인 대기', frame('M-01', 1)) + '</div></section>';
    h += '<div class="d6-opts">';
    h += opt('A', '묶음 정리', true, '설정 묶음(빈 항목 표시 · 테마 · 자동저장)과 문서 묶음(자동입력 · 임시저장 · 초기화)을 카드 두 장으로 나눠요. 한 줄은 44px이고, “메뉴” 머리줄은 없애요.',
      fig('A · 기본', menuA(false)) + fig('A · 초기화 확인 대기', menuA(true)),
      ['시트 높이 약 <b>320px</b>, M-01 대비 <b>−87px</b>(여백 8 + 카드 132 + 간격 8 + 카드 132 + 아래 34 + 테두리).', '“메뉴” 제목줄과 닫기 버튼이 없어져요. 닫기는 어두운 바깥을 누르거나 위쪽 ⋯를 다시 눌러요.', '자동저장 시각은 라벨 옆 작은 글자로 붙어요.'],
      ['설정과 동작이 묶여서 무엇이 무엇인지 한눈에 보여요.', '줄 수는 그대로라 지금 메뉴와 같은 모양이라 낯설지 않아요.', '초기화 확인 문구가 한 줄에 그대로 들어가요.'],
      ['닫기 버튼이 없어서 닫는 방법을 모르는 사람은 헤맬 수 있어요(⋯ 재탭과 바깥 탭).', '카드 두 장이라 테두리가 늘어 화면이 조금 복잡해 보여요.']);
    h += opt('B', '두 줄 압축', false, '맨 위 한 줄에 동작 셋(자동입력 · 임시저장 · 초기화)을 44px 칸 세 개로 두고, 그 아래에 설정 세 줄(44px)을 둬요.',
      fig('B · 기본', menuB(false)) + fig('B · 초기화 확인 대기(칸이 좁아 두 줄)', menuB(true)),
      ['시트 높이 약 <b>230px</b>, M-01 대비 <b>−177px</b>(여백 8 + 칸 44 + 간격 8 + 카드 132 + 아래 34 + 테두리).', '동작 셋이 아이콘과 짧은 이름의 칸으로 바뀌어요. 아이콘은 임시로 그렸어요.', '초기화를 한 번 누르면 그 칸에 앰버 테두리와 “한 번 더 눌러 전체 삭제”가 떠요.'],
      ['메뉴가 가장 작아서 티켓이 거의 그대로 보여요.', '자주 쓰는 동작이 맨 위 한 줄에 모여 있어요.'],
      ['칸 하나가 가로 약 112px라 확인 문구가 두 줄로 줄바꿈돼요(44px 안에 간신히 들어가는 크기).', '초기화가 다른 두 동작과 같은 크기 칸이라 실수로 누르기 쉬워요(두 번 눌러야 하는 장치가 그래서 더 중요해요).', '“자동입력”, “임시저장” 같은 이름이 줄어들어서 처음에는 뜻을 헷갈릴 수 있어요.']);
    h += '</div></div>';
    return h;
  };
  W.D06_CSS = '.d6 { font-family: var(--pr-font); color: var(--pr-ink); padding: 32px 40px 56px; }' +
    '.d6 h1 { margin: 4px 0 0; font-size: 24px; line-height: 30px; font-weight: 600; letter-spacing: -.02em; }' +
    '.d6 h2 { margin: 0; font-size: 19px; line-height: 26px; font-weight: 600; display: flex; gap: 10px; align-items: baseline; }' +
    '.d6 h3 { margin: 0 0 6px; font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); }' +
    '.d6 h2 .k { font-variant-numeric: tabular-nums; color: var(--pr-ink-3); }' +
    '.d6-q { margin: 0; font-size: 13px; color: var(--pr-ink-2); font-weight: 500; }' +
    '.d6-lede { margin: 10px 0 24px; color: var(--pr-ink-2); max-width: 72ch; font-size: 15px; line-height: 1.55; }' +
    '.d6-now { background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; margin-bottom: 40px; }' +
    '.d6-nowrow { display: flex; gap: 24px; margin-top: 16px; align-items: flex-start; }' +
    '.d6-txt { flex: 1; min-width: 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d6-txt ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; }' +
    '.d6-hint { margin: 16px 0 0; font-size: 13px; color: var(--pr-ink-3); }' +
    '.d6-opts { display: flex; gap: 40px; align-items: flex-start; }' +
    '.d6-o { flex: 1; min-width: 0; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; }' +
    '.d6-o.rec { border-color: var(--pr-accent); border-width: 2px; padding: 23px; }' +
    '.d6-rec { font-size: 12px; font-weight: 600; border: 1px solid currentColor; border-radius: var(--pr-r-tag); padding: 0 5px; line-height: 18px; color: var(--pr-accent); }' +
    '.d6-sum { margin: 8px 0 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); min-height: 42px; }' +
    '.d6-row { display: flex; gap: 24px; margin-top: 16px; }' +
    '.d6-fig { margin: 0; flex: none; width: 393px; display: flex; flex-direction: column; gap: 8px; --fw: 393px; --fh: 852px; --sb: 54px; }' +
    '.d6-fig figcaption { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); background: var(--pr-page); padding: 4px 8px; }' +
    '.d6-bs { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d6-b ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }' +
    '.d6 .c-sw { flex: none; }' +
    '.d6-sh { position: absolute; left: 0; right: 0; bottom: 0; z-index: 21; box-sizing: border-box; background: var(--pr-s1); border-top: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-sheet) var(--pr-r-sheet) 0 0; padding: 8px 16px 34px; display: flex; flex-direction: column; gap: 8px; }' +
    '.d6-card { border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); background: var(--pr-s2); overflow: hidden; }' +
    '.d6-r { box-sizing: border-box; display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; padding: 0 12px; margin: 0; border: 0; border-top: 1px solid var(--pr-hair); background: transparent; color: var(--pr-ink); font: inherit; font-size: 15px; line-height: 22px; text-align: left; }' +
    '.d6-card > .d6-r:first-child { border-top: 0; }' +
    '.d6-r .lb { flex: 1; min-width: 0; } .d6-r .lb small { font-size: 12px; line-height: 16px; color: var(--pr-ink-3); margin-left: 6px; }' +
    '.d6-r.armed { color: var(--pr-warn); font-weight: 600; }' +
    '.d6-seg { display: inline-flex; flex: none; margin-right: -12px; }' +
    '.d6-seg span { min-height: 44px; min-width: 52px; display: grid; place-items: center; padding: 0 8px; font-size: 14px; color: var(--pr-ink-2); border-left: 1px solid var(--pr-hair); }' +
    '.d6-seg span.on { background: var(--pr-s1); color: var(--pr-ink); font-weight: 600; }' +
    '.d6-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }' +
    '.d6-cell { box-sizing: border-box; min-height: 44px; padding: 4px 6px; border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); background: var(--pr-s2); color: var(--pr-ink); display: flex; align-items: center; justify-content: center; gap: 6px; font: inherit; font-size: 13px; line-height: 18px; }' +
    '.d6-cell.armed { border-color: var(--pr-warn); color: var(--pr-warn); font-weight: 600; font-size: 12px; line-height: 16px; text-align: center; }';
})();
