/* 프레임 정의(2차: 편집 구조 재설계). 프레임 = 한 화면, variants = 그 화면의 상태 변형.
   comps는 components.js의 ID, flow는 [트리거, 도착 프레임, 전환]. 모바일 전용(데스크톱 축은 범위 밖). */
(function () {
  var S = window.PR, i = S.i;
  var FR = [];
  function F(o) { FR.push(o); }
  var SAFE = '<div class="safe-b"></div>';
  var DT = ['무드', '색상', '재질', '코팅', '투명도', '크기'];

  /* ---------- 공용 조각 ---------- */
  function tb(o) {
    o = o || {};
    var u = o.undo || { u: true, r: false };
    return '<div class="c-tb" data-rl="h"><button class="c-ib" aria-label="랜딩으로 돌아가기">' + i('back') + '</button><span class="sp"></span>' +
      '<button class="c-ib" aria-label="실행 취소"' + (u.u === false ? ' disabled' : '') + '>' + i('undo') + '</button>' +
      '<button class="c-ib" aria-label="다시 실행"' + (u.r === false ? ' disabled' : '') + '>' + i('redo') + '</button>' +
      '<button class="c-ib" aria-label="전체 보기">' + i('expand') + '</button>' +
      '<button class="c-ib" aria-label="편집 메뉴"' + (o.menuOpen ? ' aria-expanded="true"' : '') + '>' + i('more') + '</button>' +
      '<button class="c-btn pri"' + (o.blocked ? ' aria-disabled="true"' : '') + '>완료</button></div>';
  }
  /* 토스트는 무대 안: 도크 바로 위(bottom 12) 또는 상단 줄 바로 아래(top 8) */
  function ed(o) {
    return S.phone(tb(o) + S.canvas({ ticket: o.ticket, wide: o.wide, extra: o.sel || '', after: o.toast || '', rl: o.rlStage }) + (o.banner || '') + o.dock);
  }
  function design(tool, ctl, o) { o = o || {}; return S.dock('design', S.tools(o.tools || DT, tool) + '<div class="c-ctl">' + ctl + '</div>', o); }
  function sw(sel, dis) {
    return '<div class="c-opts" role="radiogroup" aria-label="잉크 색" style="gap:8px;padding:4px 0">' + ['#FFFFFF', '#141414', '#B8913A', '#5B6C8F', '#9A4A3C'].map(function (c, n) { return '<button role="radio" aria-checked="' + (n === sel) + '"' + (dis ? ' disabled' : '') + ' aria-label="' + ['흰색', '검정', '골드', '추천색 1', '추천색 2'][n] + '" style="width:44px;height:44px;border-radius:6px;border:1px solid var(--pr-hair-strong);background:' + c + ';flex:none;' + (n === sel ? 'outline:2px solid var(--pr-ink);outline-offset:2px;' : '') + (dis ? 'opacity:.4' : '') + '"></button>'; }).join('') + '</div>';
  }
  function info(o) {
    o = o || {};
    var miss = o.miss, R = S.irow;
    var b = '<div class="c-acts" style="margin-top:4px"><button class="c-btn sec"' + (o.busy ? ' aria-busy="true" aria-disabled="true"' : '') + '>' + (o.busy ? '<span class="spin" aria-hidden="true"></span>티켓 인식 중…' : '스크린샷으로 자동입력') + '</button></div>';
    b += '<p class="c-igrp">영화</p>' + R('제목', miss && miss !== 'release' ? '' : '먼 바다', { req: 1, miss: miss && miss !== 'release' }) + R('개봉일', miss ? '' : '2024.05.01', { req: 1, miss: !!miss }) + R('원제', '') + R('출연', '');
    b += '<p class="c-igrp">관람</p>' + R('관람일', '11.15 토', { off: o.offDate }) + R('관람 시간', '19:40') + R('극장', 'CGV 용산아이파크몰') + R('상영관', '7관') + R('좌석', 'H12') + R('예매 번호', '');
    b += '<p class="c-igrp">기록</p>' + R('평점', '4.0') + R('한줄평', '') + R('서명', '');
    return S.dock('info', b, { scroll: true, scrollIntended: true, miss: !!miss });
  }
  function photo(rows) { return S.dock('photo', rows.join('')); }
  var ROW = {
    poster: '<div class="c-arow"><span class="th"></span><span class="tx"><b>포스터</b><small>960 × 1440</small></span><button class="c-btn txt u">자르기</button><button class="c-btn sec">교체</button></div>',
    posterNoOrig: '<div class="c-arow"><span class="th"></span><span class="tx"><b>포스터</b><small>원본 없음</small></span><button class="c-btn txt" disabled>자르기</button><button class="c-btn sec">교체</button></div>',
    posterNone: '<div class="c-arow"><span class="th none"></span><span class="tx"><b>포스터</b><small>없음</small></span><button class="c-btn sec">추가</button></div>',
    chain: '<div class="c-arow"><span class="th logo">CGV</span><span class="tx"><b>극장 로고</b><small>텍스트 · CGV</small></span><button class="c-btn sec">이미지로</button><button class="c-ib" aria-label="극장 로고 티켓에 표시" aria-pressed="true">' + i('eye') + '</button></div>',
    format: '<div class="c-arow"><span class="th logo none" style="background:transparent"></span><span class="tx"><b>포맷 로고</b><small>비어 있음</small></span><button class="c-btn sec">추가</button><button class="c-ib" aria-label="포맷 로고 티켓에 표시" aria-pressed="true">' + i('eye') + '</button></div>',
    stamp: '<div class="c-arow"><span class="th none"></span><span class="tx"><b>배경 스탬프</b><small>비어 있음</small></span><button class="c-btn sec">추가</button></div>'
  };

  /* =========================================================
     랜딩
     ========================================================= */
  /* 비공식 고지(랜딩 · 결과 공통, 현행 문구) */
  var NOTICE = '비공식 팬메이드 티켓이라 양도·재판매할 수 없고, 정보 정확성은 보장하지 않으며 분실·훼손에 책임지지 않아요.';
  /* 재단 표시: 고른 카드 바깥 8px에 accent L자 넷(장식) */
  var CM = '<span class="cm" aria-hidden="true"><span class="a"></span><span class="b"></span><span class="c"></span><span class="d"></span></span>';
  var ATT = { // 첨부 시트 '티켓 스크린샷' 행 상태 · 실패 문구
    busy: '<span class="spin" aria-hidden="true"></span>인식 중', done: '인식했어요'
  };
  /* o: grid(동작 줄이기) · resume · sheet {ss:'none|busy|done|info|err', err(info · err 글), act(err 행 아래 버튼), poster, make} · notice(이용 고지 시트) */
  function landing(o) {
    o = o || {};
    var sh = o.sheet, gal;
    if (o.grid) {
      gal = '<div class="c-gal grid k" aria-label="무드 전시(동작 줄이기)">' + S.MOODS.filter(function (m) { return m.k !== '35mmw'; }).map(function (m, n) { return '<button class="cell" style="border:0;padding:0;background:transparent" aria-pressed="' + (n === 0) + '" aria-label="' + m.n + '"><span class="tk' + (m.dark ? ' dark' : '') + '" style="display:block;background:' + m.paper + '"><span class="po" style="display:block"></span></span>' + (n === 0 ? CM : '') + '</button>'; }).join('') + '</div>';
    } else {
      var live = sh ? S.ticket({ poster: sh.poster ? 'img' : 'none', empty: !sh.poster && sh.ss !== 'done', ghost: true }) : S.ticket({});
      gal = '<div class="c-gal k" aria-roledescription="carousel" aria-label="무드 전시"' + S.rl('w') + '>' +
        (sh ? '' : '<button class="cd s l" tabindex="-1" aria-label="스텁">' + S.ticket({}) + '</button><button class="cd s r" aria-label="크라이테리언">' + S.ticket({}) + '</button>') +
        '<button class="cd" aria-pressed="true" aria-label="미니멀"' + (sh ? ' data-live="true"' : '') + '>' + live + CM + '</button>' +
        '<div class="prog" aria-hidden="true"><span class="on"></span><span></span><span></span><span></span><span></span></div></div>';
    }
    var bottom;
    if (sh) {
      var ssSub = sh.ss === 'busy' ? ATT.busy : sh.ss === 'done' ? ATT.done : sh.ss === 'err' || sh.ss === 'info' ? sh.err : '';
      bottom = '<div class="c-asheet" role="dialog" aria-modal="true" aria-label="티켓과 포스터"' + S.rl('h') + '>' +
        '<div class="hd"><span class="t">티켓과 포스터</span><button class="c-ib" aria-label="닫기">' + i('close') + '</button></div>' +
        '<button class="c-ar"><span class="th">' + i('scan') + '</span><span class="tx"><b>티켓 스크린샷</b>' + (ssSub ? '<small' + (sh.ss === 'err' ? ' class="err"' : '') + '>' + ssSub + '</small>' : '') + '</span></button>' +
        (sh.act ? '<button class="c-btn txt u" style="align-self:flex-end">' + sh.act + '</button>' : '') +
        '<button class="c-ar"><span class="th' + (sh.poster ? ' img' : '') + '">' + (sh.poster ? '' : i('pic')) + '</span><span class="tx"><b>포스터</b>' + (sh.poster ? '' : '<small>선택</small>') + '</span></button>' +
        '<button class="mk-btn' + (sh.make ? ' on' : '') + '"' + (sh.make ? '' : ' aria-disabled="true"') + '>만들기</button>' + SAFE + '</div>';
    } else {
      bottom = '<div class="c-lb">' +
        (o.resume ? '<button class="c-resume"' + S.rl('h') + '><span class="rt"><small>이어서 만들기</small><b>' + (o.resume === 'untitled' ? '제목 없는 티켓' : o.resume) + '</b></span><span class="t-meta">11월 15일</span>' + i('next') + '</button>' : '') +
        '<button class="c-btn pri cta block"' + S.rl('h') + '>' + i('scan') + '티켓 스크린샷으로 자동입력</button>' +
        '<button class="c-btn sec cta block">직접 입력</button>' + SAFE + '</div>';
    }
    var notice = o.notice ? '<div class="c-sheet k" role="dialog" aria-modal="true" aria-label="이용 고지"><div class="hd"><span class="t">이용 고지</span><button class="c-ib" aria-label="닫기">' + i('close') + '</button></div>' +
      '<div class="nb c-legal"><p class="c-legal">' + NOTICE + ' © FILME</p><p class="c-legal">글꼴 KCC은영체 한국저작권위원회 (CC BY)</p><p class="c-legal"><a href="#" aria-label="GitHub 저장소">GitHub</a></p></div></div>' : '';
    var head = '<div class="c-head k">' + S.wordmark() + '<button class="c-ntc">이용 고지</button></div>';
    return S.phone('<div class="c-land">' + head + gal + bottom + notice + '</div>');
  }
  F({ id: 'L-01', page: 'landing', name: '랜딩 · 첫 방문', comps: ['C-WM', 'C-CAR', 'C-BTN'],
    variants: [{ st: '기본 · 전시 재생', html: landing({}) }, { st: '동작 줄이기', html: landing({ grid: true }) }, { st: '이용 고지 시트', html: landing({ notice: true }) }],
    states: ['워드마크 줄 바로 아래에 큰 가운데 티켓 한 장이 서요. 옆 카드는 0.82배 · 불투명도 .5로 양옆에서 엿보고, 전시 가장자리에서 잘려요.', '전시는 4초마다 넘어가요. 누르고 있거나 포커스가 들어오면 멈추고, 떼면 다시 돌아요. 카드를 탭하면 고르기만 해요(진입 아님). 고른 카드 둘레에 accent 재단 표시 네 개가 서고, 아래 5칸 진행 막대가 지금 칸을 보여요.', '시작은 아래 버튼 둘뿐이에요: "티켓 스크린샷으로 자동입력"(accent) · "직접 입력"(같은 높이). 헤드라인 · 서브 · 링크 쌍 · 아래 판은 없어요.', '동작 줄이기(OS 설정)면 자동 전환 없이 3열 격자로 전부 보여요. 탭은 고르기고 재단 표시가 고른 카드로 옮겨 가요. 35mm 와이드는 가로라 전시에서 빠져요.', '"이용 고지"는 워드마크 줄 오른쪽 끝 글자 버튼이에요. 누르면 작은 아래 시트가 열리고(어둡게 덮지 않음, 밖을 탭하면 닫힘) 고지 문구 · 글꼴 크레딧 · GitHub가 들어 있어요. 문구는 그대로예요.'],
    flow: [['티켓 스크린샷으로 자동입력', 'L-03', '첨부 시트 열기(전시가 시트 위로 올라 옆 카드 숨김)'], ['직접 입력', 'E-02', '고른 무드의 빈 티켓 편집'], ['전시 카드 탭', 'L-01', '그 카드를 고르기(진입 아님)'], ['가로 스와이프', 'L-01', '전시 한 칸'], ['이용 고지', 'L-01', '이용 고지 시트(밖 탭 · 닫기로 닫힘)']],
    notes: ['S9(D25-12)로 랜딩을 다시 짰어요. 소유자 결정: 헤드라인 · 서브 · 기둥(beam) · 아래 판 · "1 / 5" 표시 · 링크 쌍 · 접힌 고지를 걷고, 카드 탭은 진입이 아니라 고르기로 바꿨어요.', '카드 높이는 min(전시 높이 − 44px, (전시 폭 − 112px) × 1534/960)예요. 세로로 긴 프레임에서 폭만 따라 늘어나 옆 카드 · 재단 표시가 밀리는 걸 막아요.', '고지 문구 상수는 결과 화면 · 공유 페이지와 같은 것을 써요.'] });
  F({ id: 'L-02', page: 'landing', name: '랜딩 · 이어서 만들기', comps: ['C-RES', 'C-BTN'],
    variants: [{ st: '저장본 있음', html: landing({ resume: '먼 바다' }) }, { st: '제목 없는 저장본', html: landing({ resume: 'untitled' }) }],
    states: ['저장본이 있을 때만 "이어서 만들기" 행이 버튼 둘 위에 생겨요. 제목이 없으면 "제목 없는 티켓". 나머지는 L-01과 같아요.', '행이 생겨도 전시와 버튼 둘은 같은 자리에 서요(행 높이 56만큼 전시가 줄어요).'],
    flow: [['이어서 만들기', 'E-01', '저장본 열기(포스터 복원 중이면 E-02.4)']], notes: [] });
  F({ id: 'L-03', page: 'landing', name: '랜딩 · 첨부 시트', comps: ['C-BTN', 'C-WM'],
    variants: [
      { st: '빈 시트', html: landing({ sheet: { ss: 'none' } }) },
      { st: '인식 중', html: landing({ sheet: { ss: 'busy' } }) },
      { st: '포스터 넣음', html: landing({ sheet: { ss: 'none', poster: true, make: true } }) },
      { st: '인식 끝', html: landing({ sheet: { ss: 'done', make: true } }) },
      { st: '실패 · 인식 실패', html: landing({ sheet: { ss: 'err', err: '인식에 실패했어요' } }) },
      { st: '실패 · 요청 많음', html: landing({ sheet: { ss: 'err', err: '지금 요청이 많아요. 잠시 후 다시 시도하거나 직접 입력해 주세요.' } }) },
      { st: '실패 · 파일 형식', html: landing({ sheet: { ss: 'err', err: 'PNG, JPG, WebP만 인식할 수 있어요' } }) },
      { st: '진행 · 영화 정보 검색 중', html: landing({ sheet: { ss: 'info', err: '영화 정보 검색 중…', make: true } }) },
      { st: '빈 결과 · 영화 정보 없음', html: landing({ sheet: { ss: 'err', err: '영화 정보를 찾지 못했어요', act: '제목 확인', make: true } }) }
    ],
    states: ['"티켓 스크린샷으로 자동입력"이 여는 시트 "티켓과 포스터"예요. 어둡게 덮지 않고, 열려 있는 동안 옆 카드는 숨고 가운데 티켓(지금 문서 그대로)이 시트 위에 서요.', '행 둘: "티켓 스크린샷"(상태 줄 없음 · "인식 중" 스피너 · "인식했어요" · 경고색 오류 글) · "포스터"("선택" 또는 올린 썸네일). 행을 누르면 OS 파일 선택이 떠요.', '"만들기"는 뭔가 넣었고 인식 중이 아닐 때만 accent로 켜져요. 그 전엔 테두리 버튼 모양으로 눌러도 아무 일 없어요.', '넣은 포스터와 인식 결과는 뒤의 큰 티켓에 바로 차올라요. 닫기(또는 시트 밖 탭 · Escape)는 시트를 열기 전 문서로 되돌려요(스냅샷).', '오류 문구는 "인식에 실패했어요" · "지금 요청이 많아요…" · "PNG, JPG, WebP만 인식할 수 있어요". 같은 자리: "HEIC는 지원하지 않아요" · "10MB 이하 이미지만 돼요" · "인식된 정보가 없어요. 직접 입력해 주세요."'],
    flow: [['만들기(스크린샷 있음)', 'E-05', '편집 + 자동입력 배너'], ['만들기(포스터만)', 'E-01', '포스터가 들어간 새 문서'], ['닫기', 'L-01', '문서 그대로, 시트 열기 전 스냅샷으로 되돌림'], ['인식된 정보 없음', 'L-03', '시트에 남아 행 아래 안내'], ['제목 확인', 'K-01', '만들기처럼 문서를 확정하고 정보 모드의 제목 입력']],
    notes: ['"지금 요청이 많아요…"·"인식된 정보가 없어요…"는 테스트가 잠근 문구라 두 문장 그대로예요.', '시트가 오류 글을 행 안에 싣게 되면서 옛 토스트 자리 안내는 걷었어요(S9 constraint-11).', '제목만 인식하면 "영화 정보 검색 중…"이 보조색으로, KOBIS가 못 찾으면 "영화 정보를 찾지 못했어요"가 경고색으로 행에 뜨고 [제목 확인]은 행 바로 아래에 서요(#852, 행 자체가 버튼이라 안에 못 넣어요). 버튼이 달린 안내는 3초 뒤 사라지지 않고, 누르거나 시트를 닫으면 걷혀요.'] });

  /* =========================================================
     편집 기본
     ========================================================= */
  F({ id: 'E-01', page: 'editor', name: '편집 · 기본(모드 셋)', comps: ['C-TB', 'C-STAGE', 'C-DOCK', 'C-TOOLS', 'C-MOOD', 'C-IROW', 'C-AROW'],
    variants: [
      { st: '디자인 · 무드', html: ed({ rlStage: true, dock: design('무드', S.thumbs('minimal')) }) },
      { st: '정보', html: ed({ ticket: { ghost: true }, dock: info({}) }) },
      { st: '사진', html: ed({ dock: photo([ROW.poster, ROW.chain, ROW.format]) }) }
    ],
    states: ['도크 높이는 모드·도구와 상관없이 하나(본문 196 + 모드 바 52 + 안전 영역 34). 티켓은 남은 높이를 다 써요.', '사진 = 이미지 자산(포스터 · 로고 · 스탬프), 정보 = 티켓에 찍히는 글, 디자인 = 티켓 전체에 한 번에 적용되는 꾸미기. 필드 하나하나를 디자인과 같은 줄에 두지 않아요.', '정보 모드에선 빈 자리가 점선으로 보여요(빈 항목 미리보기 자동 켬, 저장물엔 없음).', '처음 진입: 스크린샷으로 채웠으면 디자인, 아니면 정보.'],
    flow: [['티켓의 글 필드 탭', 'K-01 · K-02', '입력 패널 + 키보드 240ms'], ['티켓의 포스터·로고 탭', 'G-01', '사진 모드, 그 행 강조'], ['모드 탭', 'E-01', '도크 본문만 160ms 교체'], ['완료', 'R-01', '필수 통과 시. 실패 시 E-03'], ['전체 보기', 'E-04', ''], ['⋯', 'M-01', ''], ['‹', 'L-02', '랜딩(문서 보존)']],
    notes: ['떠 있는 툴바·드로어·대상 줄·고급 설정은 없어요. 실행 취소·다시 실행·전체 보기는 상단 줄.'] });

  F({ id: 'E-02', page: 'editor', name: '편집 · 빈 티켓과 복원', comps: ['C-DOCK', 'C-IROW', 'C-BTN', 'C-TST'],
    variants: [
      { st: '빈 상태', html: ed({ ticket: { poster: 'none', empty: true, ghost: true }, undo: { u: false, r: false }, blocked: true, dock: info({ miss: true }) }) },
      { st: '로딩 · 스크린샷 인식 중', html: ed({ ticket: { poster: 'none', empty: true, ghost: true }, undo: { u: false, r: false }, blocked: true, dock: info({ miss: true, busy: true }) }) },
      { st: '오류 · 인식 실패', html: ed({ ticket: { poster: 'none', empty: true, ghost: true }, undo: { u: false, r: false }, blocked: true, dock: info({ miss: true }), toast: S.toast('인식에 실패했어요', { err: true, bottom: 12 }) }) },
      { st: '로딩 · 포스터 복원 중', html: ed({ ticket: { poster: 'load' }, dock: design('무드', S.thumbs('minimal')), toast: '<p class="c-spec" style="position:absolute;left:0;right:0;top:40%;text-align:center;color:rgba(30,27,24,.72)">포스터 불러오는 중…</p>' }) },
      { st: '오류 · 포스터 복원 실패', html: ed({ ticket: { poster: 'none' }, dock: photo([ROW.posterNone, ROW.chain, ROW.format]), toast: S.toast('저장된 포스터를 불러오지 못했어요', { err: true, close: true, top: 8 }) }) }
    ],
    states: ['빈 상태는 정보 모드로 열려요. 필수(제목·개봉일) 행과 정보 탭에 앰버 점, 완료는 차단 모양.', '인식 중: "스크린샷으로 자동입력"이 "티켓 인식 중…"(aria-busy). 다른 편집은 계속돼요.', '포스터 복원 실패는 사진 모드로 열고 포스터 행을 "없음"으로.'],
    flow: [['스크린샷으로 자동입력', 'E-02 · E-05', '인식 중 → 성공 E-05 · 실패 E-02.3'], ['제목 행', 'K-01', '입력'], ['포스터 추가', 'C-01', '']], notes: [] });

  F({ id: 'E-03', page: 'editor', name: '편집 · 완료 실패(필수 누락)', comps: ['C-DOCK', 'C-IROW', 'C-TST'],
    variants: [
      { st: '오류 · 제목·개봉연도 없음', html: ed({ ticket: { empty: true, ghost: true }, blocked: true, dock: info({ miss: true }), toast: S.toast('제목과 개봉연도를 입력해 주세요', { err: true, top: 8 }) }) },
      { st: '오류 · 개봉연도만 없음', html: ed({ blocked: true, dock: info({ miss: 'release' }), toast: S.toast('개봉연도를 입력해 주세요', { err: true, top: 8 }) }) }
    ],
    states: ['완료를 누르면 정보 모드로 바꾸고 빈 필수 행을 앰버로, 4초 토스트 한 줄. 키보드는 자동으로 올리지 않아요.', '필수 판정은 현행 그대로(제목 trim, 개봉일 4자 이상).'],
    flow: [['빈 필수 행', 'K-01 · K-04', '입력']], notes: [] });

  F({ id: 'E-04', page: 'editor', name: '편집 · 전체 보기', comps: ['C-STAGE'],
    variants: [
      { st: '세로 무드', html: S.phone('<div class="c-canvas" style="margin-bottom:34px"><div class="tkw" style="top:8px;bottom:8px" data-rl="tw">' + S.ticket({}) + '</div></div>') },
      { st: '가로 무드(회전)', html: S.phone('<div class="c-canvas" style="margin-bottom:34px"><div style="position:absolute;left:50%;top:50%;width:calc(var(--fh) * .78);aspect-ratio:1534/960;transform:translate(-50%,-50%) rotate(90deg)">' + S.ticket({ wide: true }) + '</div></div>') }
    ],
    states: ['상단 줄·도크·토스트를 숨기고 티켓만. 가로 무드는 90° 회전(현행). 티켓을 누르면 돌아가요(안내 문구 없음).', '선택 표시·빈 항목은 강제로 꺼요(요구 6).'],
    flow: [['티켓 탭 · 뒤로', 'E-01', '240ms']], notes: [] });

  F({ id: 'E-05', page: 'editor', name: '편집 · 자동입력 결과', comps: ['C-BNR', 'C-IROW', 'C-TST'],
    variants: [
      { st: '기본 · 자동입력 완료', html: ed({ banner: '<div class="c-banner" role="status"><span class="tx">8개 항목을 채웠어요</span><button class="c-btn txt u">되돌리기</button><button class="c-btn txt">확인</button></div>', dock: design('무드', S.thumbs('minimal')) }) },
      { st: '로딩 · 영화 정보 검색 중', html: ed({ ticket: { poster: 'none' }, banner: '<div class="c-banner" role="status"><span class="tx">영화 정보를 자동으로 불러왔어요.</span><button class="c-btn txt u">되돌리기</button><button class="c-btn txt">확인</button></div>', toast: S.toast('영화 정보 검색 중…', { bottom: 12 }), dock: info({}) }) },
      { st: '빈 결과 · 영화 정보 없음', html: ed({ ticket: { poster: 'none' }, banner: '<div class="c-banner" role="status"><span class="tx">영화 정보를 자동으로 불러왔어요.</span><button class="c-btn txt u">되돌리기</button><button class="c-btn txt">확인</button></div>', toast: S.toast('영화 정보를 찾지 못했어요', { bottom: 12, act: '제목 확인' }), dock: info({}) }) }
    ],
    states: ['배너는 티켓과 도크 사이. 되돌리기·확인을 누를 때까지 남아요(현행).', '자동입력된 값은 정보 행 오른쪽에 출처(자동입력·KOBIS)를 작게 붙여요.', '영화 정보 검색 중 · 못 찾음은 배너가 아니라 그 위 통보 토스트예요(#852). 검색 중은 2.6초 통보, 못 찾음은 [제목 확인]이 붙어 누르거나 다음 토스트가 덮거나 필드 입력이 열릴 때까지 남아요.'],
    flow: [['되돌리기', 'E-06', '토스트 "되돌렸어요"'], ['제목 확인', 'K-01', '정보 모드로 바꿔 제목 입력']], notes: ['앱 현황: KOBIS가 못 찾아도 배너 문구는 "영화 정보를 자동으로 불러왔어요."로 남아 토스트와 어긋나요(기존 결함, #852 범위 밖).'] });

  F({ id: 'E-06', page: 'editor', name: '편집 · 실행 취소 통보', comps: ['C-TST'],
    variants: [{ st: '기본', html: ed({ undo: { u: true, r: true }, dock: design('무드', S.thumbs('minimal')), toast: S.toast('되돌렸어요', { bottom: 12 }) }) }],
    states: ['통보 토스트 2.6초, 도크 바로 위.'], flow: [['다시 실행', 'E-06', '"다시 실행했어요"']], notes: [] });

  /* =========================================================
     도크 · 디자인 / 정보 / 사진
     ========================================================= */
  F({ id: 'D-01', page: 'dock', name: '디자인 · 무드', comps: ['C-TOOLS', 'C-MOOD'],
    variants: [{ st: '기본', html: ed({ dock: design('무드', S.thumbs('minimal')) }) }, { st: '가로 무드 선택', html: ed({ wide: true, ticket: { wide: true }, dock: design('무드', S.thumbs('editorial')) }) }],
    states: ['무드 썸네일 6장 가로 스크롤(의도된 잘림). 이름은 한글.'], flow: [['썸네일', 'D-01', '티켓 즉시 교체']], notes: [] });
  F({ id: 'D-02', page: 'dock', name: '디자인 · 색상', comps: ['C-TOOLS', 'C-SW'],
    variants: [
      { st: '기본', html: ed({ dock: design('색상', sw(1) + '<div class="c-acts" style="margin-top:4px"><button class="c-btn sec">직접 지정</button><span class="t-meta">#141414</span></div>') }) },
      { st: '비활성 · 색 고정 무드', html: ed({ ticket: { dark: true }, dock: design('색상', sw(1, true) + '<p class="c-hint">이 무드는 색이 고정돼요</p>') }) }
    ],
    states: ['견본 44. 추천색 둘은 포스터에서 뽑아요(실패하면 두 칸을 숨기고 X-01 토스트).', '색 고정 무드(35mm·35mm 와이드·크라이테리언·스텁)는 견본 비활성 + 한 줄.'], flow: [['직접 지정', 'D-02', 'OS 색 선택기']], notes: [] });
  function tex(sub, opts, sel, v, dis) {
    return '<div class="c-opts" role="radiogroup" aria-label="' + sub + '">' + opts.map(function (x) { return '<button class="c-opt" role="radio" aria-checked="' + (x === sel) + '">' + x + '</button>'; }).join('') + '</div>' + S.slider('강도', v, { dis: dis, rlTrack: true });
  }
  F({ id: 'D-03', page: 'dock', name: '디자인 · 재질 · 코팅', comps: ['C-TOOLS', 'C-OPT', 'C-SL'],
    variants: [
      { st: '재질', html: ed({ dock: design('재질', tex('재질', ['원본', '미술용지', '빈티지', '흑백 신문'], '미술용지', 60)) }) },
      { st: '코팅', html: ed({ dock: design('코팅', tex('코팅', ['없음', '유광', '홀로그램', '메탈릭', '스코딕스'], '유광', 40)) }) },
      { st: '비활성 · 효과 없음', html: ed({ dock: design('재질', tex('재질', ['원본', '미술용지', '빈티지', '흑백 신문'], '원본', 0, true)) }) }
    ],
    states: ['재질과 코팅은 디자인 도구 줄의 두 도구예요. 예전엔 질감 도구 안에 재질/코팅 칸을 한 번 더 뒀는데, 도구 줄 · 칸 · 옵션이 같은 모양의 선택으로 세 겹 쌓여 위계가 흐려서 한 겹을 걷었어요(2026-11-17 시각 감사).', '"원본"·"없음"이면 강도 비활성. 트랙 hit 32, 값을 누르면 K-03.'], flow: [['값 %', 'K-03', '숫자 키패드']], notes: ['옵션 줄 가로 스크롤은 의도된 잘림이에요.'] });
  F({ id: 'D-04', page: 'dock', name: '디자인 · 투명도', comps: ['C-TOOLS', 'C-SL'],
    variants: [{ st: '기본', html: ed({ dock: design('투명도', S.slider('포스터', 100) + S.slider('글자·로고', 100)) }) }],
    states: ['티켓 전체의 두 층을 한 번에 조정해요.'], flow: [['값 %', 'K-03', '']], notes: [] });
  F({ id: 'D-05', page: 'dock', name: '디자인 · 크기', comps: ['C-TOOLS', 'C-SL', 'C-OPT'],
    variants: [
      { st: '미니멀(포스터 채우기 있음)', html: ed({ dock: design('크기', '<div class="c-opts" role="radiogroup" aria-label="포스터"><button class="c-opt" role="radio" aria-checked="true">원본 비율</button><button class="c-opt" role="radio" aria-checked="false">꽉 채우기</button></div>' + S.slider('극장 로고', 70) + S.slider('포맷 로고', 70, { dis: true })) }) },
      { st: '그 밖의 무드', html: ed({ dock: design('크기', S.slider('극장 로고', 70) + S.slider('포맷 로고', 70, { dis: true })) }) }
    ],
    states: ['포스터 채우기는 미니멀에서만(POSTER_FILL_MOODS).', '빈 로고의 크기 슬라이더는 비활성.'], flow: [['값 %', 'K-03', '']], notes: [] });

  F({ id: 'I-01', page: 'dock', name: '정보 · 목록', comps: ['C-DOCK', 'C-IROW'],
    variants: [{ st: '기본', html: ed({ ticket: { ghost: true }, dock: info({}) }) }, { st: '숨긴 항목', html: ed({ ticket: { ghost: true }, dock: info({ offDate: true }) }) }],
    states: ['의도된 잘림: 무드에 따라 최대 15행이라 도크 안에서 세로 스크롤해요.', '행 = 이름 · 값(비면 "비어 있음") · 표시 토글. 행을 누르면 그 필드 입력(K). 제목은 필수라 숨김 비활성.', '무드가 그리지 않는 항목은 목록에서 빠져요(MOOD_EXCLUDED_FIELDS).'],
    flow: [['행', 'K-01 · K-02 · K-04 · K-05 · K-06', '입력'], ['표시 토글', 'I-01', '실행 취소 가능']], notes: ['옛 FieldDrawer(핸들·스와이프)를 대체했어요(S2).'] });
  F({ id: 'G-01', page: 'dock', name: '사진', comps: ['C-DOCK', 'C-AROW', 'C-SEL'],
    variants: [
      { st: '기본', html: ed({ sel: S.sel('poster'), dock: photo([ROW.poster, ROW.chain, ROW.format]) }) },
      { st: '비활성 · 원본 없음', html: ed({ dock: photo([ROW.posterNoOrig, ROW.chain, ROW.format]) }) },
      { st: '빈 상태 · 포스터 없음', html: ed({ ticket: { poster: 'none' }, dock: photo([ROW.posterNone, ROW.chain, ROW.format]) }) },
      { st: '스탬프 무드', html: ed({ dock: photo([ROW.poster, ROW.chain, ROW.format, ROW.stamp]) }) }
    ],
    states: ['행 = 썸네일 · 이름 · 상태 · 동작. 포스터 행이 선택되면 티켓에 재단 표시(라벨은 상자 안쪽).', '로고는 텍스트/이미지 전환, 이미지면 "교체 · 자르기 · 제거". 텍스트 수정은 K-07.', '배경 스탬프는 에디토리얼·크라이테리언·스텁에서만 행이 생겨요. 행 48이라 4행까지 스크롤 없이 들어가요.'],
    flow: [['교체 · 추가', 'C-01 · C-02', 'OS 파일 선택 → 크롭'], ['자르기', 'C-01', '원본으로'], ['극장 로고 행', 'K-07', '텍스트 입력']], notes: [] });

  /* =========================================================
     입력 · 키보드
     ========================================================= */
  function kb(sel, inner, kind, o) {
    o = o || {};
    var y = ({ title: 67, seat: 85, foot: 94, date: 76, screen: 76 })[sel] || 70;
    var zoom = '<div class="c-canvas" style="overflow:hidden"><div style="position:absolute;left:50%;width:84%;margin-left:-42%;bottom:-' + (o.lift || 30) + '%;aspect-ratio:960/1534;transform:scale(1.18);transform-origin:50% ' + y + '%">' + S.ticket({}) + (sel ? S.sel(sel, { nolab: true }) : '') + '</div></div>';
    return S.phone(zoom + S.panel('inp', inner, { aria: '입력' }) + (kind === 'none' ? SAFE : S.kbd(kind)));
  }
  function ihead(name, id) {
    return '<div class="c-ph" style="margin-top:0"><label class="t" for="' + id + '" style="font-size:13px;line-height:20px;font-weight:500;color:var(--pr-ink-2)">' + name + '</label><span class="gap"></span><button class="c-ib" aria-label="이전 항목">' + i('back') + '</button><button class="c-ib" aria-label="다음 항목">' + i('next') + '</button><button class="c-btn txt">닫기</button></div>';
  }
  /* 칩 줄 = toolbar. 동작(이미지로)·독립 토글(재개봉)은 라디오 그룹 밖, 배타 선택만 radio(APG toolbar · radio) */
  function chips(items, sel, label, act, tog) { return '<div class="c-acc" role="toolbar" aria-label="' + label + ' 옵션">' + (act ? '<button class="c-opt act">' + act + '</button>' : '') + '<div role="radiogroup" aria-label="' + label + '" style="display:contents">' + items.map(function (x) { return '<button class="c-opt" role="radio" aria-checked="' + (x === sel) + '">' + x + '</button>'; }).join('') + '</div>' + (tog ? '<button class="c-opt" aria-pressed="false">' + tog + '</button>' : '') + '</div>'; }
  function title(state) {
    var b = ihead('제목 · 필수', 'k1') + '<div class="c-field focus"><input id="k1" value="먼 바" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="k1l"' + S.rl('h') + '></div>';
    if (state === 'results') b += '<ul class="c-list" id="k1l" role="listbox" style="margin-top:8px"><li role="option"><span class="th"></span><span class="kt"><b>먼 바다</b><small>2024 · 드라마 · 홍길동</small></span></li><li role="option"><span class="th"></span><span class="kt"><b>먼 바다의 소리</b><small>2019 · 다큐멘터리 · 감독 없음</small></span></li></ul>';
    if (state === 'loading') b += '<div class="c-kh" role="status"><span>검색 중…</span></div><ul class="c-list sk" aria-hidden="true"><li><span class="th"></span><span class="kt"><span class="bar" style="width:46%"></span><span class="bar" style="width:70%;margin-top:6px"></span></span></li></ul>';
    if (state === 'empty') b += '<p class="c-hint" role="status" style="margin-top:8px">검색 결과가 없어요</p>';
    if (state === 'error') b += '<div class="c-acts"><span class="c-hint warn" role="alert" style="flex:1">검색에 실패했어요</span><button class="c-btn txt u">다시 검색</button></div>';
    return b;
  }
  F({ id: 'K-01', page: 'input', name: '제목 입력 · KOBIS 검색', comps: ['C-INP', 'C-FLD', 'C-LIST', 'C-KBD', 'C-SEL'],
    variants: [{ st: '결과', html: kb('title', title('results')) }, { st: '로딩 · 검색 중', html: kb('title', title('loading')) }, { st: '빈 결과', html: kb('title', title('empty')) }, { st: '오류', html: kb('title', title('error')) }],
    states: ['입력 패널이 키보드 위에 붙어 이름·입력을 보여 주고(①), 티켓은 고른 필드가 패널 위에 오도록 1.18배로 확대해 가로가 잘리지 않아요(②). 요구 4.', '입력 16px(요구 3). 결과는 입력 아래 목록. 선택 표시 라벨은 입력 중엔 생략(패널이 이름을 보여 줌).'],
    flow: [['결과 행', 'I-01', '제목·개봉일·출연 채움, 키보드 닫힘'], ['닫기', 'K-08', '복원'], ['다음 ›', 'K-02', '다음 항목']], notes: ['키보드 300은 iOS 근사. 실제는 visualViewport로 재요.'] });
  F({ id: 'K-02', page: 'input', name: '텍스트 입력', comps: ['C-INP', 'C-FLD', 'C-KBD'],
    variants: [
      { st: '기본 · 작은 필드', html: kb('seat', ihead('좌석', 'k2') + '<div class="c-field focus"><input id="k2" value="H12" enterkeyhint="next"></div>' + chips(['티켓에 표시', '숨김'], '티켓에 표시', '표시'), 'text', { lift: 22 }) },
      { st: '비어 있음', html: kb('foot', ihead('예매 번호', 'k2b') + '<div class="c-field focus"><input id="k2b" placeholder="예매 번호" enterkeyhint="done"></div>' + chips(['티켓에 표시', '숨김'], '티켓에 표시', '표시'), 'text', { lift: 2 }) }
    ],
    states: ['필드 옵션은 입력 아래 칩 한 줄(여기선 표시/숨김). Enter는 다음 항목.'], flow: [['닫기', 'K-08', '']], notes: [] });
  F({ id: 'K-03', page: 'input', name: '% 직접 입력', comps: ['C-SL', 'C-FLD', 'C-KBD'],
    variants: [{ st: '기본', html: S.phone('<div class="c-canvas"><div class="tkw" style="top:8px;bottom:8px">' + S.ticket({}) + '</div></div>' + S.panel('inp', ihead('재질 강도', 'k3').replace('<button class="c-ib" aria-label="이전 항목">' + i('back') + '</button><button class="c-ib" aria-label="다음 항목">' + i('next') + '</button>', '') + '<div class="c-field focus"><input id="k3" value="60" inputmode="numeric"' + S.rl('h') + '></div>') + S.kbd('num')) }],
    states: ['값(%)을 누르면 숫자 키패드 + 16px 입력. 범위 밖은 0~100으로 조용히 맞춰요(현행).', '닫으면 들어오기 전 도크 도구로 돌아가요(③).'], flow: [['닫기', 'D-03', '']], notes: ['여섯 % 입력 모두 같은 화면.'] });
  F({ id: 'K-04', page: 'input', name: '날짜 입력', comps: ['C-INP', 'C-FLD', 'C-ACC'],
    variants: [
      { st: '관람일', html: kb('date', ihead('관람일', 'k4') + '<div class="c-field focus"><input id="k4" value="2026-11-15"></div>' + chips(['11.15 토', '2026.11.15', 'NOV 15'], '11.15 토', '표기'), 'text') },
      { st: '개봉일', html: kb('date', ihead('개봉일 · 필수', 'k4b') + '<div class="c-field focus"><input id="k4b" value="2024-05-01"></div>' + chips(['연', '연·월', '연·월·일'], '연·월·일', '정밀도', null, '재개봉'), 'text') }
    ],
    states: ['날짜는 OS 날짜 입력(16px). 표기·정밀도·재개봉은 칩 한 줄.', '"재개봉"을 켜면 다음 항목으로 재개봉일이 생겨요.'], flow: [['닫기', 'K-08', '']], notes: ['현행 DateSheet를 입력 패널 칩으로 옮겼어요.'] });
  F({ id: 'K-05', page: 'input', name: '평점', comps: ['C-INP', 'C-STAR'],
    variants: [
      { st: '별점', html: kb(null, ihead('평점', 'k5') + '<div class="c-acts" role="radiogroup" aria-label="별점">' + [1, 2, 3, 4, 5].map(function (n) { return '<button class="c-ib" role="radio" aria-checked="' + (n === 4) + '" aria-label="' + n + '점" style="color:' + (n <= 4 ? 'var(--pr-ink)' : 'var(--pr-hair-strong)') + '">' + i('star', n <= 4 ? ' style="fill:currentColor"' : '') + '</button>'; }).join('') + '<button class="c-btn txt u push" id="k5">4.0</button></div>', 'none') },
      { st: '소수 입력', html: kb(null, ihead('평점', 'k5b') + '<div class="c-field focus"><input id="k5b" value="4.3" inputmode="decimal"></div>', 'num') }
    ],
    states: ['별 44×44. 0.1 단위는 숫자를 눌러 키패드로.'], flow: [['닫기', 'K-08', '']], notes: [] });
  var FONTS = ['자동', '고딕', '바탕', '자람', '잉크', '은영', '붓', '쿨가이', '꽃길'];
  F({ id: 'K-06', page: 'input', name: '서명 · 한줄평', comps: ['C-INP', 'C-ACC', 'C-FLD'],
    variants: [
      { st: '서명 · 텍스트', html: kb('foot', ihead('서명', 'k6') + '<div class="c-field focus"><input id="k6" value="영화의 순간"></div>' + chips(FONTS, '자동', '서체', '이미지로'), 'text', { lift: 2 }) },
      { st: '서명 · 이미지', html: kb('foot', ihead('서명', 'k6b') + '<div class="c-acts"><span class="t-body-s" style="flex:1;color:var(--pr-ink-2)">이미지 서명</span><button class="c-btn txt">제거</button><button class="c-btn sec" id="k6b">교체</button></div>', 'none', { lift: 2 }) },
      { st: '한줄평(크라이테리언)', html: kb('foot', ihead('한줄평', 'k6c') + '<div class="c-field focus"><input id="k6c" value="파도 소리가 오래 남았다"></div>' + chips(FONTS, '바탕', '서체'), 'text', { lift: 2 }) }
    ],
    states: ['서체 9종은 칩 한 줄(가로 스크롤). 구현에선 각 칩을 그 서체로 렌더해요(티켓 폰트라 UI 단일 서체 결정 밖).', '이미지 서명이면 서체 칩이 사라져요. 한줄평 서체는 크라이테리언만.'], flow: [['이미지로 · 교체', 'C-02', '자유 비율 크롭']], notes: [] });
  F({ id: 'K-07', page: 'input', name: '로고 텍스트', comps: ['C-INP', 'C-FLD'],
    variants: [{ st: '기본', html: kb(null, ihead('극장 로고', 'k7') + '<div class="c-field focus"><input id="k7" value="CGV"></div>' + chips(['티켓에 표시', '숨김'], '티켓에 표시', '표시', '이미지로'), 'text') }],
    states: ['이미지가 있으면 텍스트보다 우선(현행).'], flow: [['이미지로', 'C-02', '']], notes: [] });
  F({ id: 'K-08', page: 'input', name: '키보드 닫힌 뒤 복원', comps: ['C-DOCK', 'C-IROW'],
    variants: [{ st: '복원', html: ed({ ticket: { ghost: true }, dock: info({}) }) }],
    states: ['닫기 · 키보드 내림 · 바깥 탭 · 뒤로 네 경로 모두: 들어오기 전 모드·도구로, 티켓은 맞춤 배율, 입력값 유지(요구 4 ③).'], flow: [['행', 'K-02', '다시 입력']], notes: ['종료 경로별 실기기 검증은 S8 Seed.'] });

  /* =========================================================
     크롭
     ========================================================= */
  function crop(o) {
    o = o || {};
    var img = o.fail ? '<div class="c-cropimg fail">이미지를 표시할 수 없어요</div>' : '<div class="c-cropimg' + (o.logo ? ' logo' : '') + '">' + (o.logo ? 'CGV' : '') + '<div class="c-cropbox" style="' + o.box + '"><i></i><i></i><i></i><i></i></div></div>';
    var ft = '<div class="c-cropft">' + (o.err ? '<div class="c-alert" role="alert"><span class="ic"></span><span class="tx">' + o.err + '</span></div>' : '') +
      (o.logo ? '' : '<div class="rowx"><span class="lb">원본 비율 보존</span><span class="c-sw' + (o.keep ? ' on' : '') + '" role="switch" aria-checked="' + !!o.keep + '" aria-label="원본 비율 보존"></span></div>') +
      '<div class="rowx"><button class="c-btn sec"' + (o.busy ? ' disabled' : '') + '>다른 사진</button><span style="flex:1"></span><button class="c-btn pri"' + (o.busy || o.fail ? ' disabled' : '') + S.rl('h') + '>' + (o.busy ? '<span class="spin"></span>적용 중' : '적용') + '</button></div></div>';
    return S.phone('<div class="c-dlg" role="dialog" aria-modal="true" aria-label="' + (o.logo ? '로고 자르기' : '포스터 자르기') + '"><div style="height:var(--sb);flex:none"></div><div class="c-tb"><span style="width:44px;flex:none"></span><b class="ttl">' + (o.logo ? '로고 자르기' : '포스터 자르기') + '</b><button class="c-ib" aria-label="닫기">' + i('close') + '</button></div><div class="c-cropstage">' + img + '</div>' + ft + '</div>');
  }
  F({ id: 'C-01', page: 'crop', name: '포스터 크롭', comps: ['C-DLG', 'C-SWT', 'C-BTN'],
    variants: [{ st: '기본 · 2:3', html: crop({ box: 'left:6%;top:10%;width:88%;height:80%' }) }, { st: '원본 비율 보존', html: crop({ keep: true, box: 'left:2%;top:2%;width:96%;height:96%' }) }, { st: '가로 슬롯 무드 · 3:2', html: crop({ box: 'left:4%;top:31%;width:92%;height:46%' }) }],
    states: ['프리셋 방향은 포스터 슬롯을 따라요(#529). 크롭 화면은 테마와 무관하게 어두운 토큰.'], flow: [['적용', 'C-03 · G-01', '적용 중 → 반영'], ['닫기', 'G-01', '변경 없음']], notes: ['비율 설명 문장은 뺐어요. 상자 모양이 비율을 보여 줘요.'] });
  F({ id: 'C-02', page: 'crop', name: '로고·서명·스탬프 크롭', comps: ['C-DLG'], variants: [{ st: '자유 비율', html: crop({ logo: true, box: 'left:0;top:0;width:100%;height:100%' }) }], states: ['비율 토글 없이 자유 비율.', '가로·세로를 따로 끌 수 있고, 처음엔 사진 전체(100%)로 열려요.'], flow: [['적용', 'G-01 · K-06', '']], notes: [] });
  F({ id: 'C-03', page: 'crop', name: '크롭 진행·오류', comps: ['C-DLG', 'C-ALR'],
    variants: [{ st: '로딩 · 적용 중', html: crop({ busy: true, box: 'left:6%;top:10%;width:88%;height:80%' }) }, { st: '오류 · 불러오기 실패', html: crop({ fail: true, err: '이미지를 불러오지 못했어요' }) }, { st: '오류 · 크롭 실패', html: crop({ box: 'left:6%;top:10%;width:88%;height:80%', err: '자르지 못했어요' }) }],
    states: ['다음 행동은 버튼(다른 사진 · 적용)이 맡아서 문장은 한 줄만.'], flow: [['다른 사진', 'C-01', '사진 선택창이 바로 열려요']], notes: [] });

  /* =========================================================
     메뉴
     ========================================================= */
  function menu(o) {
    o = o || {};
    var sheet = '<div class="c-scrim" aria-hidden="true"></div><div class="c-sheet" role="dialog" aria-modal="true" aria-label="편집 메뉴"><div class="hd"><span class="t">메뉴</span><button class="c-ib" aria-label="닫기">' + i('close') + '</button></div>' +
      '<button class="c-mi"><span class="lb">스크린샷으로 자동입력</span></button>' +
      '<div class="c-mi"><span class="lb">빈 항목 표시</span><span class="c-sw" role="switch" aria-checked="false" aria-label="빈 항목 표시"></span></div>' +
      '<div class="c-mi" role="group" aria-label="테마"><span class="lb">테마</span><span class="seg"><span class="on">시스템</span><span>라이트</span><span>다크</span></span></div>' +
      '<div class="c-mi"><span class="lb">자동저장' + (o.autoOff ? '' : '<small>11:42 저장</small>') + '</span><span class="c-sw' + (o.autoOff ? '' : ' on') + '" role="switch" aria-checked="' + !o.autoOff + '" aria-label="자동저장"></span></div>' +
      '<button class="c-mi"><span class="lb">임시저장</span></button>' +
      '<button class="c-mi' + (o.armed ? ' armed' : '') + '"><span class="lb">' + (o.armed ? '한 번 더 눌러 전체 삭제' : '초기화') + '</span></button></div>';
    return S.phone(tb({ menuOpen: true }) + S.canvas({}) + design('무드', S.thumbs('minimal')) + sheet);
  }
  F({ id: 'M-01', page: 'menu', name: '메뉴 시트', comps: ['C-MENU', 'C-SWT', 'C-SEG'],
    variants: [{ st: '기본', html: menu({}) }, { st: '초기화 확인 대기', html: menu({ armed: true }) }, { st: '자동저장 꺼짐', html: menu({ autoOff: true }) }],
    states: ['행 52. 초기화는 2탭 arm 유지(3.2초, 첫 탭 뒤 350ms 무시, 메뉴 닫으면 해제). 잠긴 문구 그대로.', '포스터 교체는 사진 모드로 옮겨서 메뉴에서 뺐어요.'],
    flow: [['스크린샷으로 자동입력', 'E-02 · E-05', '인식'], ['임시저장', 'M-02', '"임시저장했어요"'], ['초기화 두 번', 'L-01', '"초기화했어요"']], notes: [] });
  F({ id: 'M-02', page: 'menu', name: '저장 통보·실패', comps: ['C-TST'],
    variants: [
      { st: '기본 · 임시저장함', html: ed({ dock: design('무드', S.thumbs('minimal')), toast: S.toast('임시저장했어요', { bottom: 12 }) }) },
      { st: '오류 · 저장 공간', html: ed({ dock: design('무드', S.thumbs('minimal')), toast: S.toast('저장에 실패했어요. 브라우저 저장 공간이 가득 찼거나 비공개 모드일 수 있어요.', { err: true, close: true, top: 8 }) }) }
    ],
    states: ['저장 공간 실패는 지속(닫기). 포스터 저장 실패는 같은 자리 4초 "포스터 저장에 실패했어요. 저장 공간이 찼거나 비공개 모드일 수 있어요.". 토스트엔 버튼을 둘 수 없어서 [무슨 일] + [다음 행동] 두 문장이에요.'], flow: [['닫기', 'E-01', '']], notes: [] });

  /* =========================================================
     결과 · 공유
     ========================================================= */
  /* D21(결과 화면 확정안 D11 A) · S7 출시 동작(PR #846, main df3764a3) 그대로.
     o.save: 'loading'|'done' · o.link: 'loading'|'made'(만료 문장 붙음) · o.fallback: 클립보드 거부(대체 링크 칸, link:'made'와 같이)
     o.err: 화면 안 경고 한 줄 · o.toast: 위쪽 통보 · o.wide: 가로 무드 · o.extra: 덮는 층 */
  function result(o) {
    o = o || {};
    var busy = o.save === 'loading' || o.link === 'loading';
    var save = '<button class="c-btn pri"' + (o.save === 'loading' ? ' aria-busy="true"' : '') + (o.link === 'loading' ? ' disabled' : '') + S.rl('h') + '>' + (o.save === 'loading' ? '<span class="spin"></span>' : i(o.save === 'done' ? 'check' : 'down')) + '<span class="lb">저장</span></button>';
    var link = '<button class="c-btn sec"' + (o.link === 'loading' ? ' aria-busy="true"' : '') + (busy ? ' disabled' : '') + '>' + (o.link === 'loading' ? '<span class="spin"></span><span class="lb">링크 만드는 중…</span>' : i('link') + '<span class="lb">링크</span>') + '</button>';
    var share = '<button class="c-btn sec"' + (busy ? ' disabled' : '') + '>' + i('share') + '<span class="lb">공유</span></button>';
    var made = o.link === 'made';
    var float = (o.fallback ? '<div class="c-link"><input aria-label="공유 링크" value="filme.app/t/k3x9q2" readonly><button class="c-btn sec">복사</button></div>' : '') +
      (o.err ? '<div class="c-alert" role="alert"><span class="ic"></span><span class="tx">' + o.err + '</span></div>' : '');
    var toast = o.toast ? S.toast(o.toast, { mid: true, dot: false, top: 'calc(var(--sb) + var(--pr-topbar) + var(--pr-s-2))' }) : '';
    return S.phone(S.topbar({ back: '편집으로 돌아가기' }) + '<h1 class="sr-only">결과</h1><div class="c-rbody"><div class="c-rtk' + (o.wide ? ' wide' : '') + '">' + S.ticket({ wide: o.wide }) + '</div></div>' +
      '<div class="c-racts">' + (float ? '<div class="c-rfloat">' + float + '</div>' : '') + '<div class="c-rrow">' + save + link + share + '</div>' +
      '<div class="c-rnote">' + (made ? '<p class="c-legal">이 링크는 3일 후 만료돼요.</p>' : '') + '<p class="c-legal">' + NOTICE + '</p></div>' + SAFE + '</div>' + toast + (o.extra || ''));
  }
  F({ id: 'R-01', page: 'result', name: '결과 · 저장', comps: ['C-TB', 'C-BTN', 'C-ALR', 'C-TST'],
    variants: [{ st: '기본', html: result({}) }, { st: '로딩 · 저장 중', html: result({ save: 'loading' }) }, { st: '완료 · 저장함', html: result({ save: 'done', toast: '저장했어요' }) }, { st: '오류 · 저장 실패', html: result({ err: '저장하지 못했어요' }) }, { st: '가로 무드', html: result({ wide: true }) }],
    states: ['D21(D11 A). 위 줄은 ‹ 하나(워드마크 · 크기 줄 · "새 티켓 만들기" 없음, 보이는 제목 없이 sr-only 제목 "결과"). 티켓은 좌우 16 가로 상한과 남는 높이 세로 상한 중 작은 쪽까지 커지고, 가로 무드는 돌리지 않고 남는 높이 가운데에 서요. 앱 기준 위 줄 44 · 위 간격 8 · 아래 간격 12 · 버튼 줄 44 · 고지 블록 48.',
      '티켓 아래 [저장](강조) [링크] [공유] 한 줄(1.4 : 1 : 1)과 늘 보이는 비공식 고지. 저장물 그대로의 렌더(요구 6).',
      '저장 중엔 [저장]이 진행 표시, [링크] · [공유]는 비활성. 성공하면 체크 약 1.5초 + 위쪽 통보 "저장했어요"(약 2초). OS 시트를 닫으면 통보 없이 원래대로.',
      '실패는 버튼 줄 위에 겹쳐 뜨는 화면 안 경고 한 줄 "저장하지 못했어요"(티켓 크기가 안 바뀜). 다시 시도는 그 [저장] 버튼이고, 누르는 순간 경고가 지워져요.',
      '결과 화면은 앱 테마(라이트 · 다크)를 따라요.'],
    flow: [['저장', 'R-03', 'OS 공유 시트 또는 다운로드'], ['링크', 'R-02', ''], ['공유', 'R-03', '링크가 없으면 먼저 발급'], ['‹', 'E-01', '']], notes: [] });
  F({ id: 'R-02', page: 'result', name: '결과 · 링크', comps: ['C-FLD', 'C-BTN', 'C-ALR', 'C-TST'],
    variants: [{ st: '로딩 · 만드는 중', html: result({ link: 'loading' }) }, { st: '완료 · 복사함', html: result({ link: 'made', toast: '링크를 복사했어요' }) }, { st: '대체 · 클립보드 거부', html: result({ link: 'made', fallback: true }) }, { st: '오류 · 링크 실패', html: result({ err: '링크를 만들지 못했어요' }) }],
    states: ['[링크]는 링크가 없으면 만들어 바로 복사하고, 있으면 다시 복사해요. 만드는 중엔 "링크 만드는 중…"이고 다른 버튼은 비활성. 복사하면 위쪽 통보 "링크를 복사했어요"(약 2초).',
      '클립보드가 거부될 때만(인앱 웹뷰 등) 버튼 줄 위에 16px 읽기 전용 대체 링크 칸 + [복사]가 떠요(포커스 · 전체 선택).',
      '링크가 생기면 고지 블록 위에 만료 문장 "이 링크는 3일 후 만료돼요."가 붙어요(자리는 미리 잡아 티켓 크기가 안 바뀜). 만료 문장과 비공식 고지는 현행 그대로이고, 링크 전 "3일 뒤 만료" 보조 문구는 없어요.',
      '실패는 화면 안 경고 한 줄 "링크를 만들지 못했어요"이고 다시 시도는 그 [링크] 버튼이에요. 티켓 내용이 바뀌면 링크는 비워져 다시 만들어요.'],
    flow: [['공유', 'R-03', ''], ['받은 사람이 열기', 'S-01', '']], notes: [] });
  F({ id: 'R-03', page: 'result', name: '저장 · 공유 진행', comps: ['C-TST'],
    variants: [
      { st: 'OS 공유 시트(그림)', html: result({ link: 'made', extra: '<div class="c-scrim" aria-hidden="true"></div><div class="c-osheet" aria-hidden="true"><div class="hd"><i></i><span>먼 바다 · 포토티켓<br><span class="t-meta">JPEG</span></span></div><div class="apps"><span></span><span></span><span></span><span></span></div><p class="note">iOS 공유 시트 근사(앱이 그리지 않음)</p></div>' }) },
      { st: '통보 · 저장했어요', html: result({ toast: '저장했어요' }) },
      { st: '공유 불가 · 링크 복사', html: result({ link: 'made', toast: '링크를 복사했어요' }) }
    ],
    states: ['[공유]는 링크가 없으면 먼저 발급하고(발급이 실패하면 시트 · 복사 없이 R-02 경고만), 공유 API가 있으면 OS 시트, 없거나 실패하면 링크를 복사하고 통보해요. 시트를 닫으면 조용히 끝나요.',
      '통보 "저장했어요" · "링크를 복사했어요"는 결과 화면 위쪽(위 줄 아래, 티켓 위)에 약 2초 떠요. 아래가 전부 조작이라서예요.'],
    flow: [['닫기', 'R-01', '']], notes: [] });

  /* =========================================================
     오류 · 공유 페이지
     ========================================================= */
  F({ id: 'X-01', page: 'errors', name: '오류 토스트 규칙', comps: ['C-TST'],
    variants: [
      { st: '일시 · 4초', html: ed({ dock: design('색상', sw(1)), toast: S.toast('추천 색상을 만들지 못했어요', { err: true, top: 8 }) }) },
      { st: '지속 · 닫기', html: ed({ dock: photo([ROW.posterNone, ROW.chain, ROW.format]), toast: S.toast('저장된 포스터를 불러오지 못했어요', { err: true, close: true, top: 8 }) }) }
    ],
    states: ['오류는 상단 줄 아래, 통보는 도크 위. 문장은 무슨 일 한 줄. 다음 행동은 화면의 버튼이 맡고, 버튼이 없을 때만 두 번째 문장.'], flow: [['4초 · 닫기', 'E-01', '160ms']], notes: [] });
  F({ id: 'S-01', page: 'share', name: '공유 페이지 /t/[id]', comps: ['C-WM', 'C-BTN'],
    variants: [
      { st: '기본', html: S.phone('<div class="c-head" style="display:flex;justify-content:center">' + S.wordmark() + '</div><div class="c-share"><div class="img" data-rl="h">' + S.ticket({}) + '</div><p class="t-meta" style="letter-spacing:.1em;text-transform:uppercase">FILME · Photoplay Premium Ticket</p><p class="t-body">영화 포스터로 시네마틱한 포토티켓을, 너도 만들어봐.</p><button class="c-btn pri cta block" data-rl="hx">나도 티켓 만들기</button><p class="c-legal">이 링크는 3일 후 만료돼요. ' + NOTICE + '</p></div>' + SAFE) },
      { st: '빈 상태 · 만료된 링크', html: S.phone('<div class="c-head" style="display:flex;justify-content:center">' + S.wordmark() + '</div><div class="c-share" style="justify-content:center"><p class="t-title" role="heading" aria-level="1">만료된 링크예요</p><button class="c-btn pri cta block">나도 티켓 만들기</button></div>' + SAFE) }
    ],
    states: ['기본은 티켓 아래 "FILME · Photoplay Premium Ticket"(작은 대문자 줄) · 한 줄 소개 · [나도 티켓 만들기]로 현행 그대로이고, [나도 티켓 만들기]에 화살표가 없어요. 만료 문장과 비공식 고지는 맨 아래 한 줄이에요.',
      '만료 · 없는 링크(조회 실패 포함)는 404 상태코드와 함께 빈 상태 "만료된 링크예요" + [나도 티켓 만들기]예요(S7 출시). 탭 제목은 "만료된 링크예요 · FILME"이고 캐시하지 않아요.',
      '공유 페이지는 앱 테마(라이트 · 다크)를 따라요.'], flow: [['나도 티켓 만들기', 'L-01', '']], notes: [] });

  window.FRAMES = FR;
})();
