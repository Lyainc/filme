/* D03 빈 항목(ghost) 비교판. D03-ghost.html과 tools/gen-canvas.js가 같이 불러요.
   프레임은 lib.js 빌더와 frames.js(E-01 · M-01 · K-02 패턴)로 그려요. 라이트 한 가지만 그려요. */
(function () {
  var W = window, S = W.PR, i = S.i, SAFE = '<div class="safe-b"></div>';
  var DT = ['무드', '색상', '재질', '코팅', '투명도', '크기'];
  function frame(id, n) { return W.FRAMES.filter(function (f) { return f.id === id; })[0].variants[n].html; }
  /* frames.js 지역 조각을 이 파일 안에 복사해 써요 */
  function tb() {
    return '<div class="c-tb"><button class="c-ib" aria-label="랜딩으로 돌아가기">' + i('back') + '</button><span class="sp"></span><button class="c-ib" aria-label="실행 취소">' + i('undo') + '</button><button class="c-ib" aria-label="다시 실행" disabled>' + i('redo') + '</button><button class="c-ib" aria-label="전체 보기">' + i('expand') + '</button><button class="c-ib" aria-label="편집 메뉴">' + i('more') + '</button><button class="c-btn pri">완료</button></div>';
  }
  function design(ghost) {
    return S.phone(tb() + S.canvas({ ticket: { ghost: ghost } }) + S.dock('design', S.tools(DT, '무드') + '<div class="c-ctl">' + S.thumbs('minimal') + '</div>'));
  }
  /* 메뉴 시트. label · on: 빈 항목 스위치의 이름과 상태 */
  function menu(label, on, note) {
    var sheet = '<div class="c-scrim" aria-hidden="true"></div><div class="c-sheet" role="dialog" aria-modal="true" aria-label="편집 메뉴"><div class="hd"><span class="t">메뉴</span><button class="c-ib" aria-label="닫기">' + i('close') + '</button></div>' +
      '<button class="c-mi"><span class="lb">스크린샷으로 자동입력</span></button>' +
      '<div class="c-mi"><span class="lb">' + label + (note ? '<small>' + note + '</small>' : '') + '</span><span class="c-sw' + (on ? ' on' : '') + '" role="switch" aria-checked="' + !!on + '" aria-label="' + label + '"></span></div>' +
      '<div class="c-mi" role="group" aria-label="테마"><span class="lb">테마</span><span class="seg"><span class="on">시스템</span><span>라이트</span><span>다크</span></span></div>' +
      '<div class="c-mi"><span class="lb">자동저장<small>11:42 저장</small></span><span class="c-sw on" role="switch" aria-checked="true" aria-label="자동저장"></span></div>' +
      '<button class="c-mi"><span class="lb">임시저장</span></button><button class="c-mi"><span class="lb">초기화</span></button></div>';
    return S.phone(tb() + S.canvas({ ticket: { ghost: true } }) + S.dock('design', S.tools(DT, '무드') + '<div class="c-ctl">' + S.thumbs('minimal') + '</div>') + sheet);
  }
  function ihead(name, id, extra) {
    return '<div class="c-ph" style="margin-top:0"><label class="t" for="' + id + '" style="font-size:13px;line-height:20px;font-weight:500;color:var(--pr-ink-2)">' + name + '</label><span class="gap"></span>' + (extra || '') + '<button class="c-ib" aria-label="이전 항목">' + i('back') + '</button><button class="c-ib" aria-label="다음 항목">' + i('next') + '</button><button class="c-btn txt">닫기</button></div>';
  }
  function chips(items, sel, label) { return '<div class="c-acc" role="toolbar" aria-label="' + label + ' 옵션"><div role="radiogroup" aria-label="' + label + '" style="display:contents">' + items.map(function (x) { return '<button class="c-opt" role="radio" aria-checked="' + (x === sel) + '">' + x + '</button>'; }).join('') + '</div></div>'; }
  /* 키보드 위 입력 패널(K-02 패턴). 티켓은 확대해 보여 줘요 */
  function kbPhone(inner, ghost) {
    var zoom = '<div class="c-canvas" style="overflow:hidden"><div style="position:absolute;left:50%;width:84%;margin-left:-42%;bottom:-22%;aspect-ratio:960/1534;transform:scale(1.18);transform-origin:50% 85%">' + S.ticket({ ghost: ghost }) + S.sel('seat', { nolab: true }) + '</div></div>';
    return S.phone(zoom + S.panel('inp', inner, { aria: '입력' }) + S.kbd('text'));
  }
  function fig(cap, html) { return '<figure class="d3-fig"><figcaption>' + cap + '</figcaption>' + html + '</figure>'; }
  function list(t, a) { return '<div class="d3-b"><h3>' + t + '</h3><ul>' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>'; }
  function opt(k, name, rec, sum, figs, chg, good, risk) {
    return '<section class="d3-o' + (rec ? ' rec' : '') + '"><h2><span class="k">' + k + '</span>' + name + (rec ? ' <span class="d3-rec">추천</span>' : '') + '</h2><p class="d3-sum">' + sum + '</p><div class="d3-row">' + figs + '</div><div class="d3-bs">' + list('무엇이 달라지나', chg) + list('좋은 점', good) + list('걸리는 점', risk) + '</div></section>';
  }

  W.D03_HTML = function () {
    var h = '<div class="d3">';
    h += '<p class="d3-q">#826 S2 착수 전 · 결정 D03</p><h1>빈 항목 표시는 언제 보여 줄까요</h1>' +
      '<p class="d3-lede">빈 항목은 티켓에서 아직 비어 있거나 숨긴 항목 자리를 점선 상자로 미리 보여 주는 표시예요. 저장되는 이미지에는 나오지 않아요. 이 표시를 켜고 끄는 방법을 세 가지로 비교해요.</p>';
    h += '<section class="d3-now"><h2>지금은 이래요</h2><div class="d3-nowrow"><div class="d3-txt"><ul>' +
      '<li>편집 메뉴(⋯)에 “빈 항목” 스위치가 있어요. 화면 읽기 프로그램에는 “빈 항목 미리보기”라고 읽혀요.</li>' +
      '<li>처음부터 켜져 있어서, 비어 있는 자리가 티켓에 점선 상자로 보여요.</li>' +
      '<li>티켓의 글자를 눌러 직접 입력하는 동안에는 스위치를 꺼 놓았어도 강제로 켜져요. 어디를 채울지 보이게 하려는 동작이에요.</li>' +
      '<li>스위치는 모드(사진 · 정보 · 디자인)와 상관없이 하나로 움직여요.</li></ul>' +
      '<p class="d3-hint">아래 두 화면이 지금 모습이에요. 왼쪽은 편집 화면, 오른쪽은 메뉴를 연 모습이에요.</p></div>' +
      fig('편집 화면 · 점선 상자가 보여요', design(true)) + fig('메뉴 · 빈 항목 켜짐', menu('빈 항목', true)) + '</div></section>';
    h += '<div class="d3-opts">';
    h += opt('A', '정보 모드는 자동, 나머지는 스위치', true,
      '정보 모드에서는 저절로 켜지고, 사진 · 디자인 모드에서는 메뉴의 “빈 항목 표시” 스위치를 따라요.',
      fig('정보 모드 · 자동으로 켜짐', frame('E-01', 1)) + fig('메뉴 · 사진 · 디자인에서만 쓰는 스위치', menu('빈 항목 표시', false)),
      ['정보 모드를 열면 스위치와 상관없이 빈 자리가 보여요.', '사진 · 디자인 모드는 스위치 상태 그대로예요.', '메뉴 문구가 “빈 항목”(읽는 이름 “빈 항목 미리보기”)에서 “빈 항목 표시”로 바뀌어요.'],
      ['채울 자리를 찾는 순간(정보 모드)에는 알아서 보여서 편해요.', '무드나 색을 고를 때는 스위치를 꺼서 깔끔한 티켓을 볼 수 있어요.', '지금 방식과 가장 가까워서 바뀌는 부분이 적어요.'],
      ['스위치와 자동 켜짐이 겹쳐서 “왜 켜졌지” 하는 순간이 생길 수 있어요.', '정보 모드에서는 스위치를 꺼도 켜져 있어서, 스위치 옆에 이유를 적어 주는 편이 좋아요.']);
    h += opt('B', '입력 패널 머리에 토글', false,
      '입력 패널 머리줄(이름 · 이전 · 다음 · 닫기)에 “빈 항목” 토글 버튼을 둬요. 메뉴의 스위치는 없어져요.',
      fig('입력 패널 · 머리에 토글', kbPhone(ihead('좌석', 'd3b', '<button class="c-opt" aria-pressed="true">빈 항목</button>') + '<div class="c-field focus"><input id="d3b" value="H12" enterkeyhint="next"></div>' + chips(['티켓에 표시', '숨김'], '티켓에 표시', '표시'), true)) + fig('디자인 모드 · 끌 곳이 없어요', design(true)),
      ['빈 항목 조작이 메뉴에서 입력 패널로 옮겨 가요.', '글자를 입력하는 중에만 토글이 보여요.'],
      ['입력하면서 바로 “이 자리를 채우면 어떻게 보일까”를 켜고 끌 수 있어요.', '메뉴가 한 줄 줄어요.'],
      ['입력 패널은 S3 · S4에서 만드는 화면이라, S2에서는 임시로 붙일 자리가 필요해요.', '입력 중에만 보이는 토글이라, 디자인 모드에서는 빈 항목을 끌 방법이 없어요.']);
    h += opt('C', '스위치 없음', false,
      '정보 모드와 입력하는 동안에만 자동으로 보이고, 그 밖에는 항상 꺼져 있어요.',
      fig('정보 모드 · 자동으로 켜짐', frame('E-01', 1)) + fig('디자인 모드 · 항상 꺼짐', design(false)),
      ['메뉴의 빈 항목 스위치가 없어져요.', '사진 · 디자인 모드에서는 점선 상자가 보이지 않아요.'],
      ['조작이 하나 줄어서 메뉴가 단순해요.', '켜졌다 꺼졌다 하는 이유를 따질 일이 없어요.'],
      ['무드를 고르면서 빈 자리 배치를 미리 보는 길이 사라져요.', '사진 · 디자인 모드에서 빈 자리를 보고 싶으면 정보 모드로 옮겨야 해요.']);
    h += '</div></div>';
    return h;
  };
  /* 비교판 전용 스타일(마스터 토큰 위에서 동작) */
  W.D03_CSS = '.d3 { font-family: var(--pr-font); color: var(--pr-ink); padding: 32px 40px 56px; }' +
    '.d3 h1 { margin: 4px 0 0; font-size: 24px; line-height: 30px; font-weight: 600; letter-spacing: -.02em; }' +
    '.d3 h2 { margin: 0; font-size: 19px; line-height: 26px; font-weight: 600; display: flex; gap: 10px; align-items: baseline; }' +
    '.d3 h3 { margin: 0 0 6px; font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); }' +
    '.d3 h2 .k { font-variant-numeric: tabular-nums; color: var(--pr-ink-3); }' +
    '.d3-q { margin: 0; font-size: 13px; color: var(--pr-ink-2); font-weight: 500; }' +
    '.d3-lede { margin: 10px 0 24px; color: var(--pr-ink-2); max-width: 72ch; font-size: 15px; line-height: 1.55; }' +
    '.d3-now { background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; margin-bottom: 40px; }' +
    '.d3-nowrow { display: flex; gap: 24px; margin-top: 16px; align-items: flex-start; }' +
    '.d3-txt { flex: 1; min-width: 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d3-txt ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; }' +
    '.d3-hint { margin: 16px 0 0; font-size: 13px; color: var(--pr-ink-3); }' +
    '.d3-opts { display: flex; gap: 40px; align-items: flex-start; }' +
    '.d3-o { flex: 1; min-width: 0; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; }' +
    '.d3-o.rec { border-color: var(--pr-accent); border-width: 2px; padding: 23px; }' +
    '.d3-rec { font-size: 12px; font-weight: 600; border: 1px solid currentColor; border-radius: var(--pr-r-tag); padding: 0 5px; line-height: 18px; color: var(--pr-accent); }' +
    '.d3-sum { margin: 8px 0 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); min-height: 42px; }' +
    '.d3-row { display: flex; gap: 24px; margin-top: 16px; }' +
    '.d3-fig { margin: 0; flex: none; width: 393px; display: flex; flex-direction: column; gap: 8px; --fw: 393px; --fh: 852px; --sb: 54px; }' +
    '.d3-fig figcaption { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); background: var(--pr-page); padding: 4px 8px; }' +
    '.d3-bs { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d3-b ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }';
})();
