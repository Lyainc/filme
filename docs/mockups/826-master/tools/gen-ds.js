// 마스터에서 Design System(FILME 영사실) 파일을 생성해요. node tools/gen-ds.js <출력폴더>. 로고·폰트 업로드 id는 이미 올린 자산이에요.
const fs = require('fs'), path = require('path');
const M = path.join(__dirname, '..') + '/';
const OUT = path.join(process.argv[2] || path.join(__dirname, '.out/ds'), 'project') + '/';
fs.mkdirSync(OUT + 'assets/Logos', { recursive: true });
global.window = {}; global.document = {};
['lib.js', 'frames.js', 'data/components.js'].forEach(f => require(M + f));
const W = global.window;

/* ---------- tokens.json ---------- */
const C = (name, light, dark, usage) => ({ name, value: { light, dark }, usage });
const tokens = {
  name: 'FILME 영사실', version: 1, meta: { source: 'docs/mockups/826-master/master.css (branch docs/826-page-master)' },
  color: {
    themes: [{ id: 'light', name: '라이트 · 종이와 잉크' }, { id: 'dark', name: '다크 · 무대' }],
    tokens: [
      C('pr-page', '#e4e0d9', '#050506', '앱 밖 문서 바탕(데스크톱 PhoneFrame 바깥).'),
      C('pr-stage', '#efece6', '#0b0b0c', '편집기 무대 · 랜딩 · 결과 화면 바탕.'),
      C('pr-s1', '#f7f5f1', '#141416', '편집 도크 · 입력 패널 · 시트 · 이어서 만들기 행 면.'),
      C('pr-s2', '#ffffff', '#1c1c1f', '입력 · 선택된 옵션 · 토스트 면.'),
      C('pr-hair', 'rgba(17,17,17,0.08)', 'rgba(255,255,255,0.08)', '구분선(헤어라인 1px).'),
      C('pr-hair-strong', 'rgba(17,17,17,0.16)', 'rgba(255,255,255,0.16)', '테두리 · 슬라이더 트랙 · 패널 손잡이.'),
      C('pr-ink', '#141414', '#ece9e3', '본문 · 선택 글자 · 슬라이더 채움. stage/s1/s2 위 15:1 이상.'),
      C('pr-ink-2', '#5b5852', '#a8a49c', '보조 글자 · 아이콘. 세 표면 위 6.5:1(라이트) · 7.4:1(다크) 이상.'),
      C('pr-ink-3', '#6a665f', '#8e8a83', '메타 · 위치 · 빈 값. 12px에도 쓰여서 세 표면 위 4.8:1 이상.'),
      C('pr-accent', '#b0423f', '#c24b43', '브릭. 화면당 주 행동 하나의 채움, 선택 표시(재단 표시), 모드 인디케이터에만. 글자색으로 쓰지 않아요(다크 표면 위 3.8:1).'),
      C('pr-accent-ink', '#ffffff', '#ffffff', '브릭 채움 위 글자(5.7:1 라이트 · 4.8:1 다크).'),
      C('pr-accent-hair', 'rgba(176,66,63,0.45)', 'rgba(194,75,67,0.45)', '선택 표시의 45% 상자 선.'),
      C('pr-warn', '#8f5410', '#e0a35a', '앰버. 오류 · 필수 누락 · 초기화 확인 대기. 글자로 써도 AA(5.2:1 · 7.7:1 이상).'),
      C('pr-scrim', 'rgba(20,18,14,0.48)', 'rgba(0,0,0,0.64)', '모달(메뉴 시트 · 크롭) 뒤 어둡게.'),
      C('pr-kbd', '#d1d3d9', '#2b2b2e', '키보드 그림 바탕(문서 전용 근사).'),
      C('pr-key', '#ffffff', '#4a4a4e', '키보드 그림 키(문서 전용 근사).')
    ]
  },
  type: {
    fonts: [{ family: 'Pretendard Variable', file: 'fonts/PretendardVariable.woff2', weight: '45 920' }],
    families: { ui: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif', brand: 'Nunito, "Pretendard Variable", sans-serif' },
    groups: [
      { name: 'UI', family: 'ui', styles: [
        { name: 't-tag', fontSize: '11px', lineHeight: '14px', fontWeight: 600, sample: '필수', usage: '태그 · 선택 라벨.' },
        { name: 't-meta', fontSize: '12px', lineHeight: '16px', fontWeight: 400, sample: '03 / 19 · 1960 × 3108', usage: '위치 · 사양 · 날짜. tabular-nums, pr-ink-3.' },
        { name: 't-caption', fontSize: '12px', lineHeight: '16px', fontWeight: 400, sample: '링크는 3일 뒤 사라져요', usage: '보조 문장 · 고지.' },
        { name: 't-body-s', fontSize: '13px', lineHeight: '20px', fontWeight: 400, sample: '재질 강도', usage: '슬라이더 라벨 · 패널 안내.' },
        { name: 't-body', fontSize: '15px', lineHeight: '22px', fontWeight: 400, sample: '포스터 없이 직접 입력', usage: '버튼 · 대상 · 옵션 · 목록.' },
        { name: 't-input', fontSize: '16px', lineHeight: '24px', fontWeight: 400, sample: '먼 바다', usage: '모든 입력. iOS 확대 방지(#585, PR #824).' },
        { name: 't-title', fontSize: '17px', lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: 600, sample: '제목', usage: '패널 머리 · 상단 줄 제목.' },
        { name: 't-headline', fontSize: '24px', lineHeight: '30px', letterSpacing: '-0.02em', fontWeight: 600, sample: '티켓 한 장이, 내 굿즈가 돼요', usage: '랜딩 헤드라인(브랜드 카피 예외).' }
      ] },
      { name: 'Brand', family: 'brand', styles: [{ name: 't-logotype', fontSize: '19px', lineHeight: '1', letterSpacing: '-0.012em', fontWeight: 900, sample: 'filme', usage: 'BI 마스터 v2 로고타입 전용(Wordmark.tsx). 다른 곳에 쓰지 않아요.' }] }
    ]
  },
  spacing: { tokens: [4, 8, 12, 16, 24, 32, 48].map((v, i) => ({ name: 'pr-s-' + (i + 1), value: v + 'px', usage: ['아이콘과 글자 사이', '옵션·태그 간격', '패널 안쪽 위', '프레임 좌우 여백 · 패널 좌우', '구획 사이', '큰 구획', '페이지 구획'][i] })) },
  radius: { tokens: [
    { name: 'pr-r-tag', value: '3px', usage: '태그 · 선택 라벨.' }, { name: 'pr-r-ctl', value: '6px', usage: '버튼 · 옵션 · 입력 · 토스트.' }, { name: 'pr-r-sheet', value: '14px', usage: '패널 · 시트 위 모서리만.' }] },
  shadow: { tokens: [{ name: 'pr-ticket-shadow', value: { light: '0 14px 32px -20px rgba(20,18,14,0.45)', dark: '0 16px 40px -20px rgba(0,0,0,0.9)' }, usage: '그림자는 티켓 한 장에만.' }] },
  size: { tokens: [
    { name: 'pr-hit', value: '44px', usage: '모든 터치 대상 최소.' }, { name: 'pr-hit-cta', value: '48px', usage: '화면 주 행동(CTA).' },
    { name: 'pr-track-hit', value: '32px', usage: '슬라이더 트랙 터치 높이(#779).' }, { name: 'pr-topbar', value: '52px', usage: '상단 줄 높이.' },
    { name: 'pr-line', value: '1px', usage: '헤어라인.' }, { name: 'pr-ind', value: '2px', usage: '선택 인디케이터 · 탭 밑줄.' }] },
  timing: { tokens: [
    { name: 'pr-dur-1', value: '160ms', usage: '패널 내용 교체(대상 전환).' }, { name: 'pr-dur-2', value: '240ms', usage: '패널 높이 · 화면 전환.' },
    { name: 'pr-ease', value: 'cubic-bezier(0.2, 0.7, 0.2, 1)', usage: '모든 전환.' }] }
};
fs.writeFileSync(OUT + 'tokens.json', JSON.stringify(tokens, null, 1));

/* ---------- bundle.css: master.css에서 토큰 정의만 걷어 내요 ---------- */
let css = fs.readFileSync(M + 'master.css', 'utf8');
const cut = css.indexOf('* { box-sizing: border-box; }');
const head = `/* FILME 영사실 컴포넌트 스타일. 토큰은 tokens.css(tokens.json에서 생성)가 정의해요.
   여기엔 테마와 무관한 상수(크롭 다이얼로그의 다크 고정색)와 별칭만 둬요. */
:root {
  --pr-font: var(--font-ui); --pr-font-brand: var(--font-brand);
  --pr-d-page: #050506; --pr-d-stage: #0B0B0C; --pr-d-s1: #141416; --pr-d-s2: #1C1C1F;
  --pr-d-hair-strong: rgba(255,255,255,.16); --pr-d-ink: #ECE9E3; --pr-d-ink2: #A8A49C; --pr-d-accent: #C24B43; --pr-d-warn: #E0A35A;
  --pr-rl: #D6336C; --pr-rl-ink: #FFFFFF;
}
`;
let body = css.slice(cut);
// 문서 셸(.m-*) 규칙은 시스템에 필요 없어서 그대로 두되 해가 없어요. 프레임 크기 변수는 유지.
fs.mkdirSync(OUT + 'components', { recursive: true });
fs.writeFileSync(OUT + 'components/bundle.css', head + body);

/* ---------- 컴포넌트 ---------- */
const NAME = { 'C-TB': 'TopBar', 'C-BTN': 'Button', 'C-LNK': 'LinkPair', 'C-WM': 'Wordmark', 'C-CAR': 'MoodShowcase', 'C-RES': 'ResumeRow', 'C-STAGE': 'Stage', 'C-SEL': 'SelectionMark', 'C-DOCK': 'EditDock', 'C-TOOLS': 'DesignTools', 'C-IROW': 'InfoRow', 'C-AROW': 'AssetRow', 'C-INP': 'InputPanel', 'C-ACC': 'OptionChips', 'C-MOOD': 'MoodThumbs', 'C-OPT': 'OptionGroup', 'C-SL': 'Slider', 'C-FLD': 'TextField', 'C-LIST': 'ResultList', 'C-KBD': 'KeyboardArea', 'C-SWT': 'Switch', 'C-SEG': 'Segmented', 'C-MENU': 'MenuSheet', 'C-DLG': 'CropDialog', 'C-TST': 'Toast', 'C-ALR': 'InlineAlert', 'C-BNR': 'AutofillBanner', 'C-TAG': 'Tag', 'C-STAR': 'StarRating', 'C-SW': 'ColorSwatches' };
const GROUP = { 'C-BTN': 'Actions', 'C-LNK': 'Actions', 'C-SWT': 'Actions', 'C-SEG': 'Actions', 'C-TB': 'Navigation', 'C-TOOLS': 'Navigation', 'C-DOCK': 'Surfaces', 'C-INP': 'Surfaces', 'C-IROW': 'Inputs', 'C-AROW': 'Inputs', 'C-ACC': 'Inputs', 'C-MENU': 'Surfaces', 'C-DLG': 'Surfaces', 'C-STAGE': 'Surfaces', 'C-SEL': 'Surfaces', 'C-FLD': 'Inputs', 'C-SL': 'Inputs', 'C-OPT': 'Inputs', 'C-SW': 'Inputs', 'C-STAR': 'Inputs', 'C-LIST': 'Inputs', 'C-KBD': 'Inputs', 'C-TST': 'Feedback', 'C-ALR': 'Feedback', 'C-BNR': 'Feedback', 'C-TAG': 'Feedback', 'C-WM': 'Brand', 'C-CAR': 'Brand', 'C-RES': 'Brand', 'C-MOOD': 'Brand' };
// 메뉴·크롭은 견본 대신 실제 프레임 한 장을 축소해 보여 줘요.
const FRAME_DEMO = { 'C-MENU': ['M-01', 0], 'C-DLG': ['C-01', 0], 'C-KBD': ['K-01', 0] };
const fr = id => W.FRAMES.find(f => f.id === id);
const H = { 'C-CAR': 280, 'C-STAGE': 260, 'C-DOCK': 340, 'C-IROW': 180, 'C-TST': 160, 'C-FLD': 200, 'C-MENU': 620, 'C-DLG': 620, 'C-KBD': 620, 'C-SL': 140, 'C-MOOD': 140 };
W.COMPONENTS.forEach(c => {
  const n = NAME[c.id], dir = OUT + 'components/' + n + '/';
  fs.mkdirSync(dir, { recursive: true });
  let demo = c.demo;
  if (FRAME_DEMO[c.id]) { const f = fr(FRAME_DEMO[c.id][0]); demo = '<div style="width:393px;transform:scale(.68);transform-origin:0 0;height:580px">' + f.variants[FRAME_DEMO[c.id][1]].html + '</div>'; }
  const prev = `<!-- @dsCard group="${GROUP[c.id]}" height=${H[c.id] || 120} subtitle="${c.variants.replace(/"/g, "'").slice(0, 120)}" -->
<div class="pr" style="background:var(--pr-stage);color:var(--pr-ink);font-family:var(--pr-font);padding:16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-height:100%;box-sizing:border-box;container-type:inline-size">${demo}</div>

`;
  fs.writeFileSync(dir + 'preview.html', prev);
  const md = `# ${n}

${c.name}(${c.id})예요. ${c.anatomy[0]}부터 시작하는 ${c.anatomy.length}개 부분으로 이뤄져요.

## 구성
${c.anatomy.map((a, i) => (i + 1) + '. ' + a).join('\n')}

## 크기
${c.size}

## 토큰
${c.tokens}

## 변형
${c.variants}

## 상태
${c.states}

## 대응 구현(main 203ee7c)
${c.files}

## 쓰이는 프레임
${c.frames} — 페이지 마스터(\`docs/mockups/826-master/\`)와 Design 캔버스 "FILME 리뉴얼"의 같은 ID 프레임.

## 소비자가 넣는 것
마크업은 \`components/bundle.css\`의 \`c-\` 클래스를 써요. React 컴포넌트 번들은 아직 없어요(구현은 #826 4단계 Seed 이후, cva + cn으로 직접).
`;
  fs.writeFileSync(dir + 'README.md', md);
});

/* ---------- 표지 ---------- */
fs.mkdirSync(OUT + 'components/Cover', { recursive: true });
fs.writeFileSync(OUT + 'components/Cover/preview.html', `<!-- @dsCard height=300 -->
<div class="cv" style="position:relative;width:960px;height:300px;background:var(--pr-stage);overflow:hidden;font-family:var(--font-ui)">
<style>
.cv .stage{fill:var(--pr-s1)} .cv .ink{fill:var(--pr-ink)} .cv .brick{fill:var(--pr-accent)} .cv .warn{fill:var(--pr-warn)} .cv .s2{fill:var(--pr-s2)}
.cv .hair{stroke:var(--pr-hair-strong);stroke-width:1;fill:none} .cv .notch{fill:var(--pr-stage)}
.cv h1{position:absolute;left:40px;bottom:64px;margin:0;font-size:84px;line-height:.92;font-weight:600;letter-spacing:-0.03em;color:var(--pr-ink)}
.cv p{position:absolute;left:42px;bottom:36px;margin:0;font-size:14px;line-height:20px;color:var(--pr-ink-2);max-width:420px}
</style>
<svg width="960" height="300" viewBox="0 0 960 300" aria-hidden="true" style="position:absolute;inset:0">
<!-- blocks: pr-ink 192×300 · pr-s1 160×300(무대 기둥) · pr-accent 112×176 · pr-warn 48×48 · pr-s2 112×124
     arrangement: 무대 기둥 하나 + 위성 블록, 오른쪽 끝에서 잘려 나감
     pattern: literal motif(ticket) — 티켓 절취 반원 노치를 pr-s-2(8) 반지름으로, 기둥 가장자리를 따라 6개. 시스템이 티켓 한 장을 무대에 세우는 영사실이라서.
     scales: pr-s-2 8 · pr-s-6 32 · pr-s-7 48 · pr-r-ctl 6 -->
<rect class="stage" x="560" y="0" width="160" height="300"/>
<line class="hair" x1="560.5" y1="0" x2="560.5" y2="300"/><line class="hair" x1="719.5" y1="0" x2="719.5" y2="300"/>
<rect class="ink" x="768" y="0" width="192" height="300"/>
<rect class="brick" x="600" y="64" width="80" height="128" rx="6"/>
<rect class="s2" x="808" y="48" width="112" height="124" rx="6"/>
<rect class="warn" x="496" y="236" width="48" height="48" rx="6"/>
<circle class="notch" cx="768" cy="64" r="8"/><circle class="notch" cx="768" cy="112" r="8"/><circle class="notch" cx="768" cy="160" r="8"/><circle class="notch" cx="768" cy="208" r="8"/><circle class="notch" cx="768" cy="256" r="8"/><circle class="notch" cx="960" cy="112" r="8"/>
</svg>
<h1>FILME<br>영사실</h1>
<p>무대는 어둡게, 티켓만 빛나게. 포토티켓 편집기의 화면 시스템이에요.</p>
</div>
`);

/* ---------- README ---------- */
fs.writeFileSync(OUT + 'README.md', `# FILME 영사실

FILME(CGV 포토플레이 스타일 포토티켓 편집기)의 앱 화면 디자인 시스템이에요. #826 리뉴얼 3단계에서 F′(영사실) 방향을 확정해 만들었고, 원본은 레포 브랜치 \`docs/826-page-master\`의 \`docs/mockups/826-master/\`(페이지 마스터)예요. 티켓 무드 렌더(6무드)는 이 시스템의 범위가 아니에요.

## 한 줄 원칙
무대(stage)는 어둡거나 종이처럼 조용하고, 티켓 한 장만 빛나요. 깊이는 표면 세 단계(\`pr-stage\` → \`pr-s1\` → \`pr-s2\`)와 헤어라인으로 내고, 그림자는 티켓에만 써요(\`pr-ticket-shadow\`).

## 결정(2026-11-16 소유자)
1. 테마는 시스템 설정을 따라요. 라이트·다크를 같은 수준으로 완성하고, 메뉴에 시스템/라이트/다크 선택을 둬요(기본 시스템).
2. 글꼴은 Pretendard Variable 하나예요. mono를 쓰지 않고 숫자 정렬은 \`font-variant-numeric: tabular-nums\`로만.
3. 선택 표시는 재단 표시예요: \`pr-accent-hair\` 상자 + 네 모서리 L자(\`pr-accent\`) + 한글 대상 라벨. 위 여백이 22px 미만이면 라벨을 아래로, 아래도 없으면 안쪽, 그것도 안 되면 생략.
4. 세리프를 쓰지 않아요. 워드마크는 BI 마스터 v2 락업(클래퍼 티켓 마크 + Nunito 900 "fılme") 그대로.
5. 브릭(\`pr-accent\`)은 화면당 주 행동 하나의 채움, 선택 표시, 모드 인디케이터에만 써요. 오류·필수 누락·초기화 확인은 앰버(\`pr-warn\`).\n6. 모바일 전용. 랜딩 전시는 버튼 없이 강제 재생(누르고 있는 동안·포커스 동안 정지, OS 동작 줄이기면 정지).\n7. 문구는 핵심만: 설명성 안내 없음, 진행은 "…중…", 오류는 무슨 일 한 줄(다음 행동은 버튼).\n8. 편집은 고정 높이 도크 + 모드 셋(사진 · 정보 · 디자인). 디자인은 티켓 전체에 한 번에, 필드는 바로 입력.

## 색 쓰는 법
- 글자: \`pr-ink\`(본문) · \`pr-ink-2\`(보조, 아이콘) · \`pr-ink-3\`(메타, 12px까지). 세 표면 모두 4.5:1 이상.
- 브릭은 글자색 금지(다크 표면 위 3.8:1). 브릭 채움 위 글자는 \`pr-accent-ink\`.
- 경고 글자·테두리·점은 \`pr-warn\`. 현행 앱의 \`--danger\` 빨강은 브릭과 너무 가까워 쓰지 않아요.
- 모달 뒤는 \`pr-scrim\`. 크롭 다이얼로그는 사진 판독용으로 테마와 무관하게 다크 고정(\`bundle.css\`의 \`--pr-d-*\` 상수).

## 글
- 사용자 노출 문구는 레포 \`docs/COPY_TONE_GUIDE.md\`를 따라요: 라벨은 명사구(조건절·종결어미·마침표 없음), 실패는 [무슨 일] + [다음 행동] 두 문장, 한 문장 33자·전체 44자.
- 완료 통보는 과거형("임시저장했어요"), 진행은 "…중…"(U+2026).
- 예: 주 버튼 "티켓 스크린샷으로 자동입력", 링크 쌍 "포스터 업로드 · 포스터 없이 직접 입력"(테스트가 잠근 문구).

## 모양
- 모서리 두 단계와 태그: \`pr-r-ctl\` 6(조작부), \`pr-r-sheet\` 14(시트 위 모서리), \`pr-r-tag\` 3. pill은 스위치 트랙 하나만.
- 선: \`pr-line\` 1px 헤어라인, \`pr-ind\` 2px 인디케이터.
- 터치: 모든 대상 \`pr-hit\` 44, 화면 주 행동 \`pr-hit-cta\` 48, 슬라이더 트랙 \`pr-track-hit\` 32. 입력 글자 16px(\`t-input\`).
- 모션: \`pr-dur-1\` 160ms 내용 교체, \`pr-dur-2\` 240ms 높이·화면 전환, \`pr-ease\` 하나. 동작 줄이기면 즉시.
- 금지: 그라데이션 · 글로우 · 큰 그림자 · pill 남발 · 이모지 아이콘.

## 아이콘
20px, 선 굵기 1.75, 둥근 끝, \`currentColor\`(보통 \`pr-ink-2\`). 쓰는 것: 뒤로 · 다음 · 실행 취소 · 다시 실행 · 더보기 · 눈/눈 끔 · 닫기 · 정지/재생 · 별 · 검색 · 확인.

## 로고
\`assets/Logos/clapper-ticket-mark.svg\`는 \`src/components/v2/Wordmark.tsx\`의 클래퍼 티켓 마크를 그대로 옮긴 거예요(배지색은 라이트 브릭 #B0423F, 앱에선 테마 accent). 로고타입 "fılme"는 글자(Nunito 900 19px, ı 위 브릭 점, me 브릭)라 파일이 없어요: \`t-logotype\` 스타일과 Wordmark.tsx를 쓰세요.

## 컴포넌트
${W.COMPONENTS.length}개. 각 카드의 README에 구성·크기·토큰·변형·상태·대응 구현 파일(main 203ee7c)과 쓰이는 프레임 ID가 있어요. 스타일은 \`components/bundle.css\`의 \`c-\` 클래스이고, React 번들은 아직 없어요.

## 화면
화면 정의(프레임 ${W.FRAMES.length}개 · 상태 ${W.FRAMES.reduce((a, f) => a + f.variants.length, 0)}개)는 Design 캔버스 "FILME 리뉴얼"의 "페이지 마스터" 페이지와 레포 페이지 마스터에 있어요. 작업 중 비교판은 같은 캔버스의 "결정 · 비교판" 페이지에 쌓아요.
`);

/* ---------- index ---------- */
const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
fs.writeFileSync(OUT + 'design-system.json', JSON.stringify({
  v: 3, layout: 'files', createdOnFiles: { v: 1, at: '2026-11-16T14:42:36Z' } /* 처음 만든 시각 고정(인덱스 마커) */, title: 'FILME 영사실', namespace: 'FilmeProjection', libraries: [],
  sections: {}, groups: ['Logos'],
  assetGroups: { Logos: { name: 'Logos', tile: 'm', order: ['clapper-ticket-mark.svg'], files: { 'clapper-ticket-mark.svg': { name: 'clapper-ticket-mark.svg', blob: '93bdcf2caf7cd54152bfbbf55b7c933c', size: 1097, type: 'image/svg+xml' } } } },
  blobs: {}, docs: { readme: 'project/README.md', sections: [] },
  lastChange: { by: 'Lyainc', at: now, via: 'Claude Code', note: process.argv[3] || ('페이지 마스터에서 토큰 · 컴포넌트 ' + W.COMPONENTS.length + '개 생성') } /* 두 번째 인자: 이번 변경 메모 */
}, null, 1));
fs.writeFileSync(OUT + 'assets/Logos/README.md', '# Logos\n\n클래퍼 티켓 마크(BI 마스터 v2 §02). 배지 안 -16° 대각. 마크 안 잉크/페이퍼(#FBF4EC/#241C22)는 BI 고정색이고 배지만 테마 accent를 따라요. 최소 크기 24px.\n');
console.log('components', W.COMPONENTS.length);
