/* D11 결과 화면 확정안(D08 A 다듬기, 2차). D11-result-final.html과 tools/gen-canvas.js가 같이 불러요.
   결과 화면 정리는 S7 범위예요. S2는 워드마크 탭 동작만 없애요. 라이트 · 다크는 .d11 / .d11-dk 토큰 클래스로 나눠요. */
(function () {
  var W = window, S = W.PR, i = S.i, SAFE = '<div class="safe-b"></div>';
  var LEGAL = '비공식 팬메이드 티켓이라 양도·재판매할 수 없고, 정보 정확성은 보장하지 않으며 분실·훼손에 책임지지 않아요.';
  function ic(d) { return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>'; }
  var SAVE = ic('M12 4v11M8 11l4 4 4-4M5 20h14'), LINK = ic('M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1'), SHARE = ic('M12 3v12M8 7l4-4 4 4M5 12v8h14v-8');
  var SPIN = '<span class="spin" aria-hidden="true"></span>';
  /* 치수(393 × 852 프레임): 위 = 상태 막대 54 + ‹ 줄 44 + 간격 8, 아래 = 간격 12 + 버튼 줄 44 + 안내 + 홈 34 */
  var FH = 852, TOP = 54 + 44 + 8, SIDE = 16, FW = 393;
  function noticeH(link) { return 4 + 32 + (link ? 18 : 0); }
  function bottomH(o) { return 12 + 44 + noticeH(o.link) + (o.newT ? 44 : 0) + 34; }
  /* 티켓 크기: 가로는 좌우 16px, 높이는 남은 만큼. 둘 중 작은 쪽이 한계예요 */
  function size(o) {
    if (o.wide) { var w = FW - 2 * SIDE; return [w, Math.round(w * 960 / 1534)]; }
    var wb = FW - 2 * SIDE, hb = FH - TOP - bottomH(o), h = Math.min(Math.round(wb * 1534 / 960), hb);
    return [Math.round(h * 960 / 1534), h];
  }
  W.D11_SIZE = size;
  function row(o) {
    o = o || {};
    var ring = function (k) { return o.ring === k ? ' ring' : ''; };
    var saveIc = o.save === 'busy' ? SPIN : o.save === 'done' ? i('check') : SAVE;
    var linkIc = o.link === 'busy' ? SPIN : o.link === 'done' ? i('check') : LINK;
    var off = o.save === 'busy' || o.link === 'busy';
    return '<div class="d11-row" role="group" aria-label="저장 · 공유">' +
      '<button class="c-btn pri d11-save' + ring('save') + '"' + (o.save === 'busy' ? ' aria-busy="true" aria-disabled="true"' : o.link === 'busy' ? ' disabled' : '') + '>' + saveIc + '저장</button>' +
      '<button class="c-btn txt d11-t' + ring('link') + '"' + (o.link === 'busy' ? ' aria-busy="true" aria-disabled="true"' : o.save === 'busy' ? ' disabled' : '') + '>' + linkIc + '링크</button>' +
      '<button class="c-btn txt d11-t' + ring('share') + '"' + (off ? ' disabled' : '') + '>' + SHARE + '공유</button></div>';
  }
  /* 안내: 고지는 늘 보이고, 링크가 있으면 그 위에 만료 한 줄이 붙어요 */
  function notice(link) { return '<div class="d11-notice">' + (link ? '<small class="m">링크는 3일 뒤 만료돼요</small>' : '') + '<p class="c-legal">' + LEGAL + '</p></div>'; }
  function newBtn(on) { return on ? '<button class="c-btn txt d11-new">새 티켓 만들기</button>' : ''; }
  function alertRow(t) { return '<div class="c-alert d11-al" role="alert"><span class="ic"></span><span class="tx">' + t + '</span></div>'; }
  /* o: {link:bool(링크가 있음), wide, newT(새 티켓 만들기), row, alert} */
  function phone(o) {
    o = o || {};
    var sz = size(o), top = '<div class="c-tb"><button class="c-ib" aria-label="편집으로 돌아가기">' + i('back') + '</button></div>';
    var tk = '<div class="d11-tk" style="width:' + sz[0] + 'px;height:' + sz[1] + 'px">' + S.ticket({ wide: o.wide }) + '</div>';
    return S.phone(top + '<div class="d11-stage' + (o.wide ? ' land' : '') + '">' + tk + '</div>' + (o.alert ? alertRow(o.alert) : '') + row(o.row) + notice(o.link) + newBtn(o.newT) + SAFE);
  }
  function fig(cap, html, cls) { return '<figure class="d11-fig ' + (cls || '') + '"><figcaption>' + cap + '</figcaption>' + html + '</figure>'; }
  function sc(cap, o) {
    o = o || {};
    return '<figure class="d11-sc"><div class="d11-box d11-crop">' + (o.toast ? S.toast(o.toast, { top: 8 }) : '') + '<div class="d11-cin">' + (o.alert ? alertRow(o.alert) : '') + row(o.row) + notice(o.link) + newBtn(o.newT) + '</div></div><figcaption>' + cap + '</figcaption></figure>';
  }
  function lst(t, a) { return '<div class="d11-b"><h3>' + t + '</h3><ul>' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>'; }
  function px(o) { var s = size(o); return s[0] + ' × ' + s[1] + 'px'; }

  W.D11_HTML = function () {
    var h = '<div class="d11">';
    h += '<p class="d11-q">#826 S2 착수 전 · 결정 D11 (D08 A 확정안 2차)</p><h1>결과 화면</h1>' +
      '<p class="d11-lede">티켓이 주인공이에요. 위에는 ‹ 하나, 아래에는 버튼 한 줄과 안내만 있어요. 이번 판은 티켓 위쪽 여백을 줄이고, 버튼을 티켓 쪽으로 올리고, 아래에 고지를 늘 보이게 해서 위아래를 맞췄어요. 결과 화면 정리는 S7 범위예요. S2에서는 워드마크 탭 동작만 없애요.</p>';
    h += '<section class="d11-now"><h2>A 고지만 <span class="d11-rec">추천</span></h2><div class="d11-nowrow">' +
      fig('라이트 · 기본', phone({})) + fig('다크 · 기본', phone({}), 'd11-dk') + fig('링크 만든 뒤', phone({ link: true, row: { link: 'done' } })) + fig('가로 무드(35mm 와이드) · 가로가 한계', phone({ wide: true })) +
      '</div><div class="d11-bs">' +
      lst('정한 것', ['‹ 줄은 44px이고 티켓이 그 아래 8px에서 바로 시작해요. 위쪽 빈 공간은 없어요.', '티켓은 좌우 16px만 두고 <b>' + px({}) + '</b>이에요(지금 274 × 437px에서 높이 +140px). 가로가 한계라 높이에는 여유가 남아요.', '가로 무드는 돌리지 않고 가로가 한계라 <b>' + px({ wide: true }) + '</b>이에요. 티켓은 남는 높이 가운데에 놓여요.', '버튼 줄은 티켓 12px 아래에 있어요. 저장은 강조색 채움, 링크와 공유는 글자와 아이콘이에요.', '비공식 고지는 늘 두 줄로 보여요(12/16, ink-3). 링크가 있으면 그 위에 “링크는 3일 뒤 만료돼요”가 한 줄 붙어요(ink-2).', '링크를 만들면 바로 복사하고 “링크를 복사했어요”로 알려요. 만료 안내 18px은 남는 43px 안에 들어가서 티켓 크기는 그대로예요.']) +
      lst('위아래 균형', ['위: ‹ 줄 44 + 간격 8 = <b>52px</b>(상태 막대 54 별도).', '아래: 간격 12 + 버튼 줄 44 + 안내 36 = <b>92px</b>(링크가 있으면 110px, 홈 영역 34 별도).', '티켓 아래 남는 높이는 43px이고 링크 안내 18px을 이 안에서 받아서, 링크를 만들어도 티켓이 움직이지 않아요. 남는 높이는 고지 아래로 흘러요.']) +
      lst('좋은 점', ['티켓이 가장 크고 위아래가 같은 무게예요.', '고지가 늘 보여서 링크 흐름에서 빠질 일이 없어요.', '저장 하나만 강조라 주 행동이 분명해요.']) +
      lst('걸리는 점', ['결과 화면에서 바로 새 티켓을 시작하는 길이 없어요(‹ 로 돌아가서 메뉴로).', '고지 두 줄이 늘 보이는 게 조용한 화면에서는 조금 무거울 수 있어요.']) + '</div>' +
      '<p class="d11-fam">익숙한 패턴: 사진 앱 공유 화면처럼 작품은 크게, 동작은 아래 한 줄이에요. 링크 만들기를 공유 시트 앞에 두는 점만 달라요.</p></section>';
    h += '<section class="d11-now"><h2>B 고지 + 새 티켓 만들기</h2><div class="d11-nowrow">' +
      fig('기본', phone({ newT: true })) + fig('링크 만든 뒤 · 티켓이 줄어요', phone({ newT: true, link: true, row: { link: 'done' } })) +
      '</div><div class="d11-bs">' +
      lst('무엇이 달라지나', ['안내 아래에 글자만 있는 “새 티켓 만들기”(44px 줄, ink-3)가 붙어요. 저장 아래 두 번째 줄이라 저장과 겹치지 않아요.', '누르면 문서는 남기고 랜딩으로 가요. 랜딩의 “이어서 만들기”(L-02)로 돌아올 수 있어요.', '티켓 크기는 ' + px({ newT: true }) + '(링크가 있으면 ' + px({ newT: true, link: true }) + ')로 줄어요.']) +
      lst('좋은 점', ['저장하고 바로 다음 티켓으로 넘어가는 길이 생겨요.', '글자만이라 저장과 경쟁하지 않아요.']) +
      lst('걸리는 점', ['이름은 “새 티켓”인데 하는 일은 랜딩으로 가기예요. 문서는 지워지지 않아서 “이어서 만들기”에 남아요. 지우기는 여전히 메뉴의 초기화 두 번 누르기뿐이에요(결과 화면에서 바로 지우면 안 돼요).', '줄 하나가 더 늘어 아래가 무거워지고 링크를 만든 뒤 티켓 높이가 18px 줄어요.', '‹(편집으로)와 새 티켓 만들기(랜딩으로)가 갈래가 둘이라 헷갈릴 수 있어요.']) + '</div></section>';
    h += '<section class="d11-st"><h2>상태</h2><p class="d11-fam">하단만 잘라서 나란히 놓았어요. 버튼은 모두 44px이에요. 고지는 모든 상태에서 보여요.</p><div class="d11-strip">' +
      sc('기본', {}) + sc('포커스 · 저장에 링', { row: { ring: 'save' } }) + sc('저장 중 · aria-busy, 나머지는 꺼져요', { row: { save: 'busy' } }) +
      sc('저장했어요 · 체크가 잠깐 보여요', { row: { save: 'done' }, toast: '저장했어요' }) +
      sc('저장 실패 · 버튼은 그대로 저장(다시 시도)', { alert: '저장하지 못했어요' }) +
      sc('링크 만드는 중', { row: { link: 'busy' } }) +
      sc('링크 만든 뒤 · 자동 복사와 만료 안내', { row: { link: 'done' }, toast: '링크를 복사했어요', link: true }) +
      sc('공유 불가(Web Share 없음) · 공유를 누르면 링크를 복사해요', { toast: '링크를 복사했어요', link: true }) +
      sc('B · 새 티켓 만들기가 붙은 모양', { newT: true, link: true, row: { link: 'done' } }) + '</div></section>';
    h += '<section class="d11-memo"><h2>구현 메모</h2><ul>' +
      '<li><b>재사용</b> ResultPanel의 저장 · 공유 · 링크 로직(저장 중 상태, copyState idle/copied/manual, canShareTicketFile과 navigator.share, 클립보드 실패 시 읽기 전용 입력 대체)은 그대로 두고 배치만 바꿔요. 티켓 미리보기는 ResultStage가 그대로 맡아요.</li>' +
      '<li><b>새 코드</b> 하단 한 줄 레이아웃, 아이콘 3개, 체크 표시(약 1.5초), 늘 보이는 고지 블록이에요. 티켓 크기는 가로 361px 한계와 남는 높이 중 작은 쪽을 쓰는 계산이 필요해요(ResultStage가 이미 PhoneFrame 안 크기를 알아요). 워드마크와 크기 줄(1960 × 3108 · JPEG)은 지워요.</li>' +
      '<li><b>고지</b> UNOFFICIAL_TICKET_NOTICE는 법적 고지라 문구를 바꾸지 않고, 늘 렌더되는지 확인하는 테스트를 둬요.</li>' +
      '<li><b>접근성</b> 버튼은 모두 실제 button이에요. 저장 중에는 aria-busy, 결과 통보는 role=status, 실패 알림은 role=alert예요.</li>' +
      '<li><b>빠지는 것</b> 링크 입력 칸과 복사 버튼이 사라져요. 클립보드가 막힌 환경(인앱 웹뷰)에서는 복사 실패 때만 링크 입력 칸을 줄 위에 보여 주는 대체가 필요해요.</li>' +
      '<li><b>위험</b> 낮은 화면(667px 등)에서는 고지 두 줄과 버튼 줄이 티켓 높이를 깎아요. 실기기 확인이 필요해요.</li></ul></section>';
    return h + '</div>';
  };
  W.D11_CSS = '.d11 { font-family: var(--pr-font); color: var(--pr-ink); padding: 32px 40px 56px; }' +
    '.d11 h1 { margin: 4px 0 0; font-size: 24px; line-height: 30px; font-weight: 600; letter-spacing: -.02em; }' +
    '.d11 h2 { margin: 0; font-size: 19px; line-height: 26px; font-weight: 600; display: flex; gap: 10px; align-items: baseline; }' +
    '.d11 h3 { margin: 0 0 6px; font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); }' +
    '.d11 h2 .k { font-variant-numeric: tabular-nums; color: var(--pr-ink-3); }' +
    '.d11-q { margin: 0; font-size: 13px; color: var(--pr-ink-2); font-weight: 500; }' +
    '.d11-lede { margin: 10px 0 24px; color: var(--pr-ink-2); max-width: 72ch; font-size: 15px; line-height: 1.55; }' +
    '.d11-now { background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; margin-bottom: 40px; }' +
    '.d11-nowrow { display: flex; gap: 24px; margin-top: 16px; align-items: flex-start; }' +
    '.d11-txt { flex: 1; min-width: 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d11-txt ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; }' +
    '.d11-hint { margin: 16px 0 0; font-size: 13px; color: var(--pr-ink-3); }' +
    '.d11-opts { display: flex; gap: 40px; align-items: flex-start; }' +
    '.d11-o { flex: 1; min-width: 0; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; }' +
    '.d11-o.rec { border-color: var(--pr-accent); border-width: 2px; padding: 23px; }' +
    '.d11-rec { font-size: 12px; font-weight: 600; border: 1px solid currentColor; border-radius: var(--pr-r-tag); padding: 0 5px; line-height: 18px; color: var(--pr-accent); }' +
    '.d11-sum { margin: 8px 0 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); min-height: 42px; }' +
    '.d11-row { display: flex; gap: 24px; margin-top: 16px; }' +
    '.d11-fig { margin: 0; flex: none; width: 393px; display: flex; flex-direction: column; gap: 8px; --fw: 393px; --fh: 852px; --sb: 54px; }' +
    '.d11-fig figcaption { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); background: var(--pr-page); padding: 4px 8px; }' +
    '.d11-bs { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d11-b ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }' +
    '.d11 { --pr-page: var(--pr-l-page); --pr-stage: var(--pr-l-stage); --pr-s1: var(--pr-l-s1); --pr-s2: var(--pr-l-s2); --pr-hair: var(--pr-l-hair); --pr-hair-strong: var(--pr-l-hair-strong); --pr-ink: var(--pr-l-ink); --pr-ink-2: var(--pr-l-ink2); --pr-ink-3: var(--pr-l-ink3); --pr-accent: var(--pr-l-accent); --pr-accent-ink: var(--pr-l-accent-ink); --pr-warn: var(--pr-l-warn); --pr-kbd: var(--pr-l-kbd); --pr-key: var(--pr-l-key); --pr-scrim: var(--pr-l-scrim); --pr-ticket-shadow: var(--pr-l-ticket-shadow); color-scheme: light; background: var(--pr-page); }' +
    '.d11 .d11-dk { --pr-page: var(--pr-d-page); --pr-stage: var(--pr-d-stage); --pr-s1: var(--pr-d-s1); --pr-s2: var(--pr-d-s2); --pr-hair: var(--pr-d-hair); --pr-hair-strong: var(--pr-d-hair-strong); --pr-ink: var(--pr-d-ink); --pr-ink-2: var(--pr-d-ink2); --pr-ink-3: var(--pr-d-ink3); --pr-accent: var(--pr-d-accent); --pr-accent-ink: var(--pr-d-accent-ink); --pr-warn: var(--pr-d-warn); --pr-kbd: var(--pr-d-kbd); --pr-key: var(--pr-d-key); --pr-scrim: var(--pr-d-scrim); --pr-ticket-shadow: var(--pr-d-ticket-shadow); color-scheme: dark; }' +
    '.d11 { --d11-ring: var(--pr-accent); --d11-ghost: rgba(30,27,24,.35); }' +
    '.d11 .ring { outline: 2px solid var(--d11-ring); outline-offset: 2px; }' +
    '.d11-memo { border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); background: var(--pr-s1); padding: 20px 24px; margin-top: 40px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d11-memo h2 { margin-bottom: 8px; } .d11-memo ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; max-width: 110ch; } .d11-memo b { color: var(--pr-ink); font-weight: 600; }' +
    '.d11-st { margin-top: 40px; } .d11-st h2 { margin-bottom: 4px; }' +
    '.d11-strip { display: flex; flex-wrap: wrap; gap: 24px; margin-top: 16px; align-items: flex-start; }' +
    '.d11-sc { margin: 0; width: 393px; display: flex; flex-direction: column; gap: 8px; }' +
    '.d11-sc figcaption { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); }' +
    '.d11-box { position: relative; box-sizing: border-box; border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); background: var(--pr-s1); overflow: hidden; }' +
    '.d11-fam { margin: 8px 0 0; font-size: 13px; line-height: 19px; color: var(--pr-ink-3); }' +
    '.d11-t { border-collapse: collapse; font-size: 14px; line-height: 21px; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); margin: 0 0 24px; } .d11-t th, .d11-t td { text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--pr-hair); vertical-align: top; } .d11-t th { background: var(--pr-s2); font-weight: 600; } .d11-t td:first-child { font-weight: 600; white-space: nowrap; }' +
    '.d11-nowrow { display: flex; gap: 24px; align-items: flex-start; }' +
    '.d11-nowrow { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }' +
    '.d11-bs { flex-direction: row; gap: 40px; margin-top: 24px; flex-wrap: wrap; } .d11-bs .d11-b { flex: 1; min-width: 300px; }' +
    '.d11-now h2 { margin-bottom: 0; }' +
    '.d11-stage { flex: none; display: flex; justify-content: center; margin-top: 8px; }' +
    '.d11-stage.land { flex: 1; min-height: 0; align-items: center; margin-top: 0; }' +
    '.d11-tk { position: relative; flex: none; }' +
    '.d11-row { flex: none; display: flex; justify-content: center; align-items: center; gap: 4px; min-height: 44px; margin-top: 12px; }' +
    '.d11-row .c-btn { display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; height: 44px; min-height: 44px; margin: 0; box-sizing: border-box; vertical-align: middle; } .d11-row .c-btn:not(.pri) { border-color: transparent; background: transparent; }' +
    '.d11-save { min-height: 44px; } .d11-t { color: var(--pr-ink-2); } .d11-row .c-btn.ring { outline-offset: 2px; }' +
    '.d11-row .c-btn.pri .spin { border-color: var(--pr-accent-ink); border-right-color: transparent; }' +
    '.d11-row .c-btn.pri[aria-busy="true"] { background: var(--pr-accent); border-color: var(--pr-accent); color: var(--pr-accent-ink); font-weight: 600; opacity: .8; }' +
    '.d11-notice { flex: none; box-sizing: border-box; padding: 4px 24px 0; text-align: center; display: flex; flex-direction: column; gap: 2px; }' +
    '.d11-notice .m { font-size: 12px; line-height: 16px; color: var(--pr-ink-2); } .d11-notice .c-legal { margin: 0; font-size: 12px; line-height: 16px; color: var(--pr-ink-3); }' +
    '.d11-new { flex: none; align-self: center; height: 44px; min-height: 44px; padding: 0 12px; color: var(--pr-ink-3); font-size: 13px; }' +
    '.d11-al { margin: 0 16px; }' +
    '.d11-crop { width: 393px; min-height: 120px; padding-top: 56px; } .d11-cin { padding: 0 0 12px; display: flex; flex-direction: column; }' +
    '.d11-crop .c-toast { z-index: 3; }' +
    '.d11 svg.i { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; flex: none; }';
})();
