/* 색 토큰 · 대비. 대비는 WCAG 상대 휘도 공식으로 여기서 직접 계산해요. 값은 master.css의 --pr-l-* / 다크 블록과 같아야 해요. */
EV({ id: 'tokens-color', page: 'tokens', title: '색 · 라이트 / 다크', html: function () {
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
    ['accent', '#B0423F', '#C24B43', '브릭: 주 행동 채움 · 선택 표시 · 모드 인디케이터만', 'fill'],
    ['accent-ink', '#FFFFFF', '#FFFFFF', '브릭 채움 위 글자', 'onaccent'],
    ['warn', '#8F5410', '#E0A35A', '앰버: 오류 · 필수 누락 · 초기화 arm (신규, 결정 5-A)', 'text'],
    ['accent-hair', 'rgba(176,66,63,.45)', 'rgba(194,75,67,.45)', '선택 표시 45% 상자 선(C-SEL)', null],
    ['scrim', 'rgba(20,18,14,.48)', 'rgba(0,0,0,.64)', '모달 뒤 어둡게 (신규)', null],
    ['kbd · key', '#D1D3D9 · #FFFFFF', '#2B2B2E · #4A4A4E', '키보드 그림 전용(문서). iOS 키보드 색에 가깝게', null]
  ];
  var SURF = { l: ['#EFECE6', '#F7F5F1', '#FFFFFF'], d: ['#0B0B0C', '#141416', '#1C1C1F'] };
  var sw = function (v) { return /^#|^rgba/.test(v) && v.indexOf('·') < 0 ? '<i class="sw" style="background:' + v + '"></i>' : ''; };
  var rows = COLORS.map(function (c) {
    var r = '—';
    if (c[4] === 'text') r = Math.min.apply(null, SURF.l.map(function (s) { return +cr(c[1], s); })).toFixed(2) + ' · ' + Math.min.apply(null, SURF.d.map(function (s) { return +cr(c[2], s); })).toFixed(2);
    if (c[4] === 'onaccent') r = cr('#FFFFFF', '#B0423F') + ' · ' + cr('#FFFFFF', '#C24B43') + ' (브릭 채움 위)';
    if (c[4] === 'fill') r = '글자로 쓰지 않음(다크 표면 위 ' + cr('#C24B43', '#141416') + ')';
    return ['<code>--pr-' + c[0].split(' ')[0] + '</code>', sw(c[1]) + c[1], sw(c[2]) + c[2], c[3], r];
  });
  return '<p class="m-lede">f-refined의 <code>--pr-</code> 토큰을 출발점으로 확정했어요. 바뀐 점: mono 글꼴 토큰 삭제(결정 2), Instrument Serif 삭제(결정 4 · 워드마크는 BI Nunito), <code>--pr-warn</code>·<code>--pr-scrim</code>·<code>--pr-r-tag</code> 추가(결정 5-A, 모달, 태그), 대상 번호 표기 삭제.</p>' +
    '<h3>색 · 라이트 / 다크</h3>' + EV_TBL(['토큰', '라이트', '다크', '쓰임', '대비(라이트 · 다크, 세 표면 중 최소)'], rows, ['n', 'n', 'n', null, 'n']) +
    '<p class="m-note">반투명 토큰은 대비를 매기지 않아요(글자에 쓰지 않음).</p>';
} });
