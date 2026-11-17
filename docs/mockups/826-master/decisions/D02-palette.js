/* D02 팔레트 비교판. 후보 값의 단일 원본이에요. D02-palette.html과 tools/gen-canvas.js가 같이 불러요.
   실제 마스터 프레임(frames.js)에 후보 토큰만 덮어 그려요. 결정 5-A(브릭 = 주 행동 채움 · 선택 표시 · 모드 인디케이터만)는 그대로라 --pr-accent 자리만 바뀌어요. */
(function () {
  var W = window;
  /* 공통(후보와 무관): 반투명 구분선 · 스크림 · 키보드 그림 · 앰버 오류는 결정 5-A로 고정 */
  var BASE = {
    l: { hair: 'rgba(17,17,17,.08)', 'hair-strong': 'rgba(17,17,17,.16)', 'accent-ink': '#FFFFFF', warn: '#8F5410', kbd: '#D1D3D9', key: '#FFFFFF', scrim: 'rgba(20,18,14,.48)', 'ticket-shadow': '0 14px 32px -20px rgba(20,18,14,.45)' },
    d: { hair: 'rgba(255,255,255,.08)', 'hair-strong': 'rgba(255,255,255,.16)', 'accent-ink': '#FFFFFF', warn: '#E0A35A', kbd: '#2B2B2E', key: '#4A4A4E', scrim: 'rgba(0,0,0,.64)', 'ticket-shadow': '0 16px 40px -20px rgba(0,0,0,.9)' }
  };
  var C = [
    { k: 'A', name: '현행 · 크림 + 브릭', why: '3단계 마스터 값이에요. 비교 기준으로 같이 그렸어요.', risk: '크림 바탕 + 테라코타 강조는 생성형 디자인이 몰리는 조합 1번이에요(2026-11-17 감사). 회색 글자도 같은 웜 계열이라 화면 전체가 한 톤으로 뭉개져요.',
      l: { page: '#E4E0D9', stage: '#EFECE6', s1: '#F7F5F1', s2: '#FFFFFF', ink: '#141414', 'ink-2': '#5B5852', 'ink-3': '#6A665F', accent: '#B0423F' },
      d: { page: '#050506', stage: '#0B0B0C', s1: '#141416', s2: '#1C1C1F', ink: '#ECE9E3', 'ink-2': '#A8A49C', 'ink-3': '#8E8A83', accent: '#C24B43' } },
    { k: 'B', name: '중성 회색 + 크림슨', rec: true, why: '붉은 강조는 남기고 크림 바탕과 웜 회색을 뺐어요. 객석 · 커튼의 크림슨이라 영사실 주제와 이어지고, 결정 5-A의 "붉은 점 하나" 인상이 그대로예요. 바탕이 무채색이라 포스터 · 티켓 색이 덜 물들어 보여요.', risk: '붉은 계열이라 티켓의 붉은 포스터 옆에서 선택 표시가 덜 튈 수 있어요(현행도 같음). 다크 강조 채움 위 흰 글자 5.48:1로 여유가 커졌어요.',
      l: { page: '#E1E2E4', stage: '#EDEEEF', s1: '#F6F7F8', s2: '#FFFFFF', ink: '#121314', 'ink-2': '#55585D', 'ink-3': '#62666C', accent: '#A3182F' },
      d: { page: '#050506', stage: '#0B0B0C', s1: '#141416', s2: '#1C1C1F', ink: '#ECECEE', 'ink-2': '#A7A9AE', 'ink-3': '#8E9196', accent: '#C8283F' } },
    { k: 'C', name: '쿨 페이퍼 + 코발트', why: '영사기 빛의 푸른 기운을 강조색으로 썼어요. 앰버 오류와 보색이라 "주 행동"과 "문제"가 색만으로 가장 또렷이 갈려요. 포스터 대부분(웜 톤) 옆에서 선택 표시가 잘 보여요.', risk: '파란 주 버튼은 범용 앱 기본값과도 가까워요. 붉은 강조로 쌓은 3단계 시안 인상(랜딩 빔 포함)이 바뀌어 랜딩 빔 색을 같이 볼 필요가 있어요.',
      l: { page: '#E0E3E8', stage: '#ECEEF1', s1: '#F5F6F8', s2: '#FFFFFF', ink: '#111318', 'ink-2': '#535863', 'ink-3': '#60656F', accent: '#2747C7' },
      d: { page: '#050608', stage: '#0A0B0D', s1: '#13151A', s2: '#1B1E24', ink: '#E9ECF1', 'ink-2': '#A3A9B4', 'ink-3': '#8A909B', accent: '#3F5FDC' } },
    { k: 'D', name: '그래파이트 + 리더 그린', why: '필름 리더 · 비상구 표시의 짙은 초록이에요. 붉은 포스터 · 앰버 오류와 모두 겹치지 않아요.', risk: '초록은 "완료 · 성공"으로 읽혀 주 행동(저장)과 선택 표시가 상태 색처럼 보일 수 있어요. 셋 중 주제 연결이 가장 약해요.',
      l: { page: '#DFE2DF', stage: '#EBEDEB', s1: '#F5F6F5', s2: '#FFFFFF', ink: '#121413', 'ink-2': '#545955', 'ink-3': '#616762', accent: '#1D6A4C' },
      d: { page: '#050605', stage: '#0A0C0B', s1: '#131614', s2: '#1B1F1D', ink: '#E8ECE9', 'ink-2': '#A3AAA5', 'ink-3': '#8A918C', accent: '#22805C' } }
  ];
  /* 비교에 쓰는 프레임: 모드 인디케이터 · 선택 표시 · 주 행동(E-01.1), 앰버 오류 옆 강조(E-03.1), 랜딩 빔(L-01.1) */
  var SHOW = [['E-01', 0], ['E-03', 0], ['L-01', 0]];

  function lum(h) { h = h.replace('#', ''); return [0, 2, 4].map(function (k, i) { var v = parseInt(h.substr(k, 2), 16) / 255; v = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); return v * [0.2126, 0.7152, 0.0722][i]; }).reduce(function (a, b) { return a + b; }); }
  function cr(a, b) { var x = lum(a), y = lum(b); if (x < y) { var t = x; x = y; y = t; } return (x + 0.05) / (y + 0.05); }
  function vars(c, m) { var o = Object.assign({}, BASE[m], c[m]), s = ''; for (var k in o) s += '--pr-' + k + ':' + o[k] + ';'; return s + '--pr-accent-hair:color-mix(in srgb,' + o.accent + ' 45%,transparent);color-scheme:' + (m === 'l' ? 'light' : 'dark') + ';'; }
  /* 대비: 글자 토큰은 세 표면(stage · s1 · s2) 중 최소, 강조는 흰 글자와 · 무대 위 비글자 */
  function contrast(c, m) {
    var p = Object.assign({}, BASE[m], c[m]), S = [p.stage, p.s1, p.s2], mn = function (x) { return Math.min.apply(null, S.map(function (s) { return cr(x, s); })); };
    return { ink: mn(p.ink), ink2: mn(p['ink-2']), ink3: mn(p['ink-3']), warn: mn(p.warn), onAcc: cr('#FFFFFF', p.accent), accStage: cr(p.accent, p.stage) };
  }
  function sw(v) { return '<i class="d2-sw" style="background:' + v + '"></i><code>' + v + '</code>'; }

  W.D02 = { C: C, BASE: BASE, contrast: contrast };
  W.D02_HTML = function () {
    var S = W.PR, F = W.FRAMES;
    var h = '<div class="d2">';
    h += '<p class="d2-q">#826 4단계 S1 착수 전 · 결정 D02 · 결정 대기</p><h1>팔레트: 라이트 바탕과 강조색</h1>' +
      '<p class="d2-lede">결정 5-A(강조색은 주 행동 채움 · 선택 표시 · 모드 인디케이터에만, 오류는 앰버)는 그대로예요. 바뀌는 건 <code>--pr-accent</code> 값과 바탕 · 회색 글자 계열뿐이에요. 아래 프레임은 마스터 원본(frames.js)에 후보 토큰만 덮어 그렸어요. 대비는 이 페이지가 WCAG 상대 휘도로 직접 계산해요.</p>';
    /* 요약 표 */
    h += '<table class="d2-t"><thead><tr><th>후보</th><th>라이트 바탕 · 강조</th><th>다크 바탕 · 강조</th><th>글자 최소 대비(라이트 · 다크)</th><th>강조 채움 위 흰 글자</th><th>강조 vs 무대(비글자 3:1)</th></tr></thead><tbody>';
    C.forEach(function (c) {
      var l = contrast(c, 'l'), d = contrast(c, 'd'), f = function (x) { return x.toFixed(2); };
      var tl = Math.min(l.ink, l.ink2, l.ink3, l.warn), td = Math.min(d.ink, d.ink2, d.ink3, d.warn);
      h += '<tr><td><b>' + c.k + '</b> ' + S.esc(c.name) + (c.rec ? ' <span class="d2-rec">권고</span>' : '') + '</td><td>' + sw(c.l.stage) + ' ' + sw(c.l.accent) + '</td><td>' + sw(c.d.stage) + ' ' + sw(c.d.accent) + '</td><td>' + f(tl) + ' · ' + f(td) + '</td><td>' + f(l.onAcc) + ' · ' + f(d.onAcc) + '</td><td>' + f(l.accStage) + ' · ' + f(d.accStage) + '</td></tr>';
    });
    h += '</tbody></table><p class="d2-note">글자 토큰 = ink · ink-2 · ink-3 · warn, 표면 = stage · s1 · s2 중 최소. 네 후보 모두 4.5:1(글자) · 3:1(강조 비글자)을 넘어요.</p>' +
      '<p class="d2-note"><b>같이 정할 것</b> 워드마크 배지와 "me"는 지금 강조색을 따라가요(<code>Wordmark.tsx</code>의 <code>bg-accent</code> · <code>text-accent</code>, 랜딩 프레임 참고). B~D를 고르면 BI 배지 색이 같이 바뀌니, 배지를 강조색과 함께 바꿀지 BI 고정 색으로 떼어 둘지 정해 주세요.</p>';
    C.forEach(function (c) {
      h += '<section class="d2-c"><h2><span class="k">' + c.k + '</span>' + S.esc(c.name) + (c.rec ? ' <span class="d2-rec">권고</span>' : '') + '</h2>' +
        '<div class="d2-why"><p><b>왜</b> ' + S.esc(c.why) + '</p><p><b>위험</b> ' + S.esc(c.risk) + '</p></div><div class="d2-row">';
      ['l', 'd'].forEach(function (m) {
        SHOW.forEach(function (s) {
          var f = F.filter(function (x) { return x.id === s[0]; })[0], v = f.variants[s[1]];
          h += '<figure class="d2-fig" style="' + vars(c, m) + '"><figcaption>' + (m === 'l' ? '라이트' : '다크') + ' · ' + f.id + ' ' + S.esc(v.st) + '</figcaption>' + v.html + '</figure>';
        });
      });
      h += '</div></section>';
    });
    return h + '</div>';
  };
  /* 비교판 전용 스타일(마스터 토큰 위에서 동작) */
  W.D02_CSS = '.d2 { font-family: var(--pr-font); color: var(--pr-ink); padding: 32px 40px 56px; }' +
    '.d2 h1 { margin: 4px 0 0; font-size: 24px; line-height: 30px; font-weight: 600; letter-spacing: -.02em; }' +
    '.d2 h2 { margin: 48px 0 8px; font-size: 19px; line-height: 26px; font-weight: 600; display: flex; gap: 10px; align-items: baseline; }' +
    '.d2 h2 .k { font-variant-numeric: tabular-nums; color: var(--pr-ink-3); }' +
    '.d2-q { margin: 0; font-size: 13px; color: var(--pr-ink-2); font-weight: 500; }' +
    '.d2-lede { margin: 10px 0 16px; color: var(--pr-ink-2); max-width: 72ch; font-size: 15px; line-height: 1.55; }' +
    '.d2-note { margin: 8px 0 0; font-size: 13px; color: var(--pr-ink-2); }' +
    '.d2 code { font-size: 12px; font-variant-numeric: tabular-nums; }' +
    '.d2-t { border-collapse: collapse; font-size: 13px; line-height: 20px; background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); }' +
    '.d2-t th, .d2-t td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--pr-hair); vertical-align: middle; white-space: nowrap; }' +
    '.d2-t th { background: var(--pr-s2); font-weight: 600; }' +
    '.d2-sw { display: inline-block; width: 14px; height: 14px; vertical-align: -2px; margin-right: 4px; border: 1px solid var(--pr-hair-strong); }' +
    '.d2-rec { font-size: 12px; font-weight: 600; border: 1px solid currentColor; border-radius: var(--pr-r-tag); padding: 0 5px; line-height: 18px; }' +
    '.d2-why { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 1200px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2); }' +
    '.d2-why p { margin: 0; } .d2-why b { color: var(--pr-ink); font-weight: 600; margin-right: 4px; }' +
    '.d2-row { display: flex; gap: 24px; margin-top: 16px; overflow-x: auto; padding-bottom: 8px; }' +
    '.d2-fig { margin: 0; flex: none; width: 393px; display: flex; flex-direction: column; gap: 8px; --fw: 393px; --fh: 852px; --sb: 54px; }' +
    '.d2-fig figcaption { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--pr-ink); background: var(--pr-page); padding: 4px 8px; }' +
    '.d2-fig:nth-child(3) { margin-right: 24px; }';
})();
