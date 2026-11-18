/* D10 한줄평 서체 · pt. D07 B를 다듬은 B′와 입력란 없이 티켓 위에서 바로 고치는 N을 비교해요.
   D10-quote-editing.html과 tools/gen-canvas.js가 같이 불러요. 라이트 한 가지만 그려요. */
(function () {
  var W = window, S = W.PR, i = S.i;
  var FONTS = ['자동', '고딕', '바탕', '자람', '잉크', '은영', '붓', '쿨가이', '꽃길'];
  /* 실제 티켓 폰트는 이 페이지에 없어서 비슷한 결의 기본 서체로 대신 그려요 */
  var FF = { '자동': 'inherit', '고딕': 'sans-serif', '바탕': 'serif', '자람': 'cursive', '잉크': 'cursive', '은영': 'fantasy', '붓': 'cursive', '쿨가이': 'monospace', '꽃길': 'fantasy' };
  var FS = { '잉크': 'italic', '꽃길': 'italic' }, FW = { '붓': 700 };
  function fs(x) { return 'font-family:' + FF[x] + ';' + (FS[x] ? 'font-style:' + FS[x] + ';' : '') + (FW[x] ? 'font-weight:' + FW[x] + ';' : ''); }
  var CUR = '바탕', PT_MIN = 2, PT_MAX = 6;
  var CHEV = '<svg class="i d10-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var TEXT = '파도 소리가 오래 남았다';
  /* 글꼴 드롭다운 버튼 · 목록(APG listbox) · pt 스핀버튼(APG spinbutton) */
  function drop(open, ring) { return '<button class="d10-sel' + (ring ? ' ring' : '') + '" aria-haspopup="listbox" aria-expanded="' + !!open + '" aria-label="글꼴, 지금 ' + CUR + '"><span style="' + fs(CUR) + '">' + CUR + '</span>' + CHEV + '</button>'; }
  function lbox(cls, h) {
    return '<ul class="d10-dd ' + cls + '" role="listbox" aria-label="글꼴" style="height:' + h + 'px">' + FONTS.map(function (x) {
      var on = x === CUR; return '<li role="option" aria-selected="' + on + '"><span style="' + fs(x) + '">' + x + '</span>' + (on ? i('check') : '') + '</li>';
    }).join('') + '</ul>';
  }
  function step(v, ring) {
    return '<div class="d10-step" role="group" aria-label="글자 크기"><button tabindex="-1" aria-label="0.5pt 줄이기"' + (v <= PT_MIN ? ' disabled' : '') + '>−</button>' +
      '<span class="d10-val' + (ring ? ' ring' : '') + '" role="spinbutton" tabindex="0" aria-label="글자 크기" aria-valuenow="' + v + '" aria-valuemin="' + PT_MIN + '" aria-valuemax="' + PT_MAX + '" aria-valuetext="' + v.toFixed(1) + 'pt">' + v.toFixed(1) + 'pt</span>' +
      '<button tabindex="-1" aria-label="0.5pt 키우기"' + (v >= PT_MAX ? ' disabled' : '') + '>+</button></div>';
  }
  function ihead(name, id) {
    return '<div class="c-ph" style="margin-top:0"><label class="t" for="' + id + '" style="font-size:13px;line-height:20px;font-weight:500;color:var(--pr-ink-2)">' + name + '</label><span class="gap"></span><button class="c-ib" aria-label="이전 항목">' + i('back') + '</button><button class="c-ib" aria-label="다음 항목">' + i('next') + '</button><button class="c-btn txt">닫기</button></div>';
  }
  var ZB = '<div class="c-canvas" style="overflow:hidden"><div style="position:absolute;left:50%;width:84%;margin-left:-42%;bottom:-2%;aspect-ratio:960/1534;transform:scale(1.18);transform-origin:50% 94%">' + S.ticket({}) + S.sel('foot', { nolab: true }) + '</div></div>';
  /* B′: 패널 안 한 줄. 목록은 줄 위로 열리고 5.5줄만 보여서 아래가 잘려 있어요 */
  function phoneB(open, v) {
    var line = '<div class="d10-line">' + drop(open) + step(v || 4.5) + (open ? lbox('up', 242) : '') + '</div>';
    return S.phone(ZB + S.panel('inp', ihead('한줄평', 'd10b') + '<div class="c-field focus"><input id="d10b" value="' + TEXT + '"></div>' + line, { aria: '입력' }) + S.kbd('text'));
  }
  /* N: 티켓 위에서 바로 고쳐요. 입력란 없음, 키보드 바로 위에 도구 줄 하나 */
  function ticketN(empty) {
    var q = empty
      ? '<div class="d10-q d10-gh" aria-hidden="true"><span class="ph-t">한줄평</span><i class="d10-caret"></i></div>'
      : '<div class="d10-q" style="' + fs(CUR) + '">' + TEXT + '<i class="d10-caret"></i></div>';
    return '<div class="c-canvas" style="overflow:hidden"><div style="position:absolute;left:50%;width:84%;margin-left:-42%;bottom:0%;aspect-ratio:960/1534;transform:scale(1.18);transform-origin:50% 98%">' + S.ticket({}) + q + '<div class="c-sel nolab" style="left:4.5%;top:87%;width:91%;height:5.6%" aria-hidden="true"></div></div></div>';
  }
  function toolbar(v, o) {
    o = o || {};
    return '<div class="d10-tool" role="toolbar" aria-label="한줄평 서식"><button class="c-ib" aria-label="이전 항목">' + i('back') + '</button><button class="c-ib" aria-label="다음 항목">' + i('next') + '</button>' + drop(o.open, o.ring) + step(v || 4.5, o.stepRing) + '<button class="c-btn txt d10-done">완료</button></div>';
  }
  function phoneN(state) {
    var open = state === 'list';
    var below = open ? '<div class="d10-kbdsheet">' + lbox('sheet', 300) + '</div>' : S.kbd('text');
    return S.phone(ticketN(state === 'empty') + toolbar(4.5, { open: open }) + below);
  }
  function fig(cap, html) { return '<figure class="d10-fig"><figcaption>' + cap + '</figcaption>' + html + '</figure>'; }
  function sc(cap, html) { return '<figure class="d10-sc"><div class="d10-box" style="padding:12px">' + html + '</div><figcaption>' + cap + '</figcaption></figure>'; }
  function lst(t, a) { return '<div class="d10-b"><h3>' + t + '</h3><ul>' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>'; }

  W.D10_HTML = function () {
    var h = '<div class="d10">';
    h += '<p class="d10-q0">#826 S2 착수 전 · 결정 D10 (D07 B 다듬기 · 신규안 N)</p><h1>한줄평 서체와 pt 크기를 어디서 고를까요</h1>' +
      '<p class="d10-lede">D07에서 B를 고르셨는데 패널의 입력란이 필요한지 물으셨어요. 입력란을 그대로 둔 B′와 입력란 없이 티켓 위에서 바로 고치는 N을 나란히 놓았어요. 크기 조절은 티켓 렌더 변경이라 S2 밖 별도 Seed예요. pt는 1pt ≈ 6.3px(내보내기 배율 0.05625mm/px)이고 하한은 12px(약 1.9pt)예요.</p>';
    h += '<table class="d10-t"><thead><tr><th></th><th>B′ 패널 안 한 줄</th><th>N 티켓 위에서 바로</th></tr></thead><tbody>' +
      '<tr><td>입력 위치</td><td>키보드 위 입력 패널의 입력란</td><td>티켓 위 한줄평 자리에 글자와 캐럿이 있어요. 입력란은 없어요.</td></tr>' +
      '<tr><td>화면 높이 사용</td><td>패널 약 165px + 키보드. 티켓 영역 약 331px</td><td>도구 줄 44px + 키보드. 티켓 영역 약 444px</td></tr>' +
      '<tr><td>다른 필드와 일관성</td><td>높음. 모든 필드가 같은 패널을 써요.</td><td>낮음. 좌석 같은 작은 필드는 티켓 위에서 고치기 어려워서 한줄평만 다른 방식이에요.</td></tr>' +
      '<tr><td>구현량</td><td>작음. 패널 줄 하나를 더해요.</td><td>큼. 티켓 위 글자 편집과 도구 줄 위치를 새로 만들어요.</td></tr>' +
      '<tr><td>위험</td><td>글자가 바뀌는 티켓과 조작 줄이 떨어져 있어요.</td><td>마스터가 티켓 위 입력을 걷어 낸 이유(글꼴 불일치 · 가림)가 그대로 돌아와요.</td></tr></tbody></table>';
    h += '<div class="d10-opts">';
    h += '<section class="d10-o rec"><h2><span class="k">B′</span>패널 안 한 줄 <span class="d10-rec">추천</span></h2><p class="d10-sum">입력란 아래 한 줄에 글꼴 드롭다운과 − 4.5pt + 가 있어요. 다른 필드의 옵션 줄과 같은 자리예요.</p><div class="d10-row">' +
      fig('기본', phoneB(false)) + fig('글꼴 목록 펼침 · 5.5줄과 잘린 줄', phoneB(true)) + '</div>' +
      '<p class="d10-fam">익숙한 패턴: Google Docs 모바일의 서식 줄이에요(글꼴과 크기를 키보드 위에서 바로 골라요).</p></section>';
    h += '<section class="d10-o"><h2><span class="k">N</span>입력란 없이 티켓 위에서 바로</h2><p class="d10-sum">티켓이 확대돼 한줄평 자리가 키보드 위에 오고, 글자와 캐럿이 티켓에 있어요. 키보드 바로 위에 도구 줄 하나가 있어요. 글꼴 목록은 키보드 자리를 바꿔 열려요.</p><div class="d10-row">' +
      fig('입력 중', phoneN('typing')) + fig('글꼴 목록 · 키보드 자리 교체', phoneN('list')) + fig('빈 한줄평 · 점선 자리와 캐럿', phoneN('empty')) + '</div>' +
      '<p class="d10-fam">익숙한 패턴: Instagram 스토리와 iOS 메모의 글자 편집이에요(글자는 화면 위, 도구는 키보드 위 한 줄).</p>' +
      '<div class="d10-bs">' + lst('목록을 키보드 자리에 둔 이유', ['도구 줄 위로 열면 글자를 고치는 한줄평 자리를 덮어요. 키보드 자리는 이미 비어 있고 높이도 같아서(300px) 티켓이 움직이지 않아요.', '키보드를 바꿔 끼우는 동작이라 iOS 이모지 키보드처럼 낯설지 않아요.']) +
      lst('걸리는 점', ['마스터가 티켓 위 입력에서 패널로 옮긴 이유가 그대로 돌아와요: 투명 입력이 티켓 글꼴과 안 맞아 캐럿이 어긋나고(글꼴 불일치) 손가락과 키보드가 글자를 가려요(가림).', '다른 필드는 패널을 쓰는데 한줄평만 다른 방식이에요. 좌석 같은 작은 필드는 티켓 위에서 고치기 어려워요.', '긴 한줄평은 칸에 맞춰 자동으로 줄어들어서(fitFontSizeToWidth) 입력하는 동안 글자 크기가 눈에 띄게 튀어요.', 'iOS 선택 핸들과 돋보기는 확대 변환(transform)이 걸린 요소에서 어긋나기 쉬워요.']) + '</div></section>';
    h += '</div>';
    h += '<section class="d10-st"><h2>상태</h2><p class="d10-fam">조작 줄만 잘라서 나란히 놓았어요. 모두 44px 줄이에요.</p><div class="d10-strip">' +
      sc('B′ 기본', '<div class="d10-line">' + drop(false) + step(4.5) + '</div>') +
      sc('B′ 포커스 · 글꼴 버튼과 pt 값에 링', '<div class="d10-line">' + drop(false, true) + step(4.5, true) + '</div>') +
      sc('B′ 최소 2.0pt · −가 꺼져요', '<div class="d10-line">' + drop(false) + step(PT_MIN) + '</div>') +
      sc('B′ 최대 6.0pt · +가 꺼져요(무드마다 달라요)', '<div class="d10-line">' + drop(false) + step(PT_MAX) + '</div>') +
      sc('N 도구 줄 · 기본', toolbar(4.5)) + sc('N 도구 줄 · 포커스', toolbar(4.5, { ring: true, stepRing: true })) +
      sc('N 도구 줄 · 최소 2.0pt', toolbar(PT_MIN)) + '</div></section>';
    h += '<section class="d10-memo"><h2>구현 메모</h2><ul>' +
      '<li><b>추천은 B′예요.</b> 한줄평만 다른 방식이 되지 않고, 패널과 키보드 위 처리(InPlaceFieldEditor의 visualViewport 측정)를 그대로 쓰는 가장 작은 변경이에요. N은 S3 이후에 따로 실험할 만해요.</li>' +
      '<li><b>B′ 재사용</b> 입력 패널과 필드는 그대로이고, 옵션 줄 자리에 글꼴 드롭다운과 pt 스핀버튼 한 줄이 새로 들어가요. 글꼴 목록(APG listbox)과 스핀버튼(APG spinbutton: ↑ ↓ 키 0.5pt, Home · End)은 라이브러리 없이 직접 써요. Tailwind cva + cn으로 변형만 정의해요.</li>' +
      '<li><b>pt 저장</b> 티켓 렌더(무드)가 고른 pt를 최대값으로 받아서 자동 줄임에 넘겨야 해요. 이건 S2 밖 별도 Seed예요.</li>' +
      '<li><b>N 구현 방식 두 가지</b> (a) 기존 InPlaceFieldEditor의 투명 입력에 무드의 계산된 글꼴 · 크기를 맞춰 올리는 방법은 재사용이 쉽지만, 6무드 글꼴을 계속 맞춰야 하고 마스터가 걷어 낸 문제를 다시 불러요. (b) 숨은 진짜 input의 값을 무드 컴포넌트가 그대로 그리고 캐럿을 직접 그리는 방법은 글꼴이 어긋나지 않지만 코드가 더 들고 iOS 선택 핸들 · 돋보기가 없어요. N을 만든다면 <b>(b)를 추천</b>해요. 유지보수 비용이 무드 수와 무관해서예요.</li>' +
      '<li><b>빈 한줄평</b> 티켓 위 점선 자리와 “한줄평” 안내는 미리보기에서만 보이고 data-hide-on-export로 저장물에서 빠져요.</li>' +
      '<li><b>위험</b> B′는 키보드가 열린 상태에서 목록이 5.5줄이라 스크롤이 필요해요. N은 위 걸리는 점 네 가지가 모두 실기기 검증 대상이에요.</li></ul></section>';
    return h + '</div>';
  };
  W.D10_CSS = '.d10 { font-family: var(--pr-font); color: var(--pr-ink); padding: 32px 40px 56px; }' +
    '.d10 h1 { margin: 4px 0 0; font-size: 24px; line-height: 30px; font-weight: 600; letter-spacing: -.02em; }' +
    '.d10 h2 { margin: 0; font-size: 19px; line-height: 26px; font-weight: 600; display: flex; gap: 10px; align-items: baseline; }' +
    '.d10 h3 { margin: 0 0 6px; font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); }' +
    '.d10 h2 .k { font-variant-numeric: tabular-nums; color: var(--pr-ink-3); }' +
    '.d10-q { margin: 0; font-size: 13px; color: var(--pr-ink-2); font-weight: 500; }' +
    '.d10-lede { margin: 10px 0 24px; color: var(--pr-ink-2); max-width: 72ch; font-size: 15px; line-height: 1.55; }' +
    '.d10-now { background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; margin-bottom: 40px; }' +
    '.d10-nowrow { display: flex; gap: 24px; margin-top: 16px; align-items: flex-start; }' +
    '.d10-txt { flex: 1; min-width: 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d10-txt ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; }' +
    '.d10-hint { margin: 16px 0 0; font-size: 13px; color: var(--pr-ink-3); }' +
    '.d10-opts { display: flex; gap: 40px; align-items: flex-start; }' +
    '.d10-o { flex: 1; min-width: 0; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); padding: 24px; }' +
    '.d10-o.rec { border-color: var(--pr-accent); border-width: 2px; padding: 23px; }' +
    '.d10-rec { font-size: 12px; font-weight: 600; border: 1px solid currentColor; border-radius: var(--pr-r-tag); padding: 0 5px; line-height: 18px; color: var(--pr-accent); }' +
    '.d10-sum { margin: 8px 0 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); min-height: 42px; }' +
    '.d10-row { display: flex; gap: 24px; margin-top: 16px; }' +
    '.d10-fig { margin: 0; flex: none; width: 393px; display: flex; flex-direction: column; gap: 8px; --fw: 393px; --fh: 852px; --sb: 54px; }' +
    '.d10-fig figcaption { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); background: var(--pr-page); padding: 4px 8px; }' +
    '.d10-bs { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d10-b ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }' +
    '.d10 { --pr-page: var(--pr-l-page); --pr-stage: var(--pr-l-stage); --pr-s1: var(--pr-l-s1); --pr-s2: var(--pr-l-s2); --pr-hair: var(--pr-l-hair); --pr-hair-strong: var(--pr-l-hair-strong); --pr-ink: var(--pr-l-ink); --pr-ink-2: var(--pr-l-ink2); --pr-ink-3: var(--pr-l-ink3); --pr-accent: var(--pr-l-accent); --pr-accent-ink: var(--pr-l-accent-ink); --pr-warn: var(--pr-l-warn); --pr-kbd: var(--pr-l-kbd); --pr-key: var(--pr-l-key); --pr-scrim: var(--pr-l-scrim); --pr-ticket-shadow: var(--pr-l-ticket-shadow); color-scheme: light; background: var(--pr-page); }' +
    '.d10 .d10-dk { --pr-page: var(--pr-d-page); --pr-stage: var(--pr-d-stage); --pr-s1: var(--pr-d-s1); --pr-s2: var(--pr-d-s2); --pr-hair: var(--pr-d-hair); --pr-hair-strong: var(--pr-d-hair-strong); --pr-ink: var(--pr-d-ink); --pr-ink-2: var(--pr-d-ink2); --pr-ink-3: var(--pr-d-ink3); --pr-accent: var(--pr-d-accent); --pr-accent-ink: var(--pr-d-accent-ink); --pr-warn: var(--pr-d-warn); --pr-kbd: var(--pr-d-kbd); --pr-key: var(--pr-d-key); --pr-scrim: var(--pr-d-scrim); --pr-ticket-shadow: var(--pr-d-ticket-shadow); color-scheme: dark; }' +
    '.d10 { --d10-ring: var(--pr-accent); --d10-ghost: rgba(30,27,24,.35); }' +
    '.d10 .ring { outline: 2px solid var(--d10-ring); outline-offset: 2px; }' +
    '.d10-memo { border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); background: var(--pr-s1); padding: 20px 24px; margin-top: 40px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d10-memo h2 { margin-bottom: 8px; } .d10-memo ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; max-width: 110ch; } .d10-memo b { color: var(--pr-ink); font-weight: 600; }' +
    '.d10-st { margin-top: 40px; } .d10-st h2 { margin-bottom: 4px; }' +
    '.d10-strip { display: flex; flex-wrap: wrap; gap: 24px; margin-top: 16px; align-items: flex-start; }' +
    '.d10-sc { margin: 0; width: 393px; display: flex; flex-direction: column; gap: 8px; }' +
    '.d10-sc figcaption { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); }' +
    '.d10-box { position: relative; box-sizing: border-box; border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); background: var(--pr-s1); overflow: hidden; }' +
    '.d10-fam { margin: 8px 0 0; font-size: 13px; line-height: 19px; color: var(--pr-ink-3); }' +
    '.d10-t { border-collapse: collapse; font-size: 14px; line-height: 21px; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); margin: 0 0 24px; } .d10-t th, .d10-t td { text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--pr-hair); vertical-align: top; } .d10-t th { background: var(--pr-s2); font-weight: 600; } .d10-t td:first-child { font-weight: 600; white-space: nowrap; }' +
    '.d10-q0 { margin: 0; font-size: 13px; color: var(--pr-ink-2); font-weight: 500; }' +
    '.d10-chev { width: 18px; height: 18px; }' +
    '.d10-line { position: relative; display: flex; gap: 8px; margin-top: 8px; }' +
    '.d10-sc .d10-line { margin-top: 0; }' +
    '.d10-sel { box-sizing: border-box; flex: 1; min-width: 0; min-height: 44px; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); background: var(--pr-s2); color: var(--pr-ink); font-size: 16px; line-height: 24px; }' +
    '.d10-step { display: flex; align-items: center; flex: none; border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); background: var(--pr-s2); }' +
    '.d10-step button { width: 44px; height: 42px; border: 0; background: transparent; color: var(--pr-ink); font-size: 20px; line-height: 20px; }' +
    '.d10-step button:disabled { opacity: .4; }' +
    '.d10-val { min-width: 52px; box-sizing: border-box; text-align: center; font-size: 14px; line-height: 40px; font-variant-numeric: tabular-nums; color: var(--pr-ink); border-radius: var(--pr-r-tag); }' +
    '.d10-dd { position: absolute; z-index: 40; margin: 0; padding: 0; list-style: none; box-sizing: border-box; background: var(--pr-s2); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); overflow: hidden; }' +
    '.d10-dd.up { left: 0; bottom: calc(100% + 8px); width: 220px; }' +
    '.d10-dd.sheet { position: static; width: 100%; border-radius: 0; border-width: 1px 0 0; }' +
    '.d10-dd li { box-sizing: border-box; min-height: 44px; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 16px; line-height: 24px; color: var(--pr-ink); border-top: 1px solid var(--pr-hair); }' +
    '.d10-dd li:first-child { border-top: 0; } .d10-dd li[aria-selected="true"] { background: var(--pr-s1); font-weight: 600; }' +
    '.d10-tool { flex: none; box-sizing: border-box; display: flex; align-items: center; gap: 4px; padding: 0 4px; height: 52px; background: var(--pr-s1); border-top: 1px solid var(--pr-hair-strong); position: relative; z-index: 5; }' +
    '.d10-tool .c-ib { width: 40px; flex: none; } .d10-tool .d10-sel { padding: 0 8px; } .d10-tool .d10-step button { width: 36px; } .d10-tool .d10-val { min-width: 48px; } .d10-done { padding: 0 8px; flex: none; min-width: 44px; justify-content: center; }' +
    '.d10-kbdsheet { flex: none; height: 300px; background: var(--pr-kbd); overflow: hidden; }' +
    '.d10-q { position: absolute; left: 6%; top: 88.4%; font-size: 14px; line-height: 1.2; color: #1E1B18; white-space: nowrap; }' +
    '.d10-gh { border: 1px dashed var(--d10-ghost); border-radius: 2px; min-width: 40%; height: 4.6%; box-sizing: border-box; padding: 0 4px; display: flex; align-items: center; top: 87.9%; }' +
    '.d10-gh .ph-t { color: var(--pr-l-ink3); }' +
    '.d10-caret { display: inline-block; width: 2px; height: 1.1em; background: var(--pr-l-accent); margin-left: 1px; vertical-align: -0.15em; }' +
    '.d10-opts { display: flex; flex-direction: column; gap: 32px; }' +
    '.d10-o .d10-row { flex-wrap: wrap; }' +
    '.d10-fig, .d10-sc { --fw: 393px; --fh: 852px; --sb: 54px; }' +
    '.d10-sc .d10-box { width: 393px; }' +
    '.d10-bs { flex-direction: row; gap: 40px; } .d10-bs .d10-b { flex: 1; }' +
    '.d10 svg.i { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; flex: none; }' +
    '.d10-st .d10-sc { gap: 8px; }';
})();
