/* 검증 기록(검증 기록 페이지에 그려요). 원자료: verification/render-check.json */
window.VERIFY_HTML = [
  '<p class="m-lede">2026-11-16, Aside CLI 1.26.1113.1717의 REPL(Chromium)로 이 마스터를 열고 <code>check.js</code>의 <code>MASTER_CHECK()</code>로 쟀어요. 뷰포트 393·375 × 라이트·다크 네 구성, 화면 9페이지의 모든 폰 프레임이 대상이에요.</p>',
  '<div class="m-tblw"><table class="m-tbl"><thead><tr><th>구성</th><th>프레임 크기</th><th>프레임 수</th><th>잘림 · 겹침 · 프레임 밖 · 스크롤 가림</th><th>가로 스크롤</th><th>콘솔 오류</th></tr></thead><tbody>',
  '<tr><td>393 · 라이트</td><td class="n">393×852</td><td class="n">87</td><td class="n">0</td><td>없음</td><td class="n">0</td></tr>',
  '<tr><td>393 · 다크</td><td class="n">393×852</td><td class="n">87</td><td class="n">0</td><td>없음</td><td class="n">0</td></tr>',
  '<tr><td>375 · 라이트</td><td class="n">375×812</td><td class="n">87</td><td class="n">0</td><td>없음</td><td class="n">0</td></tr>',
  '<tr><td>375 · 다크</td><td class="n">375×812</td><td class="n">87</td><td class="n">0</td><td>없음</td><td class="n">0</td></tr>',
  '</tbody></table></div>',
  '<h3>검사가 보는 것</h3><ul><li>글자 상자가 폰 프레임 밖으로 나감</li><li>말줄임 없이 잘린 글자</li><li>같은 층의 글자 상자끼리 겹침(토스트·시트·배너·선택 라벨처럼 떠 있는 층이 바탕 위에 오는 건 의도라 제외)</li><li>패널 스크롤 영역 아래로 가려진 글자</li></ul>',
  '<h3>의도된 잘림</h3><ul><li>대상 줄·옵션 줄·무드 썸네일: 가로 스크롤 줄이라 오른쪽 끝이 잘려 보여요(더 있다는 신호).</li><li>랜딩 전시의 곁 티켓: 화면 밖으로 반쯤 나가는 게 전시 구성이에요.</li><li>P-10 항목 목록: 최대 19행이라 패널 안에서 세로 스크롤해요.</li><li>레드라인(분홍)은 문서 주석 층이라 화면 위에 겹쳐요. 좁은 화면(뷰포트 ≤420)에선 프레임 오른쪽 바깥 치수 숫자가 화면 밖이라 안 보여요. 넓은 화면에서 보세요.</li></ul>',
  '<h3>검증이 아닌 것</h3><p>Aside(데스크톱 Chromium) 렌더 확인이에요. 실기기 iPhone PASS가 아니고, iOS Simulator나 헤드리스 하네스 결과도 아니에요. Android는 #585 보류라 주장하지 않아요. 키보드·공유 시트는 그림이라 실제 OS 동작을 확인하지 않았어요.</p>',
  '<p class="m-note">눈 확인 표본: <code>verification/l01-1700-dark.jpg</code>(랜딩), <code>verification/p03-1700-dark.jpg</code>(질감 펼침).</p>'
].join('');
