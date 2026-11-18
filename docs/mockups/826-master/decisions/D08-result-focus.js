/* D08 결과 화면 · 티켓에 집중 재시안(D05 후속, 워드마크는 두 안 모두 없음). D08-result-focus.html과 tools/gen-canvas.js가 같이 불러요.
   결과 화면 정리는 S7 범위예요. S2는 워드마크 탭 동작만 없애요. 라이트 한 가지만 그려요. */
(function () {
  var W = window, S = W.PR, i = S.i, SAFE = '<div class="safe-b"></div>';
  var LEGAL = '비공식 팬메이드 티켓이라 양도·재판매할 수 없고, 정보 정확성은 보장하지 않으며 분실·훼손에 책임지지 않아요.';
  function ic(d) { return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>'; }
  var SAVE = ic('M12 4v11M8 11l4 4 4-4M5 20h14'), LINK = ic('M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1'), SHARE = ic('M12 3v12M8 7l4-4 4 4M5 12v8h14v-8');
  var BACK = '<button class="c-ib" aria-label="편집으로 돌아가기">' + i('back') + '</button>';
  /* 지금: 마스터 R-01 이전의 현행 구성(‹ · 워드마크 · 빈칸) */
  function current() {
    var top = '<div class="c-tb">' + BACK + '<span style="flex:1;display:flex;justify-content:center">' + S.wordmark() + '</span><span style="width:44px;flex:none"></span></div>';
    var body = '<div class="c-rbody"><div class="beam" aria-hidden="true"></div><div class="c-rtk">' + S.ticket({}) + '</div><p class="c-spec">1960 × 3108 · JPEG</p></div>' +
      '<div class="c-racts"><button class="c-btn pri cta block">사진에 저장</button><div class="c-lrow"><button class="c-btn txt u">링크 만들기</button><small>3일 뒤 만료</small><button class="c-btn txt u">공유</button></div>' + SAFE + '</div>';
    return S.phone(top + body);
  }
  /* A: 상단은 ‹ 하나, 아래 가운데 작은 버튼 묶음 */
  function phoneA(made) {
    var top = '<div class="c-tb">' + BACK + '</div>';
    var bar = '<div class="d8-abar"><button class="c-btn pri d8-save">' + SAVE + '저장</button><button class="c-btn txt d8-t">' + (made ? i('check') + '복사됨' : LINK + '링크') + '</button><button class="c-btn txt d8-t">' + SHARE + '공유</button></div>' +
      (made ? '<div class="d8-note"><small>3일 뒤 만료</small><p class="c-legal">' + LEGAL + '</p></div>' : '');
    return S.phone(top + '<div class="d8-stage"><div class="d8-tk" style="width:361px">' + S.ticket({}) + '</div></div>' + bar + SAFE);
  }
  /* B: 티켓이 화면 전체, ‹는 떠 있는 아이콘, 아래 면 막대 */
  function phoneB(made) {
    var btn = function (icon, lb) { return '<button class="d8-ib">' + icon + '<span>' + lb + '</span></button>'; };
    var bar = '<div class="d8-bbar" role="toolbar" aria-label="저장 · 공유">' + (made ? '<div class="d8-bnote"><small>3일 뒤 만료</small><p class="c-legal">' + LEGAL + '</p></div>' : '') +
      '<div class="d8-bbtns">' + btn(SAVE, '저장') + btn(made ? i('check') : LINK, made ? '복사됨' : '링크') + btn(SHARE, '공유') + '</div></div>';
    return S.phone('<div class="d8-full"><div class="d8-tk" style="width:377px">' + S.ticket({}) + '</div></div><button class="c-ib d8-float" aria-label="편집으로 돌아가기">' + i('back') + '</button>' + bar);
  }
  function fig(cap, html) { return '<figure class="d8-fig"><figcaption>' + cap + '</figcaption>' + html + '</figure>'; }
  function lst(t, a) { return '<div class="d8-b"><h3>' + t + '</h3><ul>' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>'; }
  function opt(k, name, rec, sum, figs, chg, good, risk) {
    return '<section class="d8-o' + (rec ? ' rec' : '') + '"><h2><span class="k">' + k + '</span>' + name + (rec ? ' <span class="d8-rec">추천</span>' : '') + '</h2><p class="d8-sum">' + sum + '</p><div class="d8-row">' + figs + '</div><div class="d8-bs">' + lst('무엇이 달라지나', chg) + lst('좋은 점', good) + lst('걸리는 점', risk) + '</div></section>';
  }

  W.D08_HTML = function () {
    var h = '<div class="d8">';
    h += '<p class="d8-q">#826 S2 착수 전 · 결정 D08 (D05 재시안)</p><h1>결과 화면은 티켓에 집중하고 공유 버튼은 작게 해요</h1>' +
      '<p class="d8-lede">마지막 화면에서는 티켓이 주인공이고, 부차 요소는 다 빼요. 두 안 모두 워드마크가 없어요. 결과 화면 정리는 S7 범위예요. S2에서는 워드마크 탭 동작만 없애요.</p>';
    h += '<section class="d8-now"><h2>지금은 이래요</h2><div class="d8-nowrow"><div class="d8-txt"><ul>' +
      '<li>맨 위 줄에 ‹(편집으로 돌아가기), 가운데 FILME 워드마크, 오른쪽 빈 칸이 있어요.</li>' +
      '<li>티켓은 화면 가로의 70%라 <b>274px × 437px</b>이에요(393 × 852 프레임 기준).</li>' +
      '<li>티켓 아래에 “1960 × 3108 · JPEG” 크기 줄이 있어요.</li>' +
      '<li>그 아래에 가로로 꽉 찬 큰 “사진에 저장” 버튼(48px)이 있고, 바로 밑에 “링크 만들기 · 3일 뒤 만료 · 공유” 한 줄이 있어요.</li>' +
      '<li>링크를 만들면 링크 칸과 비공식 고지 문구가 더 붙어요.</li></ul></div>' + fig('지금 · 결과 화면', current()) + '</div></section>';
    h += '<div class="d8-opts">';
    h += opt('A', '아래 작은 막대', true, '상단은 ‹ 하나만 두고, 티켓을 화면 가득 키워요. 아래 가운데에 높이 44px 한 줄로 [저장] [링크] [공유]를 놓아요. 저장만 강조색으로 채우고 나머지는 글자와 아이콘이에요.',
      fig('A · 기본', phoneA(false)) + fig('A · 링크 만든 뒤', phoneA(true)),
      ['티켓 크기가 약 <b>274 × 437px</b>에서 <b>361 × 577px</b>으로 커져요(높이 +140px, 약 +32%).', '워드마크, 크기 줄(1960 × 3108 · JPEG), “3일 뒤 만료” 문구가 처음에는 없어요.', '링크를 만든 뒤에만 “3일 뒤 만료”와 비공식 고지가 나타나요. 고지는 링크로 공유하는 흐름에서 꼭 필요해서 남겼어요(문장이 길어서 두 줄이 돼요).'],
      ['저장이 주 행동이라는 위계가 그대로예요(강조색 채움).', '상단 줄이 ‹ 하나로 단순해요.', '막대가 티켓 아래 별도 줄이라 티켓을 가리지 않아요.'],
      ['보조 둘이 글자와 아이콘뿐이라 눌리는 것으로 안 보일 수 있어요.', '가로가 좁은 화면(360px 이하)에서는 세 버튼이 빠듯해요.', '링크를 만든 뒤 고지가 붙으면 티켓이 조금 줄어들어요(577px 안에서 유지돼요).']);
    h += opt('B', '떠 있는 면 막대', false, '티켓이 화면 전체를 쓰고 상단 줄도 없어요. ‹는 왼쪽 위에 떠 있는 44px 아이콘이고, 아래에는 모서리 6px의 면 막대에 아이콘 셋(저장 · 링크 · 공유)이 아이콘 아래 11px 이름과 함께 있어요.',
      fig('B · 기본', phoneB(false)) + fig('B · 링크 만든 뒤', phoneB(true)),
      ['티켓 크기가 약 <b>274 × 437px</b>에서 <b>377 × 602px</b>으로 커져요(높이 +165px, 약 +38%).', '상단 줄 없이 ‹만 티켓 위에 떠 있어요. 막대는 반투명이 아니라 불투명한 면이에요.', '링크를 만들면 막대 안에 “3일 뒤 만료”와 고지가 붙어 막대가 높아져요.'],
      ['티켓이 가장 크게 보여요.', '세 아이콘이 같은 무게라 한 묶음처럼 정돈돼 보여요.'],
      ['저장이 주 행동이라는 위계가 약해져요. 세 아이콘이 같은 크기예요.', '막대가 티켓 아래 가장자리를 가릴 위험이 있어요. 852px 높이에서는 안 겹치지만, 더 낮은 화면(예: 667px)이나 링크 문구가 붙은 상태에서는 겹쳐요.', '링크를 만든 뒤에는 막대가 높아져서 ‹와 티켓 위쪽이 겹칠 수 있어요.', '요구 6(저장물 = 프리뷰)은 티켓이 그대로 보이는 쪽이 지켜요. 가려지는 면이 생기면 어긋나요.']);
    h += '</div></div>';
    return h;
  };
  W.D08_CSS = '.d8 { font-family: var(--pr-font); color: var(--pr-ink); padding: 32px 40px 56px; }' +
    '.d8 h1 { margin: 4px 0 0; font-size: 24px; line-height: 30px; font-weight: 600; letter-spacing: -.02em; }' +
    '.d8 h2 { margin: 0; font-size: 19px; line-height: 26px; font-weight: 600; display: flex; gap: 10px; align-items: baseline; }' +
    '.d8 h3 { margin: 0 0 6px; font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); }' +
    '.d8 h2 .k { font-variant-numeric: tabular-nums; color: var(--pr-ink-3); }' +
    '.d8-q { margin: 0; font-size: 13px; color: var(--pr-ink-2); font-weight: 500; }' +
    '.d8-lede { margin: 10px 0 24px; color: var(--pr-ink-2); max-width: 72ch; font-size: 15px; line-height: 1.55; }' +
    '.d8-now { background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; margin-bottom: 40px; }' +
    '.d8-nowrow { display: flex; gap: 24px; margin-top: 16px; align-items: flex-start; }' +
    '.d8-txt { flex: 1; min-width: 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d8-txt ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; }' +
    '.d8-hint { margin: 16px 0 0; font-size: 13px; color: var(--pr-ink-3); }' +
    '.d8-opts { display: flex; gap: 40px; align-items: flex-start; }' +
    '.d8-o { flex: 1; min-width: 0; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; }' +
    '.d8-o.rec { border-color: var(--pr-accent); border-width: 2px; padding: 23px; }' +
    '.d8-rec { font-size: 12px; font-weight: 600; border: 1px solid currentColor; border-radius: var(--pr-r-tag); padding: 0 5px; line-height: 18px; color: var(--pr-accent); }' +
    '.d8-sum { margin: 8px 0 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); min-height: 42px; }' +
    '.d8-row { display: flex; gap: 24px; margin-top: 16px; }' +
    '.d8-fig { margin: 0; flex: none; width: 393px; display: flex; flex-direction: column; gap: 8px; --fw: 393px; --fh: 852px; --sb: 54px; }' +
    '.d8-fig figcaption { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); background: var(--pr-page); padding: 4px 8px; }' +
    '.d8-bs { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d8-b ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }' +
    '.d8-stage, .d8-full { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }' +
    '.d8-tk { position: relative; aspect-ratio: 960/1534; container-type: normal; }' +
    '.d8-abar { flex: none; display: flex; justify-content: center; align-items: center; gap: 4px; min-height: 44px; margin: 8px 0 0; }' +
    '.d8-abar .c-btn { display: inline-flex; gap: 6px; padding: 0 12px; }' +
    '.d8-save { min-height: 44px; } .d8-t { color: var(--pr-ink-2); }' +
    '.d8-note { flex: none; padding: 4px 16px 0; text-align: center; display: flex; flex-direction: column; gap: 2px; } .d8-note small { font-size: 12px; line-height: 16px; color: var(--pr-ink-2); }' +
    '.d8-full { position: absolute; inset: 54px 0 94px 0; } ' +
    '.d8-float { position: absolute; left: 8px; top: 54px; z-index: 30; }' +
    '.d8-bbar { position: absolute; left: 12px; right: 12px; bottom: 42px; z-index: 30; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: 6px; padding: 4px; display: flex; flex-direction: column; gap: 4px; }' +
    '.d8-bnote { padding: 4px 8px 6px; text-align: center; display: flex; flex-direction: column; gap: 2px; border-bottom: 1px solid var(--pr-hair); } .d8-bnote small { font-size: 12px; line-height: 16px; color: var(--pr-ink-2); }' +
    '.d8-bbtns { display: flex; }' +
    '.d8-ib { flex: 1; min-width: 44px; min-height: 52px; border: 0; background: transparent; color: var(--pr-ink); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font: inherit; font-size: 11px; line-height: 14px; }';
})();
