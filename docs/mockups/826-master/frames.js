/* 프레임 정의. 프레임 = 한 화면, variants = 그 화면의 상태 변형. comps는 components.js의 ID, flow는 [트리거, 도착 프레임, 전환]. */
(function () {
  var S = window.PR, i = S.i;
  var FR = [];
  function F(o) { FR.push(o); }

  /* ---------- 공용 화면 조각 ---------- */
  var SAFE = '<div class="safe-b"></div>';
  function tbEdit(o) { o = o || {}; return S.topbar({ undo: o.undo || { u: true, r: false }, menu: true, done: o.done || 'enabled', menuOpen: o.menuOpen, rlDone: o.rlDone }); }
  function ticketHead(o) {
    o = o || {};
    return S.phd({ t: '티켓', k: 'ticket', rl: o.rl, right: '<button class="c-btn txt" aria-pressed="' + (!!o.ghost) + '">빈 항목</button><button class="c-btn txt">전체 보기</button>' });
  }
  function tabs4(sel) {
    var n = ['디자인', '색상', '질감', '항목'];
    return '<div class="c-tabs" role="tablist" aria-label="티켓 꾸미기" style="grid-template-columns:repeat(4,minmax(0,1fr))" data-rl="h">' + n.map(function (x) { return '<button role="tab" aria-selected="' + (x === sel) + '">' + x + '</button>'; }).join('') + '</div>';
  }
  function edit(o) {
    o = o || {};
    return S.phone(tbEdit(o) + S.canvas({ ticket: o.ticket, sel: o.sel, wide: o.wide, after: o.after }) + (o.banner || '') + o.panel + (o.toast || ''));
  }
  function pTicketCollapsed(o) {
    o = o || {};
    return S.panel('', S.trail('ticket', o.trail) + ticketHead(o) + tabs4('디자인') + S.thumbs(o.mood || 'minimal') + SAFE, { rl: o.rl });
  }
  function pX(inner, sel, o) {
    o = o || {};
    return S.panel('x', S.trail(o.target || 'ticket', o.trail) + (o.head || ticketHead()) + (o.tabs === false ? '' : tabs4(sel)) + '<div class="c-body"' + (o.scroll ? ' data-scroll="intended"' : '') + '>' + inner + '</div>' + SAFE, { rl: true });
  }
  function pTarget(k, t, inner, o) {
    o = o || {};
    return S.panel(o.cls || '', S.trail(k, o.trail) + S.phd({ t: t, k: k, nav: true, src: o.src, req: o.req, rl: o.rlHead }) + inner + SAFE);
  }

  /* =========================================================
     랜딩
     ========================================================= */
  function landing(o) {
    o = o || {};
    var gal;
    if (o.grid) {
      gal = '<div class="c-gal grid" aria-label="무드 전시(동작 줄이기)">' + S.MOODS.filter(function (m) { return m.k !== '35mmw'; }).map(function (m) { return '<button class="cell" style="border:0;padding:0;background:transparent" aria-label="' + m.n + ' 무드로 바로 시작"><span class="tk' + (m.dark ? ' dark' : '') + '" style="display:block;background:' + m.paper + '"><span class="po" style="display:block"></span></span></button>'; }).join('') + '</div>';
    } else {
      gal = '<div class="c-gal' + (o.drop ? ' drop' : '') + '" aria-roledescription="carousel" aria-label="무드 전시"><div class="beam" aria-hidden="true"></div>' +
        '<div class="peek l" aria-hidden="true">' + S.ticket({ dark: true }) + '</div><div class="peek r" aria-hidden="true">' + S.ticket({}) + '</div>' +
        '<button class="main" style="border:0;padding:0;background:transparent" aria-label="미니멀 무드로 바로 시작"' + S.rl('w') + '>' + S.ticket({}) + '</button>' +
        '<button class="c-ib box pause" aria-label="' + (o.paused ? '자동 전시 재개' : '자동 전시 정지') + '"' + S.rl('h') + '>' + i(o.paused ? 'play' : 'pause') + '</button>' +
        '<span class="idx">' + (o.paused ? '정지됨 · ' : '') + '1 / 5</span>' +
        (o.drop ? '<span class="dropmsg">놓으면 포스터로 시작해요</span>' : '') + '</div>';
    }
    var cta = o.loading ? '<button class="c-btn pri cta block" aria-busy="true" aria-disabled="true"><span class="spin" aria-hidden="true"></span>티켓 인식 중…</button>'
      : '<button class="c-btn pri cta block"' + S.rl('h') + '>티켓 스크린샷으로 자동입력</button>';
    var lp = '<div class="c-lp">' +
      (o.resume ? '<button class="c-resume"' + S.rl('h') + '><span class="rt"><small>이어서 만들기</small>' + (o.resume === 'untitled' ? '<b>제목 없는 티켓</b>' : '<b>' + o.resume + '</b>') + '</span><span class="t-meta">11.15 저장</span>' + i('next') + '</button>' : '') +
      cta +
      '<div class="c-pair"><button class="c-btn txt u"' + (o.loading ? ' disabled' : '') + '>포스터 업로드</button><span aria-hidden="true">·</span><button class="c-btn txt u"' + (o.loading ? ' disabled' : '') + '>포스터 없이 직접 입력</button></div>' +
      '<p class="c-legal">비공식 팬메이드 티켓이라 양도·재판매할 수 없고, 정보 정확성은 보장하지 않으며 분실·훼손에 책임지지 않아요.</p>' +
      '<p class="c-legal">© FILME · 글꼴 KCC은영체 한국저작권위원회 (CC BY) · <a href="#">GitHub</a></p>' +
      SAFE + '</div>';
    var head = '<div class="c-head">' + S.wordmark() + '<h1 class="c-copy">티켓 한 장이, 내 굿즈가 돼요</h1><p class="c-subc">스크린샷으로 자동입력. 사진으로 찍은 실물 티켓도 돼요.</p></div>';
    return S.phone('<div class="c-land">' + head + gal + lp + (o.toast || '') + '</div>', { cls: o.desk ? 'desk' : '' });
  }
  F({ id: 'L-01', page: 'landing', name: '랜딩 · 첫 방문', comps: ['C-WM', 'C-CAR', 'C-BTN', 'C-LNK'],
    variants: [
      { st: '기본 · 전시 재생', html: landing({}) },
      { st: '정지됨', html: landing({ paused: true }) },
      { st: '동작 줄이기', html: landing({ grid: true }) }
    ],
    states: ['기본: 5무드 전시가 4초마다 넘어가요(35mm 와이드는 가로라 전시 제외, 현행 유지).', '정지됨: 정지 버튼이 재생 아이콘으로 바뀌고 "정지됨" 표시. 포커스·포인터가 전시에 들어와도 멈추고, 나가도 사용자가 멈춘 상태는 유지해요.', '동작 줄이기: prefers-reduced-motion이면 전시 대신 3열 격자로 전부 보여요. 정지 버튼은 숨겨요(움직이는 게 없음).'],
    flow: [['전시 카드 탭', 'E-01', '그 무드로 새 문서. 240ms 페이드'], ['티켓 스크린샷으로 자동입력', 'L-03', 'OS 파일 선택 → 인식 중'], ['포스터 업로드', 'C-01', 'OS 파일 선택 → 크롭'], ['포스터 없이 직접 입력', 'E-02', '빈 티켓 편집'], ['가로 스와이프', 'L-01', '전시 한 칸(여러 칸 연속 가능)']],
    notes: ['요구 1(자동 재생 정지): 버튼·포커스·포인터·동작 줄이기 4갈래.', '헤드라인·서브는 COPY_TONE_GUIDE 축 5의 브랜드 예외라 문구를 그대로 둬요.', '법적 고지는 문구 규칙 대상이 아니라서 현행 문장을 그대로 옮겨요.'] });

  F({ id: 'L-02', page: 'landing', name: '랜딩 · 이어서 만들기', comps: ['C-RES', 'C-BTN', 'C-CAR'],
    variants: [
      { st: '저장본 있음', html: landing({ resume: '먼 바다' }) },
      { st: '제목 없는 저장본', html: landing({ resume: 'untitled' }) }
    ],
    states: ['저장본이 있을 때만 행이 생겨요. 제목이 없으면 "제목 없는 티켓"으로 보여요(현행은 "이어서 만들기"만 보임).', '저장본 JSON이 깨져 있으면 행이 생기지 않아요(현행 유지, 별도 문구 없음).'],
    flow: [['이어서 만들기 행', 'E-01', '저장본 열기. 포스터 복원 중이면 E-02 복원 상태'], ['주 CTA·링크 쌍', 'L-03 · C-01 · E-02', '새 문서(저장본은 덮어쓰기 전까지 유지)']],
    notes: ['주 행동은 여전히 스크린샷 자동입력 하나예요. 이어서 만들기는 테두리 행이라 채움 버튼과 무게가 갈려요.'] });

  F({ id: 'L-03', page: 'landing', name: '랜딩 · 스크린샷 인식', comps: ['C-BTN', 'C-TST'],
    variants: [
      { st: '로딩 · 인식 중', html: landing({ loading: true }) },
      { st: '오류 · 인식 실패', html: landing({ toast: S.toast('인식에 실패했어요. 다시 시도해 주세요.', { err: true, bottom: 236 }) }) },
      { st: '오류 · 요청 많음', html: landing({ toast: S.toast('지금 요청이 많아요. 잠시 후 다시 시도하거나 직접 입력해 주세요.', { err: true, bottom: 236 }) }) },
      { st: '오류 · 파일 형식', html: landing({ toast: S.toast('PNG, JPG, WebP 파일만 인식할 수 있어요. 다른 파일을 골라 주세요.', { err: true, bottom: 236 }) }) }
    ],
    states: ['로딩: CTA가 "티켓 인식 중…"(aria-busy)으로 바뀌고 링크 쌍은 비활성. 전시는 계속 돌아요.', '오류는 트리거(CTA) 바로 위에 3초 로컬 토스트로 떠요(OcrUploadCard 의도 유지, COPY_TONE_GUIDE 축 3).', '같은 자리 문구: HEIC "HEIC 파일은 지원하지 않아요. PNG/JPG로 저장해 주세요." · 10MB "파일 크기가 10MB를 초과해요. 더 작은 이미지를 골라 주세요." · 정보 없음 "인식된 정보가 없어요. 직접 입력해 주세요."'],
    flow: [['인식 성공', 'E-05', '편집으로 전환 + 자동입력 배너'], ['인식된 정보 없음', 'E-02', '빈 편집(토스트 유지)'], ['제목만 인식', 'E-05', 'KOBIS 조회 배너']],
    notes: ['"지금 요청이 많아요…"·"인식된 정보가 없어요…"는 테스트가 잠근 문구라 그대로예요(landingHeroMood).'] });

  F({ id: 'L-04', page: 'landing', name: '랜딩 · 포스터 끌어 놓기', comps: ['C-CAR'],
    variants: [{ st: '드래그 중(데스크톱 프레임)', html: landing({ drop: true }) }],
    states: ['데스크톱의 PhoneFrame(400) 안에서만 의미가 있어요. 파일이 전시 위에 오면 브릭 점선 + 안내 한 줄.', '이미지가 아닌 파일은 조용히 무시(현행 유지).'],
    flow: [['이미지 놓기', 'C-01', '크롭']], notes: ['편집 중에는 무대 전체가 같은 드롭 영역이에요(E-01).'] });

  /* =========================================================
     편집
     ========================================================= */
  F({ id: 'E-01', page: 'editor', name: '편집 · 기본(티켓 대상, 패널 접힘)', comps: ['C-TB', 'C-STAGE', 'C-PANEL', 'C-TRAIL', 'C-PH', 'C-TABS', 'C-MOOD'],
    variants: [
      { st: '기본', html: edit({ panel: pTicketCollapsed({ rl: true }) }) },
      { st: '첫 진입 · 되돌릴 것 없음', html: edit({ undo: { u: false, r: false }, panel: pTicketCollapsed({}) }) },
      { st: '빈 항목 보기 켬', html: edit({ ticket: { ghost: true }, panel: pTicketCollapsed({ ghost: true }) }) }
    ],
    states: ['기본: 티켓이 무대 가운데, 패널은 접힌 높이(대상 줄 + 머리 + 탭 + 무드)로 티켓이 화면 높이의 약 47%를 써요.', '되돌릴 것이 없으면 실행 취소·다시 실행이 비활성(현행 FloatingToolbar 규칙).', '빈 항목: 비어 있는 자리를 점선으로 보여 줘요. 필드를 고르면 자동으로 켜지고 저장물에는 안 들어가요(요구 6).'],
    flow: [['티켓의 필드 탭', 'P-06', '대상 전환. 패널 내용만 160ms 교체'], ['대상 줄 항목 탭', 'P-04 · P-05 · P-06', '같음'], ['패널 위로 끌기', 'P-01', '펼침 240ms'], ['완료', 'R-01', '필수 통과 시 결과. 실패 시 E-03'], ['‹', 'L-02', '랜딩(문서 보존)'], ['⋯', 'M-01', '메뉴 시트'], ['전체 보기', 'E-04', '최대화']],
    notes: ['떠 있는 툴바·드로어 핸들·고급 설정은 없어요. 실행 취소·다시 실행은 상단 줄로 옮겼어요.', '자동저장 표시는 상단 줄에서 메뉴로 옮겼어요(M-01). 상단 줄에 채운 버튼은 완료 하나예요.'] });

  F({ id: 'E-02', page: 'editor', name: '편집 · 빈 티켓과 복원', comps: ['C-STAGE', 'C-PANEL', 'C-BTN', 'C-TST'],
    variants: [
      { st: '빈 상태 · 포스터 없이 시작', html: edit({ ticket: { poster: 'none', empty: true, ghost: true }, undo: { u: false, r: false },
        panel: S.panel('', S.trail('ticket', { miss: true }) + ticketHead({ ghost: true }) +
          '<p class="c-hint">스크린샷이 있으면 정보를 한 번에 채울 수 있어요.</p><div class="c-acts"><button class="c-btn sec">스크린샷으로 자동입력</button><button class="c-btn txt u">제목부터 입력</button></div>' + tabs4('디자인') + SAFE) }) },
      { st: '로딩 · 저장본 포스터 복원 중', html: edit({ ticket: { poster: 'load' }, panel: pTicketCollapsed({}), after: '<p class="c-spec" style="position:absolute;left:0;right:0;top:40%;text-align:center">포스터를 불러오는 중…</p>' }) },
      { st: '오류 · 포스터 복원 실패', html: edit({ ticket: { poster: 'none' }, panel: pTicketCollapsed({}), toast: S.toast('저장된 포스터를 불러오지 못했어요. 포스터를 다시 올려 주세요.', { err: true, close: true, top: 112 }) }) }
    ],
    states: ['빈 상태: 포스터 자리에 "포스터 추가" 점선, 필드는 빈 항목 점선. 패널 머리 아래 스크린샷 자동입력(보조)과 "제목부터 입력"을 둬요. 화면의 채운 버튼은 여전히 완료 하나예요.', '복원 중: 포스터 자리만 면으로 비워 두고 나머지 편집은 바로 할 수 있어요(현행은 셸 전체를 막음 — 형태 변경).', '복원 실패: 지속 오류 토스트(닫기 버튼), 위쪽에 떠서 패널을 가리지 않아요.'],
    flow: [['포스터 추가 탭', 'C-01', 'OS 파일 선택 → 크롭'], ['스크린샷으로 자동입력', 'L-03 상태와 같은 인식 → E-05', ''], ['제목부터 입력', 'K-01', '입력 패널']],
    notes: ['드로어 상단 OcrUploadCard(context=drawer)의 자리예요. 라벨 "스크린샷으로 자동입력"은 테스트가 잠근 문구라 그대로예요.'] });

  F({ id: 'E-03', page: 'editor', name: '편집 · 완료 실패(필수 누락)', comps: ['C-TRAIL', 'C-PH', 'C-FLD', 'C-TST', 'C-TAG'],
    variants: [
      { st: '오류 · 제목·개봉연도 없음', html: edit({ done: 'blocked', sel: 'title', ticket: { empty: true, ghost: true },
        panel: pTarget('title', '제목', '<div class="c-field err"><input aria-label="제목" placeholder="영화 제목" aria-invalid="true" aria-describedby="e3m"><span class="msg" id="e3m"><span>제목과 개봉연도가 비어 있어요. 두 항목을 채워 주세요.</span></span></div><div class="c-acts"><button class="c-btn txt u">개봉일로 이동</button></div>', { trail: { miss: true }, req: 'miss' }) }) },
      { st: '오류 · 개봉연도만 없음', html: edit({ done: 'blocked', sel: 'date',
        panel: pTarget('release', '개봉일', '<div class="c-field err"><input aria-label="개봉일" placeholder="2024 또는 2024.05.01" aria-invalid="true"><span class="msg"><span>개봉연도가 비어 있어요. 연도 네 자리를 입력해 주세요.</span></span></div><p class="c-hint">개봉일은 티켓에서 숨겨도 돼요.</p>', { trail: { miss: true }, req: 'miss' }) }) }
    ],
    states: ['완료는 비활성처럼 보이지만(테두리만) 눌러져요. 누르면 첫 빈 필수 대상을 고르고 패널에 경고 입력을 띄워요(현행 "토스트 + 드로어 열기"를 한 자리로 합침).', '경고는 앰버(--pr-warn) 테두리 + 문구, 대상 줄의 필수 항목에 앰버 점. 브릭은 쓰지 않아요(결정 5-A).', '키보드는 자동으로 올리지 않아요. 입력을 누르면 K-01로 가요(완료를 누른 직후 키보드가 화면을 덮는 걸 피함).'],
    flow: [['입력 탭', 'K-01', '입력 패널 + 키보드'], ['개봉일로 이동', 'E-03 두 번째', '대상 전환'], ['두 항목 채운 뒤 완료', 'R-01', '']],
    notes: ['문구 변경: "제목과 개봉연도가 필요해요"(현행 disabledReason) → 두 문장 규칙으로. 잠긴 문구가 아니라 테스트 영향은 없고, useExportReady 판정(제목 trim 비어 있지 않음 · 개봉일 4자 이상)은 그대로예요.'] });

  F({ id: 'E-04', page: 'editor', name: '편집 · 전체 보기', comps: ['C-STAGE'],
    variants: [
      { st: '세로 무드', html: S.phone('<div class="c-canvas" style="margin-bottom:34px"><div class="tkw" style="top:8px;bottom:8px">' + S.ticket({}) + '</div></div><p class="c-spec" style="position:absolute;left:0;right:0;bottom:44px;text-align:center">티켓을 누르면 돌아가요</p>') },
      { st: '가로 무드(회전)', html: S.phone('<div class="c-canvas" style="margin-bottom:34px"><div style="position:absolute;left:50%;top:50%;width:calc(var(--fh) * .78);aspect-ratio:1534/960;transform:translate(-50%,-50%) rotate(90deg)">' + S.ticket({ wide: true }) + '</div></div>') }
    ],
    states: ['상단 줄·패널·토스트가 모두 숨고 티켓만 남아요. 가로 무드(에디토리얼·35mm 와이드)는 90° 돌려 꽉 채워요(현행 유지).', '안내 한 줄은 처음 한 번만 보이고 1.5초 뒤 사라져요.'],
    flow: [['티켓 탭 · 뒤로', 'E-01', '240ms']], notes: ['저장물 비교용 화면이기도 해서 선택 표시·빈 항목을 강제로 꺼요(요구 6).'] });

  F({ id: 'E-05', page: 'editor', name: '편집 · 스크린샷 자동입력 결과', comps: ['C-BNR', 'C-TAG', 'C-TST'],
    variants: [
      { st: '기본 · 자동입력 완료', html: edit({ banner: '<div class="c-banner" role="status"><span class="tx">8개 항목이 자동 입력되었어요.</span><button class="c-btn txt u">되돌리기</button><button class="c-btn txt">확인</button></div>', panel: pTicketCollapsed({}) }) },
      { st: '로딩 · 제목으로 영화 검색', html: edit({ ticket: { poster: 'none' }, banner: '<div class="c-banner" role="status"><span class="spin" style="width:14px;height:14px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;flex:none" aria-hidden="true"></span><span class="tx">제목으로 영화 정보를 검색할게요.</span></div>', panel: pTicketCollapsed({}) }) },
      { st: '빈 결과 · 영화 정보 없음', html: edit({ sel: 'title', ticket: { poster: 'none' },
        panel: pTarget('title', '제목', '<div class="c-field"><input aria-label="제목" value="먼 바다"></div><p class="c-hint warn">영화 정보를 찾지 못했어요. 제목을 확인하고 다시 검색해 주세요.</p>', { src: '자동입력', req: 'ok' }) }) }
    ],
    states: ['배너는 티켓과 패널 사이에 끼어 패널을 밀지 않고 티켓 높이를 줄여요. 타이머 없이 되돌리기·확인 중 하나를 누를 때까지 남아요(현행 유지).', '자동입력된 필드는 패널 머리에 "자동입력" 태그가 붙어요. KOBIS에서 온 값은 "KOBIS".', 'KOBIS가 빈손이면 제목 대상을 열고 경고 문구를 패널 안에 둬요(드로어 경로의 onNeedManualTitle과 같은 동작).'],
    flow: [['되돌리기', 'E-01', '자동입력 전 상태 + 토스트 "되돌렸어요"'], ['확인', 'E-01', '배너 닫힘'], ['입력 탭', 'K-01', '']],
    notes: ['문구는 OcrUndoBanner·OcrUploadCard 현행 그대로예요.'] });

  F({ id: 'E-06', page: 'editor', name: '편집 · 실행 취소 통보', comps: ['C-TST', 'C-TB'],
    variants: [{ st: '기본', html: edit({ undo: { u: true, r: true }, panel: pTicketCollapsed({}), toast: S.toast('되돌렸어요', { bottom: 270 }) }) }],
    states: ['완료 통보 토스트는 2.6초, 패널 바로 위에 떠요. 전체 보기 중에는 띄우지 않아요(현행).'],
    flow: [['다시 실행', 'E-06', '토스트 "다시 실행했어요"']], notes: [] });

  /* =========================================================
     대상별 패널
     ========================================================= */
  F({ id: 'P-01', page: 'panels', name: '티켓 · 디자인(펼침)', comps: ['C-PANEL', 'C-TABS', 'C-MOOD', 'C-OPT'],
    variants: [
      { st: '기본 · 스탬프 없는 무드', html: edit({ panel: pX(S.thumbs('minimal') + '<p class="c-hint">미니멀은 배경 스탬프를 쓰지 않아요.</p>', '디자인') }) },
      { st: '스탬프 무드 · 이미지 없음', html: edit({ panel: pX(S.thumbs('editorial') + '<p class="c-sh">배경 스탬프</p><div class="c-acts"><button class="c-btn sec">이미지 업로드</button></div>', '디자인'), wide: true, ticket: { wide: true } }) },
      { st: '스탬프 무드 · 이미지 있음', html: edit({ panel: pX(S.thumbs('stub') + '<p class="c-sh">배경 스탬프</p><div class="c-acts"><button class="c-btn sec">이미지 교체</button><button class="c-btn txt">제거</button></div>', '디자인'), ticket: {} }) }
    ],
    states: ['펼친 패널 높이 500. 무대는 남은 높이에 맞춰 티켓을 줄여요(티켓이 완전히 가려지지 않음).', '배경 스탬프는 에디토리얼·크라이테리언·스텁에서만 행이 생겨요. 다른 무드에서는 이유 한 줄.', '무드 이름은 한글(미니멀·크라이테리언…)로 바꿨어요(결정 2). 현행 LayoutStrip은 영문 라벨이에요.'],
    flow: [['무드 썸네일', 'P-01', '티켓 즉시 교체'], ['아래로 끌기', 'E-01', '접힘']], notes: [] });

  var SW = '<div class="c-opts" role="radiogroup" aria-label="잉크 색" style="gap:8px;padding:6px 0">' + ['#FFFFFF', '#141414', '#B8913A', '#5B6C8F', '#9A4A3C'].map(function (c, n) { return '<button role="radio" aria-checked="' + (n === 1) + '" aria-label="' + ['흰색', '검정', '골드', '추천색 1', '추천색 2'][n] + '" style="width:44px;height:44px;border-radius:6px;border:1px solid var(--pr-hair-strong);background:' + c + ';flex:none;' + (n === 1 ? 'outline:2px solid var(--pr-ink);outline-offset:2px' : '') + '"></button>'; }).join('') + '</div>';
  F({ id: 'P-02', page: 'panels', name: '티켓 · 색상', comps: ['C-SW', 'C-BTN'],
    variants: [
      { st: '기본', html: edit({ panel: pX('<div class="c-row"><span class="lb">잉크</span>' + SW + '</div><div class="c-acts"><button class="c-btn sec">직접 지정</button><span class="t-meta">#141414</span></div><p class="c-hint">추천색 둘은 포스터에서 뽑았어요.</p>', '색상') }) },
      { st: '비활성 · 톤 고정 무드', html: edit({ ticket: { dark: true }, panel: pX('<div class="c-row" style="opacity:.4"><span class="lb">잉크</span>' + SW.replace(/<button role="radio"/g, '<button role="radio" disabled') + '</div><p class="c-hint">이 무드는 톤이 고정이라 잉크 색을 바꿀 수 없어요.</p>', '색상') }) },
      { st: '오류 · 추천색 없음', html: edit({ panel: pX('<div class="c-row"><span class="lb">잉크</span>' + SW.replace(/,#5B6C8F|#5B6C8F/, '').split('<button').slice(0, 4).join('<button') + '</div></div><div class="c-acts"><button class="c-btn sec">직접 지정</button></div>', '색상'), toast: S.toast('추천 색상을 만들지 못했어요. 색상은 직접 골라 주세요.', { err: true, top: 112 }) }) }
    ],
    states: ['견본 44×44, 선택은 잉크 2px 바깥선(브릭 아님: 브릭은 주 행동·선택 표시·탭 인디케이터만).', '톤 고정 무드(35mm·35mm 와이드·크라이테리언·스텁)는 견본을 보이되 비활성 + 이유 한 줄(현행 문구).', '추천색 생성 실패는 일시 오류 토스트(4초) 후 추천 두 칸을 숨겨요.'],
    flow: [['직접 지정', 'P-02', 'OS 색 선택기(native input type=color)']], notes: [] });

  F({ id: 'P-03', page: 'panels', name: '티켓 · 질감', comps: ['C-OPT', 'C-SL'],
    variants: [
      { st: '기본', html: edit({ panel: pX(S.opts('재질', ['원본', '미술용지', '빈티지', '흑백 신문'], '미술용지') + S.slider('재질 강도', 60, { rlTrack: true }) + S.opts('코팅', ['없음', '유광', '홀로그램', '메탈릭', '스코딕스'], '유광') + S.slider('코팅 강도', 40) + '<p class="c-sh">투명도</p>' + S.slider('포스터', 100) + S.slider('글자·로고', 100), '질감') }) },
      { st: '비활성 · 효과 없음', html: edit({ panel: pX(S.opts('재질', ['원본', '미술용지', '빈티지', '흑백 신문'], '원본') + S.slider('재질 강도', 0, { dis: true }) + S.opts('코팅', ['없음', '유광', '홀로그램', '메탈릭', '스코딕스'], '없음') + S.slider('코팅 강도', 0, { dis: true }) + '<p class="c-sh">투명도</p>' + S.slider('포스터', 100) + S.slider('글자·로고', 100), '질감') }) }
    ],
    states: ['슬라이더는 트랙 hit 32px, 트랙 어디서 시작한 드래그로도 값이 바뀌어요(요구 2). 값(%)을 누르면 숫자 입력(K-03).', '재질 "원본"·코팅 "없음"이면 강도 슬라이더가 비활성이에요.', '옵션 목록은 이 목업의 자리표시예요. 실제 값은 현행 후보정 상수를 그대로 써요.'],
    flow: [['값 % 탭', 'K-03', '숫자 키패드']], notes: ['재질·코팅 목록이 가로로 넘치면 옵션 줄만 가로 스크롤해요(의도된 잘림).'] });

  F({ id: 'P-04', page: 'panels', name: '포스터 대상', comps: ['C-PH', 'C-BTN', 'C-OPT', 'C-SL', 'C-SEL'],
    variants: [
      { st: '기본 · 미니멀', html: edit({ sel: 'poster', panel: pTarget('poster', '포스터', '<div class="c-acts"><button class="c-btn sec">교체</button><button class="c-btn txt u">자르기</button><div class="c-opts push" role="radiogroup" aria-label="포스터 채우기"><button class="c-opt" role="radio" aria-checked="true">원본 비율</button><button class="c-opt" role="radio" aria-checked="false">꽉 채우기</button></div></div>' + S.slider('투명도', 100) + '<div class="c-pad"></div>') }) },
      { st: '비활성 · 원본 없음', html: edit({ sel: 'poster', panel: pTarget('poster', '포스터', '<div class="c-acts"><button class="c-btn sec">교체</button><button class="c-btn txt" disabled>자르기</button></div><p class="c-hint">포스터 원본이 없어요. 포스터를 다시 업로드해 주세요.</p>' + S.slider('투명도', 100)) }) },
      { st: '빈 상태 · 포스터 없음', html: edit({ sel: 'poster', ticket: { poster: 'none' }, panel: pTarget('poster', '포스터', '<p class="c-hint">포스터 없이도 저장할 수 있어요.</p><div class="c-acts"><button class="c-btn sec">포스터 추가</button></div><div class="c-pad"></div>') }) }
    ],
    states: ['선택 표시는 포스터 상단에 여백이 없어서 라벨이 상자 안쪽 위로 들어가요(3-A 위치 규칙).', '"원본 비율 / 꽉 채우기"는 미니멀에서만 보여요(POSTER_FILL_MOODS). 다른 무드에선 행 자체가 없어요.', '원본이 없으면 자르기 비활성 + 이유 문장(현행 메뉴 문구 재사용).'],
    flow: [['교체 · 포스터 추가', 'C-01', 'OS 파일 선택 → 크롭'], ['자르기', 'C-01', '원본으로 크롭']], notes: ['현행 "포스터·컴포넌트 투명도" 중 포스터 쪽은 여기, 글자·로고는 P-03에도 있어요(두 진입점, 같은 값).'] });

  F({ id: 'P-05', page: 'panels', name: '로고 대상(극장·포맷)', comps: ['C-PH', 'C-OPT', 'C-FLD', 'C-SL', 'C-SEL'],
    variants: [
      { st: '텍스트 로고', html: edit({ sel: 'logo', panel: pTarget('chain', '극장 로고', '<div class="c-acts"><div class="c-opts" role="radiogroup" aria-label="로고 종류"><button class="c-opt" role="radio" aria-checked="true">텍스트</button><button class="c-opt" role="radio" aria-checked="false">이미지</button></div><button class="c-ib push" aria-label="극장 로고 티켓에 표시" aria-pressed="true">' + i('eye') + '</button></div><div class="c-field"><input aria-label="극장 로고 텍스트" value="CGV"></div>' + S.slider('크기', 70)) }) },
      { st: '이미지 로고', html: edit({ sel: 'logo', panel: pTarget('chain', '극장 로고', '<div class="c-acts"><div class="c-opts" role="radiogroup" aria-label="로고 종류"><button class="c-opt" role="radio" aria-checked="false">텍스트</button><button class="c-opt" role="radio" aria-checked="true">이미지</button></div><button class="c-ib push" aria-label="극장 로고 티켓에 표시" aria-pressed="true">' + i('eye') + '</button></div><div class="c-acts"><button class="c-btn sec">교체</button><button class="c-btn txt u">로고 크롭</button><button class="c-btn txt push">제거</button></div>' + S.slider('크기', 70)) }) },
      { st: '빈 상태', html: edit({ sel: 'logo', ticket: { nologo: true }, panel: pTarget('format', '포맷 로고', '<p class="c-hint">포맷 로고가 비어 있어요. 이미지나 텍스트를 입력하세요.</p><div class="c-acts"><button class="c-btn sec">이미지 업로드</button><button class="c-btn txt u">텍스트 입력</button></div>' + S.slider('크기', 70, { dis: true })) }) }
    ],
    states: ['이미지가 텍스트보다 우선해요(현행 렌더 규칙). 이미지 모드에서 텍스트는 보존돼요.', '빈 로고는 프리뷰에서만 점선 자리표시, 저장물에선 빠져요(data-hide-on-export).', '숨김(눈 끔)이면 크기 슬라이더 비활성 + "포맷 로고가 숨겨져 있어요." 한 줄.'],
    flow: [['이미지 업로드 · 교체', 'C-02', '자유 비율 크롭'], ['텍스트 입력', 'K-02', '입력 패널']], notes: [] });

  F({ id: 'P-06', page: 'panels', name: '텍스트 필드 대상', comps: ['C-PH', 'C-BTN', 'C-SEL', 'C-TAG'],
    variants: [
      { st: '기본 · 큰 필드', html: edit({ sel: 'title', panel: pTarget('title', '제목', '<p class="c-hint" style="color:var(--pr-ink);font-size:15px">먼 바다</p><div class="c-acts"><button class="c-btn sec">값 편집</button><button class="c-ib push" aria-label="제목 티켓에 표시" aria-pressed="true" disabled>' + i('eye') + '</button></div>', { src: 'KOBIS', req: 'ok', rlHead: true }) }) },
      { st: '작은 필드', html: edit({ sel: 'seat', panel: pTarget('seat', '좌석', '<p class="c-hint" style="color:var(--pr-ink);font-size:15px">H12</p><div class="c-acts"><button class="c-btn sec">값 편집</button><button class="c-ib push" aria-label="좌석 티켓에 표시" aria-pressed="true">' + i('eye') + '</button></div>') }) },
      { st: '숨김', html: edit({ panel: pTarget('watchDate', '관람일', '<p class="c-hint">티켓에서 숨겼어요. 값은 남아 있어요.</p><div class="c-acts"><button class="c-btn sec">값 편집</button><button class="c-ib push" aria-label="관람일 티켓에 표시" aria-pressed="false">' + i('eyeoff') + '</button></div>', { trail: { off: ['watchDate'] } }) }) }
    ],
    states: ['티켓을 직접 눌러 고르고, 대상 줄(44px)·이전/다음으로도 옮겨요. 인접 필드를 잘못 눌렀으면 이전/다음 한 번으로 복구(요구 5).', '필드 hit area는 글자 상자보다 최소 44×44로 넓히고, 겹치면 가까운 중심이 이겨요(구현 메모).', '제목은 필수라 표시 끄기가 비활성(현행: "필수 항목 — 항상 표시돼요").'],
    flow: [['값 편집 · 필드 다시 탭', 'K-01 · K-02', '입력 패널 + 키보드'], ['이전/다음', 'P-06', '대상 이동']], notes: ['서체가 있는 필드(서명·한줄평)는 P-09.'] });

  F({ id: 'P-07', page: 'panels', name: '평점 대상', comps: ['C-STAR', 'C-FLD'],
    variants: [
      { st: '기본', html: edit({ panel: pTarget('rating', '평점', '<div class="c-acts" role="radiogroup" aria-label="별점">' + [1, 2, 3, 4, 5].map(function (n) { return '<button class="c-ib" role="radio" aria-checked="' + (n === 4) + '" aria-label="' + n + '점" style="color:' + (n <= 4 ? 'var(--pr-ink)' : 'var(--pr-hair-strong)') + '">' + i('star', n <= 4 ? ' style="fill:currentColor"' : '') + '</button>'; }).join('') + '<button class="c-btn txt u push">4.0 직접 입력</button></div><div class="c-pad"></div>') }) },
      { st: '소수 입력', html: edit({ panel: pTarget('rating', '평점', '<div class="c-field focus"><input aria-label="평점 직접 입력 (0.1 단위)" value="4.3" inputmode="decimal"></div><p class="c-hint">0.0부터 5.0까지 0.1 단위예요.</p>') }) }
    ],
    states: ['별 5개는 각 44×44. 반 칸이 아니라 0.1 단위가 필요하면 직접 입력으로.', '숨김 토글은 머리 오른쪽 눈 아이콘(다른 필드와 같은 자리).'],
    flow: [['직접 입력', 'K-03', '소수 키패드']], notes: [] });

  F({ id: 'P-08', page: 'panels', name: '날짜 대상(관람일·개봉일)', comps: ['C-FLD', 'C-OPT'],
    variants: [
      { st: '관람일', html: edit({ sel: 'date', panel: S.panel('x', S.trail('watchDate') + S.phd({ t: '관람일', k: 'watchDate', nav: true }) + '<div class="c-body"><div class="c-field"><input type="text" aria-label="관람일" value="2026-11-15"></div>' + S.opts('표기', ['11.15 토', '2026.11.15', 'NOV 15'], '11.15 토') + '<div class="c-field" style="margin-top:8px"><input aria-label="관람 시간" value="19:40"></div></div>' + SAFE) }) },
      { st: '개봉일 · 정밀도·재개봉', html: edit({ panel: S.panel('x', S.trail('release') + S.phd({ t: '개봉일', k: 'release', nav: true, req: 'ok' }) + '<div class="c-body">' + S.opts('정밀도', ['연만', '연·월', '연·월·일'], '연·월·일') + '<div class="c-field"><input aria-label="개봉일" value="2024-05-01"></div>' + S.opts('표기', ['2024.05.01', '2024', 'MAY 2024'], '2024.05.01') + '<div class="c-acts"><span class="lb t-body-s" style="flex:1;color:var(--pr-ink-2)">재개봉</span><span class="c-sw" role="switch" aria-checked="false" aria-label="재개봉"></span></div></div>' + SAFE) }) }
    ],
    states: ['날짜는 OS 날짜 선택기(native, 16px). 정밀도가 "연만"이면 연도 입력만 보여요.', '재개봉을 켜면 "재개봉일" 입력이 아래에 생겨요.', '정밀도·표기 문구는 현행 dateTokens 그대로예요.'],
    flow: [['날짜 입력 탭', 'K-04', '키보드 닫힘 후 복원 확인']], notes: ['현행 DateSheet(별도 시트)를 대상 패널 펼침으로 옮겼어요: 날짜를 고치는 동안 티켓이 보여서 표기 변화를 바로 확인할 수 있어요.'] });

  var FONTS = ['자동', '고딕', '바탕', '자람', '잉크', '은영', '붓', '쿨가이', '꽃길'];
  F({ id: 'P-09', page: 'panels', name: '서명 · 한줄평 대상', comps: ['C-OPT', 'C-FLD', 'C-BTN'],
    variants: [
      { st: '서명 · 텍스트', html: edit({ ticket: { ghost: true }, panel: S.panel('x', S.trail('signature') + S.phd({ t: '서명', k: 'signature', nav: true }) + '<div class="c-body"><div class="c-acts"><div class="c-opts" role="radiogroup" aria-label="서명 종류"><button class="c-opt" role="radio" aria-checked="true">텍스트</button><button class="c-opt" role="radio" aria-checked="false">이미지</button></div><button class="c-ib push" aria-label="서명 티켓에 표시" aria-pressed="true">' + i('eye') + '</button></div><div class="c-field"><input aria-label="서명" value="영화의 순간"></div><p class="c-sh">서체</p><div class="c-opts" role="radiogroup" aria-label="서명 서체" style="flex-wrap:wrap">' + FONTS.map(function (f, n) { return '<button class="c-opt" role="radio" aria-checked="' + (n === 0) + '">' + f + '</button>'; }).join('') + '</div></div>' + SAFE) }) },
      { st: '서명 · 이미지(서체 비활성)', html: edit({ panel: S.panel('x', S.trail('signature') + S.phd({ t: '서명', k: 'signature', nav: true }) + '<div class="c-body"><div class="c-acts"><div class="c-opts" role="radiogroup" aria-label="서명 종류"><button class="c-opt" role="radio" aria-checked="false">텍스트</button><button class="c-opt" role="radio" aria-checked="true">이미지</button></div></div><div class="c-acts"><button class="c-btn sec">교체</button><button class="c-btn txt push">제거</button></div><p class="c-sh">서체</p><p class="c-hint">서명 이미지가 있으면 폰트가 적용되지 않아요.</p><div class="c-opts" style="flex-wrap:wrap">' + FONTS.slice(0, 6).map(function (f) { return '<button class="c-opt" disabled>' + f + '</button>'; }).join('') + '</div></div>' + SAFE) }) },
      { st: '한줄평(크라이테리언)', html: edit({ panel: S.panel('x', S.trail('quote') + S.phd({ t: '한줄평', k: 'quote', nav: true }) + '<div class="c-body"><div class="c-field"><input aria-label="한줄평" value="파도 소리가 오래 남았다"></div><p class="c-sh">서체</p><div class="c-opts" role="radiogroup" aria-label="한줄평 서체" style="flex-wrap:wrap">' + FONTS.map(function (f, n) { return '<button class="c-opt" role="radio" aria-checked="' + (n === 2) + '">' + f + '</button>'; }).join('') + '</div></div>' + SAFE) }) }
    ],
    states: ['서체 9종은 줄바꿈 옵션 상자(가로 스크롤 아님: 9개를 한눈에 비교).', '서명 이미지가 있으면 서체 옵션 비활성 + 현행 안내 문장.', '한줄평 서체는 크라이테리언에서만 보여요(QUOTE_FONT_MOODS). 다른 무드에선 서체 구획이 없어요.'],
    flow: [['이미지 · 교체', 'C-02', '자유 비율 크롭'], ['입력 탭', 'K-02', '']], notes: ['현행 DesignRail "커스텀" 칩을 해당 필드 대상으로 옮겼어요: 서체는 그 필드의 속성이라 필드를 고른 자리에서 바꾸는 게 맞아요.'] });

  F({ id: 'P-10', page: 'panels', name: '티켓 · 항목(전체 목록)', comps: ['C-TABS', 'C-LIST', 'C-SWT'],
    variants: [
      { st: '기본', html: edit({ panel: pX('<div class="c-acts"><span class="t-body-s" style="flex:1;color:var(--pr-ink-2)">모두 표시</span><span class="c-sw on" role="switch" aria-checked="true" aria-label="모든 항목 티켓에 표시"></span></div>' + listRows(false), '항목', { scroll: true }) }) },
      { st: '필수 누락', html: edit({ panel: pX('<div class="c-alert" role="status"><span class="ic" aria-hidden="true"></span><span class="tx">저장에는 제목과 개봉연도가 필요해요. 개봉일은 티켓에서 숨겨도 돼요.</span></div>' + listRows(true), '항목', { trail: { miss: true }, scroll: true }) }) }
    ],
    states: ['의도된 잘림: 목록은 무드에 따라 최대 19행이라 패널 안에서 세로로 스크롤해요. 마지막 보이는 행이 반쯤 잘린 건 아래에 더 있다는 신호예요.', '티켓 대상의 네 번째 탭. 영화·관람·기록 그룹으로 모든 항목을 보여 주고, 행 탭이면 그 대상으로, 눈으로 표시 토글.', '무드가 렌더하지 않는 항목은 목록에서 빠져요(MOOD_EXCLUDED_FIELDS).', '필수 누락이면 현행 드로어 안내 문장을 그대로 위에 둬요.'],
    flow: [['행 탭', 'P-06 · P-07 · P-08 · P-09', '대상 전환'], ['눈', 'P-10', '표시 토글(실행 취소 가능)']], notes: ['현행 FieldDrawer(가장자리 핸들·스와이프)를 대체해요. 핸들 위치 설정이 필요 없어져 고급 설정이 사라져요.'] });
  function listRows(miss) {
    function row(n, v, o) { o = o || {}; return '<li style="min-height:44px"><span class="kt"><b style="font-size:15px">' + n + (o.req ? ' <span class="c-tag req' + (miss && !v ? ' miss' : '') + '">필수</span>' : '') + '</b><small>' + (v || '비어 있음') + '</small></span><button class="c-ib" aria-label="' + n + ' 티켓에 표시" aria-pressed="' + (o.off ? 'false' : 'true') + '"' + (o.req ? ' disabled' : '') + '>' + i(o.off ? 'eyeoff' : 'eye') + '</button></li>'; }
    return '<p class="c-sh">영화</p><ul class="c-list">' + row('제목', miss ? '' : '먼 바다', { req: 1 }) + row('개봉일', miss ? '' : '2024.05.01', { req: 1 }) + row('출연', '') + '</ul><p class="c-sh">관람</p><ul class="c-list">' + row('관람일', '11.15 토', { off: 1 }) + row('극장', 'CGV 용산아이파크몰') + '</ul>';
  }

  /* =========================================================
     필드 편집 · 키보드
     ========================================================= */
  function kbScreen(sel, panelInner, kind, o) {
    o = o || {};
    var org = o.origin || ({ title: '16% 68%', seat: '82% 86%', foot: '14% 94%' })[sel] || '30% 70%';
    var zoom = '<div class="c-canvas" style="overflow:hidden"><div style="position:absolute;left:50%;width:84%;margin-left:-42%;bottom:-' + (o.lift || 30) + '%;aspect-ratio:960/1534;transform:scale(1.5);transform-origin:' + org + '">' + S.ticket({}) + (sel ? S.sel(sel) : '') + '</div></div>';
    return S.phone(zoom + S.panel('inp', panelInner, { aria: '편집 패널' }) + S.kbd(kind));
  }
  function titleInput(state) {
    var body = '<div class="c-path">영화 / 제목</div>' + S.phd({ t: '제목', label: 'k1', req: 'ok', right: '<button class="c-ib" aria-label="이전 대상">' + i('back') + '</button><button class="c-ib" aria-label="다음 대상">' + i('next') + '</button><button class="c-btn txt">닫기</button>' }) +
      '<div class="c-field focus"><input id="k1" value="먼 바" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="k1l"' + S.rl('h') + '></div>';
    if (state === 'results') body += '<div class="c-kh"><span>KOBIS 검색 결과</span><span class="t-meta">2</span></div><ul class="c-list" id="k1l" role="listbox"><li role="option"><span class="th"></span><span class="kt"><b>먼 바다</b><small>2024 · 드라마 · 홍길동</small></span></li><li role="option"><span class="th"></span><span class="kt"><b>먼 바다의 소리</b><small>2019 · 다큐멘터리 · 감독 없음</small></span></li></ul>';
    if (state === 'loading') body += '<div class="c-kh" role="status"><span>검색 중…</span></div><ul class="c-list sk" aria-hidden="true"><li><span class="th"></span><span class="kt"><span class="bar" style="width:46%"></span><span class="bar" style="width:70%;margin-top:6px"></span></span></li><li><span class="th"></span><span class="kt"><span class="bar" style="width:38%"></span><span class="bar" style="width:62%;margin-top:6px"></span></span></li></ul>';
    if (state === 'empty') body += '<div class="c-kh"><span>KOBIS 검색 결과</span><span class="t-meta">0</span></div><p class="c-hint" role="alert">검색 결과가 없어요. 제목을 다시 확인해 주세요.</p><p class="c-hint">입력한 제목은 그대로 티켓에 들어가요.</p>';
    if (state === 'error') body += '<div class="c-kh"><span>KOBIS 검색</span></div><p class="c-hint warn" role="alert">검색 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.</p><div class="c-acts"><button class="c-btn txt u">다시 검색</button></div>';
    return body;
  }
  F({ id: 'K-01', page: 'input', name: '제목 입력 · KOBIS 검색', comps: ['C-PANEL', 'C-FLD', 'C-LIST', 'C-KBD', 'C-SEL'],
    variants: [
      { st: '결과', html: kbScreen('title', titleInput('results')) },
      { st: '로딩 · 검색 중', html: kbScreen('title', titleInput('loading')) },
      { st: '빈 결과', html: kbScreen('title', titleInput('empty')) },
      { st: '오류', html: kbScreen('title', titleInput('error')) }
    ],
    states: ['패널이 키보드 위에 붙어 경로·라벨·입력을 보여 주고(①), 티켓은 고른 필드가 패널 바로 위에 오도록 1.5배 확대·이동해요(②). 요구 4.', '입력은 16px(요구 3). 검색은 300ms 디바운스, 결과는 입력 바로 아래 목록(combobox + listbox).', '로딩은 "검색 중…" + 두 줄 뼈대(현행 "Loading…" 영문 → 한글로 바꿈). 빈 결과·오류는 현행 useKobisSearch 문구.'],
    flow: [['결과 행 탭', 'P-06', '제목·개봉일·출연 채움 + KOBIS 태그, 키보드 닫힘'], ['닫기 · 키보드 내림', 'K-04', '복원'], ['다음(›) · Enter', 'K-02', '다음 대상 입력']],
    notes: ['키보드 높이 300은 iOS 근사예요. 실제 높이는 visualViewport로 재고 패널을 그 위에 붙여요.'] });

  F({ id: 'K-02', page: 'input', name: '일반 텍스트 입력', comps: ['C-PANEL', 'C-FLD', 'C-KBD'],
    variants: [
      { st: '기본 · 작은 필드', html: kbScreen('seat', '<div class="c-path">관람 / 좌석</div>' + S.phd({ t: '좌석', label: 'k2', right: '<button class="c-ib" aria-label="이전 대상">' + i('back') + '</button><button class="c-ib" aria-label="다음 대상">' + i('next') + '</button><button class="c-btn txt">닫기</button>' }) + '<div class="c-field focus"><input id="k2" value="H12" enterkeyhint="next"></div><div class="c-kh"><span>Enter를 누르면 다음 항목(러닝타임)으로 가요</span></div>', 'text', { lift: 22 }) },
      { st: '비어 있음', html: kbScreen('foot', '<div class="c-path">기록 / 예매 번호</div>' + S.phd({ t: '예매 번호', label: 'k2b', right: '<button class="c-ib" aria-label="이전 대상">' + i('back') + '</button><button class="c-ib" aria-label="다음 대상">' + i('next') + '</button><button class="c-btn txt">닫기</button>' }) + '<div class="c-field focus"><input id="k2b" placeholder="예매 번호" enterkeyhint="done"></div><div class="c-kh"><span>비워 두면 티켓에서 빠져요</span></div>', 'text', { lift: 2 }) }
    ],
    states: ['티켓 맨 아래 필드(예매 번호)는 위 여백이 없어서 라벨이 상자 아래가 아니라 안쪽에도 못 들어가면 생략(3-A 규칙). 패널 머리가 이름을 보여 줘요.', '이전/다음은 패널 머리에 고정. 키보드를 내리지 않고 대상만 바뀌어요.'],
    flow: [['Enter(next)', 'K-02', '다음 대상'], ['닫기', 'K-04', '']], notes: [] });

  F({ id: 'K-03', page: 'input', name: '% 직접 입력', comps: ['C-SL', 'C-FLD', 'C-KBD'],
    variants: [
      { st: '기본', html: S.phone('<div class="c-canvas"><div class="tkw" style="top:8px;bottom:8px">' + S.ticket({}) + '</div></div>' + S.panel('inp', S.phd({ t: '재질 강도', label: 'k3', right: '<button class="c-btn txt">완료</button>' }) + '<div class="c-sl"><span class="lb">미술용지</span><div class="c-rng"><span class="tr"></span><span class="fi" style="width:60%"></span><span class="th" style="left:60%"></span></div><span class="t-meta" style="text-align:right">%</span></div><div class="c-field focus"><input id="k3" value="60" inputmode="numeric"' + S.rl('h') + '></div>') + S.kbd('num')) },
      { st: '오류 · 범위 밖', html: S.phone('<div class="c-canvas"><div class="tkw" style="top:8px;bottom:8px">' + S.ticket({}) + '</div></div>' + S.panel('inp', S.phd({ t: '재질 강도', label: 'k3b', right: '<button class="c-btn txt">완료</button>' }) + '<div class="c-field err"><input id="k3b" value="140" inputmode="numeric" aria-invalid="true"><span class="msg">0부터 100까지만 돼요. 100으로 맞출게요.</span></div>') + S.kbd('num')) }
    ],
    states: ['값(%)을 누르면 숫자 키패드 + 16px 입력. 슬라이더가 입력 위에 남아 값이 같이 움직여요(①②).', '키보드를 내리면 패널이 원래 높이로, 티켓이 원래 맞춤으로 돌아오고 값은 남아요(③, K-04).', '범위 밖은 경고 문장 후 가장 가까운 값으로 고정해요(현행은 조용히 고정 — 형태 변경).'],
    flow: [['완료 · 키보드 내림', 'P-03', '펼친 패널로 복귀']], notes: ['여섯 개 % 입력(재질·코팅 강도, 포스터·글자 투명도, 로고 크기 두 개) 모두 같은 화면을 써요.'] });

  F({ id: 'K-04', page: 'input', name: '키보드 닫힌 뒤 복원', comps: ['C-PANEL'],
    variants: [{ st: '복원', html: edit({ sel: 'seat', panel: pTarget('seat', '좌석', '<p class="c-hint" style="color:var(--pr-ink);font-size:15px">H12</p><div class="c-acts"><button class="c-btn sec">값 편집</button><button class="c-ib push" aria-label="좌석 티켓에 표시" aria-pressed="true">' + i('eye') + '</button></div>') }) }],
    states: ['닫기 · 키보드 내림 · 바깥 탭 · 뒤로 네 가지 종료 경로 모두 같은 결과: 패널은 접힌 대상 패널, 티켓은 맞춤 배율, 고른 대상과 입력값 유지(요구 4 ③).'],
    flow: [['값 편집', 'K-02', '다시 입력']], notes: ['종료 경로별 검증은 #585 방식(경로 × 기기)을 새 Seed에서 이어 가요. 이 마스터는 화면 정의까지예요.'] });

  /* =========================================================
     크롭
     ========================================================= */
  function crop(o) {
    o = o || {};
    var img = o.fail ? '<div class="c-cropimg fail">이미지를 표시할 수 없어요</div>' :
      '<div class="c-cropimg' + (o.logo ? ' logo' : o.wideImg ? ' wide' : '') + '">' + (o.logo ? 'CGV' : '') + '<div class="c-cropbox" style="' + o.box + '"><i></i><i></i><i></i><i></i></div></div>';
    var ft = '<div class="c-cropft">' +
      (o.err ? '<div class="c-alert" role="alert"><span class="ic"></span><span class="tx">' + o.err + '</span></div>' : '') +
      (o.logo ? '<p class="c-hint" style="color:var(--pr-d-ink2)">로고는 비율 제한 없이 잘라요.</p>' :
        '<div class="rowx"><span class="lb">원본 비율 보존<small>' + (o.keep ? '이미지 비율 그대로 잘라요' : (o.land ? '이 무드는 가로 3:2로 잘라요' : '포스터 표준 2:3으로 잘라요')) + '</small></span><span class="c-sw' + (o.keep ? ' on' : '') + '" role="switch" aria-checked="' + !!o.keep + '" aria-label="원본 비율 보존"></span></div>') +
      '<div class="rowx"><button class="c-btn sec"' + (o.busy ? ' disabled' : '') + '>다른 사진 선택</button><span style="flex:1"></span><button class="c-btn pri"' + (o.busy || o.fail ? ' disabled' : '') + S.rl('h') + '>' + (o.busy ? '<span class="spin"></span>적용 중' : '적용') + '</button></div></div>';
    return S.phone('<div class="c-dlg" role="dialog" aria-modal="true" aria-label="' + (o.logo ? '로고 크롭' : '포스터 크롭') + '"><div style="height:var(--sb);flex:none"></div>' + S.topbar({ back: false, title: o.logo ? '로고 자르기' : '포스터 자르기' }).replace('<span style="width:44px;flex:none"></span>', '<button class="c-ib" aria-label="닫기">' + i('close') + '</button>').replace('<b class="ttl">', '<span style="width:44px;flex:none"></span><b class="ttl">') + '<div class="c-cropstage">' + img + '</div>' + ft + '</div>');
  }
  F({ id: 'C-01', page: 'crop', name: '포스터 크롭', comps: ['C-DLG', 'C-SWT', 'C-BTN'],
    variants: [
      { st: '기본 · 표준 2:3', html: crop({ box: 'left:6%;top:10%;width:88%;height:80%' }) },
      { st: '원본 비율 보존 켬', html: crop({ keep: true, box: 'left:2%;top:2%;width:96%;height:96%' }) },
      { st: '가로 슬롯 무드 · 3:2', html: crop({ land: true, box: 'left:4%;top:31%;width:92%;height:46%' }) }
    ],
    states: ['프리셋 방향은 캔버스가 아니라 포스터 슬롯을 따라요(35mm 와이드 컷·스텁 밴드는 3:2). 출력 960×1440 / 1440×960, 원본 보존이면 이미지 자연비.', '크롭 화면은 테마와 무관하게 다크 고정(사진 판독용). 다이얼로그라 뒤 화면은 비활성(APG dialog).', '"원본 비율 보존"은 체크박스에서 스위치로 바꾸고 현재 비율을 설명 한 줄로 붙였어요.'],
    flow: [['적용', 'E-01 · P-04', '크롭 반영 240ms'], ['닫기(✕)', '이전 화면', '변경 없음'], ['다른 사진 선택', 'C-01', 'OS 파일 선택']], notes: [] });
  F({ id: 'C-02', page: 'crop', name: '로고·서명·스탬프 크롭', comps: ['C-DLG'],
    variants: [{ st: '자유 비율', html: crop({ logo: true, box: 'left:14%;top:22%;width:72%;height:56%' }) }],
    states: ['비율 토글 없이 자유 비율(useLogoCrop 현행).'], flow: [['적용', 'P-05 · P-09 · P-01', '']], notes: [] });
  F({ id: 'C-03', page: 'crop', name: '크롭 진행·오류', comps: ['C-DLG', 'C-TST'],
    variants: [
      { st: '로딩 · 적용 중', html: crop({ busy: true, box: 'left:6%;top:10%;width:88%;height:80%' }) },
      { st: '오류 · 이미지 불러오기 실패', html: crop({ fail: true, err: '이미지를 불러오지 못했어요. 다른 사진을 선택해 주세요.' }) },
      { st: '오류 · 크롭 실패', html: crop({ box: 'left:6%;top:10%;width:88%;height:80%', err: '이미지 크롭에 실패했어요. 다시 시도해 주세요.' }) }
    ],
    states: ['적용 중: 적용·다른 사진 선택·토글 비활성, 버튼에 진행 표시.', '이미지 실패는 지속, 크롭 실패는 일시. 둘 다 전역 토스트 대신 크롭 하단의 경고 상자로 옮겼어요: 다이얼로그가 화면을 덮고 있어서 위쪽 토스트가 크롭 영역을 가리던 문제를 피해요.'],
    flow: [['다른 사진 선택', 'C-01', '']], notes: [] });

  /* =========================================================
     메뉴 · 설정
     ========================================================= */
  function menu(o) {
    o = o || {};
    var sheet = '<div class="c-scrim" aria-hidden="true"></div><div class="c-sheet" role="dialog" aria-modal="true" aria-label="편집 메뉴"><div class="hd"><span class="t">메뉴</span><button class="c-ib" aria-label="닫기">' + i('close') + '</button></div>' +
      '<button class="c-mi"><span class="lb">스크린샷으로 자동입력<small>스크린샷에서 정보를 다시 채워요</small></span></button>' +
      '<button class="c-mi"><span class="lb">' + (o.noPoster ? '포스터 추가' : '포스터 교체') + '</span></button>' +
      '<div class="c-mi" role="group" aria-label="테마"><span class="lb">테마</span><span class="seg"><span class="on">시스템</span><span>라이트</span><span>다크</span></span></div>' +
      '<div class="c-mi"><span class="lb">자동저장<small>' + (o.autoOff ? '꺼져 있어요. 기존 저장본은 그대로예요.' : '11:42에 저장했어요') + '</small></span><span class="c-sw' + (o.autoOff ? '' : ' on') + '" role="switch" aria-checked="' + !o.autoOff + '" aria-label="자동저장"></span></div>' +
      '<button class="c-mi"><span class="lb">임시저장</span></button>' +
      '<button class="c-mi' + (o.armed ? ' armed' : '') + '"><span class="lb">' + (o.armed ? '한 번 더 눌러 전체 삭제' : '초기화') + (o.armed ? '<small style="color:var(--pr-warn)">사진·입력·꾸미기를 모두 지워요</small>' : '') + '</span></button>' +
      '</div>';
    return S.phone(tbEdit({ menuOpen: true }) + S.canvas({}) + pTicketCollapsed({}) + sheet + (o.toast || ''));
  }
  F({ id: 'M-01', page: 'menu', name: '메뉴 시트', comps: ['C-MENU', 'C-SWT', 'C-SEG'],
    variants: [
      { st: '기본', html: menu({}) },
      { st: '초기화 확인 대기(arm)', html: menu({ armed: true }) },
      { st: '포스터 없음 · 자동저장 꺼짐', html: menu({ noPoster: true, autoOff: true }) }
    ],
    states: ['바텀 시트(모달), 행 높이 52. 순서: 가져오기 → 사진 → 표시 → 저장 → 초기화(파괴적인 건 맨 아래).', '초기화는 현행 2탭 arm 유지: 3.2초 안에 한 번 더, 첫 탭 뒤 350ms 안의 탭은 무시, 메뉴를 닫으면 해제. 잠긴 문구 "초기화"·"한 번 더 눌러 전체 삭제"·"초기화했어요" 그대로.', '테마는 다크모드 토글 → 시스템/라이트/다크 세 갈래(결정 1: 시스템 따름이 기본).'],
    flow: [['스크린샷으로 자동입력', 'L-03 → E-05', '인식'], ['포스터 교체 · 추가', 'C-01', ''], ['임시저장', 'M-02', '토스트 "임시저장했어요"'], ['초기화 두 번', 'L-01', '문서 지움 + 토스트 "초기화했어요"']],
    notes: ['메뉴에서 빠진 것: 빈 항목(티켓 패널 머리로), 고급 설정(제거), 재크롭(포스터 대상 "자르기"로). 자동저장은 헤더 표시에서 이 행으로 옮겼어요.'] });
  F({ id: 'M-02', page: 'menu', name: '저장 통보·실패', comps: ['C-TST'],
    variants: [
      { st: '기본 · 임시저장함', html: edit({ panel: pTicketCollapsed({}), toast: S.toast('임시저장했어요', { bottom: 270 }) }) },
      { st: '오류 · 저장 공간', html: edit({ panel: pTicketCollapsed({}), toast: S.toast('저장에 실패했어요. 브라우저 저장 공간이 가득 찼거나 비공개 모드일 수 있어요.', { err: true, close: true, top: 112 }) }) },
      { st: '오류 · 포스터 저장', html: edit({ panel: pTicketCollapsed({}), toast: S.toast('포스터 저장에 실패했어요. 저장 공간이 찼거나 비공개 모드일 수 있어요.', { err: true, top: 112 }) }) }
    ],
    states: ['통보는 패널 위 아래쪽, 오류는 상단 줄 아래 위쪽(두 자리가 겹치지 않음).', '저장 공간 실패는 지속(닫기 버튼), 포스터 저장 실패는 일시 4초(현행 구분 유지).'],
    flow: [], notes: [] });

  /* =========================================================
     결과 · 저장 · 공유
     ========================================================= */
  function result(o) {
    o = o || {};
    var cta = o.cta === 'loading' ? '<button class="c-btn pri cta block" aria-busy="true" aria-disabled="true"><span class="spin"></span>저장 중…</button>'
      : o.cta === 'done' ? '<button class="c-btn pri cta block">' + i('check') + '사진에 저장됨</button>'
      : '<button class="c-btn pri cta block"' + S.rl('h') + '>사진에 저장</button>';
    var link = o.link === 'made' || o.link === 'copied'
      ? '<div class="c-link"><input aria-label="공유 링크" value="filme.app/t/k3x9q2" readonly><button class="c-btn sec">' + (o.link === 'copied' ? '복사됨!' : '복사') + '</button></div><div class="c-lrow"><small>이 링크는 3일 후 만료돼요.</small><button class="c-btn txt u">공유</button></div>'
      : '<div class="c-lrow"><button class="c-btn txt u"' + (o.link === 'loading' ? ' disabled' : '') + '>' + (o.link === 'loading' ? '링크 만드는 중…' : o.link === 'fail' ? '실패, 다시 시도' : '링크 만들기') + '</button><small>링크는 3일 뒤 사라져요</small><button class="c-btn txt u">공유</button></div>';
    return S.phone(S.topbar({ back: '편집으로 돌아가기', title: '완성' }) +
      '<div class="c-rbody"><div class="beam" aria-hidden="true"></div><div class="c-rtk' + (o.wide ? ' wide' : '') + '">' + S.ticket({ wide: o.wide }) + (o.cta === 'loading' ? '<div class="veil" aria-hidden="true"></div>' : '') + '</div><p class="c-spec">' + (o.wide ? '3108 × 1960' : '1960 × 3108') + ' · JPEG</p></div>' +
      '<div class="c-racts">' + (o.err ? '<div class="c-alert" role="alert"><span class="ic"></span><span class="tx">' + o.err + '</span>' + (o.retry ? '<button class="c-btn txt u">다시 시도</button>' : '') + '</div>' : '') + cta + link + SAFE + '</div>' + (o.extra || ''));
  }
  F({ id: 'R-01', page: 'result', name: '결과 · 사진에 저장', comps: ['C-TB', 'C-BTN', 'C-ALR'],
    variants: [
      { st: '기본', html: result({}) },
      { st: '로딩 · 저장 중', html: result({ cta: 'loading' }) },
      { st: '완료 · 저장됨', html: result({ cta: 'done' }) },
      { st: '오류 · 저장 실패', html: result({ err: '저장에 실패했어요. 다시 시도해 주세요.', retry: false }) },
      { st: '가로 무드', html: result({ wide: true }) }
    ],
    states: ['선택 표시·빈 항목을 끈 저장물 그대로의 렌더예요(요구 6). 아래 사양 1960 × 3108은 export 실측값(여백 10px × pixelRatio 2).', '저장은 모바일이면 OS 공유 시트(파일), 아니면 다운로드. 공유 시트를 취소하면 조용히 기본으로(현행).', '저장 실패 문구: 현행 "저장에 실패했어요." + "다시 시도" 버튼 → 두 문장 규칙으로 고치고 다시 시도는 주 버튼 자체로(같은 버튼을 다시 누르면 재시도).'],
    flow: [['사진에 저장', 'R-03', 'OS 공유 시트(모바일)'], ['‹ · 브라우저 뒤로', 'E-01', '편집(문서 그대로)']], notes: ['문구 변경 "저장에 실패했어요." → "저장에 실패했어요. 다시 시도해 주세요." 잠긴 문구 아님.'] });
  F({ id: 'R-02', page: 'result', name: '결과 · 공유 링크', comps: ['C-FLD', 'C-BTN', 'C-ALR'],
    variants: [
      { st: '로딩 · 링크 만드는 중', html: result({ link: 'loading' }) },
      { st: '완료 · 링크 생성됨', html: result({ link: 'made' }) },
      { st: '완료 · 복사됨', html: result({ link: 'copied' }) },
      { st: '오류 · 링크 실패', html: result({ link: 'fail', err: '링크 생성에 실패했어요. 다시 시도해 주세요.' }) }
    ],
    states: ['링크를 만들면 클립보드에 바로 복사하고 읽기 전용 입력(16px)으로 보여 줘요. 복사됨!은 2초 뒤 복사로.', '클립보드가 거부되면 입력 글자를 전체 선택해 손으로 복사하게 해요(현행).', '티켓을 고치고 돌아오면 링크는 처음 상태로 돌아가요(현행).'],
    flow: [['공유', 'R-03', '']], notes: [] });
  F({ id: 'R-03', page: 'result', name: '저장·공유 진행(OS 시트)', comps: ['C-TST'],
    variants: [
      { st: '공유 시트(그림)', html: result({ extra: '<div class="c-scrim" aria-hidden="true"></div><div class="c-osheet" aria-hidden="true"><div class="hd"><i></i><span>먼 바다 · 포토티켓<br><span class="t-meta">JPEG</span></span></div><div class="apps"><span></span><span></span><span></span><span></span></div><p class="note">iOS 공유 시트 근사(앱이 그리지 않음)</p></div>' }) },
      { st: '공유 불가 · 링크 복사로 대체', html: result({ link: 'made', extra: S.toast('링크를 복사했어요', { bottom: 210 }) }) }
    ],
    states: ['공유는 링크가 없으면 먼저 만들고 navigator.share를 불러요. 사용자가 닫으면(AbortError) 아무 일도 안 해요.', '공유 API가 없거나 실패하면 링크를 클립보드로 복사하고 통보해요(현행은 통보 문구 없음 → "링크를 복사했어요" 추가, 축 4 과거형).'],
    flow: [['공유 완료 · 닫기', 'R-01', '']], notes: ['OS 시트는 앱 밖이라 그림만 둬요.'] });

  /* =========================================================
     오류·빈 상태(전역), 공유 페이지
     ========================================================= */
  F({ id: 'X-01', page: 'errors', name: '오류 토스트 규칙', comps: ['C-TST'],
    variants: [
      { st: '일시 · 4초', html: edit({ panel: pTicketCollapsed({}), toast: S.toast('추천 색상을 만들지 못했어요. 색상은 직접 골라 주세요.', { err: true, top: 112 }) }) },
      { st: '지속 · 닫기 필요', html: edit({ panel: pTicketCollapsed({}), toast: S.toast('저장된 포스터를 불러오지 못했어요. 포스터를 다시 올려 주세요.', { err: true, close: true, top: 112 }) }) }
    ],
    states: ['오류 토스트는 상단 줄 바로 아래(위쪽), 통보 토스트는 패널 위(아래쪽). 전체 보기 중엔 오류만.', '지속 토스트가 떠 있으면 일시 토스트를 막고, 같은 문구는 다시 띄우지 않아요(errorToast 현행).', '빨강(현행 --danger) 대신 표면 + 앰버 점·테두리(결정 5-A). 문구 색은 잉크라 대비 걱정이 없어요.'],
    flow: [], notes: ['모든 오류·빈 문구와 그 프레임은 아래 색인 표에 있어요.'] });
  F({ id: 'S-01', page: 'share', name: '공유 페이지 /t/[id]', comps: ['C-WM', 'C-BTN'],
    variants: [
      { st: '기본', html: S.phone('<div class="c-head" style="display:flex;justify-content:center">' + S.wordmark() + '</div><div class="c-share"><div class="img">' + S.ticket({}) + '</div><p class="t-body">영화 포스터로 시네마틱한 포토티켓을, 너도 만들어봐.</p><button class="c-btn pri cta block">나도 티켓 만들기</button><p class="c-legal">이 링크는 3일 후 만료돼요. 비공식 팬메이드 티켓이라 양도·재판매할 수 없고, 정보 정확성은 보장하지 않으며 분실·훼손에 책임지지 않아요.</p></div>' + SAFE) },
      { st: '빈 상태 · 만료된 링크(제안)', html: S.phone('<div class="c-head" style="display:flex;justify-content:center">' + S.wordmark() + '</div><div class="c-share" style="justify-content:center"><div class="img" style="height:34%;border:1px dashed var(--pr-hair-strong);display:grid;place-items:center;color:var(--pr-ink-3);font-size:13px">티켓 없음</div><p class="t-title">이 링크는 만료됐어요</p><p class="t-body-s" style="color:var(--pr-ink-2)">공유 링크는 3일 동안만 열려요.</p><button class="c-btn pri cta block">나도 티켓 만들기</button></div>' + SAFE) }
    ],
    states: ['기본은 현행 그대로(문구·만료 안내·CTA). CTA 끝의 "→" 화살표만 아이콘 없는 라벨로 정리.', '만료·없는 링크: 현행은 Next 기본 404. 같은 레이아웃의 빈 상태를 제안해요(새 문구 2개, 4단계 Seed에서 확정).'],
    flow: [['나도 티켓 만들기', 'L-01', '앱 첫 화면']], notes: ['이 페이지는 편집기 밖이라 무대·패널 없이 워드마크만 둬요.'] });

  window.FRAMES = FR;
})();
