/* 표지 머리 · 읽는 법. 캔버스에선 Main.dc.html이 같은 역할이라 올리지 않아요. */
EV({ id: 'about', page: 'cover', title: '읽는 법', canvas: false, html: function () {
  var FR = window.FRAMES, nV = FR.reduce(function (a, f) { return a + f.variants.length; }, 0);
  return '<p class="m-lede">#826 리뉴얼 3단계 산출물이에요. 소유자가 고른 F′(f-refined "영사실")를 바탕으로 앱 화면 전체를 393 기준 프레임 ' + FR.length + '개, 상태 변형 ' + nV + '개로 정의했어요. 각 프레임에 상태·컴포넌트·흐름·레드라인이 붙어 있어요. 프로덕션 코드(src/)와 Seed(4단계)는 범위 밖이에요.</p>' +
    '<h3>읽는 법</h3><ul><li>왼쪽 목록이 페이지예요. 숫자는 프레임·상태 변형 수.</li><li>위 막대에서 프레임 폭(393/375)·테마·레드라인을 바꿔요. 레드라인 숫자는 화면을 그린 뒤 요소를 실측한 px라 375에서도 맞아요.</li><li>레드라인 주석(분홍)은 문서 층이라 앱 화면 위에 일부러 겹쳐요. 끄면 화면만 보여요.</li><li>티켓 그림은 960×1534 비율 자리표시예요. 무드 렌더 리뉴얼은 #826의 다른 갈래예요.</li><li>근거는 <code>evidence/</code>의 단위 파일 하나가 이 마스터의 절 하나이자 캔버스 "근거" 페이지의 보드 하나예요.</li></ul>';
} });
