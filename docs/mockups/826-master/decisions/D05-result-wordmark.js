/* D05 결과 화면 워드마크 비교판. D05-result-wordmark.html과 tools/gen-canvas.js가 같이 불러요.
   프레임은 lib.js 빌더와 frames.js(R-01 · M-01 · L-02)의 패턴으로 그려요. 라이트 한 가지만 그려요. */
(function () {
  var W = window, S = W.PR, i = S.i, SAFE = '<div class="safe-b"></div>';
  function frame(id, n) { return W.FRAMES.filter(function (f) { return f.id === id; })[0].variants[n].html; }
  /* 결과 화면. bar: 'wm'(가운데 워드마크) | 'wm-static'(탭 동작 없음) */
  function result(bar) {
    var wm = bar === 'wm' ? '<button class="d5-wm" aria-label="처음 화면으로" style="border:0;background:transparent;padding:0">' + S.wordmark() + '</button>' : '<span class="d5-wm" role="img" aria-label="FILME">' + S.wordmark() + '</span>';
    var top = '<div class="c-tb"><button class="c-ib" aria-label="편집으로 돌아가기">' + i('back') + '</button><span style="flex:1;display:flex;justify-content:center">' + wm + '</span><span style="width:44px;flex:none"></span></div>';
    var body = '<div class="c-rbody"><div class="beam" aria-hidden="true"></div><div class="c-rtk">' + S.ticket({}) + '</div><p class="c-spec">1960 × 3108 · JPEG</p></div>' +
      '<div class="c-racts"><button class="c-btn pri cta block">사진에 저장</button><div class="c-lrow"><button class="c-btn txt u">링크 만들기</button><small>3일 뒤 만료</small><button class="c-btn txt u">공유</button></div>' + SAFE + '</div>';
    return S.phone(top + body);
  }
  function confirm() {
    return '<div class="d5-dlg" role="alertdialog" aria-label="처음 화면으로 돌아갈까요"><p>지금까지 작업한 내용이 사라져요. 처음 화면으로 돌아갈까요?</p><div class="d5-btns"><button class="c-btn sec">취소</button><button class="c-btn pri">돌아가기</button></div></div>';
  }
  function fig(cap, html) { return '<figure class="d5-fig"><figcaption>' + cap + '</figcaption>' + html + '</figure>'; }
  function list(t, a) { return '<div class="d5-b"><h3>' + t + '</h3><ul>' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>'; }
  function opt(k, name, rec, sum, figs, chg, good, risk) {
    return '<section class="d5-o' + (rec ? ' rec' : '') + '"><h2><span class="k">' + k + '</span>' + name + (rec ? ' <span class="d5-rec">추천</span>' : '') + '</h2><p class="d5-sum">' + sum + '</p><div class="d5-row">' + figs + '</div><div class="d5-bs">' + list('무엇이 달라지나', chg) + list('좋은 점', good) + list('걸리는 점', risk) + '</div></section>';
  }

  W.D05_HTML = function () {
    var h = '<div class="d5">';
    h += '<p class="d5-q">#826 S2 착수 전 · 결정 D05</p><h1>결과 화면의 워드마크를 눌렀을 때 무엇을 할까요</h1>' +
      '<p class="d5-lede">결과 화면 맨 위 가운데에는 FILME 워드마크가 있고, 지금은 누르면 문서를 지우고 첫 화면으로 가요. 이 동작을 어떻게 할지 세 가지로 비교해요.</p>';
    h += '<section class="d5-now"><h2>지금은 이래요</h2><div class="d5-nowrow"><div class="d5-txt"><ul>' +
      '<li>“완료”를 누르면 나오는 결과 화면(저장 · 공유)의 맨 위 가운데에 FILME 워드마크가 있어요.</li>' +
      '<li>왼쪽에는 “편집으로 돌아가기” 뒤로 버튼(‹)이 있고, 오른쪽은 빈 칸이에요.</li>' +
      '<li>워드마크를 누르면 작업한 내용이 있을 때 “지금까지 작업한 내용이 사라져요. 처음 화면으로 돌아갈까요?” 확인 창이 떠요. 확인하면 문서를 지우고 첫 화면으로 가요.</li>' +
      '<li>편집 화면의 워드마크도 같은 동작이었어요. S2에서 편집 쪽은 ‹ 버튼(문서는 남기고 랜딩으로)으로 바뀌어요. 그래서 결과 화면만 따로 정해야 해요.</li></ul></div>' +
      fig('결과 화면 · 워드마크가 눌러져요', result('wm')) + fig('누르면 뜨는 확인 창(그림)', confirm()) + '</div></section>';
    h += '<div class="d5-opts">';
    h += opt('A', '탭 동작만 없애기', true, '워드마크는 브랜드 표시로만 남아요. 돌아가기는 기존 ‹가 맡아요.',
      fig('결과 화면 · 워드마크는 표시만', result('wm-static')) + fig('지우는 곳은 메뉴의 초기화 한 곳', frame('M-01', 1)),
      ['워드마크를 눌러도 아무 일도 일어나지 않아요.', '확인 창이 없어져요.', '작업을 지우는 길은 편집 메뉴의 “초기화”(두 번 누르기) 하나만 남아요.'],
      ['실수로 눌러서 작업이 날아갈 위험이 없어요.', '지우는 길이 한 곳이라 설명하기 쉬워요.', '편집 화면의 바뀐 동작(‹로 랜딩, 문서는 보존)과 결이 맞아요.'],
      ['결과 화면에서 바로 새로 시작하는 길이 없어요. ‹로 편집에 돌아가 메뉴에서 초기화해야 해요.']);
    h += opt('B', '워드마크 = 랜딩(문서 보존)', false, '워드마크를 누르면 랜딩으로 가고, 문서는 지우지 않아요. 편집 화면의 ‹와 같은 뜻이에요.',
      fig('결과 화면 · 워드마크가 랜딩으로', result('wm')) + fig('도착 · 이어서 만들기가 보여요', frame('L-02', 0)),
      ['워드마크 탭이 “랜딩으로 가기”로 바뀌어요(문서 보존).', '확인 창은 필요 없어요.'],
      ['결과 화면에서 바로 첫 화면으로 갈 수 있어요.', '지워지지 않아서 되돌아와 이어서 만들 수 있어요.'],
      ['같은 화면에 “돌아가기”가 둘이에요. ‹는 편집으로, 워드마크는 랜딩으로 가서 헷갈릴 수 있어요.']);
    h += opt('C', '지금 R-01로 바꾸기', false, '결과 화면 상단 줄을 “‹ + 가운데 제목 완성”으로 바꿔요(마스터 R-01). 워드마크는 결과 화면에서 빠져요.',
      fig('마스터 R-01 · 제목 “완성”', frame('R-01', 0)),
      ['워드마크 자리에 “완성” 제목이 들어가요.', '결과 화면에서 워드마크 동작 자체가 없어져요.'],
      ['다른 화면과 똑같은 상단 줄이라 일관돼요.', '결과 화면이 무슨 화면인지 제목으로 알 수 있어요.'],
      ['결과 화면 정리는 S7 범위인데 이 안은 그 작업을 앞당겨 와요.', '브랜드 표시가 결과 화면에서 사라져요.']);
    h += '</div></div>';
    return h;
  };
  W.D05_CSS = '.d5 { font-family: var(--pr-font); color: var(--pr-ink); padding: 32px 40px 56px; }' +
    '.d5 h1 { margin: 4px 0 0; font-size: 24px; line-height: 30px; font-weight: 600; letter-spacing: -.02em; }' +
    '.d5 h2 { margin: 0; font-size: 19px; line-height: 26px; font-weight: 600; display: flex; gap: 10px; align-items: baseline; }' +
    '.d5 h3 { margin: 0 0 6px; font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); }' +
    '.d5 h2 .k { font-variant-numeric: tabular-nums; color: var(--pr-ink-3); }' +
    '.d5-q { margin: 0; font-size: 13px; color: var(--pr-ink-2); font-weight: 500; }' +
    '.d5-lede { margin: 10px 0 24px; color: var(--pr-ink-2); max-width: 72ch; font-size: 15px; line-height: 1.55; }' +
    '.d5-now { background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; margin-bottom: 40px; }' +
    '.d5-nowrow { display: flex; gap: 24px; margin-top: 16px; align-items: flex-start; }' +
    '.d5-txt { flex: 1; min-width: 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d5-txt ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; }' +
    '.d5-dlg { width: 393px; box-sizing: border-box; background: var(--pr-s2); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-sheet); padding: 20px; display: flex; flex-direction: column; gap: 16px; font-size: 15px; line-height: 22px; }' +
    '.d5-dlg p { margin: 0; } .d5-btns { display: flex; justify-content: flex-end; gap: 8px; }' +
    '.d5-opts { display: flex; gap: 40px; align-items: flex-start; }' +
    '.d5-o { flex: 1; min-width: 0; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; }' +
    '.d5-o.rec { border-color: var(--pr-accent); border-width: 2px; padding: 23px; }' +
    '.d5-rec { font-size: 12px; font-weight: 600; border: 1px solid currentColor; border-radius: var(--pr-r-tag); padding: 0 5px; line-height: 18px; color: var(--pr-accent); }' +
    '.d5-sum { margin: 8px 0 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); min-height: 42px; }' +
    '.d5-row { display: flex; gap: 24px; margin-top: 16px; }' +
    '.d5-fig { margin: 0; flex: none; width: 393px; display: flex; flex-direction: column; gap: 8px; --fw: 393px; --fh: 852px; --sb: 54px; }' +
    '.d5-fig figcaption { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); background: var(--pr-page); padding: 4px 8px; }' +
    '.d5-bs { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d5-b ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }';
})();
