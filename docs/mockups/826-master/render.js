/* 페이지 목록·라우팅·토큰 표·추적표·흐름 렌더. */
(function () {
  var S = window.PR, FR = window.FRAMES, esc = S.esc;
  var root = document.documentElement;

  var PAGES = [
    { id: 'cover', k: '00', n: '표지 · 결정', grp: '시작' },
    { id: 'tokens', k: '01', n: '토큰', grp: '디자인 시스템' },
    { id: 'components', k: '02', n: '컴포넌트', grp: '디자인 시스템' },
    { id: 'flow', k: '03', n: '흐름', grp: '화면' },
    { id: 'landing', k: '04', n: '랜딩', grp: '화면' },
    { id: 'editor', k: '05', n: '편집 기본', grp: '화면' },
    { id: 'panels', k: '06', n: '대상별 패널', grp: '화면' },
    { id: 'input', k: '07', n: '필드 편집 · 키보드', grp: '화면' },
    { id: 'crop', k: '08', n: '크롭', grp: '화면' },
    { id: 'menu', k: '09', n: '메뉴 · 설정', grp: '화면' },
    { id: 'result', k: '10', n: '결과 · 저장 · 공유', grp: '화면' },
    { id: 'errors', k: '11', n: '오류 · 빈 상태', grp: '화면' },
    { id: 'share', k: '12', n: '공유 페이지', grp: '화면' },
    { id: 'trace', k: '13', n: '기능 · 요구 추적', grp: '근거' },
    { id: 'copy', k: '14', n: '문구 변경', grp: '근거' },
    { id: 'refs', k: '15', n: '레퍼런스', grp: '근거' },
    { id: 'verify', k: '16', n: '검증 기록', grp: '근거' }
  ];
  function framesOf(p) { return FR.filter(function (f) { return f.page === p; }); }

  /* ---------- 네비 ---------- */
  var nav = '<h1>FILME 영사실</h1><p class="sub">#826 3단계 페이지 마스터</p>', g = '';
  PAGES.forEach(function (p) {
    if (p.grp !== g) { g = p.grp; nav += '<p class="grp">' + g + '</p>'; }
    var c = framesOf(p.id); var nv = c.reduce(function (a, f) { return a + f.variants.length; }, 0);
    nav += '<a href="#' + p.id + '" data-p="' + p.id + '"><span class="k">' + p.k + '</span>' + p.n + (c.length ? '<span class="c">' + c.length + '·' + nv + '</span>' : '') + '</a>';
  });
  document.getElementById('nav').innerHTML = nav;

  /* ---------- 프레임 페이지 ---------- */
  function compLink(id) { return '<a href="#components" data-jump="' + id + '">' + id + '</a>'; }
  function frameBlock(f) {
    var h = '<h3 id="' + f.id + '">' + f.id + ' · ' + esc(f.name) + '</h3><div class="fr-row">';
    f.variants.forEach(function (v, n) {
      h += '<figure class="fr" style="margin:0"><figcaption class="fr-h"><span class="id">' + f.id + (f.variants.length > 1 ? '.' + (n + 1) : '') + '</span><span class="nm">' + esc(v.st) + '</span></figcaption>' + v.html + '</figure>';
    });
    h += '</div><div class="fr-spec"><dl>';
    h += '<dt>상태</dt><dd><ul style="margin:0;padding-left:16px">' + f.states.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></dd>';
    h += '<dt>컴포넌트</dt><dd>' + f.comps.map(compLink).join(' · ') + '</dd>';
    if (f.flow.length) h += '<dt>흐름</dt><dd><ul class="flow">' + f.flow.map(function (x) { return '<li><b>' + esc(x[0]) + '</b> → ' + x[1].split(/\s*·\s*|\s*→\s*/).map(function (id) { return /^[A-Z]-\d\d/.test(id) ? '<a href="#' + pageOfFrame(id.slice(0, 4)) + '" data-jump="' + id.slice(0, 4) + '">' + esc(id) + '</a>' : esc(id); }).join(' · ') + (x[2] ? ' <span style="color:var(--pr-ink-3)">(' + esc(x[2]) + ')</span>' : '') + '</li>'; }).join('') + '</ul></dd>';
    if (f.notes.length) h += '<dt>메모</dt><dd>' + f.notes.map(esc).join('<br>') + '</dd>';
    return h + '</dl></div>';
  }
  function pageOfFrame(id) { for (var n = 0; n < FR.length; n++) if (FR[n].id === id) return FR[n].page; return 'flow'; }

  var INTRO = {
    landing: '앱 첫 화면이에요. 주 행동은 "티켓 스크린샷으로 자동입력" 하나이고, 전시는 무대 기둥 위에서 돌아가요.',
    editor: '편집의 바탕 화면이에요. 상단 줄 · 무대(티켓) · 문맥 패널 세 층뿐이고 떠 있는 층이 없어요.',
    panels: '패널은 고른 대상을 따라 내용만 바뀌어요. 티켓 전체(디자인·색상·질감·항목), 포스터, 로고, 필드별 패널이에요.',
    input: '입력은 언제나 키보드 위에 붙은 같은 패널에서 해요. 요구 3·4(16px, 노출·복원 3조건)가 여기서 지켜져요.',
    crop: '크롭은 전체 화면 모달이고 사진 판독을 위해 테마와 무관하게 어두워요.',
    menu: '자주 안 쓰는 것과 파괴적인 것만 메뉴에 남겼어요.',
    result: '저장물 그대로의 티켓과 주 행동 "사진에 저장" 하나, 링크·공유는 텍스트 행이에요.',
    errors: '오류는 표면 + 앰버 점·테두리로 표시해요(결정 5-A). 아래 색인은 앱의 모든 오류·빈 문구가 어느 프레임에 그려졌는지예요.',
    share: '편집기 밖의 공유 링크 페이지예요.'
  };

  /* ---------- 토큰 ---------- */
  function lum(hex) { var m = hex.replace('#', ''); var c = [0, 2, 4].map(function (k) { var v = parseInt(m.substr(k, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function cr(a, b) { var x = lum(a), y = lum(b); if (x < y) { var t = x; x = y; y = t; } return ((x + 0.05) / (y + 0.05)).toFixed(2); }
  var COLORS = [
    ['page', '#E4E0D9', '#050506', '문서 바탕(앱 밖)', null],
    ['stage', '#EFECE6', '#0B0B0C', '편집기 무대 · 결과 · 랜딩 바탕', null],
    ['surface-1', '#F7F5F1', '#141416', '패널 · 시트 · 이어서 만들기 행', null],
    ['surface-2', '#FFFFFF', '#1C1C1F', '입력 · 선택된 옵션 · 토스트', null],
    ['hair', 'rgba(17,17,17,.08)', 'rgba(255,255,255,.08)', '구분선', null],
    ['hair-strong', 'rgba(17,17,17,.16)', 'rgba(255,255,255,.16)', '테두리 · 트랙 · 손잡이', null],
    ['ink', '#141414', '#ECE9E3', '본문 · 선택 글자 · 슬라이더 채움', 'text'],
    ['ink-2', '#5B5852', '#A8A49C', '보조 글자 · 아이콘', 'text'],
    ['ink-3', '#6A665F', '#8E8A83', '메타 · 위치 · 빈 값(12px에도 4.5:1)', 'text'],
    ['accent', '#B0423F', '#C24B43', '브릭: 주 행동 채움 · 선택 표시 · 대상 인디케이터만', 'fill'],
    ['accent-ink', '#FFFFFF', '#FFFFFF', '브릭 채움 위 글자', 'onaccent'],
    ['warn', '#8F5410', '#E0A35A', '앰버: 오류 · 필수 누락 · 초기화 arm (신규, 결정 5-A)', 'text'],
    ['scrim', 'rgba(20,18,14,.48)', 'rgba(0,0,0,.64)', '모달 뒤 어둡게 (신규)', null],
    ['kbd · key', '#D1D3D9 · #FFFFFF', '#2B2B2E · #4A4A4E', '키보드 그림 전용(문서)', null]
  ];
  var SURF = { l: ['#EFECE6', '#F7F5F1', '#FFFFFF'], d: ['#0B0B0C', '#141416', '#1C1C1F'] };
  function tokensPage() {
    var h = '<h2>토큰</h2><p class="m-lede">f-refined의 <code>--pr-</code> 토큰을 출발점으로 확정했어요. 바뀐 점: mono 글꼴 토큰 삭제(결정 2), Instrument Serif 삭제(결정 4 · 워드마크는 BI Nunito), <code>--pr-warn</code>·<code>--pr-scrim</code>·<code>--pr-r-tag</code> 추가(결정 5-A, 모달, 태그), 대상 번호 표기 삭제, 그리드 오버레이 토큰은 문서 도구라 뺐어요.</p>';
    h += '<h3>색 · 라이트 / 다크</h3><div class="m-tblw"><table class="m-tbl"><thead><tr><th>토큰</th><th>라이트</th><th>다크</th><th>쓰임</th><th>대비(라이트 · 다크, 세 표면 중 최소)</th></tr></thead><tbody>';
    COLORS.forEach(function (c) {
      var r = '—';
      if (c[4] === 'text') { r = Math.min.apply(null, SURF.l.map(function (s) { return +cr(c[1], s); })).toFixed(2) + ' · ' + Math.min.apply(null, SURF.d.map(function (s) { return +cr(c[2], s); })).toFixed(2); }
      if (c[4] === 'onaccent') r = cr('#FFFFFF', '#B0423F') + ' · ' + cr('#FFFFFF', '#C24B43') + ' (브릭 채움 위)';
      if (c[4] === 'fill') r = '글자로 쓰지 않음(다크 표면 위 ' + cr('#C24B43', '#141416') + ')';
      var sw = function (v) { return /^#|^rgba/.test(v) && v.indexOf('·') < 0 ? '<i class="sw" style="background:' + v + '"></i>' : ''; };
      h += '<tr><td class="n"><code>--pr-' + c[0].split(' ')[0] + '</code></td><td class="n">' + sw(c[1]) + c[1] + '</td><td class="n">' + sw(c[2]) + c[2] + '</td><td>' + c[3] + '</td><td class="n">' + r + '</td></tr>';
    });
    h += '</tbody></table></div><p class="m-note">대비는 이 페이지가 WCAG 상대 휘도 공식으로 직접 계산한 값이에요. 반투명 토큰은 대비를 매기지 않아요(글자에 쓰지 않음).</p>';
    h += '<h3>타입 · Pretendard Variable 하나</h3><div class="m-tblw"><table class="m-tbl"><thead><tr><th>이름</th><th>견본</th><th>크기/행간</th><th>굵기</th><th>쓰임</th></tr></thead><tbody>' +
      [['tag', '필수', '11/14', 600, '태그 · 선택 라벨'], ['meta', '03 / 19 · 1960 × 3108', '12/16', 400, '위치 · 사양 · 날짜(tabular-nums, ink-3)'], ['caption', '링크는 3일 뒤 사라져요', '12/16', 400, '보조 문장 · 고지'], ['body-s', '재질 강도', '13/20', 400, '슬라이더 라벨 · 패널 안내'], ['body', '포스터 없이 직접 입력', '15/22', '400·500', '버튼 · 대상 · 옵션 · 목록'], ['input', '먼 바다', '16/24', 400, '모든 입력(요구 3)'], ['title', '제목', '17/24 −0.01em', 600, '패널 머리 · 상단 줄 제목'], ['headline', '티켓 한 장이, 내 굿즈가 돼요', '24/30 −0.02em', 600, '랜딩 헤드라인(브랜드 예외)']]
        .map(function (t) { return '<tr><td class="n"><code>' + t[0] + '</code></td><td><span class="t-' + (t[0] === 'tag' ? 'tag' : t[0]) + '">' + t[1] + '</span></td><td class="n">' + t[2] + '</td><td class="n">' + t[3] + '</td><td>' + t[4] + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="m-note">굵기는 400·500·600만. 숫자 정렬은 mono 대신 <code>font-variant-numeric: tabular-nums</code>. 로고타입만 BI 전용 Nunito 900(<code>--pr-font-brand</code>). 폴백: Pretendard → Apple SD Gothic Neo → Noto Sans KR.</p>';
    h += '<h3>간격 · 모서리 · 선 · 모션 · 크기</h3><div class="m-tblw"><table class="m-tbl"><thead><tr><th>토큰</th><th>값</th><th>쓰임</th></tr></thead><tbody>' +
      [['s-1 … s-7', '4 · 8 · 12 · 16 · 24 · 32 · 48', '모든 간격. 프레임 좌우 16'], ['r-tag', '3px', '태그 · 선택 라벨'], ['r-ctl', '6px', '버튼 · 옵션 · 입력 · 토스트'], ['r-sheet', '14px', '패널 · 시트(위 모서리만)'], ['line · ind', '1px · 2px', '헤어라인 · 선택 인디케이터'], ['dur-1 · dur-2', '160ms · 240ms', '내용 교체 · 패널 높이/화면 전환'], ['ease', 'cubic-bezier(.2,.7,.2,1)', '모든 전환'], ['hit · hit-cta', '44 · 48', '모든 터치 대상 · 화면 주 행동'], ['track-hit', '32', '슬라이더 트랙 터치(요구 2)'], ['topbar', '52', '상단 줄'], ['ticket-shadow', '0 14 32 −20 (라이트) · 0 16 40 −20 (다크)', '그림자는 티켓 한 장만'], ['pill', '없음', '스위치 트랙만 예외']]
        .map(function (t) { return '<tr><td class="n"><code>' + t[0] + '</code></td><td class="n">' + t[1] + '</td><td>' + t[2] + '</td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<h3>프레임 기준</h3><p>393×852(상태 막대 54, 아래 안전 영역 34)와 375×812(상태 막대 44). 위 막대의 "폭"으로 바꿔요. 데스크톱은 PhoneFrame 400 안에 같은 셸이 들어가요(CLAUDE.md 셸은 한 벌).</p>';
    return h;
  }

  /* ---------- 컴포넌트 ---------- */
  function compsPage() {
    var h = '<h2>컴포넌트</h2><p class="m-lede">각 견본은 화면 프레임과 같은 빌더로 그려요. "대응 파일"은 main 203ee7c 기준 현재 구현이고, 리뉴얼은 cva + cn으로 직접 구현하는 현행 자세를 유지해요(새 UI 라이브러리 없음).</p><div class="cs">';
    window.COMPONENTS.forEach(function (c) {
      h += '<section class="cs-card pr" id="' + c.id + '"><h4><span class="id">' + c.id + '</span>' + esc(c.name) + '</h4><div class="cs-demo">' + c.demo + '</div><dl>' +
        '<dt>구성</dt><dd><ol class="an">' + c.anatomy.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ol></dd>' +
        '<dt>크기</dt><dd>' + esc(c.size) + '</dd><dt>토큰</dt><dd>' + esc(c.tokens) + '</dd><dt>변형</dt><dd>' + esc(c.variants) + '</dd><dt>상태</dt><dd>' + esc(c.states) + '</dd>' +
        '<dt>대응 파일</dt><dd><b>' + esc(c.files) + '</b></dd><dt>프레임</dt><dd>' + esc(c.frames) + '</dd></dl></section>';
    });
    return h + '</div>';
  }

  /* ---------- 흐름 ---------- */
  function flowPage() {
    var nodes = [
      ['L', '랜딩', 'L-01~04', 20, 40], ['C', '크롭', 'C-01~03', 20, 200], ['E', '편집', 'E-01~06', 260, 40], ['P', '대상 패널', 'P-01~10', 500, 40],
      ['K', '입력 · 키보드', 'K-01~04', 740, 40], ['M', '메뉴', 'M-01~02', 260, 200], ['R', '결과', 'R-01~03', 500, 200], ['S', '공유 페이지', 'S-01', 740, 200]
    ];
    var pos = {}; nodes.forEach(function (n) { pos[n[0]] = n; });
    var edges = [['L', 'E', '카드 · 직접 입력 · 인식'], ['L', 'C', '포스터 업로드'], ['C', 'E', '적용'], ['E', 'P', '대상 선택'], ['P', 'K', '값 편집'], ['K', 'P', '닫기(복원)'], ['E', 'M', '⋯'], ['M', 'L', '초기화'], ['E', 'R', '완료'], ['R', 'E', '‹'], ['R', 'S', '링크'], ['S', 'L', '나도 만들기'], ['P', 'C', '자르기 · 교체'], ['E', 'L', '‹(보존)']];
    var svg = '<svg class="flowsvg" viewBox="0 0 960 300" role="img" aria-label="화면 흐름 개요"><defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path class="ah" d="M0 0L8 4L0 8z"/></marker></defs>';
    edges.forEach(function (e, n) {
      var a = pos[e[0]], b = pos[e[1]]; var ax = a[3] + 100, ay = a[4] + 30, bx = b[3] + 100, by = b[4] + 30;
      var off = (n % 2 ? 10 : -10);
      var x1 = ax + (bx > ax ? 100 : bx < ax ? -100 : off), y1 = ay + (by > ay ? 30 : by < ay ? -30 : off);
      var x2 = bx + (bx > ax ? -100 : bx < ax ? 100 : off), y2 = by + (by > ay ? -30 : by < ay ? 30 : off);
      if (e[0] === 'E' && e[1] === 'L') { y1 += 14; y2 += 14; }
      if (e[0] === 'K' && e[1] === 'P') { y1 += 14; y2 += 14; }
      if (e[0] === 'R' && e[1] === 'E') { y1 += 14; y2 += 14; }
      svg += '<path class="ed" d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '" marker-end="url(#ah)"/><text class="sm" x="' + ((x1 + x2) / 2 + 4) + '" y="' + ((y1 + y2) / 2 - 4) + '">' + e[2] + '</text>';
    });
    nodes.forEach(function (n) { svg += '<rect class="bx' + (n[0] === 'E' ? ' pri' : '') + '" x="' + n[3] + '" y="' + n[4] + '" width="200" height="60" rx="6"/><text x="' + (n[3] + 14) + '" y="' + (n[4] + 27) + '" font-size="15" font-weight="600">' + n[1] + '</text><text class="sm" x="' + (n[3] + 14) + '" y="' + (n[4] + 46) + '">' + n[2] + '</text>'; });
    svg += '</svg>';
    var h = '<h2>흐름</h2><p class="m-lede">화면 묶음 사이의 주 흐름이에요. 프레임 단위 트리거·전환은 아래 표(각 프레임의 흐름 항목을 모은 것)에 있어요.</p><div class="m-tblw" style="padding:12px">' + svg + '</div>';
    h += '<h3>전환 규칙</h3><ul><li>패널 내용 교체(대상 바뀜) 160ms, 패널 높이·화면 전환 240ms, 이징 하나.</li><li>무대의 티켓은 패널 높이가 바뀌면 같은 240ms로 배율만 바뀌어요(위치 점프 없음).</li><li>동작 줄이기면 전환은 즉시, 키보드 확대는 이동만.</li><li>브라우저 뒤로: 결과 → 편집, 크롭·메뉴 → 닫기, 입력 → 키보드 닫기, 편집 → 랜딩(문서 보존).</li></ul>';
    h += '<h3>프레임별 흐름 전체</h3><div class="m-tblw"><table class="m-tbl"><thead><tr><th>출발</th><th>트리거</th><th>도착</th><th>전환</th></tr></thead><tbody>';
    FR.forEach(function (f) { f.flow.forEach(function (x) { h += '<tr><td class="n"><a href="#' + f.page + '" data-jump="' + f.id + '">' + f.id + '</a></td><td>' + esc(x[0]) + '</td><td>' + esc(x[1]) + '</td><td>' + esc(x[2]) + '</td></tr>'; }); });
    return h + '</tbody></table></div>';
  }

  /* ---------- 추적 ---------- */
  function tracePage() {
    var T = window.TRACE || [], R = window.REQ_TRACE || [];
    var cnt = { '유지': 0, '형태 변경': 0, '제거': 0 }; T.forEach(function (t) { cnt[t.fate]++; });
    var fids = FR.map(function (f) { return f.id; }), cids = window.COMPONENTS.map(function (c) { return c.id; });
    var bad = []; T.concat(R).forEach(function (t) { t.frames.forEach(function (x) { if (fids.indexOf(x) < 0) bad.push(t.id + '→' + x); }); t.comps.forEach(function (x) { if (cids.indexOf(x) < 0) bad.push(t.id + '→' + x); }); });
    var miss = T.filter(function (t) { return !t.frames.length && t.fate !== '제거'; }).map(function (t) { return t.id; });
    var h = '<h2>기능 · 요구 추적</h2><p class="m-lede">현재 기능 ' + T.length + '개(features.js)와 #826 이관 요구 ' + R.length + '개가 어느 프레임·컴포넌트로 가는지예요. 유지 ' + cnt['유지'] + ' · 형태 변경 ' + cnt['형태 변경'] + ' · 제거 ' + cnt['제거'] + '.</p>';
    h += '<p class="m-note' + (bad.length || miss.length ? ' warn' : '') + '">자동 점검: 행선지 없는 기능 ' + miss.length + '개' + (miss.length ? '(' + miss.join(', ') + ')' : '') + ' · 없는 프레임/컴포넌트 참조 ' + bad.length + '개' + (bad.length ? '(' + bad.join(', ') + ')' : '') + '. 제거 행은 이유와 기능이 옮겨 간 곳을 적어요.</p>';
    h += '<h3>이관 요구 6</h3><div class="m-tblw"><table class="m-tbl"><thead><tr><th>요구</th><th>프레임</th><th>컴포넌트</th><th>마스터에서 지키는 방법</th></tr></thead><tbody>' + R.map(function (r) { return '<tr><td><b>' + esc(r.name) + '</b></td><td class="n">' + r.frames.join(' · ') + '</td><td class="n">' + r.comps.join(' · ') + '</td><td>' + esc(r.how) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<h3>현재 기능 52</h3><div class="m-tblw"><table class="m-tbl"><thead><tr><th>기능</th><th>지금</th><th>결과</th><th>프레임</th><th>컴포넌트</th><th>마스터 위치</th><th>바꾼 이유</th></tr></thead><tbody>';
    var g = '';
    T.forEach(function (t) {
      if (t.group !== g) { g = t.group; h += '<tr class="g"><td colspan="7">' + esc(g) + '</td></tr>'; }
      h += '<tr><td><b>' + esc(t.name) + '</b><br><code>' + t.id + '</code></td><td>' + esc(t.now) + '</td><td class="' + (t.fate === '제거' ? 'gone' : t.fate === '형태 변경' ? 'chg' : '') + '">' + t.fate + '</td><td class="n">' + t.frames.join(' · ') + '</td><td class="n">' + t.comps.join(' · ') + '</td><td>' + esc(t.where) + '</td><td>' + esc(t.why) + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  /* ---------- 문구 ---------- */
  var COPY = [
    ['편집 · 완료 실패', '제목과 개봉연도가 필요해요', '제목과 개봉연도가 비어 있어요. 두 항목을 채워 주세요.', 'E-03', '아니요', '없음(disabledReason은 테스트가 문자열로 잡지 않음 — 구현 때 grep 재확인)'],
    ['편집 · 개봉연도만 누락', '(없음)', '개봉연도가 비어 있어요. 연도 네 자리를 입력해 주세요.', 'E-03', '—', '신규'],
    ['KOBIS 로딩', 'Loading…', '검색 중…', 'K-01', '아니요', '없음'],
    ['결과 · 저장 실패', '저장에 실패했어요. + 다시 시도', '저장에 실패했어요. 다시 시도해 주세요.', 'R-01', '아니요', '없음'],
    ['결과 · 공유 대체', '(통보 없음)', '링크를 복사했어요', 'R-03', '—', '신규(축 4 과거형)'],
    ['랜딩 · 이어서 만들기(제목 없음)', '이어서 만들기', '제목 없는 티켓', 'L-02', '아니요', '없음'],
    ['메뉴 · 테마', '다크모드(토글)', '테마: 시스템 · 라이트 · 다크', 'M-01', '아니요', '테마 토글 테스트가 role/name으로 찾으면 갱신 필요(구현 때 확인)'],
    ['메뉴 · 자동저장 상태', '자동저장 켜짐 — 클릭하면 꺼요(title)', '자동저장 + "11:42에 저장했어요"', 'M-01', '아니요', 'AutoSaveIndicator 관련 테스트(구현 때 확인). 축 2 위반이던 title을 없앰'],
    ['편집 · 워드마크 탭 초기화', '지금까지 작업한 내용이 사라져요. 처음 화면으로 돌아갈까요?', '(사라짐: ‹는 문서를 지우지 않음)', 'E-01', '예', 'wordmarkClearOnTap · mobileEditorShellMenu · resultStageWordmarkReset'],
    ['크롭 · 비율', '원본 비율 보존(체크박스)', '원본 비율 보존(스위치) + 현재 비율 한 줄', 'C-01', '아니요', 'posterCropPipeline 등이 체크박스 role로 찾으면 switch로 갱신'],
    ['무드 이름', 'Minimal · Criterion …', '미니멀 · 크라이테리언 …', 'P-01', '아니요', 'LayoutStrip 라벨 테스트(구현 때 확인)'],
    ['포스터 · 빈 대상', '(없음)', '포스터 없이도 저장할 수 있어요.', 'P-04', '—', '신규'],
    ['범위 밖 % 입력', '(조용히 고정)', '0부터 100까지만 돼요. 100으로 맞출게요.', 'K-03', '—', '신규'],
    ['공유 페이지 만료', 'Next 기본 404', '이 링크는 만료됐어요 · 공유 링크는 3일 동안만 열려요.', 'S-01', '—', '신규(제안)'],
    ['공유 페이지 CTA', '나도 티켓 만들기 →', '나도 티켓 만들기', 'S-01', '아니요', '없음'],
    ['랜딩 드롭', '(외곽선만)', '놓으면 포스터로 시작해요', 'L-04', '—', '신규']
  ];
  function copyPage() {
    var h = '<h2>문구 변경</h2><p class="m-lede">docs/COPY_TONE_GUIDE.md 기준이에요(라벨: 조건절·종결어미·마침표 없음 / 실패: [무슨 일] + [다음 행동] 두 문장, 한 문장 33자·전체 44자). 아래 외의 문구는 현행 그대로 옮겼어요.</p>';
    h += '<h3>테스트가 잠근 문구</h3><div class="m-tblw"><table class="m-tbl"><thead><tr><th>문구</th><th>마스터</th><th>프레임</th></tr></thead><tbody>' +
      [['포스터 업로드 · 포스터 없이 직접 입력', '그대로', 'L-01~L-03'], ['티켓 스크린샷으로 자동입력 · 스크린샷으로 자동입력', '그대로', 'L-01 · E-02 · M-01'], ['지금 요청이 많아요… · 인식된 정보가 없어요…', '그대로', 'L-03'], ['한 번 더 눌러 전체 삭제 · 임시저장했어요', '그대로', 'M-01 · M-02'], ['초기화했어요', '그대로', 'M-01'], ['지금까지 작업한 내용이 사라져요…', '<span class="gone">사라짐</span>: 워드마크 탭 초기화를 ‹(문서 보존)로 대체. 영향 테스트 wordmarkClearOnTap · mobileEditorShellMenu · resultStageWordmarkReset를 같은 커밋에서 고쳐야 해요', 'E-01']]
        .map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td class="n">' + r[2] + '</td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<h3>바뀌거나 새로 생긴 문구</h3><div class="m-tblw"><table class="m-tbl"><thead><tr><th>자리</th><th>지금</th><th>마스터</th><th>프레임</th><th>잠김</th><th>영향 테스트</th></tr></thead><tbody>' +
      COPY.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + esc(r[1]) + '</td><td><b>' + esc(r[2]) + '</b></td><td class="n">' + r[3] + '</td><td>' + r[4] + '</td><td>' + esc(r[5]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    return h;
  }

  /* ---------- 오류 색인 ---------- */
  var ERR = [
    ['인식에 실패했어요. 다시 시도해 주세요.', '로컬 3s', 'L-03'], ['지금 요청이 많아요. 잠시 후 다시 시도하거나 직접 입력해 주세요.', '로컬 3s', 'L-03'], ['PNG, JPG, WebP 파일만 인식할 수 있어요. 다른 파일을 골라 주세요.', '로컬 3s', 'L-03'],
    ['HEIC 파일은 지원하지 않아요. PNG/JPG로 저장해 주세요.', '로컬 3s', 'L-03(같은 자리)'], ['파일 크기가 10MB를 초과해요. 더 작은 이미지를 골라 주세요.', '로컬 3s', 'L-03(같은 자리)'], ['인식된 정보가 없어요. 직접 입력해 주세요.', '로컬 3s', 'L-03(같은 자리) → E-02'],
    ['영화 정보를 찾지 못했어요. 제목을 확인하고 다시 검색해 주세요.', '패널 안 경고', 'E-05'], ['검색 결과가 없어요. 제목을 다시 확인해 주세요.', '패널 안', 'K-01'], ['검색 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.', '패널 안', 'K-01'],
    ['제목과 개봉연도가 비어 있어요. 두 항목을 채워 주세요.', '입력 아래', 'E-03'], ['저장에는 제목과 개봉연도가 필요해요. 개봉일은 티켓에서 숨겨도 돼요.', '경고 상자', 'P-10'],
    ['이 무드는 톤이 고정이라 잉크 색을 바꿀 수 없어요.', '비활성 안내', 'P-02'], ['추천 색상을 만들지 못했어요. 색상은 직접 골라 주세요.', '일시 4s', 'P-02 · X-01'], ['포스터 원본이 없어요. 포스터를 다시 업로드해 주세요.', '비활성 안내', 'P-04'],
    ['서명 이미지가 있으면 폰트가 적용되지 않아요.', '비활성 안내', 'P-09'], ['포맷 로고가 비어 있어요. 이미지나 텍스트를 입력하세요.', '빈 상태', 'P-05'],
    ['이미지를 불러오지 못했어요. 다른 사진을 선택해 주세요.', '크롭 안 경고', 'C-03'], ['이미지 크롭에 실패했어요. 다시 시도해 주세요.', '크롭 안 경고', 'C-03'],
    ['저장된 포스터를 불러오지 못했어요. 포스터를 다시 올려 주세요.', '지속', 'E-02 · X-01'], ['저장에 실패했어요. 브라우저 저장 공간이 가득 찼거나 비공개 모드일 수 있어요.', '지속', 'M-02'], ['포스터 저장에 실패했어요. 저장 공간이 찼거나 비공개 모드일 수 있어요.', '일시 4s', 'M-02'],
    ['저장에 실패했어요. 다시 시도해 주세요.', '경고 상자', 'R-01'], ['링크 생성에 실패했어요. 다시 시도해 주세요.', '경고 상자', 'R-02'], ['이 링크는 만료됐어요', '빈 상태', 'S-01']
  ];
  function errIndex() { return '<h3>오류 · 빈 문구 색인</h3><div class="m-tblw"><table class="m-tbl"><thead><tr><th>문구</th><th>표시</th><th>프레임</th></tr></thead><tbody>' + ERR.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + r[1] + '</td><td class="n">' + r[2] + '</td></tr>'; }).join('') + '</tbody></table></div><p class="m-note">저장본 JSON 파싱 실패는 현행처럼 조용히 넘어가요(이어서 만들기 행이 생기지 않음). 별도 문구를 만들지 않았어요.</p>'; }

  /* ---------- 레퍼런스 ---------- */
  function refsPage() {
    return '<h2>레퍼런스</h2><p class="m-lede">패턴마다 공식 출처와 채택 이유예요. "읽음"은 본문을 열어 확인한 것, "일부"는 일부만, "미확인"은 열지 못해 근거로 쓰지 않은 것이에요. 다른 서비스의 화면 배치는 문서가 직접 말한 것만 적었어요.</p><div class="m-tblw"><table class="m-tbl"><thead><tr><th>패턴</th><th>쓰인 곳</th><th>출처</th><th>출처가 말하는 것</th><th>채택 이유</th><th>확인</th></tr></thead><tbody>' +
      window.REFS.map(function (r) { return '<tr><td><b>' + esc(r.pattern) + '</b></td><td class="n">' + esc(r.where) + '</td><td style="max-width:220px;overflow-wrap:anywhere">' + (r.url ? '<a href="' + r.url + '" target="_blank" rel="noopener">' + esc(r.url.replace(/^https:\/\//, '')) + '</a>' : '—') + '</td><td>' + esc(r.says) + '</td><td>' + esc(r.adopt) + '</td><td><span class="m-pill ' + (r.verified === 'yes' ? 'ok' : 'open') + '">' + { yes: '읽음', partial: '일부', no: '미확인' }[r.verified] + '</span></td></tr>'; }).join('') + '</tbody></table></div><p class="m-note">조사일 2026-11-16. Material 3 가이드라인은 JS 렌더라 본문을 못 읽어서 48dp 등 Material 수치는 쓰지 않았어요.</p>';
  }

  /* ---------- 표지 ---------- */
  function coverPage() {
    var nF = FR.length, nV = FR.reduce(function (a, f) { return a + f.variants.length; }, 0);
    var h = '<h2>FILME 영사실 · 페이지 마스터</h2><p class="m-lede">#826 리뉴얼 3단계 산출물이에요. 소유자가 고른 F′(f-refined "영사실")를 바탕으로 앱 화면 전체를 393 기준 프레임 ' + nF + '개, 상태 변형 ' + nV + '개로 정의했어요. 라이브 구현 직전 수준이 목표라 각 프레임에 상태·컴포넌트·흐름·레드라인이 붙어 있어요. 프로덕션 코드(src/)와 Seed(4단계)는 범위 밖이에요.</p>';
    h += '<h3>읽는 법</h3><ul><li>왼쪽 목록이 페이지예요. 숫자는 프레임·상태 변형 수.</li><li>위 막대에서 프레임 폭(393/375)·테마·레드라인을 바꿔요. 레드라인 숫자는 화면을 그린 뒤 요소를 실측한 px라 375에서도 맞아요.</li><li>레드라인 주석(분홍)은 문서 층이라 앱 화면 위에 일부러 겹쳐요. 끄면 화면만 보여요.</li><li>티켓 그림은 960×1534 비율 자리표시예요. 무드 렌더 리뉴얼은 #826의 다른 갈래예요.</li></ul>';
    h += '<h3>결정</h3><div class="m-tblw"><table class="m-tbl"><thead><tr><th>#</th><th>질문</th><th>결정</th><th>상태</th></tr></thead><tbody>' +
      [['1', '다크를 기본으로 고정할지', '시스템 따름. 메뉴에서 시스템/라이트/다크 선택(기본 시스템)', '결정 2026-11-16'], ['2', 'mono 라벨 범위', 'mono를 쓰지 않음. 전부 Pretendard Variable, 숫자는 tabular-nums', '결정 2026-11-16'], ['3', '선택 표시', '3-A 재단 표시 + 라벨 위치 규칙(위 여백 22 미만이면 아래 → 안쪽 → 생략)', '결정 2026-11-16'], ['4', '세리프', '4-A 세리프 없음. 워드마크는 BI 마스터 v2(Nunito 900) 그대로', '결정 2026-11-16'], ['5', '브릭 범위', '5-A 브릭은 주 행동·선택 표시·대상 인디케이터만, 오류·필수 누락은 앰버 --pr-warn', '결정 2026-11-16']]
        .map(function (r) { return '<tr><td class="n">' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td><span class="m-pill ok">' + r[3] + '</span></td></tr>'; }).join('') + '</tbody></table></div><p class="m-note">비교판: <a href="https://claude.ai/artifact/11zWFbE2tNjENa356sjEKb" target="_blank" rel="noopener">선택 표시 · 세리프 · 브릭 범위</a></p>';
    h += '<h3>미결 · 가정</h3><div class="m-tblw"><table class="m-tbl"><thead><tr><th>항목</th><th>이 마스터의 가정</th><th>정할 때</th></tr></thead><tbody>' +
      [['테마 설정을 남길지', 'Apple HIG는 앱 전용 외관 설정을 피하라고 하지만 현행 다크모드 토글(c_theme)을 보존해야 해서 시스템/라이트/다크로 남겼어요', '4단계 Seed'],
       ['워드마크 탭 초기화 제거', '‹가 문서를 지우지 않고 랜딩으로 가고, 지우기는 메뉴 초기화(2탭 arm) 하나로 모았어요. 잠긴 confirm 문구가 사라져 테스트 3개 수정이 필요해요', '구현 PR'],
       ['공유 페이지 만료 상태', 'Next 기본 404 대신 같은 레이아웃의 빈 상태를 제안했어요', '4단계 Seed'],
       ['필드 hit area 규칙', '글자 상자보다 최소 44×44로 넓히고 겹치면 가까운 중심이 이긴다 — 실측 없이 정한 구현 메모예요', '구현 + 실기기'],
       ['키보드 높이', '300 근사로 그렸어요. 실제는 visualViewport로 재요', '구현'],
       ['재질·코팅 옵션 이름', '자리표시예요. 실제 값은 현행 후보정 상수', '구현']]
        .map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td><span class="m-pill open">' + r[2] + '</span></td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<h3>F′ 대비 바꾼 것</h3><ul><li>대상 줄 번호(01…)와 mono 태그를 지우고 위치만 "03 / 19"로 남겼어요(결정 2).</li><li>대상 목록을 현행 필드 15개 + 포스터 + 로고 2 + 티켓 = 19개 전부로 늘리고 티켓 읽는 순서로 정렬했어요.</li><li>티켓 대상에 네 번째 탭 "항목"을 더해 드로어를 대체했어요(P-10).</li><li>오류·필수 누락은 REQ 태그 대신 "필수" 태그 + 앰버 점(결정 5-A).</li><li>워드마크를 Instrument Serif "filme"에서 BI 락업으로 되돌렸어요(목표 조건: 로고 유지).</li></ul>';
    h += '<h3>함께 만든 Claude Design 산출물</h3><p id="cd-links">같은 토큰·컴포넌트를 Design System 아티팩트로, 프레임을 Design 캔버스 아트보드로 옮겼어요(검증 기록 페이지에 링크).</p>';
    return h;
  }

  function verifyPage() { return '<h2>검증 기록</h2><div id="verify-body"><p class="m-lede">Aside로 393·375 × 라이트·다크 렌더를 확인한 기록이 여기 붙어요(verification/).</p></div>'; }

  /* ---------- 조립 ---------- */
  var html = '';
  PAGES.forEach(function (p) {
    var body = '';
    if (p.id === 'cover') body = coverPage();
    else if (p.id === 'tokens') body = tokensPage();
    else if (p.id === 'components') body = compsPage();
    else if (p.id === 'flow') body = flowPage();
    else if (p.id === 'trace') body = tracePage();
    else if (p.id === 'copy') body = copyPage();
    else if (p.id === 'refs') body = refsPage();
    else if (p.id === 'verify') body = verifyPage();
    else {
      body = '<h2>' + p.n + '</h2><p class="m-lede">' + (INTRO[p.id] || '') + '</p>' + framesOf(p.id).map(frameBlock).join('');
      if (p.id === 'errors') body += errIndex();
    }
    html += '<section class="m-page" id="pg-' + p.id + '" data-page="' + p.id + '">' + body + '</section>';
  });
  document.getElementById('pages').innerHTML = html;
  if (window.VERIFY_HTML) document.getElementById('verify-body').innerHTML = window.VERIFY_HTML;

  /* ---------- 라우팅 · 토글 ---------- */
  function show() {
    var id = (location.hash || '#cover').slice(1); if (!document.getElementById('pg-' + id)) id = 'cover';
    document.querySelectorAll('.m-page').forEach(function (s) { s.classList.toggle('on', s.dataset.page === id); });
    document.querySelectorAll('.m-nav a').forEach(function (a) { a.setAttribute('aria-current', a.dataset.p === id ? 'page' : 'false'); });
    var p = PAGES.filter(function (x) { return x.id === id; })[0];
    document.getElementById('crumb').innerHTML = '<b>' + p.k + ' ' + p.n + '</b>';
    root.removeAttribute('data-nav');
    redraw();
  }
  function redraw() { var pg = document.querySelector('.m-page.on'); if (!pg) return; S.scrollTrails(pg); requestAnimationFrame(function () { S.drawRedlines(pg); }); }
  window.addEventListener('hashchange', show);
  window.addEventListener('resize', function () { clearTimeout(window.__rt); window.__rt = setTimeout(redraw, 150); });
  document.addEventListener('click', function (e) {
    var j = e.target.closest('[data-jump]');
    if (j) { var pid = j.getAttribute('href').slice(1); setTimeout(function () { var el = document.getElementById(j.dataset.jump); if (el) el.scrollIntoView(); }, pid === (location.hash || '').slice(1) ? 0 : 60); }
  });
  document.querySelectorAll('[data-fw]').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.fw === '375') root.setAttribute('data-fw', '375'); else root.removeAttribute('data-fw'); document.querySelectorAll('[data-fw]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); redraw(); }); });
  document.querySelectorAll('[data-theme-set]').forEach(function (b) { b.addEventListener('click', function () { var v = b.dataset.themeSet; if (v === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', v); document.querySelectorAll('[data-theme-set]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }); });
  var rlb = document.getElementById('rltoggle');
  root.setAttribute('data-rl', 'on');
  rlb.addEventListener('click', function () { var on = root.getAttribute('data-rl') !== 'on'; root.setAttribute('data-rl', on ? 'on' : 'off'); rlb.setAttribute('aria-pressed', String(on)); });
  var nt = document.getElementById('navtoggle');
  nt.addEventListener('click', function () { var o = root.getAttribute('data-nav') === 'open'; if (o) root.removeAttribute('data-nav'); else root.setAttribute('data-nav', 'open'); nt.setAttribute('aria-expanded', String(!o)); });
  /* URL 쿼리로 검증 상태를 고정(Aside 자동화용): ?fw=375&theme=dark&rl=off */
  var q = new URLSearchParams(location.search);
  if (q.get('fw') === '375') document.querySelector('[data-fw="375"]').click();
  if (q.get('theme')) { var tb = document.querySelector('[data-theme-set="' + q.get('theme') + '"]'); if (tb) tb.click(); }
  if (q.get('rl') === 'off') rlb.click();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
  show();
})();
