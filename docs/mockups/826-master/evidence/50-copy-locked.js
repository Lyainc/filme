/* 테스트가 잠근 문구가 마스터에서 어떻게 됐는지. [문구, 마스터(HTML), 프레임] */
window.COPY_LOCKED = [
  ['포스터 업로드 · 포스터 없이 직접 입력', '<span class="gone">사라짐</span>: S9가 링크 쌍을 걷고 "직접 입력" 버튼 · 첨부 시트 "포스터" 행으로 대체(소유자 승인 2026-11-24). 영향 테스트 9개는 S9 커밋에서 고쳐요', 'L-01~L-03'],
  ['티켓 스크린샷으로 자동입력 · 스크린샷으로 자동입력', '그대로', 'L-01 · L-02 · E-02 · M-01'],
  ['지금 요청이 많아요… · 인식된 정보가 없어요…', '그대로', 'L-03'],
  ['한 번 더 눌러 전체 삭제 · 임시저장했어요', '그대로', 'M-01 · M-02'],
  ['초기화했어요', '그대로', 'M-01'],
  ['최대화(버튼 이름)', '<span class="gone">바뀜</span>: "전체 보기". 영향 chromeDarkScope:104 · mobileChromeOrder:111 · mobileEditorShellLandscapeRotation:41 · mobileEditorShellZoom:49·61 · floatingToolbar:478', 'E-01 · E-04'],
  ['빈 항목 미리보기(스위치 이름)', '<span class="gone">바뀜</span>: 패널 머리 토글 버튼 "빈 항목". 영향 inPlaceFieldEditor:161 · mobileChromeOrder:124 · mobileEditorShellGhost:37·45', 'E-01'],
  ['지금까지 작업한 내용이 사라져요…', '<span class="gone">사라짐</span>: 워드마크 탭 초기화를 ‹(문서 보존)로 대체. 영향 테스트 wordmarkClearOnTap · mobileEditorShellMenu · resultStageWordmarkReset를 같은 커밋에서 고쳐야 해요', 'E-01']
];
EV({ id: 'copy-locked', page: 'copy', title: '테스트가 잠근 문구', html: function () {
  return '<p class="m-lede">docs/COPY_TONE_GUIDE.md의 라벨 규칙(조건절·종결어미·마침표 없음)을 지키고, 결정 8에 따라 설명성 안내를 걷어 냈어요. 실패는 무슨 일 한 줄이고 다음 행동은 화면의 버튼이 맡아요(축 3 개정이 필요해 미결로 둠). 두 표에 없는 문구는 현행 그대로 옮겼어요. 각 프레임 옆에도 그 프레임의 문구 변경이 붙어 있어요.</p>' +
    '<h3>테스트가 잠근 문구</h3>' + EV_TBL(['문구', '마스터', '프레임'], window.COPY_LOCKED, [null, null, 'n']);
} });
