/* 타입 토큰. 견본 클래스(t-*)는 master.css에 있어요. */
EV({ id: 'tokens-type', page: 'tokens', title: '타입 · Pretendard Variable 하나', html: function () {
  return '<h3>타입 · Pretendard Variable 하나</h3>' + EV_TBL(['이름', '견본', '크기/행간', '굵기', '쓰임'], [
    ['tag', '필수', '11/14', 600, '태그 · 선택 라벨'], ['meta', '03 / 19 · 1960 × 3108', '12/16', 400, '위치 · 사양 · 날짜(tabular-nums, ink-3)'], ['caption', '링크는 3일 뒤 사라져요', '12/16', 400, '보조 문장 · 고지'],
    ['body-s', '재질 강도', '13/20', 400, '슬라이더 라벨 · 패널 안내'], ['body', '포스터 없이 직접 입력', '15/22', '400·500', '버튼 · 대상 · 옵션 · 목록'], ['input', '먼 바다', '16/24', 400, '모든 입력(요구 3)'],
    ['title', '제목', '17/24 −0.01em', 600, '패널 머리 · 상단 줄 제목'], ['headline', '티켓 한 장이, 내 굿즈가 돼요', '24/30 −0.02em', 600, '랜딩 헤드라인(브랜드 예외)']
  ].map(function (t) { return ['<code>' + t[0] + '</code>', '<span class="t-' + t[0] + '">' + t[1] + '</span>', t[2], t[3], t[4]]; }), ['n', null, 'n', 'n']) +
    '<p class="m-note">굵기는 400·500·600만. 숫자 정렬은 mono 대신 <code>font-variant-numeric: tabular-nums</code>. 로고타입만 BI 전용 Nunito 900(<code>--pr-font-brand</code>). 폴백: Pretendard → Apple SD Gothic Neo → Noto Sans KR.</p>';
} });
