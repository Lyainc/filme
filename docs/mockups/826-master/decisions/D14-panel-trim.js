/* D14 입력 패널 다듬기 — 표시 토글을 눈 아이콘으로, 글꼴을 이름 대신 미리보기 글자로.
   D12-input-final.js · D13-s3-input.js를 먼저 불러야 해요(D13_CSS를 빌려요). D14-panel-trim.html과 tools/gen-canvas.js가 같이 불러요. */
(function () {
  var W = window, S = W.PR, i = S.i;
  var FONTS = ['자동', '고딕', '바탕', '자람', '잉크', '은영', '붓', '쿨가이', '꽃길'];
  var FF = { '자동': 'inherit', '고딕': 'sans-serif', '바탕': 'serif', '자람': 'cursive', '잉크': 'cursive', '은영': 'fantasy', '붓': 'cursive', '쿨가이': 'monospace', '꽃길': 'fantasy' };
  var FS = { '잉크': 'italic', '꽃길': 'italic' }, FW = { '붓': 700 };
  function fs(x) { return 'font-family:' + FF[x] + ';' + (FS[x] ? 'font-style:' + FS[x] + ';' : '') + (FW[x] ? 'font-weight:' + FW[x] + ';' : ''); }
  var CUR = '바탕', TEXT = '파도 소리가 오래 남았다', SAMPLE = '영화의 순간 Film';
  var ROW = 44, PAD = 8, HAIR = 1;
  function panelH(rows) { return HAIR + PAD + rows * ROW + PAD; }
  var EYE_ON = '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3" fill="currentColor"/>';
  var EYE_OFF = '<path d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.2 3.9M6.6 6.6C3.8 8.3 2 12 2 12s4 7 10 7a9.6 9.6 0 004.4-1.1"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>';
  function eye(on) { return '<button class="d14-eye" role="switch" aria-checked="' + on + '" aria-label="티켓에 표시"><svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + (on ? EYE_ON : EYE_OFF) + '</svg></button>'; }

  var seq = 0;
  /* 첫 줄: [‹] [입력 + 눈] [›] [완료]. 눈은 입력란 안 오른쪽 끝(누르는 영역 44) */
  function row1(o) {
    var id = 'd14i' + (seq++);
    return '<div class="d12-r d13-r1"><button class="d13-nav" aria-label="이전 항목">' + i('back') + '</button>' +
      '<div class="d14-in"><input id="' + id + '" class="v' + (o.focus === false ? '' : ' f') + (o.eye === undefined ? '' : ' has-eye') + (o.off ? ' off' : '') + '" placeholder="' + o.ph + '" value="' + (o.value || '') + '" enterkeyhint="next" autocomplete="off" aria-label="' + o.ph + '">' + (o.eye === undefined ? '' : eye(o.eye)) + '</div>' +
      '<button class="d13-nav" aria-label="다음 항목">' + i('next') + '</button><button class="d12-done">완료</button></div>';
  }
  /* 둘째 줄 글꼴 A: ‹ [미리보기 글자] › — 가운데를 누르면 목록 */
  function fontStep(text, o) {
    o = o || {};
    return '<div class="d14-fstep" role="group" aria-label="글꼴"><button class="d13-nav" aria-label="이전 글꼴">' + i('back') + '</button>' +
      '<button class="d14-prev" aria-haspopup="listbox" aria-expanded="' + !!o.open + '" aria-label="글꼴 ' + CUR + ', 목록 열기"><span style="' + fs(CUR) + '">' + text + '</span></button>' +
      '<button class="d13-nav" aria-label="다음 글꼴">' + i('next') + '</button></div>';
  }
  /* 둘째 줄 글꼴 B: 짧은 드롭다운(미리보기 글자 + ▾) */
  function fontDrop(text) {
    return '<button class="d14-drop" aria-haspopup="listbox" aria-expanded="false" aria-label="글꼴 ' + CUR + ', 목록 열기"><span class="t" style="' + fs(CUR) + '">' + text + '</span><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>';
  }
  function row2(inner, act) { return '<div class="d12-r d14-r2">' + inner + (act ? '<span class="d14-gap"></span><button class="c-btn txt d14-act">' + act + '</button>' : '') + '</div>'; }
  function lbox(h, text) {
    return '<ul class="d12-dd d14-dd" role="listbox" aria-label="글꼴" style="height:' + h + 'px">' + FONTS.map(function (x) {
      var on = x === CUR; return '<li role="option" aria-selected="' + on + '" aria-label="' + x + '"><span class="s" style="' + fs(x) + '">' + text + '</span><span class="n">' + x + '</span>' + (on ? i('check') : '<span class="ck"></span>') + '</li>';
    }).join('') + '</ul>';
  }
  var SEL = { seat: 'left:68%;top:82.2%;width:20%;height:6.4%', quote: 'left:4.5%;top:87.2%;width:91%;height:5.8%', logo: 'left:5%;top:2.6%;width:26%;height:5.6%' };
  function win(WH, sel) {
    var tw = Math.round(393 * 0.62), th = Math.round(tw * 1534 / 960), left = Math.round((393 - tw) / 2), top = sel === 'logo' ? 12 : WH - th - 16;
    return '<div class="d12-win" style="height:' + WH + 'px;background:var(--pr-stage)"><div class="d12-tkw" style="width:' + tw + 'px;height:' + th + 'px;left:' + left + 'px;top:' + top + 'px">' +
      S.ticket({}) + '<div class="c-sel nolab" style="' + SEL[sel] + '" aria-hidden="true"></div></div></div>';
  }
  function phone(sel, rows, html, list, text) {
    var KB = 330, GAP = 12, WH = 852 - 54 - KB - GAP - panelH(rows);
    var below = list ? '<div class="d12-kbs" style="height:' + KB + 'px">' + lbox(KB, text) + '</div>' : S.kbd('text');
    return S.phone(win(WH, sel) + '<div class="d12-pn" role="region" aria-label="입력">' + html + '</div><div class="d13-gap" style="height:' + GAP + 'px"></div>' + below, { cls: 'd12-ph' });
  }
  function fig(cap, html) { return '<figure class="d12-fig"><figcaption>' + cap + '</figcaption>' + html + '</figure>'; }
  function lst(t, a) { return '<div class="d12-b"><h3>' + t + '</h3><ul>' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>'; }
  function opt(key, title, sum, body, pros, cons, badge) {
    return '<div class="d12-o' + (badge ? ' rec' : '') + '"><h2><span class="k">' + key + '</span>' + title + (badge ? ' <span class="d12-rec">' + badge + '</span>' : '') + '</h2>' +
      '<p class="d12-sum">' + sum + '</p>' + (body || '') + '<div class="d12-bs">' + lst('좋은 점', pros) + lst('대가', cons) + '</div></div>';
  }
  /* D13 원안(칩 둘째 줄) 재현 — 비교용 */
  function chipsRow() { return '<div class="d12-r"><div class="c-acc d13-acc" role="toolbar" aria-label="표시 옵션"><div role="radiogroup" aria-label="표시" style="display:contents"><button class="c-opt" role="radio" aria-checked="true">티켓에 표시</button><button class="c-opt" role="radio" aria-checked="false">숨김</button></div></div></div>'; }
  function oldRow1(o) {
    var id = 'd14i' + (seq++);
    return '<div class="d12-r d13-r1"><button class="d13-nav" aria-label="이전 항목">' + i('back') + '</button><label class="d12-in" for="' + id + '"><input id="' + id + '" class="v f" value="' + o.value + '" aria-label="' + o.ph + '"></label><button class="d13-nav" aria-label="다음 항목">' + i('next') + '</button><button class="d12-done">완료</button></div>';
  }

  W.D14_HTML = function () {
    seq = 0;
    var h = '<div class="d12 d13 d14">';
    h += '<p class="d12-q0">#826 S3 착수 전 · 결정 D14 · 2026-11-20 소유자 요청</p><h1>입력 패널 다듬기 · 눈 아이콘과 글꼴 미리보기</h1>' +
      '<p class="d12-lede">D12와 D13(①② 정함 · D13-1 A · D13-2 A)은 그대로 두고, 두 군데를 줄여요. 표시/숨김 칩 줄을 입력란 안의 눈 아이콘 하나로, 글꼴 버튼을 이름이 아닌 그 서체로 쓴 글자로 바꿔요.</p>';
    h += '<section class="d12-memo d14-dec"><h2>결정 · 2026-11-20</h2><ul>' +
      '<li><b>D14-2 A</b> ‹ 미리보기 › + 누르면 목록으로 정했어요.</li>' +
      '<li><b>D14-1 → 패널에서 표시 토글 빼기</b> 입력란 안 눈을 검토해 보니 그 자리(입력란 안 오른쪽 아이콘)는 지우기 · 비밀번호 보기처럼 <b>입력한 글자에 대한 동작</b>에 쓰는 게 관례예요(uxpatterns.dev 텍스트 필드 · 비밀번호 패턴). 눈은 "글자 보기/가리기"로 읽힐 수 있고, 커서를 글 끝에 놓으려고 오른쪽 끝을 누르다 필드를 숨기는 오탭도 생겨요.</li>' +
      '<li>그래서 패널에는 표시 토글을 두지 않고 정보 목록 행의 눈으로만 바꿔요. 표시 옵션만 있는 필드는 패널이 [‹][입력][›][완료] 한 줄이고 입력란은 약 205px예요. 예외는 정보 목록에 행이 없는 재개봉일 하나로, 개봉일 패널 안에 표시 토글을 남겨요.</li>' +
      '<li>아래 D14-1 그림(입력란 안 눈)은 검토 전 안이라 근거로 남겨 둬요.</li></ul></section>';
    h += '<section class="d12-rules"><h2>바뀌는 것</h2>' +
      lst('표시 · 숨김', ['칩 두 개(티켓에 표시 · 숨김) 대신 입력란 안 오른쪽 끝에 눈 아이콘 하나(role=switch, 누르는 영역 44).', '숨기면 눈에 사선이 생기고 입력 글자가 흐려져요. 값은 그대로예요.', '제목은 필수라 눈이 없어요(지금 규칙).']) +
      lst('줄 수', ['표시 옵션만 있는 필드(좌석 · 상영관 · 예매 번호 등)는 <b>한 줄</b>로 끝나요. 패널 높이 105 → 61.', '둘째 줄은 글꼴(한줄평 · 서명), 표기 · 정밀도 · 재개봉(날짜), 이미지로(로고 · 서명)가 있을 때만 생겨요.']) +
      lst('글꼴 미리보기', ['글꼴 이름 대신 <b>입력한 글을 그 서체로</b> 보여 줘요. 비어 있으면 견본 "' + SAMPLE + '"(지금 코드의 견본, 한글 · 영문 둘 다 보여요).', '글꼴 이름은 화면에 안 쓰고 스크린리더 이름(aria-label)에만 둬요.']) +
      lst('그대로', ['‹ › 이전 · 다음 + Return 다음, 완료, 패널 자리(지금 aid 자리), hit 44 위임은 D13 그대로.', 'pt 크기 조절은 여전히 S3 밖이에요.']) +
      '</section>';

    h += '<section class="d13-q"><h2><span class="k">D14-1</span>표시 · 숨김을 눈 아이콘으로 <span class="d13-ok">요청 반영 · 확인용</span></h2>' +
      '<p class="d12-fam">좌석 입력으로 비교해요. 눈을 첫 줄에 따로 두면 입력란이 약 160px까지 줄어서, 비밀번호 보기 아이콘처럼 입력란 안에 넣었어요.</p>' +
      '<div class="d12-opts d13-opts">' +
      opt('D13', '칩 둘째 줄', '[티켓에 표시] [숨김] 칩 두 개가 한 줄을 차지해요.',
        '<div class="d12-row">' + fig('D13 · 두 줄 105', phone('seat', 2, oldRow1({ ph: '좌석', value: 'H12' }) + chipsRow())) + '</div>',
        ['상태가 글자로 보여요.'], ['선택지 둘에 한 줄을 다 써서 티켓 창이 44 줄어요.'], null) +
      opt('D14', '입력란 안 눈 아이콘', '한 줄로 끝나요. 숨김이면 눈에 사선 + 입력 글자 흐림.',
        '<div class="d12-row">' + fig('표시 중 · 한 줄 61', phone('seat', 1, row1({ ph: '좌석', value: 'H12', eye: true }))) + fig('숨김', phone('seat', 1, row1({ ph: '좌석', value: 'H12', eye: false, off: true })) ) + '</div>',
        ['티켓 창이 44 커져요(좌석 · 예매 번호 등 대부분 필드).', '지금 정보 목록 행의 눈 토글과 같은 아이콘이라 규칙이 하나예요.'], ['입력란 글자 폭이 아이콘만큼(약 36) 줄어요.', '"티켓에 표시"라는 글자가 없어서 처음엔 아이콘 뜻을 짐작해야 해요(스크린리더는 이름으로 읽어요).'], '추천') +
      '</div></section>';

    h += '<section class="d13-q"><h2><span class="k">D14-2</span>글꼴을 이름 대신 미리보기 글자로</h2>' +
      '<p class="d12-fam">두 안 모두 버튼에 글꼴 이름 대신 입력한 글을 그 서체로 보여 줘요. 목록도 같은 글을 9가지 서체로 보여 주고, 이름은 오른쪽에 작게 둬요(서체끼리 비슷한 손글씨 계열을 가리려고).</p>' +
      '<div class="d12-opts d13-opts d14-stack">' +
      opt('A', '‹ 미리보기 › + 누르면 목록', '좌우 버튼으로 한 칸씩 넘기고, 가운데 글자를 누르면 키보드 자리에 목록이 열려요. 서명이면 오른쪽에 "이미지로".',
        '<div class="d12-row">' + fig('입력 중 · 글 있음', phone('quote', 2, row1({ ph: '한줄평', value: TEXT, eye: true }) + row2(fontStep(TEXT)))) +
        fig('비어 있음 · 견본', phone('quote', 2, row1({ ph: '한줄평', value: '', eye: true }) + row2(fontStep(SAMPLE)))) +
        fig('목록 열림', phone('quote', 2, row1({ ph: '한줄평', value: TEXT, eye: true, focus: false }) + row2(fontStep(TEXT, { open: true })), true, TEXT)) + '</div>',
        ['키보드를 내리지 않고 ‹ ›로 넘기며 티켓과 바로 비교해요.', '9종을 한눈에 보고 싶으면 목록도 있어요.', '버튼 폭이 미리보기 글자에 맞아 줄을 길게 쓰지 않아요.'],
        ['‹ › 가 첫 줄의 항목 ‹ › 와 모양이 같아 헷갈릴 수 있어요(둘째 줄은 글꼴이라 아이콘을 작게 · 흐리게 그려 구분).'], '추천') +
      opt('B', '짧은 드롭다운', '미리보기 글자 + ▾ 버튼 하나. 누르면 목록.',
        '<div class="d12-row">' + fig('입력 중 · 글 있음', phone('quote', 2, row1({ ph: '한줄평', value: TEXT, eye: true }) + row2(fontDrop(TEXT)))) +
        fig('서명 · 이미지로', phone('quote', 2, row1({ ph: '서명', value: '영화의 순간', eye: true }) + row2(fontDrop('영화의 순간'), '이미지로'))) + '</div>',
        ['컨트롤이 하나라 단순해요. D13-1 A를 가장 덜 바꿔요.'], ['바꿀 때마다 목록을 열고 닫아야 해요.'], null) +
      '</div></section>';
    h += '<section class="d12-memo"><h2>답하는 법</h2><ul><li>"D14-1 좋아, D14-2 A"처럼 적어 주세요. 다른 모양이 좋으면 그대로 말씀해 주세요.</li>' +
      '<li>답이 오면 D12 · D13 · D14를 합쳐 S3 Seed 초안을 만들어요. 승인 전에는 src를 고치지 않아요.</li></ul></section>';
    return h + '</div>';
  };
  W.D14_CSS = (W.D13_CSS || '') +
    '.d14-dec { margin: 0 0 32px; } .d14-stack { flex-direction: column; } .d14-stack .d12-o { width: 100%; box-sizing: border-box; flex: none; }' +
    '.d14-in { flex: 1; min-width: 0; height: 44px; position: relative; display: flex; align-items: center; }' +
    '.d14-in .v { width: 100%; box-sizing: border-box; height: 36px; padding: 0 12px; font: inherit; font-size: 16px; line-height: 24px; color: var(--pr-ink); background: var(--pr-s2); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); }' +
    '.d14-in .v.has-eye { padding-right: 40px; } .d14-in .v.f { outline: 2px solid var(--pr-accent); outline-offset: -1px; border-color: transparent; } .d14-in .v.off { color: var(--pr-ink-3); }' +
    '.d14-in .v::placeholder { color: var(--pr-ink-3); opacity: 1; }' +
    '.d14-eye { position: absolute; right: -4px; top: 0; width: 44px; height: 44px; padding: 0; border: 0; background: transparent; color: var(--pr-ink-2); display: inline-flex; align-items: center; justify-content: center; }' +
    '.d14-eye[aria-checked="false"] { color: var(--pr-ink-3); }' +
    '.d14-r2 { gap: 4px; }' +
    '.d14-fstep { display: flex; align-items: center; min-width: 0; max-width: 100%; }' +
    '.d14-fstep .d13-nav { color: var(--pr-ink-3); } .d14-fstep .d13-nav .i { width: 16px; height: 16px; }' +
    '.d14-prev { min-width: 0; max-width: 220px; height: 44px; padding: 0; border: 0; background: transparent; display: flex; align-items: center; }' +
    '.d14-prev span { display: block; max-width: 100%; box-sizing: border-box; height: 36px; line-height: 34px; padding: 0 12px; font-size: 16px; color: var(--pr-ink); background: var(--pr-s2); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
    '.d14-drop { min-width: 0; max-width: 240px; height: 44px; padding: 0; border: 0; background: transparent; display: flex; align-items: center; }' +
    '.d14-drop > .t, .d14-drop { color: var(--pr-ink); }' +
    '.d14-drop { position: relative; } .d14-drop .t { display: block; box-sizing: border-box; height: 36px; line-height: 34px; padding: 0 32px 0 12px; font-size: 16px; background: var(--pr-s2); border: 1px solid var(--pr-hair-strong); border-radius: var(--pr-r-ctl); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; }' +
    '.d14-drop .i { position: absolute; right: 8px; width: 18px; height: 18px; }' +
    '.d14-gap { flex: 1; } .d14-act { flex: none; height: 44px; font-size: 15px; }' +
    '.d14-dd li { gap: 12px; } .d14-dd .s { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .d14-dd .n { flex: none; font-size: 12px; font-weight: 400; color: var(--pr-ink-3); font-family: var(--pr-font); font-style: normal; } .d14-dd .ck { width: 20px; flex: none; }';
})();
