/* 현재 기능 52개와 요구사항 6개가 마스터 어디로 갔는지 대조표. */
window.TRACE = [
  {
    "id": "l_carousel",
    "group": "랜딩",
    "name": "무드 캐러셀(5종) + 정지/재개",
    "now": "Landing MoodCarousel, 정지 버튼, 포커스·포인터 일시정지, 동작 줄이기면 그리드",
    "fate": "유지",
    "frames": [
      "L-01"
    ],
    "comps": [
      "C-CAR"
    ],
    "where": "랜딩 L-01 전시. 정지/재생 버튼 · 포커스·포인터 일시정지 · 동작 줄이기 격자를 그대로 옮겼어요.",
    "why": ""
  },
  {
    "id": "l_gesture",
    "group": "랜딩",
    "name": "캐러셀 스와이프·길게 눌러 늦추기",
    "now": "MoodCarousel 가로 스와이프(여러 칸), 길게 누르면 전환이 느려지고 떼도 진입 안 함",
    "fate": "형태 변경",
    "frames": [
      "L-01"
    ],
    "comps": [
      "C-CAR"
    ],
    "where": "가로 스와이프는 그대로 두고 길게 누르기는 정지 버튼이 맡아요.",
    "why": "길게 누르기가 숨은 제스처라 보이는 정지 버튼으로 바꿨어요."
  },
  {
    "id": "l_reduced",
    "group": "랜딩",
    "name": "동작 줄이기 설정이면 그리드 배치",
    "now": "prefers-reduced-motion → 줄바꿈 그리드로 전부 표시",
    "fate": "유지",
    "frames": [
      "L-01"
    ],
    "comps": [
      "C-CAR"
    ],
    "where": "동작 줄이기면 자동 전환을 멈추고 카드를 모두 보여 줘요.",
    "why": ""
  },
  {
    "id": "l_card_enter",
    "group": "랜딩",
    "name": "캐러셀 카드 탭 → 그 무드로 시작",
    "now": "onEnterMood → startFreshDoc({layout})",
    "fate": "유지",
    "frames": [
      "L-01"
    ],
    "comps": [
      "C-CAR"
    ],
    "where": "전시 카드를 탭하면 그 무드로 새 문서를 열어요.",
    "why": ""
  },
  {
    "id": "l_restore",
    "group": "랜딩",
    "name": "이어서 만들기 — {제목}",
    "now": "landing-restore 버튼, 저장된 draft 열기",
    "fate": "유지",
    "frames": [
      "L-02"
    ],
    "comps": [
      "C-RES"
    ],
    "where": "랜딩 L-02의 \"이어서 만들기\" 행이 저장본을 열어요.",
    "why": ""
  },
  {
    "id": "l_ocr",
    "group": "랜딩",
    "name": "티켓 스크린샷 자동입력(주 CTA)",
    "now": "OcrUploadCard context=landing",
    "fate": "유지",
    "frames": [
      "L-01",
      "L-03"
    ],
    "comps": [
      "C-BTN",
      "C-TST"
    ],
    "where": "랜딩 주 CTA가 스크린샷 인식을 시작하고 L-03에서 진행돼요.",
    "why": ""
  },
  {
    "id": "l_poster",
    "group": "랜딩",
    "name": "포스터 업로드",
    "now": "랜딩 링크 → 파일 선택 → 크롭 → 새 문서",
    "fate": "유지",
    "frames": [
      "L-01"
    ],
    "comps": [
      "C-LNK"
    ],
    "where": "랜딩 링크 쌍 왼쪽 \"포스터 업로드\"로 그대로 있어요.",
    "why": ""
  },
  {
    "id": "l_noposter",
    "group": "랜딩",
    "name": "포스터 없이 직접 입력",
    "now": "startFreshDoc() 후 닫기, 테스트가 문구 잠금",
    "fate": "유지",
    "frames": [
      "L-01"
    ],
    "comps": [
      "C-LNK"
    ],
    "where": "랜딩 링크 쌍 오른쪽 \"포스터 없이 직접 입력\"으로 그대로 있어요.",
    "why": ""
  },
  {
    "id": "l_drop",
    "group": "랜딩",
    "name": "포스터 드래그앤드롭",
    "now": "랜딩 + 편집 캔버스 posterDropProps",
    "fate": "유지",
    "frames": [
      "L-04",
      "E-01"
    ],
    "comps": [
      "C-CAR",
      "C-STAGE"
    ],
    "where": "랜딩 L-04와 편집 E-01의 티켓 영역이 드롭 영역이에요.",
    "why": ""
  },
  {
    "id": "l_copy",
    "group": "랜딩",
    "name": "헤드라인·서브 카피",
    "now": "h1 \"티켓 한 장이, 내 굿즈가 돼요\" + 서브",
    "fate": "유지",
    "frames": [
      "L-01"
    ],
    "comps": [
      "C-WM"
    ],
    "where": "랜딩 카피는 브랜드 예외로 그대로 두었어요.",
    "why": ""
  },
  {
    "id": "l_footer",
    "group": "랜딩",
    "name": "비공식 고지·크레딧 푸터",
    "now": "AppFooter ambient(랜딩 전용)",
    "fate": "유지",
    "frames": [
      "L-01"
    ],
    "comps": [
      "C-WM"
    ],
    "where": "비공식 고지 푸터는 랜딩 L-01 패널에 그대로 있어요.",
    "why": ""
  },
  {
    "id": "c_wordmark_reset",
    "group": "편집 chrome",
    "name": "워드마크 탭 → 처음 화면(초기화 확인)",
    "now": "window.confirm 후 performClear",
    "fate": "형태 변경",
    "frames": [
      "E-01",
      "M-01"
    ],
    "comps": [
      "C-TB",
      "C-MENU"
    ],
    "where": "상단 ‹로 랜딩에 돌아가고 문서는 보존돼요. 지우기는 메뉴에 있어요.",
    "why": "탭 한 번에 지우던 위험을 없앴어요. \"지금까지 작업한 내용이 사라져요…\" 확인 문구가 사라져 wordmarkClearOnTap, mobileEditorShellMenu, resultStageWordmarkReset 테스트를 고쳐야 해요."
  },
  {
    "id": "c_autosave",
    "group": "편집 chrome",
    "name": "자동저장 스위치",
    "now": "AutoSaveIndicator(헤더)",
    "fate": "형태 변경",
    "frames": [
      "M-01"
    ],
    "comps": [
      "C-MENU",
      "C-SWT"
    ],
    "where": "자동 저장 스위치가 헤더에서 메뉴 M-01로 옮겨졌어요.",
    "why": "헤더 공간을 비우려고 메뉴로 옮겼어요."
  },
  {
    "id": "c_done",
    "group": "편집 chrome",
    "name": "완료(제목·개봉연도 검증)",
    "now": "handleDone, 실패 시 토스트 + 드로어",
    "fate": "유지",
    "frames": [
      "E-01",
      "E-03"
    ],
    "comps": [
      "C-TB",
      "C-FLD",
      "C-TAG"
    ],
    "where": "상단 오른쪽 \"완료\"예요. 필수가 비면 E-03처럼 그 필드로 안내해요.",
    "why": ""
  },
  {
    "id": "c_theme",
    "group": "편집 chrome",
    "name": "다크모드",
    "now": "햄버거 메뉴 토글",
    "fate": "형태 변경",
    "frames": [
      "M-01"
    ],
    "comps": [
      "C-MENU",
      "C-SEG"
    ],
    "where": "메뉴 M-01의 시스템/라이트/다크 세그먼트로 바뀌었어요.",
    "why": "토글 하나에서 시스템 설정 따르기까지 고르게 확장했어요."
  },
  {
    "id": "c_ghost",
    "group": "편집 chrome",
    "name": "빈 항목 미리보기(ghost)",
    "now": "햄버거 메뉴 토글, 편집 중 강제 on",
    "fate": "형태 변경",
    "frames": [
      "E-01",
      "P-01"
    ],
    "comps": [
      "C-PH",
      "C-BTN"
    ],
    "where": "티켓 패널 머리의 \"빈 항목\" 토글이에요. 필드 선택 중엔 자동으로 켜져요.",
    "why": "메뉴 깊숙한 토글을 쓰는 자리 옆으로 옮겼어요."
  },
  {
    "id": "c_advanced",
    "group": "편집 chrome",
    "name": "고급 설정(툴바 배치·핸들 위치)",
    "now": "AdvancedSettingsModal",
    "fate": "제거",
    "frames": [],
    "comps": [],
    "where": "툴바 배치와 핸들 위치를 정할 대상이 없어졌어요.",
    "why": "떠 있는 툴바와 드로어 핸들을 없애서 설정할 것이 남지 않았어요."
  },
  {
    "id": "c_poster_replace",
    "group": "편집 chrome",
    "name": "포스터 추가/교체",
    "now": "햄버거 메뉴, 빈 포스터 탭",
    "fate": "형태 변경",
    "frames": [
      "P-04",
      "M-01"
    ],
    "comps": [
      "C-PH",
      "C-BTN",
      "C-MENU"
    ],
    "where": "포스터 대상 P-04의 \"교체\"와 메뉴 M-01에서 바꿔요.",
    "why": "포스터 대상 패널로 합쳤어요."
  },
  {
    "id": "c_recrop",
    "group": "편집 chrome",
    "name": "재크롭(원본 있을 때)",
    "now": "햄버거 메뉴, 크기 패널",
    "fate": "형태 변경",
    "frames": [
      "P-04",
      "C-01"
    ],
    "comps": [
      "C-BTN",
      "C-DLG"
    ],
    "where": "포스터 대상 P-04의 \"자르기\"에서 크롭 C-01을 열어요.",
    "why": "메뉴 항목이던 걸 포스터 대상 패널로 모았어요."
  },
  {
    "id": "c_savedraft",
    "group": "편집 chrome",
    "name": "수동 임시저장",
    "now": "햄버거 메뉴, 토스트",
    "fate": "유지",
    "frames": [
      "M-01",
      "M-02"
    ],
    "comps": [
      "C-MENU",
      "C-TST"
    ],
    "where": "메뉴 M-01의 \"임시저장\"이고 결과는 M-02 토스트(\"임시저장했어요\")로 알려요.",
    "why": ""
  },
  {
    "id": "c_reset",
    "group": "편집 chrome",
    "name": "초기화(2탭 arm)",
    "now": "햄버거 메뉴, #374 문구 잠금",
    "fate": "유지",
    "frames": [
      "M-01"
    ],
    "comps": [
      "C-MENU"
    ],
    "where": "메뉴 M-01의 \"초기화\"가 2탭 arm과 잠긴 문구를 그대로 지켜요.",
    "why": ""
  },
  {
    "id": "c_undo",
    "group": "편집 chrome",
    "name": "실행 취소/다시 실행",
    "now": "플로팅 툴바 버튼",
    "fate": "형태 변경",
    "frames": [
      "E-01",
      "E-06"
    ],
    "comps": [
      "C-TB",
      "C-TST"
    ],
    "where": "실행 취소와 다시 실행이 상단 줄의 두 아이콘으로 올라갔어요.",
    "why": "플로팅 툴바가 없어져 상단 줄로 옮겼어요."
  },
  {
    "id": "c_max",
    "group": "편집 chrome",
    "name": "최대화(전체 보기)",
    "now": "플로팅 툴바 \"최대화\", 가로 무드 회전",
    "fate": "형태 변경",
    "frames": [
      "E-04",
      "E-01"
    ],
    "comps": [
      "C-STAGE",
      "C-PH"
    ],
    "where": "티켓 패널 머리의 \"전체 보기\"가 E-04를 열어요.",
    "why": "플로팅 툴바가 없어져 패널 머리로 옮겼어요."
  },
  {
    "id": "c_toolbar",
    "group": "편집 chrome",
    "name": "플로팅 툴바(배치 4종·드래그·숨김)",
    "now": "FloatingToolbar, localStorage filme:toolbar:v1",
    "fate": "제거",
    "frames": [
      "E-01",
      "E-04",
      "P-10"
    ],
    "comps": [
      "C-TB",
      "C-PH",
      "C-TABS"
    ],
    "where": "undo/redo는 상단 줄, 전체 보기는 패널 머리, 항목 목록은 P-10으로 갔어요.",
    "why": "화면을 덮고 위치 설정이 필요하던 떠 있는 층을 걷어 냈어요."
  },
  {
    "id": "d_mood",
    "group": "dock / 꾸미기",
    "name": "무드 6종 선택",
    "now": "DesignRail 무드 → LayoutStrip",
    "fate": "유지",
    "frames": [
      "P-01"
    ],
    "comps": [
      "C-MOOD",
      "C-TABS"
    ],
    "where": "티켓 대상 \"디자인\" 탭의 무드 썸네일이에요.",
    "why": ""
  },
  {
    "id": "d_color",
    "group": "dock / 꾸미기",
    "name": "잉크색(프리셋·추천색·직접 지정, 고정 무드 잠금)",
    "now": "DesignRail 컬러 → ColorPicker",
    "fate": "유지",
    "frames": [
      "P-02"
    ],
    "comps": [
      "C-SW"
    ],
    "where": "티켓 대상 \"색상\" 탭이에요. 고정색 무드는 잠금 안내가 나와요.",
    "why": ""
  },
  {
    "id": "d_texture",
    "group": "dock / 꾸미기",
    "name": "재질·코팅 + 강도",
    "now": "DesignRail 후보정",
    "fate": "유지",
    "frames": [
      "P-03"
    ],
    "comps": [
      "C-OPT",
      "C-SL"
    ],
    "where": "티켓 대상 \"질감\" 탭의 재질·코팅과 강도 슬라이더예요.",
    "why": ""
  },
  {
    "id": "d_opacity",
    "group": "dock / 꾸미기",
    "name": "포스터·컴포넌트 투명도",
    "now": "DesignRail 투명도",
    "fate": "유지",
    "frames": [
      "P-03",
      "P-04"
    ],
    "comps": [
      "C-SL"
    ],
    "where": "질감 탭과 포스터 대상 P-04의 슬라이더로 조절해요.",
    "why": ""
  },
  {
    "id": "d_posterfit",
    "group": "dock / 꾸미기",
    "name": "포스터 채우기(minimal만)",
    "now": "DesignRail 크기 → 포스터",
    "fate": "유지",
    "frames": [
      "P-04"
    ],
    "comps": [
      "C-OPT"
    ],
    "where": "포스터 대상 P-04의 맞춤/채우기이고 minimal에서만 보여요.",
    "why": ""
  },
  {
    "id": "d_logosize",
    "group": "dock / 꾸미기",
    "name": "극장·포맷 로고 크기",
    "now": "DesignRail 크기 → 로고",
    "fate": "유지",
    "frames": [
      "P-05"
    ],
    "comps": [
      "C-SL"
    ],
    "where": "로고 대상 P-05의 크기 슬라이더예요.",
    "why": ""
  },
  {
    "id": "d_stamp",
    "group": "dock / 꾸미기",
    "name": "배경 스탬프 이미지(editorial·criterion·stub)",
    "now": "DesignRail 스탬프",
    "fate": "유지",
    "frames": [
      "P-01"
    ],
    "comps": [
      "C-OPT"
    ],
    "where": "티켓 대상 디자인 탭의 스탬프 행이고 해당 무드에서만 보여요.",
    "why": ""
  },
  {
    "id": "d_fonts",
    "group": "dock / 꾸미기",
    "name": "한줄평·서명 서체 9종",
    "now": "DesignRail 커스텀",
    "fate": "형태 변경",
    "frames": [
      "P-09"
    ],
    "comps": [
      "C-OPT",
      "C-PH"
    ],
    "where": "서체는 서명·한줄평 대상 패널 P-09로 옮겨졌어요. 옵션 라벨은 각 서체로 그려요.",
    "why": "드로어와 툴바가 없어져 필드 대상 패널이 맡아요."
  },
  {
    "id": "d_percent",
    "group": "dock / 꾸미기",
    "name": "% 직접 입력",
    "now": "BrightnessSlider 텍스트 필드",
    "fate": "유지",
    "frames": [
      "K-03"
    ],
    "comps": [
      "C-SL",
      "C-FLD"
    ],
    "where": "슬라이더 값을 탭하면 K-03의 16px 입력이 열려요.",
    "why": ""
  },
  {
    "id": "f_tap",
    "group": "필드 편집",
    "name": "티켓 필드 직접 탭",
    "now": "data-field-tap → 인플레이스 편집",
    "fate": "유지",
    "frames": [
      "E-01",
      "P-06"
    ],
    "comps": [
      "C-SEL",
      "C-PANEL"
    ],
    "where": "티켓 필드를 탭하면 패널이 그 필드 대상으로 바뀌어요.",
    "why": ""
  },
  {
    "id": "f_drawer",
    "group": "필드 편집",
    "name": "티켓 항목 목록(드로어 + 핸들)",
    "now": "FieldDrawer, 가장자리 핸들·스와이프",
    "fate": "형태 변경",
    "frames": [
      "P-10"
    ],
    "comps": [
      "C-TABS",
      "C-LIST"
    ],
    "where": "티켓 대상의 4번째 탭 \"항목\" P-10이 FieldDrawer를 대신해요.",
    "why": "핸들과 스와이프 드로어를 패널 탭 하나로 합쳤어요."
  },
  {
    "id": "f_visibility",
    "group": "필드 편집",
    "name": "필드별 표시 토글 + 전체 표시",
    "now": "드로어 눈 토글, 전체 표시 스위치, 인플레이스 노출 스위치",
    "fate": "유지",
    "frames": [
      "P-10",
      "P-06"
    ],
    "comps": [
      "C-SWT",
      "C-LIST"
    ],
    "where": "필드 눈 토글과 항목 목록 P-10의 일괄 표시로 조절해요.",
    "why": ""
  },
  {
    "id": "f_missing",
    "group": "필드 편집",
    "name": "필수 누락 안내(제목·개봉연도)",
    "now": "드로어 상단 안내 + 바로가기",
    "fate": "유지",
    "frames": [
      "E-03"
    ],
    "comps": [
      "C-TAG",
      "C-FLD"
    ],
    "where": "필수 태그와 완료 실패 시 E-03 안내로 알려요.",
    "why": ""
  },
  {
    "id": "f_inplace",
    "group": "필드 편집",
    "name": "인플레이스 입력 + 이전/다음 항목",
    "now": "InPlaceFieldEditor, 1.08배 확대",
    "fate": "형태 변경",
    "frames": [
      "K-01",
      "K-02",
      "K-04"
    ],
    "comps": [
      "C-PANEL",
      "C-FLD",
      "C-KBD"
    ],
    "where": "티켓 위 입력 대신 키보드 위 입력 패널에서 고치고 닫으면 복원돼요.",
    "why": "티켓 위 투명 입력이 글꼴과 가림 문제를 만들어서 패널로 바꿨어요."
  },
  {
    "id": "f_kobis",
    "group": "필드 편집",
    "name": "제목 KOBIS 검색",
    "now": "인플레이스 aid 패널 KobisResultList",
    "fate": "유지",
    "frames": [
      "K-01"
    ],
    "comps": [
      "C-LIST",
      "C-FLD"
    ],
    "where": "제목 입력 K-01 아래에 KOBIS 결과 목록이 떠요.",
    "why": ""
  },
  {
    "id": "f_rating",
    "group": "필드 편집",
    "name": "평점(별·0.1 단위)",
    "now": "RatingPicker",
    "fate": "유지",
    "frames": [
      "P-07"
    ],
    "comps": [
      "C-STAR"
    ],
    "where": "평점 대상 P-07의 별점이에요.",
    "why": ""
  },
  {
    "id": "f_dates",
    "group": "필드 편집",
    "name": "관람일·개봉일(정밀도·표기·재개봉)",
    "now": "DateSheet",
    "fate": "형태 변경",
    "frames": [
      "P-08"
    ],
    "comps": [
      "C-FLD",
      "C-OPT"
    ],
    "where": "날짜 시트가 날짜 대상 패널 P-08로 옮겨졌어요.",
    "why": "시트가 없어져 패널 대상으로 합쳤어요."
  },
  {
    "id": "f_logos",
    "group": "필드 편집",
    "name": "극장·포맷 로고(텍스트/이미지·업로드·자르기)",
    "now": "드로어 로고 섹션, 인플레이스",
    "fate": "유지",
    "frames": [
      "P-05",
      "C-02"
    ],
    "comps": [
      "C-OPT",
      "C-FLD",
      "C-DLG"
    ],
    "where": "로고 대상 P-05에서 올리고 C-02에서 잘라요.",
    "why": ""
  },
  {
    "id": "f_signature",
    "group": "필드 편집",
    "name": "서명(텍스트/이미지)",
    "now": "인플레이스 로고 이미지 버튼",
    "fate": "유지",
    "frames": [
      "P-09",
      "C-02"
    ],
    "comps": [
      "C-OPT",
      "C-FLD",
      "C-DLG"
    ],
    "where": "서명·한줄평 대상 P-09의 텍스트/이미지 전환이에요.",
    "why": ""
  },
  {
    "id": "f_ocr_drawer",
    "group": "필드 편집",
    "name": "업로드 후 OCR 진입점",
    "now": "드로어 상단 OcrUploadCard",
    "fate": "형태 변경",
    "frames": [
      "L-03",
      "E-02",
      "M-01"
    ],
    "comps": [
      "C-BTN",
      "C-MENU"
    ],
    "where": "랜딩 L-03, 빈 편집 E-02, 메뉴 M-01에서 시작해요.",
    "why": "드로어 상단 카드가 없어져 진입점 세 곳으로 나눴어요."
  },
  {
    "id": "f_ocr_undo",
    "group": "필드 편집",
    "name": "OCR 되돌리기 배너",
    "now": "OcrUndoBanner 되돌리기/확인",
    "fate": "유지",
    "frames": [
      "E-05"
    ],
    "comps": [
      "C-BNR",
      "C-TAG"
    ],
    "where": "자동입력 결과 E-05의 배너에서 되돌리기와 확인을 눌러요.",
    "why": ""
  },
  {
    "id": "f_crop_ratio",
    "group": "필드 편집",
    "name": "포스터 크롭 \"원본 비율 보존\"",
    "now": "ImageCropModal 체크박스(켜면 자유비, 끄면 0.667/1.5 표준)",
    "fate": "형태 변경",
    "frames": [
      "C-01"
    ],
    "comps": [
      "C-DLG",
      "C-SWT"
    ],
    "where": "크롭 C-01의 \"원본 비율 보존\"이 스위치로 바뀌었어요.",
    "why": "체크박스를 다른 컨트롤과 같은 스위치로 통일했어요."
  },
  {
    "id": "f_image_remove",
    "group": "필드 편집",
    "name": "로고·서명·스탬프 이미지 제거",
    "now": "InPlaceFieldEditor·designRailItems \"이미지 제거\"",
    "fate": "유지",
    "frames": [
      "P-01",
      "P-05",
      "P-09"
    ],
    "comps": [
      "C-BTN"
    ],
    "where": "스탬프 P-01, 로고 P-05, 서명 P-09에서 \"제거\"해요.",
    "why": ""
  },
  {
    "id": "r_save",
    "group": "결과",
    "name": "사진에 저장(Web Share·다운로드)",
    "now": "ResultPanel",
    "fate": "유지",
    "frames": [
      "R-01"
    ],
    "comps": [
      "C-BTN",
      "C-TB"
    ],
    "where": "결과 R-01의 주 버튼으로 사진에 저장해요.",
    "why": ""
  },
  {
    "id": "r_link",
    "group": "결과",
    "name": "링크 만들기·복사·만료 안내",
    "now": "ResultPanel 링크 패널",
    "fate": "유지",
    "frames": [
      "R-02"
    ],
    "comps": [
      "C-FLD",
      "C-BTN",
      "C-ALR"
    ],
    "where": "결과 R-02의 링크 행에서 만들고 복사하고 만료를 안내해요.",
    "why": ""
  },
  {
    "id": "r_share",
    "group": "결과",
    "name": "공유(텍스트 + 링크)",
    "now": "navigator.share",
    "fate": "유지",
    "frames": [
      "R-01",
      "R-03"
    ],
    "comps": [
      "C-BTN",
      "C-TST"
    ],
    "where": "결과 R-01에서 공유하고 OS 시트 진행은 R-03이에요.",
    "why": ""
  },
  {
    "id": "r_back",
    "group": "결과",
    "name": "편집으로 돌아가기(+브라우저 뒤로)",
    "now": "ResultStage 뒤로, popstate",
    "fate": "유지",
    "frames": [
      "R-01"
    ],
    "comps": [
      "C-TB"
    ],
    "where": "상단 ‹로 편집에 돌아가고 브라우저 뒤로도 같아요.",
    "why": ""
  },
  {
    "id": "r_sharepage",
    "group": "결과",
    "name": "/t/[id] 공유 페이지",
    "now": "pages/t/[id].tsx",
    "fate": "형태 변경",
    "frames": [
      "S-01"
    ],
    "comps": [
      "C-WM",
      "C-BTN"
    ],
    "where": "공유 페이지 S-01이 범위에 들어왔고 만료 상태를 제안해요.",
    "why": "범위 밖이던 화면에 만료 상태를 새로 제안했어요."
  }
];
window.REQ_TRACE = [
  {
    "id": "autoplay",
    "frames": [
      "L-01"
    ],
    "comps": [
      "C-CAR"
    ],
    "how": "랜딩 전시에 정지/재생 버튼이 있고 포커스·포인터 진입 시 멈추며 동작 줄이기면 정지해요.",
    "name": "자동 재생 정지 수단"
  },
  {
    "id": "slider",
    "frames": [
      "P-03",
      "P-04",
      "K-03"
    ],
    "comps": [
      "C-SL"
    ],
    "how": "모든 슬라이더 트랙이 32px 이상이고 트랙에서 시작한 드래그로도 값이 바뀌어요.",
    "name": "슬라이더 트랙 32px와 트랙 드래그"
  },
  {
    "id": "font16",
    "frames": [
      "K-01",
      "K-02",
      "K-03",
      "P-08"
    ],
    "comps": [
      "C-FLD"
    ],
    "how": "모든 입력 필드가 16px 이상이라 iOS 포커스 확대가 일어나지 않아요.",
    "name": "입력 글꼴 16px 이상"
  },
  {
    "id": "keyboard",
    "frames": [
      "K-01",
      "K-02",
      "K-04"
    ],
    "comps": [
      "C-PANEL",
      "C-KBD"
    ],
    "how": "키보드 위 입력 패널에 라벨과 입력이 보이고 프리뷰가 남으며 닫으면 K-04처럼 복원돼요.",
    "name": "키보드 노출·복원 3조건"
  },
  {
    "id": "smallfield",
    "frames": [
      "E-01",
      "P-06",
      "P-10"
    ],
    "comps": [
      "C-SEL",
      "C-TRAIL",
      "C-PH",
      "C-LIST"
    ],
    "how": "필드를 직접 탭해 고르고(hit area 최소 44), 오탭이면 패널 머리의 이전/다음(P-06)이나 대상 줄, 항목 목록(P-10)으로 바로 복구해요.",
    "name": "작은 필드 직접 터치"
  },
  {
    "id": "exportmatch",
    "frames": [
      "E-04",
      "R-01"
    ],
    "comps": [
      "C-STAGE"
    ],
    "how": "ghost를 끈 같은 렌더러를 저장하고 선택 표시는 티켓 바깥 오버레이라 저장물에 섞이지 않아요.",
    "name": "저장물과 프리뷰 일치"
  }
];
