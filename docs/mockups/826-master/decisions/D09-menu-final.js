/* D09 편집 메뉴 시트 확정안(D06 A 다듬기). D09-menu-final.html과 tools/gen-canvas.js가 같이 불러요.
   프레임은 lib.js 빌더와 frames.js(M-01 · menu())의 패턴으로 그려요. 라이트 · 다크는 .d9 / .d9-dk 토큰 클래스로 나눠요. */
(function () {
  var W = window, S = W.PR, i = S.i;
  var DT = ['무드', '색상', '재질', '코팅', '투명도', '크기'];
  var RESET = '한 번 더 눌러 전체 삭제';
  function tb() {
    return '<div class="c-tb"><button class="c-ib" aria-label="랜딩으로 돌아가기">' + i('back') + '</button><span class="sp"></span><button class="c-ib" aria-label="실행 취소">' + i('undo') + '</button><button class="c-ib" aria-label="다시 실행" disabled>' + i('redo') + '</button><button class="c-ib" aria-label="전체 보기">' + i('expand') + '</button><button class="c-ib" aria-label="편집 메뉴" aria-expanded="true" aria-haspopup="dialog">' + i('more') + '</button><button class="c-btn pri">완료</button></div>';
  }
  /* 시트 본문. o: {armed, autoOff, ghost(빈 항목 켬), focus('ghost'|'doc1'), pressed('doc2')} */
  function sheet(o) {
    o = o || {};
    var ring = function (k) { return o.focus === k ? ' ring' : ''; };
    var sw = function (on) { return '<span class="c-sw' + (on ? ' on' : '') + '" aria-hidden="true"></span>'; };
    var seg = '<span class="d9-seg"><button role="radio" aria-checked="true">시스템</button><button role="radio" aria-checked="false">라이트</button><button role="radio" aria-checked="false">다크</button></span>';
    var set = '<div class="d9-card" role="group" aria-label="설정">' +
      '<button class="d9-r' + ring('ghost') + '" role="switch" aria-checked="' + !!o.ghost + '"><span class="lb">빈 항목 표시</span>' + sw(o.ghost) + '</button>' +
      '<div class="d9-r" role="radiogroup" aria-label="테마"><span class="lb">테마</span>' + seg + '</div>' +
      '<button class="d9-r" role="switch" aria-checked="' + !o.autoOff + '"><span class="lb">자동저장' + (o.autoOff ? '' : '<small>11:42 저장</small>') + '</span>' + sw(!o.autoOff) + '</button></div>';
    var doc = '<div class="d9-card" role="group" aria-label="문서">' +
      '<button class="d9-r' + ring('doc1') + '"><span class="lb">스크린샷으로 자동입력</span></button>' +
      '<button class="d9-r' + (o.pressed === 'doc2' ? ' down' : '') + '"><span class="lb">임시저장</span></button>' +
      '<button class="d9-r' + (o.armed ? ' armed' : '') + '"><span class="lb" aria-live="polite">' + (o.armed ? RESET : '초기화') + '</span></button></div>';
    return set + doc;
  }
  function phone(o) {
    return S.phone(tb() + S.canvas({}) + S.dock('design', S.tools(DT, '무드') + '<div class="c-ctl">' + S.thumbs('minimal') + '</div>') + '<div class="c-scrim" aria-hidden="true"></div><div class="d9-sh" role="dialog" aria-modal="true" aria-label="편집 메뉴">' + sheet(o) + '</div>');
  }
  function fig(cap, html, cls) { return '<figure class="d9-fig ' + (cls || '') + '"><figcaption>' + cap + '</figcaption>' + html + '</figure>'; }
  function crop(cap, o) { return '<figure class="d9-sc"><div class="d9-box"><div class="d9-sh static">' + sheet(o) + '</div></div><figcaption>' + cap + '</figcaption></figure>'; }

  W.D09_HTML = function () {
    var h = '<div class="d9">';
    h += '<p class="d9-q">#826 S2 착수 전 · 결정 D09 (D06 A 확정안)</p><h1>편집 메뉴 시트</h1>' +
      '<p class="d9-lede">D06에서 고른 묶음 정리안을 구현할 수 있는 모양으로 다듬었어요. 카드 두 장, 한 줄 44px, 머리줄 없음이에요.</p>';
    h += '<section class="d9-now"><div class="d9-nowrow">' + fig('라이트 · 기본', phone({})) + fig('다크 · 기본', phone({}), 'd9-dk') +
      '<div class="d9-txt"><h2>정한 것</h2><ul>' +
      '<li>시트 높이는 약 <b>320px</b>이에요. 마스터 M-01(407px)보다 87px 낮아요.</li>' +
      '<li>닫는 방법은 바깥 누르기, ⋯ 다시 누르기, Esc 세 가지예요.</li>' +
      '<li>손잡이는 두지 않아요. 아래로 끌어서 닫는 동작이 없어서, 손잡이를 두면 없는 동작을 약속하게 돼요. 끌어서 닫기를 만들게 되면 그때 더해요.</li>' +
      '<li>빈 항목 표시는 정보 모드에서 자동으로 켜져요(D03 A). 스위치는 사진 · 디자인 모드에서만 효과가 있어요.</li>' +
      '<li>자동저장이 꺼지면 “11:42 저장” 시각 메타가 사라져요.</li>' +
      '<li>초기화는 두 번 눌러야 해요. 첫 번째 누르면 줄 글자가 앰버색 잠긴 문구로 바뀌고 3.2초 뒤 되돌아가요.</li></ul>' +
      '<p class="d9-fam">익숙한 패턴: iOS 동작 시트의 묶음 목록이에요. 설정은 위 카드, 문서 동작은 아래 카드로 나눴어요.</p></div></div></section>';
    h += '<section class="d9-st"><h2>상태</h2><p class="d9-fam">시트만 잘라서 나란히 놓았어요. 줄 높이는 모두 44px이에요.</p><div class="d9-strip">' +
      crop('초기화 확인 대기 · 앰버 글자', { armed: true }) + crop('자동저장 꺼짐 · 시각 메타 없음', { autoOff: true }) +
      crop('빈 항목 표시 켜짐', { ghost: true }) + crop('포커스 · 키보드로 이동한 줄에 링', { focus: 'ghost' }) +
      crop('눌림 · 임시저장 줄', { pressed: 'doc2' }) + '</div></section>';
    h += '<section class="d9-memo"><h2>구현 메모</h2><ul>' +
      '<li><b>재사용</b> MobileEditorShell의 MenuRow 문법(라벨 + 트레일링 스위치)과 초기화 arm(#374) 로직은 그대로 두고, 줄 높이를 52에서 44로 줄여요. 리딩 아이콘은 이 안에 없어서 빼요.</li>' +
      '<li><b>재사용</b> 뒤 화면 스크롤 잠금은 useBodyScrollLock, 400px 프레임 안의 fixed 좌표는 PhoneFrame의 getFrameRect를 써요(window 크기로 계산하지 않아요).</li>' +
      '<li><b>접근성</b> 헤드리스 라이브러리가 없어서 APG dialog를 직접 맞춰요. role=dialog와 aria-modal, 열면 첫 줄로 포커스, Esc로 닫기, 닫으면 ⋯로 포커스 복귀예요. FieldDrawer가 이미 같은 패턴(포커스 유지)을 써요.</li>' +
      '<li><b>새 코드</b> 카드 래퍼 두 장과 머리줄 제거, 테마 radiogroup 버튼 정도예요. Tailwind cva + cn으로 줄 변형(기본 · armed)만 더해요.</li>' +
      '<li><b>위험</b> 머리줄과 닫기 버튼이 없어져서 닫는 방법을 모르는 사람이 있을 수 있어요. 시트 위 어두운 바깥이 넓어져 실수로 닫기도 쉬워요. 실기기에서 확인이 필요해요.</li></ul></section>';
    return h + '</div>';
  };
  W.D09_CSS = '.d9 { font-family: var(--pr-font); color: var(--pr-ink); padding: 32px 40px 56px; }' +
    '.d9 h1 { margin: 4px 0 0; font-size: 24px; line-height: 30px; font-weight: 600; letter-spacing: -.02em; }' +
    '.d9 h2 { margin: 0; font-size: 19px; line-height: 26px; font-weight: 600; display: flex; gap: 10px; align-items: baseline; }' +
    '.d9 h3 { margin: 0 0 6px; font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); }' +
    '.d9 h2 .k { font-variant-numeric: tabular-nums; color: var(--pr-ink-3); }' +
    '.d9-q { margin: 0; font-size: 13px; color: var(--pr-ink-2); font-weight: 500; }' +
    '.d9-lede { margin: 10px 0 24px; color: var(--pr-ink-2); max-width: 72ch; font-size: 15px; line-height: 1.55; }' +
    '.d9-now { background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; margin-bottom: 40px; }' +
    '.d9-nowrow { display: flex; gap: 24px; margin-top: 16px; align-items: flex-start; }' +
    '.d9-txt { flex: 1; min-width: 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d9-txt ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; }' +
    '.d9-hint { margin: 16px 0 0; font-size: 13px; color: var(--pr-ink-3); }' +
    '.d9-opts { display: flex; gap: 40px; align-items: flex-start; }' +
    '.d9-o { flex: 1; min-width: 0; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; }' +
    '.d9-o.rec { border-color: var(--pr-accent); border-width: 2px; padding: 23px; }' +
    '.d9-rec { font-size: 12px; font-weight: 600; border: 1px solid currentColor; border-radius: var(--pr-r-tag); padding: 0 5px; line-height: 18px; color: var(--pr-accent); }' +
    '.d9-sum { margin: 8px 0 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); min-height: 42px; }' +
    '.d9-row { display: flex; gap: 24px; margin-top: 16px; }' +
    '.d9-fig { margin: 0; flex: none; width: 393px; display: flex; flex-direction: column; gap: 8px; --fw: 393px; --fh: 852px; --sb: 54px; }' +
    '.d9-fig figcaption { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); background: var(--pr-page); padding: 4px 8px; }' +
    '.d9-bs { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d9-b ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }' +
    '.d9 { --pr-page: var(--pr-l-page); --pr-stage: var(--pr-l-stage); --pr-s1: var(--pr-l-s1); --pr-s2: var(--pr-l-s2); --pr-hair: var(--pr-l-hair); --pr-hair-strong: var(--pr-l-hair-strong); --pr-ink: var(--pr-l-ink); --pr-ink-2: var(--pr-l-ink2); --pr-ink-3: var(--pr-l-ink3); --pr-accent: var(--pr-l-accent); --pr-accent-ink: var(--pr-l-accent-ink); --pr-warn: var(--pr-l-warn); --pr-kbd: var(--pr-l-kbd); --pr-key: var(--pr-l-key); --pr-scrim: var(--pr-l-scrim); --pr-ticket-shadow: var(--pr-l-ticket-shadow); color-scheme: light; background: var(--pr-page); }' +
    '.d9 .d9-dk { --pr-page: var(--pr-d-page); --pr-stage: var(--pr-d-stage); --pr-s1: var(--pr-d-s1); --pr-s2: var(--pr-d-s2); --pr-hair: var(--pr-d-hair); --pr-hair-strong: var(--pr-d-hair-strong); --pr-ink: var(--pr-d-ink); --pr-ink-2: var(--pr-d-ink2); --pr-ink-3: var(--pr-d-ink3); --pr-accent: var(--pr-d-accent); --pr-accent-ink: var(--pr-d-accent-ink); --pr-warn: var(--pr-d-warn); --pr-kbd: var(--pr-d-kbd); --pr-key: var(--pr-d-key); --pr-scrim: var(--pr-d-scrim); --pr-ticket-shadow: var(--pr-d-ticket-shadow); color-scheme: dark; }' +
    '.d9 { --d9-ring: var(--pr-accent); --d9-ghost: rgba(30,27,24,.35); }' +
    '.d9 .ring { outline: 2px solid var(--d9-ring); outline-offset: 2px; }' +
    '.d9-memo { border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); background: var(--pr-s1); padding: 20px 24px; margin-top: 40px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d9-memo h2 { margin-bottom: 8px; } .d9-memo ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; max-width: 110ch; } .d9-memo b { color: var(--pr-ink); font-weight: 600; }' +
    '.d9-st { margin-top: 40px; } .d9-st h2 { margin-bottom: 4px; }' +
    '.d9-strip { display: flex; flex-wrap: wrap; gap: 24px; margin-top: 16px; align-items: flex-start; }' +
    '.d9-sc { margin: 0; width: 393px; display: flex; flex-direction: column; gap: 8px; }' +
    '.d9-sc figcaption { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); }' +
    '.d9-box { position: relative; box-sizing: border-box; border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); background: var(--pr-s1); overflow: hidden; }' +
    '.d9-fam { margin: 8px 0 0; font-size: 13px; line-height: 19px; color: var(--pr-ink-3); }' +
    '.d9-t { border-collapse: collapse; font-size: 14px; line-height: 21px; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); margin: 0 0 24px; } .d9-t th, .d9-t td { text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--pr-hair); vertical-align: top; } .d9-t th { background: var(--pr-s2); font-weight: 600; } .d9-t td:first-child { font-weight: 600; white-space: nowrap; }' +
    '.d9-nowrow { display: flex; gap: 24px; align-items: flex-start; }' +
    '.d9-nowrow .d9-txt { flex: 1; min-width: 260px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); } .d9-txt ul { margin: 12px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; }' +
    '.d9-sh { position: absolute; left: 0; right: 0; bottom: 0; z-index: 21; box-sizing: border-box; background: var(--pr-s1); border-top: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-sheet) var(--pr-r-sheet) 0 0; padding: 8px 16px 34px; display: flex; flex-direction: column; gap: 8px; }' +
    '.d9-sh.static { position: static; padding-bottom: 12px; border: 0; border-radius: 0; }' +
    '.d9-card { border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); background: var(--pr-s2); overflow: hidden; }' +
    '.d9-r { box-sizing: border-box; display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; padding: 0 12px; margin: 0; border: 0; border-top: 1px solid var(--pr-hair); background: transparent; color: var(--pr-ink); font: inherit; font-size: 15px; line-height: 22px; text-align: left; }' +
    '.d9-card > .d9-r:first-child { border-top: 0; } .d9-r.down { background: var(--pr-hair); }' +
    '.d9-r .lb { flex: 1; min-width: 0; } .d9-r .lb small { font-size: 12px; line-height: 16px; color: var(--pr-ink-3); margin-left: 6px; }' +
    '.d9-r.armed { color: var(--pr-warn); font-weight: 600; } .d9-r.ring { outline-offset: -2px; }' +
    '.d9-seg { display: inline-flex; flex: none; margin-right: -12px; }' +
    '.d9-seg button { min-height: 44px; min-width: 52px; display: grid; place-items: center; padding: 0 8px; border: 0; border-left: 1px solid var(--pr-hair); background: transparent; font: inherit; font-size: 14px; color: var(--pr-ink-2); }' +
    '.d9-seg button[aria-checked="true"] { background: var(--pr-s1); color: var(--pr-ink); font-weight: 600; }' +
    '.d9 svg.i { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; flex: none; }' +
    '.d9 .c-sw { flex: none; }';
})();
