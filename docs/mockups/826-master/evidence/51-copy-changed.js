/* 바뀌거나 새로 생긴 문구. [자리, 지금, 마스터, 프레임, 잠김, 영향 테스트(__tests__ grep)] */
window.COPY_CHANGES = [
  ['완료 실패', '제목과 개봉연도가 필요해요(토스트) + 드로어', '제목과 개봉연도를 입력해 주세요 · 개봉연도를 입력해 주세요', 'E-03', '아니요', '없음(disabledReason을 문자열로 잡는 테스트 없음)'],
  ['KOBIS 로딩', 'Loading…', '검색 중…', 'K-01', '예', 'titleSheetSearch.test.tsx:292(toBe(\'Loading…\'))'],
  ['KOBIS 빈 결과', '검색 결과가 없어요. 제목을 다시 확인해 주세요.', '검색 결과가 없어요', 'K-01', '예', 'titleSheetSearch.test.tsx:349'],
  ['KOBIS 오류', '검색 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.', '검색에 실패했어요 + [다시 검색]', 'K-01', '아니요', '없음'],
  ['OCR 실패', '인식에 실패했어요. 다시 시도해 주세요.', '인식에 실패했어요', 'L-03 · E-02', '예', 'ocrFailureFlow.test.tsx:39-40'],
  ['OCR 파일 형식', 'PNG, JPG, WebP 파일만 인식할 수 있어요. 다른 파일을 골라 주세요.', 'PNG, JPG, WebP만 인식할 수 있어요', 'L-03', '아니요', '없음'],
  ['OCR HEIC · 용량', 'HEIC 파일은 지원하지 않아요. PNG/JPG로 저장해 주세요. · 파일 크기가 10MB를 초과해요. 더 작은 이미지를 골라 주세요.', 'HEIC는 지원하지 않아요 · 10MB 이하 이미지만 돼요', 'L-03', '아니요', '없음'],
  ['제목만 인식', '제목으로 영화 정보를 검색할게요.', '영화 정보 검색 중…', 'E-05', '예', 'mobileEditorShellOcrEntryConsolidation.test.tsx:151·159·301'],
  ['KOBIS 못 찾음', '영화 정보를 찾지 못했어요. 제목을 확인하고 다시 검색해 주세요.', '영화 정보를 찾지 못했어요 + [제목 확인]', 'E-05', '예', 'ocrKobisSelectionLifetime.test.tsx:343 · ocrNeedManualTitleSearch.test.tsx:106'],
  ['자동입력 배너', '{n}개 항목이 자동 입력되었어요.', '{n}개 항목을 채웠어요', 'E-05', '예', 'mobileEditorShellOcrEntryConsolidation:187 · ocrKobisSelectionLifetime:295 · ocrUndoRestore:733·737·752·780'],
  ['결과 저장 실패', '저장에 실패했어요. + 다시 시도', '저장에 실패했어요(다시 시도는 주 버튼)', 'R-01', '예', 'resultPanelShareGating.test.tsx:119 — 문자열은 그대로라 "다시 시도" 버튼 기대만 확인'],
  ['링크 실패', '링크 생성에 실패했어요. 다시 시도해 주세요.', '링크를 만들지 못했어요', 'R-02', '아니요', '없음'],
  ['링크 행 보조', '(없음)', '3일 뒤 만료', 'R-01', '—', '신규'],
  ['공유 대체', '(통보 없음)', '링크를 복사했어요', 'R-03', '—', '신규(축 4 과거형)'],
  ['크롭 오류', '이미지를 불러오지 못했어요. 다른 사진을 선택해 주세요. · 이미지 크롭에 실패했어요. 다시 시도해 주세요.', '이미지를 불러오지 못했어요 · 자르지 못했어요', 'C-03', '아니요', '없음'],
  ['크롭 버튼', '다른 사진 선택', '다른 사진', 'C-01', '예', 'posterCropPipeline.test.tsx:92·221'],
  ['크롭 비율', '원본 비율 보존(체크박스)', '원본 비율 보존(스위치)', 'C-01', '예(role)', 'logoCropFreeAspect.test.tsx:150-165(getByRole(\'checkbox\')) → switch로'],
  ['저장 공간 실패', '저장에 실패했어요. 브라우저 저장 공간이 가득 찼거나 비공개 모드일 수 있어요.', '저장 공간이 부족해 저장하지 못했어요', 'M-02', '아니요', '없음'],
  ['포스터 저장 실패', '포스터 저장에 실패했어요. 저장 공간이 찼거나 비공개 모드일 수 있어요.', '포스터를 저장하지 못했어요', 'M-02', '아니요', '없음'],
  ['포스터 복원 실패', '저장된 포스터를 불러오지 못했어요. 포스터를 다시 올려 주세요.', '저장된 포스터를 불러오지 못했어요(사진 모드에서 추가 버튼)', 'E-02 · X-01', '아니요', '없음'],
  ['추천색 실패', '추천 색상을 만들지 못했어요. 색상은 직접 골라 주세요.', '추천 색상을 만들지 못했어요', 'X-01', '예', 'errorToastPriority.test.tsx:17·39·40'],
  ['색 고정 무드', '이 무드는 톤이 고정이라 잉크 색을 바꿀 수 없어요.', '이 무드는 색이 고정돼요', 'D-02', '예', 'colorPickerLockedNoteAdjacency.test.tsx:23'],
  ['원본 없음', '포스터 원본이 없어요. 포스터를 다시 업로드해 주세요.', '원본 없음(자르기 비활성)', 'G-01', '예', 'hoverOnlyInfo.test.tsx:23'],
  ['무드 이름', 'Minimal · Criterion …(LAYOUTS.label)', '미니멀 · 크라이테리언 …', 'D-01 · L-01', '예', 'landingHeroMood.test.tsx:164·178·259·267·275·281·363·365 · landingMoodGalleryTapTargets.test.tsx:110-111'],
  ['메뉴 · 테마', '다크모드(토글)', '테마: 시스템 · 라이트 · 다크', 'M-01', '아니요', '없음("다크모드"는 주석뿐)'],
  ['메뉴 · 자동저장', '자동저장 켜짐/꺼짐(aria) + title', '자동저장(스위치) + "11:42 저장"', 'M-01', '예', 'autoSaveIndicator.test.tsx:22·42·45·51'],
  ['메뉴 · 빈 항목', '빈 항목 미리보기(스위치 이름)', '빈 항목 표시', 'M-01', '예', 'inPlaceFieldEditor:161 · mobileChromeOrder:124 · mobileEditorShellGhost:37·45'],
  ['상단 줄 · 최대화', '최대화', '전체 보기', 'E-01', '예', 'chromeDarkScope:104 · mobileChromeOrder:111 · mobileEditorShellLandscapeRotation:41 · mobileEditorShellZoom:49·61 · floatingToolbar:478'],
  ['워드마크 탭 초기화', '지금까지 작업한 내용이 사라져요. 처음 화면으로 돌아갈까요?', '(사라짐: ‹는 문서를 지우지 않음)', 'E-01', '예', 'wordmarkClearOnTap · mobileEditorShellMenu · resultStageWordmarkReset'],
  ['공유 페이지 만료', 'Next 기본 404', '만료된 링크예요', 'S-01', '—', '신규(제안)'],
  ['공유 페이지 CTA', '나도 티켓 만들기 →', '나도 티켓 만들기', 'S-01', '아니요', '없음'],
  ['도크 모드', '(없음)', '사진 · 정보 · 디자인', 'E-01', '—', '신규 라벨'],
  ['디자인 도구 · 색', '컬러(레일 버튼)', '색상(도구 줄 탭)', 'D-02', '예', 'designRail.test.tsx:114·142 · designRailCarousel.test.tsx:76·82 · designRailPanelLookup.test.tsx:26·57·70·75·82 · designRailDockStability.test.tsx:75 — 이름과 role(button → tab)이 같이 바뀌어요(2026-11-17 리뷰에서 빠진 행 보충)'],
  ['디자인 도구 · 후보정', '후보정(레일 버튼) + "후보정 축" 재질 · 코팅 세그먼트', '재질 · 코팅(도구 줄 탭 둘, 축 세그먼트 없음)', 'D-03', '예', 'designRail.test.tsx:42·115 · designRailTapTargets.test.tsx:31·34·36·40·50·69(radiogroup "후보정 축" · "재질 · 원본" 라벨 · /^코팅 ·/ 세그먼트) · designRailCarousel.test.tsx:94·103·121 · designRailDockStability.test.tsx:77 · sliderDragThrottle.test.tsx:126 — 2026-11-17 시각 감사로 질감 한 도구를 둘로 나눴어요(2라운드 리뷰로 줄 보충)'],
  ['정보 행 빈 값', '비어 있음(드로어)', '비어 있음 · 필수', 'I-01', '아니요', '없음'],
  ['사진 행', '(없음)', '포스터 · 극장 로고 · 포맷 로고 · 배경 스탬프 / 교체 · 자르기 · 추가 · 이미지로', 'G-01', '—', '신규 라벨'],
  ['포스터 복원 중', '(셸 전체 대기)', '포스터 불러오는 중…', 'E-02', '—', '신규(축 4 진행)'],
  ['랜딩 고지 접기', '(고지 두 줄 상시 노출)', '이용 고지(접힘, 누르면 펼침 · 고지 문구는 그대로)', 'L-01~L-03', '예(존재)', 'appFooterNotice.test.tsx:38·42·47 — queryByText는 접힌 details 안의 글자도 찾아서 통과해요. "이용 고지" 문자열은 __tests__·src에 없음(신규 라벨)']
];
EV({ id: 'copy-changed', page: 'copy', title: '바뀌거나 새로 생긴 문구', html: function () {
  var esc = PR.esc;
  return '<h3>바뀌거나 새로 생긴 문구</h3><p class="m-note">"신규" 행은 src에 없는 새 문구예요. 영향 테스트 열은 __tests__를 grep한 결과예요.</p>' +
    EV_TBL(['자리', '지금', '마스터', '프레임', '잠김', '영향 테스트'], window.COPY_CHANGES.map(function (r) { return [r[0], esc(r[1]), '<b>' + esc(r[2]) + '</b>', r[3], r[4], esc(r[5])]; }), [null, null, null, 'n']);
} });
