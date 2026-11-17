// 마스터 → Design 캔버스(FILME 리뉴얼) 파일. node tools/gen-canvas.js <출력폴더>. 결과를 Artifact로 그 캔버스에 publish해요.
const fs = require('fs'), path = require('path');
const M = path.join(__dirname, '..') + '/';
const OUT = path.join(process.argv[2] || path.join(__dirname, '.out/canvas'), 'project') + '/';
const FONT = '/_blob/506ff5f72238a48abf04232196ae3d3c';
const DS = 'https://claude.ai/artifact/MBMFZaMMAytrVv5HTgnxc8';
global.window = global; global.document = {};
['lib.js', 'frames.js', 'data/components.js', 'data/trace.js', 'data/refs.js'].forEach(f => require(M + f));
/* 근거 단위: evidence/의 파일 하나 = 보드 하나. index.html이 같은 파일을 같은 순서로 싣는지 확인해요. */
const UNIT_FILES = fs.readdirSync(M + 'evidence').filter(f => f.endsWith('.js')).sort();
const idx = fs.readFileSync(M + 'index.html', 'utf8').match(/evidence\/[^"]+\.js/g) || [];
if (idx.join() !== UNIT_FILES.map(f => 'evidence/' + f).join()) { console.error('index.html의 evidence 스크립트 목록이 폴더와 달라요'); process.exit(1); }
UNIT_FILES.forEach(f => require(M + 'evidence/' + f));
const W = global.window, S = W.PR, esc = S.esc;
const TC = W.TRACE_CHECK();
if (TC.bad.length || TC.miss.length) { console.error('추적표 점검 실패', TC); process.exit(1); }
const ONLY = process.argv[3] || null; /* 단위 id 하나만 다시 쓰려면 두 번째 인자로 */
if (ONLY && !W.EVIDENCE.some(u => u.id === ONLY && u.canvas !== false)) { console.error('없는 단위 id: ' + ONLY); process.exit(1); }
fs.mkdirSync(OUT + 'master', { recursive: true }); fs.mkdirSync(OUT + 'decisions', { recursive: true }); fs.mkdirSync(OUT + 'wip', { recursive: true });

/* ---------- 지원 스타일: master.css + 아트보드 단위 테마 스위치 ---------- */
let css = fs.readFileSync(M + 'master.css', 'utf8');
const dark = css.match(/:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/)[1];
const lightVals = `--pr-page: var(--pr-l-page); --pr-stage: var(--pr-l-stage); --pr-s1: var(--pr-l-s1); --pr-s2: var(--pr-l-s2);
  --pr-hair: var(--pr-l-hair); --pr-hair-strong: var(--pr-l-hair-strong);
  --pr-ink: var(--pr-l-ink); --pr-ink-2: var(--pr-l-ink2); --pr-ink-3: var(--pr-l-ink3);
  --pr-accent: var(--pr-l-accent); --pr-accent-ink: var(--pr-l-accent-ink); --pr-warn: var(--pr-l-warn);
  --pr-kbd: var(--pr-l-kbd); --pr-key: var(--pr-l-key); --pr-scrim: var(--pr-l-scrim);
  --pr-ticket-shadow: var(--pr-l-ticket-shadow); color-scheme: light;`;
css += `
/* ---------- 캔버스 아트보드 전용 ---------- */
[data-pr-theme="dark"] {${dark}
}
[data-pr-theme="light"] { ${lightVals} }
[data-pr-theme] { --pr-accent-hair: color-mix(in srgb, var(--pr-accent) 45%, transparent); }
.ab { box-sizing: border-box; background: var(--pr-page); color: var(--pr-ink); font-family: var(--pr-font); padding: 32px; display: flex; flex-direction: column; gap: 16px; }
.ab-h { display: flex; align-items: baseline; gap: 12px; }
.ab-h .id { font-size: 14px; font-weight: 600; border: 1px solid var(--pr-hair-strong); border-radius: 3px; padding: 0 6px; line-height: 22px; color: var(--pr-ink-2); font-variant-numeric: tabular-nums; }
.ab-h h1 { margin: 0; font-size: 24px; line-height: 30px; font-weight: 600; letter-spacing: -.02em; }
.ab-row { display: flex; gap: 40px; align-items: flex-start; }
.ab-fig { width: 393px; flex: none; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.ab-fig figcaption { font-size: 14px; line-height: 20px; font-weight: 600; color: var(--pr-ink); }
.ab-fig figcaption span { color: var(--pr-ink-3); font-weight: 500; margin-right: 6px; font-variant-numeric: tabular-nums; }
.ab-spec { width: 380px; flex: none; font-size: 13px; line-height: 20px; color: var(--pr-ink-2); display: flex; flex-direction: column; gap: 12px; }
.ab-spec h2 { margin: 0; font-size: 12px; line-height: 16px; font-weight: 600; color: var(--pr-ink-3); }
.ab-spec ul { margin: 0; padding-left: 16px; }
.ab-spec b { color: var(--pr-ink); font-weight: 600; }
`;
fs.writeFileSync(OUT + 'pr.css', css);

/* ---------- 아트보드 공통 ---------- */
const HEAD = (title, css) => `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="${css}">
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@900&amp;display=swap">
<style>
@font-face { font-family: "Pretendard Variable"; src: url("${FONT}") format("woff2"); font-weight: 45 920; font-display: swap; }
body { margin: 0; }
</style>
</helmet>
`;
const TAIL = (w, h, theme) => `
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"theme":{"editor":"enum","options":["light","dark"],"default":"${theme}","section":"표시"},"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
  renderVals() {
    return { theme: this.props.theme ?? '${theme}' };
  }
}
</script>
</body>
</html>
`;

/* ---------- 프레임 아트보드 ---------- */
const GROUPS = [['landing', '랜딩'], ['editor', '편집 기본'], ['dock', '도크 · 사진 · 정보 · 디자인'], ['input', '필드 편집 · 키보드'], ['crop', '크롭'], ['menu', '메뉴 · 설정'], ['result', '결과 · 저장 · 공유'], ['errors', '오류 · 빈 상태'], ['share', '공유 페이지']];
const boards = {}, order = [], notes = {};
const H = 1010;
function frameBoard(f) {
  const n = f.variants.length, w = 64 + n * 393 + (n - 1) * 40 + 40 + 380, an = W.EV_FRAME_NOTES(f.id);
  let html = HEAD(f.id + ' ' + f.name, '../pr.css');
  html += `<div class="ab" data-pr-theme="{{theme}}" style="width: ${w}px; height: ${H}px">
<div class="ab-h"><span class="id">${f.id}</span><h1>${esc(f.name)}</h1></div>
<div class="ab-row">
`;
  f.variants.forEach((v, i) => { html += `<figure class="ab-fig"><figcaption><span>${f.id}${n > 1 ? '.' + (i + 1) : ''}</span>${esc(v.st)}</figcaption>${v.html}</figure>\n`; });
  html += `<div class="ab-spec">
<h2>상태</h2><ul>${f.states.map(s => '<li>' + esc(s) + '</li>').join('')}</ul>
<h2>컴포넌트</h2><p style="margin:0">${f.comps.join(' · ')}</p>
${f.flow.length ? '<h2>흐름</h2><ul>' + f.flow.map(x => '<li><b>' + esc(x[0]) + '</b> → ' + esc(x[1]) + (x[2] ? ' (' + esc(x[2]) + ')' : '') + '</li>').join('') + '</ul>' : ''}
${f.notes.length ? '<h2>메모</h2><ul>' + f.notes.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : ''}
${an.copy.length ? '<h2>문구 변경</h2><ul>' + an.copy.map(x => '<li>' + x + '</li>').join('') + '</ul>' : ''}
${an.trace.length ? '<h2>기능 · 요구</h2><p style="margin:0">' + an.trace.join(' · ') + '</p>' : ''}
</div>
</div>
</div>`;
  html += TAIL(w, H, 'dark');
  fs.writeFileSync(OUT + 'master/' + f.id + '.dc.html', html);
  return w;
}

/* ---------- Main: 읽는 법 ---------- */
const MAIN_W = 1280, MAIN_H = 900;
fs.writeFileSync(OUT + 'Main.dc.html', HEAD('FILME 리뉴얼', './pr.css') + `<div class="ab" data-pr-theme="{{theme}}" style="width: ${MAIN_W}px; height: ${MAIN_H}px; padding: 56px; gap: 28px">
${S.wordmark()}
<div style="display: flex; flex-direction: column; gap: 8px; max-width: 760px">
<h1 style="margin: 0; font-size: 40px; line-height: 46px; letter-spacing: -0.02em; font-weight: 600">FILME 리뉴얼 캔버스</h1>
<p style="margin: 0; font-size: 17px; line-height: 26px; color: var(--pr-ink-2)">#826 앱 화면 리뉴얼의 화면 정의와 작업 중 비교판을 한 캔버스에 모아요. 디자인 시스템은 "FILME 영사실"을 설치해 썼어요.</p>
</div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px">
<div style="background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: 6px; padding: 20px; display: flex; flex-direction: column; gap: 8px">
<h2 style="margin: 0; font-size: 17px; font-weight: 600">페이지 마스터</h2>
<p style="margin: 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2)">프레임 ${W.FRAMES.length}개 · 상태 변형 ${W.FRAMES.reduce((a, f) => a + f.variants.length, 0)}개. 화면 묶음마다 한 줄, 아트보드 하나가 프레임 하나예요. 각 아트보드 오른쪽에 상태 · 컴포넌트 · 흐름 · 메모가 붙어요. 테마는 아트보드 Tweaks의 theme.</p>
</div>
<div style="background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: 6px; padding: 20px; display: flex; flex-direction: column; gap: 8px">
<h2 style="margin: 0; font-size: 17px; font-weight: 600">결정 · 비교판</h2>
<p style="margin: 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2)">소유자 결정을 받으려고 그린 후보 비교. 파일 이름 decisions/D번호-주제(D01 선택 표시 · 세리프 · 브릭, D02 팔레트). 결정이 나면 아트보드 제목에 결과를 적고 지우지 않아요.</p>
</div>
<div style="background: var(--pr-s1); border: 1px solid var(--pr-hair-strong); border-radius: 6px; padding: 20px; display: flex; flex-direction: column; gap: 8px">
<h2 style="margin: 0; font-size: 17px; font-weight: 600">작업 중 목업</h2>
<p style="margin: 0; font-size: 14px; line-height: 21px; color: var(--pr-ink-2)">결정이 필요 없는 탐색 시안. 파일 이름 wip/W번호-주제. 마스터로 올라가면 master/의 해당 프레임을 고치고 여기 것은 남겨 둬요.</p>
</div>
</div>
<div style="display: flex; flex-direction: column; gap: 6px; font-size: 14px; line-height: 21px; color: var(--pr-ink-2)">
<p style="margin: 0"><b style="color: var(--pr-ink)">원본</b> 레포 브랜치 docs/826-page-master의 docs/mockups/826-master/ (프레임 빌더 · 추적표 · 레퍼런스 · Aside 검증 기록). 캔버스 아트보드는 그 원본에서 생성했어요.</p>
<p style="margin: 0"><b style="color: var(--pr-ink)">결정</b> 테마 시스템 따름 · Pretendard 하나 · 재단 표시 · 세리프 없음 · 오류는 앰버 · 전시 강제 재생 · 모바일 전용 · 문구 간결 · 도크 모드 셋(사진 · 정보 · 디자인).</p><p style="margin: 0"><b style="color: var(--pr-ink)">근거</b> "근거" 페이지는 짧은 보드 여러 장이에요(결정 · 미결 · 바꾼 것 · 의문 · Seed / 토큰 / 흐름 / 오류 색인 / 요구 · 기능 묶음별 / 문구 / 레퍼런스). 보드 하나가 레포 evidence/의 파일 하나라 한 단위만 고쳐 다시 올려요. 프레임에 걸린 문구 변경과 기능 추적은 각 프레임 보드 오른쪽에도 붙어요.</p>
<p style="margin: 0"><b style="color: var(--pr-ink)">범위 밖</b> 티켓 무드 렌더(자리표시 그림) · 프로덕션 코드 · Seed(4단계).</p>
</div>
</div>` + TAIL(MAIN_W, MAIN_H, 'dark'));
boards['Main.dc.html'] = { x: 0, y: 0, w: MAIN_W, h: MAIN_H, title: 'FILME 리뉴얼 · 읽는 법', page: 'master' };
order.push('Main.dc.html');

let y = MAIN_H + 120 + 260;
GROUPS.forEach(([g, label]) => {
  let x = 0;
  const fs_ = W.FRAMES.filter(f => f.page === g);
  fs_.forEach(f => { const w = frameBoard(f); const key = 'master/' + f.id + '.dc.html'; boards[key] = { x, y, w, h: H, title: f.id + ' ' + f.name, page: 'master' }; order.push(key); x += w + 80; });
  notes['row-' + g] = { x: 0, y: y - 240, text: label, kind: 'title1', maxW: Math.max(1200, x - 80), page: 'master' };
  y += H + 120 + 260;
});

/* ---------- 결정 · 비교판 D01 ---------- */
const src = fs.readFileSync(path.join(M, 'decisions/D01-selection-serif-brick.html'), 'utf8');
let dcss = src.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\bbody \{/, '.d01 {');
fs.writeFileSync(OUT + 'decisions/D01.css', dcss);
let dbody = src.slice(src.indexOf('<div class="wrap">'));
dbody = dbody.replace('<p class="q">#826 3단계 · 영사실 톤 결정</p>', '<p class="q">#826 3단계 · 결정 D01 · 2026-11-16 결정: 3-A · 4-A · 5-A</p>');
fs.writeFileSync(OUT + 'decisions/D01-selection-serif-brick.dc.html', `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>D01 선택 표시 · 세리프 · 브릭 범위</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="D01.css">
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&amp;family=Noto+Serif+KR:wght@500;600&amp;family=Nunito:wght@900&amp;display=swap">
<style>body { margin: 0; }</style>
</helmet>
<div class="d01" style="width: 100%; min-height: 100%">
${dbody}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1280,"height":2700}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`);
boards['decisions/D01-selection-serif-brick.dc.html'] = { x: 0, y: 0, w: 1280, h: 2700, title: 'D01 선택 표시 · 세리프 · 브릭 — 결정 3-A · 4-A · 5-A', page: 'decisions', expand: 'fill' };
order.push('decisions/D01-selection-serif-brick.dc.html');
/* ---------- 결정 · 비교판 D02: decisions/D02-palette.js 하나를 레포 HTML과 같이 써요 ---------- */
require(M + 'decisions/D02-palette.js');
const D02_W = 2640, D02_H = 4640;
fs.writeFileSync(OUT + 'decisions/D02-palette.dc.html', HEAD('D02 팔레트 비교', '../pr.css').replace('body { margin: 0; }', 'body { margin: 0; }\n' + W.D02_CSS) +
  '<div data-pr-theme="{{theme}}" style="width: 100%; min-height: 100%; background: var(--pr-page)">' + W.D02_HTML().replace(/\{\{/g, '{ {') + '</div>' + TAIL(D02_W, D02_H, 'light'));
boards['decisions/D02-palette.dc.html'] = { x: 1900, y: 0, w: D02_W, h: D02_H, title: 'D02 팔레트 · 바탕과 강조색 — 결정 B', page: 'decisions', expand: 'fill' };
order.push('decisions/D02-palette.dc.html');
notes['decisions-rule'] = { x: 1400, y: 0, w: 420, text: '결정 · 비교판 규칙\n\n· 새 비교판은 decisions/D번호-주제.dc.html로 오른쪽에 이어 붙여요(80px 간격).\n· 아트보드 제목: "D번호 주제 — 결정 대기" → 결정이 나면 "— 결정 X-A".\n· 결정 내용은 레포 마스터 표지의 결정 표에도 같은 날 적어요.\n· 지우지 않아요. 결정의 근거로 남겨요.', fill: 'gray', page: 'decisions' };
notes['wip-rule'] = { x: 0, y: 0, w: 480, text: '작업 중 목업 규칙\n\n· 결정이 필요 없는 탐색 시안은 wip/W번호-주제.dc.html.\n· 393 기준 폰 프레임은 pr.css의 .ph 구조(상태 막대 · 홈 인디케이터)를 그대로 써요.\n· 마스터로 확정되면 master/의 해당 프레임을 고치고, 레포 원본(frames.js)도 같은 커밋에서 고쳐요.\n· 아직 아트보드 없음.', fill: 'gray', page: 'wip' };
notes['master-rule'] = { x: MAIN_W + 80, y: 0, w: 420, text: '페이지 마스터 아트보드는 레포 원본에서 생성해요. 손으로 고치면 다음 생성 때 덮일 수 있어요. 고칠 땐 레포 frames.js를 고치고 다시 생성하거나, 여기서 고친 걸 레포에 옮겨 적어요.', fill: 'orange', page: 'master' };

/* ---------- 근거 페이지: evidence/ 단위마다 보드 하나. 단위 html()을 직접 불러 그려요(스냅숏 없음) ---------- */
fs.mkdirSync(OUT + 'evidence', { recursive: true });
/* 보드 높이 추정: 표 행·목록·문단의 글자 수로 어림하고 넉넉히 잡아요(잘림보다 남는 게 나아요). */
function estH(html) {
  const txt = h => h.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, 'x');
  let h = 140;
  (html.match(/<tr[\s\S]*?<\/tr>/g) || []).forEach(r => { const cells = r.match(/<t[dh][\s\S]*?<\/t[dh]>/g) || []; const lines = Math.max(1, ...cells.map(c => Math.ceil(txt(c).length / Math.max(14, 150 / cells.length)))); h += 18 + lines * 20; });
  (html.match(/<li[\s\S]*?<\/li>/g) || []).forEach(l => { h += 8 + Math.ceil(txt(l).length / 110) * 22; });
  (html.match(/<p[\s\S]*?<\/p>/g) || []).forEach(p => { h += 20 + Math.ceil(txt(p).length / 100) * 22; });
  h += (html.match(/<h3/g) || []).length * 64 + (/<svg/.test(html) ? 340 : 0);
  return Math.ceil(h / 40) * 40;
}
const evPages = [];
let ex = 0, ey = 0, rowH = 0;
const EV_W = 1280;
W.EVIDENCE.filter(u => u.canvas !== false).forEach((u, n) => {
  const key = 'evidence/' + u.id + '.dc.html', body = u.html(), h = estH(body);
  if (!ONLY || ONLY === u.id) fs.writeFileSync(OUT + key, HEAD(u.title, '../pr.css').replace('<style>', '<style>\n.ev a { color: inherit; }') + '<div class="ab m-page on ev" data-pr-theme="{{theme}}" style="width: 100%; min-height: 100%; padding: 32px 40px 48px; display: block"><h2>' + esc(u.title) + '</h2>' + body.replace(/\{\{/g, '{ {') + '</div>' + TAIL(EV_W, h, 'dark'));
  /* 같은 page 묶음은 한 줄에 오른쪽으로, 묶음이 바뀌면 다음 줄 */
  const prev = n && W.EVIDENCE.filter(x => x.canvas !== false)[n - 1];
  if (prev && prev.page !== u.page) { ex = 0; ey += rowH + 120; rowH = 0; }
  boards[key] = { x: ex, y: ey, w: EV_W, h, title: u.title, page: 'evidence', expand: 'fill' };
  order.push(key); evPages.push(key); ex += EV_W + 80; rowH = Math.max(rowH, h);
});
const canvas = {
  v: 3, createdOnFiles: { v: 1, at: '2026-11-16T14:45:28Z' } /* 처음 만든 시각 고정(인덱스 마커) */, title: 'FILME 리뉴얼',
  launch: { view: 'canvas', page: 'master' },
  pages: [{ id: 'master', name: '페이지 마스터' }, { id: 'evidence', name: '근거' }, { id: 'decisions', name: '결정 · 비교판' }, { id: 'wip', name: '작업 중 목업' }],
  boards, order, notes,
  designSystems: [{ title: 'FILME 영사실', namespace: 'filmeprojection', artifact: DS, version: '1794928735-dd23', copiedAt: '2026-11-17T15:20:00Z' }]
};
fs.writeFileSync(OUT + 'canvas.json', JSON.stringify(canvas, null, 1));
console.log('boards', Object.keys(boards).length);
