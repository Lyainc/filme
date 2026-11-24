/* 현재 기능 52개와 요구사항 6개가 마스터 어디로 갔는지 대조표. */
window.TRACE = [
  {
    "id": "l_carousel",
    "group": "랜딩",
    "name": "무드 전시(5종) + 자동 전환",
    "now": "Landing MoodCarousel, 정지 버튼, 포커스·포인터 일시정지, 동작 줄이기면 그리드",
    "fate": "형태 변경",
    "frames": [
      "L-01"
    ],
    "comps": [
      "C-CAR"
    ],
    "where": "랜딩 L-01 큰 가운데 카드 + 양옆 0.82배 엿보기. 4초마다 자동으로 넘어가고, 누르거나 포커스하면 멈춰요. 고른 카드에 재단 표시, 아래에 5칸 진행 막대.",
    "why": "소유자 결정으로 정지 버튼을 없앴고, S9(D25-12)가 기둥 · 위치 표시를 큰 카드 + 진행 막대로 바꿨어요."
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
    "where": "가로 스와이프는 그대로고, 길게 눌러 늦추기는 누르는 동안 멈추기로 바뀌었어요.",
    "why": "숨은 늦추기 제스처를 누르고 있으면 멈추는 동작 하나로 합쳤어요."
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
    "where": "동작 줄이기면 자동 전환 없이 3열 격자로 전부 보여 줘요(L-01.2).",
    "why": ""
  },
  {
    "id": "l_card_enter",
    "group": "랜딩",
    "name": "카드 탭 → 그 무드 고르기",
    "now": "onEnterMood → startFreshDoc({layout})",
    "fate": "형태 변경",
    "frames": [
      "L-01"
    ],
    "comps": [
      "C-CAR"
    ],
    "where": "카드 탭은 진입이 아니라 고르기예요(L-01). 진입은 아래 \"직접 입력\"(고른 무드) · 첨부 시트 \"만들기\"가 맡아요.",
    "why": "S9가 카드 탭을 고르기로 바꿨어요(소유자 승인)."
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
    "fate": "형태 변경",
    "frames": [
      "L-01",
      "L-03"
    ],
    "comps": [
      "C-BTN",
      "C-TST"
    ],
    "where": "랜딩 주 버튼 \"티켓 스크린샷으로 자동입력\"이 첨부 시트(L-03)를 열고, 시트의 \"티켓 스크린샷\" 행이 인식을 시작해 행 안에 상태를 보여요.",
    "why": "S9가 인식 진행 · 오류를 토스트에서 첨부 시트 행으로 옮겼어요."
  },
  {
    "id": "l_poster",
    "group": "랜딩",
    "name": "포스터 넣기(첨부 시트)",
    "now": "랜딩 링크 → 파일 선택 → 크롭 → 새 문서",
    "fate": "형태 변경",
    "frames": [
      "L-03"
    ],
    "comps": [
      "C-BTN"
    ],
    "where": "링크 쌍이 없어지고 첨부 시트(L-03) \"포스터\" 행이 파일 선택 → 크롭을 열어요. 넣으면 썸네일이 뜨고 \"만들기\"가 켜져요.",
    "why": "S9가 링크 쌍을 걷고 시트 한 곳으로 모았어요."
  },
  {
    "id": "l_noposter",
    "group": "랜딩",
    "name": "직접 입력",
    "now": "startFreshDoc() 후 닫기, 테스트가 문구 잠금",
    "fate": "형태 변경",
    "frames": [
      "L-01",
      "L-02"
    ],
    "comps": [
      "C-BTN"
    ],
    "where": "랜딩 아래 \"직접 입력\" 버튼(주 버튼과 같은 높이, 테두리형)이 고른 무드의 빈 티켓으로 가요.",
    "why": "S9가 \"포스터 없이 직접 입력\" 링크를 \"직접 입력\" 버튼으로 바꿨어요(잠금 해제 승인)."
  },
  {
    "id": "l_drop",
    "group": "랜딩",
    "name": "포스터 드래그앤드롭",
    "now": "랜딩 + 편집 캔버스 posterDropProps",
    "fate": "제거",
    "frames": [],
    "comps": [],
    "where": "모바일에는 드롭 영역이 없어요. 포스터는 사진 모드와 랜딩 업로드로 넣어요.",
    "why": "모바일 전용 결정(데스크톱 범위 밖)이라 드래그앤드롭은 없어졌고, 포스터 업로드/사진 모드 추가가 대신해요."
  },
  {
    "id": "l_copy",
    "group": "랜딩",
    "name": "헤드라인·서브 카피",
    "now": "h1 \"티켓 한 장이, 내 굿즈가 돼요\" + 서브",
    "fate": "제거",
    "frames": [],
    "comps": [],
    "where": "랜딩에 카피가 없어요. 워드마크 줄 바로 아래에 큰 티켓이 서요.",
    "why": "S9(D25-12)가 헤드라인 · 서브 · 기둥 · 아래 판을 걷었어요(소유자 결정)."
  },
  {
    "id": "l_footer",
    "group": "랜딩",
    "name": "비공식 고지·크레딧(이용 고지)",
    "now": "AppFooter ambient(랜딩 전용)",
    "fate": "형태 변경",
    "frames": [
      "L-01"
    ],
    "comps": [
      "C-WM"
    ],
    "where": "워드마크 줄 오른쪽 끝 \"이용 고지\" 글자 버튼이 작은 시트를 열어요(고지 문구 · 글꼴 크레딧 · GitHub, 문구는 그대로).",
    "why": "S9가 접힌 줄을 시트로 옮겼어요(소유자 결정 2026-11-24)."
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
    "where": "상단 ‹는 문서를 두고 랜딩으로 돌아가요. 지우기는 메뉴 초기화 2탭뿐이에요.",
    "why": "탭 한 번에 지우던 위험을 없앴어요. 확인 문구가 사라져 wordmarkClearOnTap, mobileEditorShellMenu, resultStageWordmarkReset 테스트를 고쳐야 해요."
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
      "C-IROW",
      "C-TAG"
    ],
    "where": "상단 오른쪽 \"완료\"예요. 필수가 비면 E-03처럼 정보 모드의 앰버 행으로 안내해요.",
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
      "I-01",
      "M-01"
    ],
    "comps": [
      "C-IROW",
      "C-SWT"
    ],
    "where": "정보 모드에서 자동으로 켜지고, 메뉴 M-01의 \"빈 항목 표시\" 스위치로도 바꿔요.",
    "why": "편집 중 강제 on을 정보 모드 자동 켜짐과 메뉴 스위치로 나눴어요."
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
      "G-01"
    ],
    "comps": [
      "C-AROW",
      "C-BTN"
    ],
    "where": "메뉴에서 사진 모드 G-01의 포스터 행 \"교체\"로 옮겼어요.",
    "why": "포스터 교체를 이미지 자산을 모은 사진 모드로 합쳤어요."
  },
  {
    "id": "c_recrop",
    "group": "편집 chrome",
    "name": "재크롭(원본 있을 때)",
    "now": "햄버거 메뉴, 크기 패널",
    "fate": "형태 변경",
    "frames": [
      "G-01",
      "C-01"
    ],
    "comps": [
      "C-AROW",
      "C-DLG"
    ],
    "where": "사진 모드 G-01의 포스터 행 \"자르기\"에서 크롭 C-01을 열어요.",
    "why": "메뉴 항목이던 걸 사진 모드 포스터 행으로 모았어요."
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
    "where": "메뉴 M-01의 \"임시저장\"이고 결과는 M-02 토스트로 알려요.",
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
    "where": "실행 취소와 다시 실행이 상단 줄 아이콘 둘이고, 통보는 E-06이에요.",
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
      "C-TB",
      "C-STAGE"
    ],
    "where": "상단 줄 \"전체 보기\"가 E-04를 열고, 티켓을 누르면 돌아와요.",
    "why": "플로팅 툴바가 없어져 상단 줄로 옮겼어요."
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
      "I-01"
    ],
    "comps": [
      "C-TB",
      "C-DOCK",
      "C-IROW"
    ],
    "where": "undo/redo/전체 보기는 상단 줄, 항목 목록은 정보 모드 I-01로 갔어요.",
    "why": "화면을 덮고 위치 설정이 필요하던 떠 있는 층을 걷어 냈어요."
  },
  {
    "id": "d_mood",
    "group": "dock / 꾸미기",
    "name": "무드 6종 선택",
    "now": "DesignRail 무드 → LayoutStrip",
    "fate": "유지",
    "frames": [
      "D-01"
    ],
    "comps": [
      "C-MOOD",
      "C-TOOLS"
    ],
    "where": "디자인 모드 D-01의 무드 썸네일 6장이에요.",
    "why": ""
  },
  {
    "id": "d_color",
    "group": "dock / 꾸미기",
    "name": "잉크색(프리셋·추천색·직접 지정, 고정 무드 잠금)",
    "now": "DesignRail 컬러 → ColorPicker",
    "fate": "유지",
    "frames": [
      "D-02"
    ],
    "comps": [
      "C-SW",
      "C-TOOLS"
    ],
    "where": "디자인 모드 D-02의 색상이고, 고정색 무드는 견본이 비활성이에요.",
    "why": ""
  },
  {
    "id": "d_texture",
    "group": "dock / 꾸미기",
    "name": "재질·코팅 + 강도",
    "now": "DesignRail 후보정",
    "fate": "유지",
    "frames": [
      "D-03"
    ],
    "comps": [
      "C-OPT",
      "C-SL"
    ],
    "where": "디자인 모드 D-03에서 재질·코팅을 하나씩 보고 강도를 조절해요.",
    "why": ""
  },
  {
    "id": "d_opacity",
    "group": "dock / 꾸미기",
    "name": "포스터·컴포넌트 투명도",
    "now": "DesignRail 투명도",
    "fate": "유지",
    "frames": [
      "D-04"
    ],
    "comps": [
      "C-SL"
    ],
    "where": "디자인 모드 D-04의 포스터/글자·로고 투명도 슬라이더예요.",
    "why": ""
  },
  {
    "id": "d_posterfit",
    "group": "dock / 꾸미기",
    "name": "포스터 채우기(minimal만)",
    "now": "DesignRail 크기 → 포스터",
    "fate": "유지",
    "frames": [
      "D-05"
    ],
    "comps": [
      "C-OPT"
    ],
    "where": "디자인 모드 D-05의 포스터 채우기이고 미니멀에서만 보여요.",
    "why": ""
  },
  {
    "id": "d_logosize",
    "group": "dock / 꾸미기",
    "name": "극장·포맷 로고 크기",
    "now": "DesignRail 크기 → 로고",
    "fate": "유지",
    "frames": [
      "D-05"
    ],
    "comps": [
      "C-SL"
    ],
    "where": "디자인 모드 D-05의 로고 크기 슬라이더예요.",
    "why": ""
  },
  {
    "id": "d_stamp",
    "group": "dock / 꾸미기",
    "name": "배경 스탬프 이미지(editorial·criterion·stub)",
    "now": "DesignRail 스탬프",
    "fate": "형태 변경",
    "frames": [
      "G-01"
    ],
    "comps": [
      "C-AROW",
      "C-BTN"
    ],
    "where": "배경 스탬프가 사진 모드 G-01의 행으로 옮겨졌고 해당 무드에서만 보여요.",
    "why": "스탬프는 이미지 자산이라 사진 모드로 모았어요."
  },
  {
    "id": "d_fonts",
    "group": "dock / 꾸미기",
    "name": "한줄평·서명 서체 9종",
    "now": "DesignRail 커스텀",
    "fate": "형태 변경",
    "frames": [
      "K-06"
    ],
    "comps": [
      "C-ACC",
      "C-INP"
    ],
    "where": "서체 9종은 서명·한줄평 입력 K-06의 칩 한 줄로 옮겨졌어요.",
    "why": "드로어와 툴바가 없어져 필드 입력 패널의 옵션 칩이 맡아요."
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
      "C-INP"
    ],
    "where": "슬라이더 값을 탭하면 K-03의 16px 숫자 입력이 열려요.",
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
      "K-01"
    ],
    "comps": [
      "C-SEL",
      "C-INP"
    ],
    "where": "티켓 필드를 탭하면 바로 키보드 입력 패널이 열려요.",
    "why": ""
  },
  {
    "id": "f_drawer",
    "group": "필드 편집",
    "name": "티켓 항목 목록(드로어 + 핸들)",
    "now": "FieldDrawer, 가장자리 핸들·스와이프",
    "fate": "형태 변경",
    "frames": [
      "I-01"
    ],
    "comps": [
      "C-IROW",
      "C-DOCK"
    ],
    "where": "정보 모드 I-01의 항목 목록이 FieldDrawer를 대신해요.",
    "why": "핸들과 스와이프 드로어를 도크의 정보 모드 하나로 합쳤어요."
  },
  {
    "id": "f_visibility",
    "group": "필드 편집",
    "name": "필드별 표시 토글 + 전체 표시",
    "now": "드로어 눈 토글, 전체 표시 스위치, 인플레이스 노출 스위치",
    "fate": "유지",
    "frames": [
      "I-01"
    ],
    "comps": [
      "C-IROW",
      "C-SWT"
    ],
    "where": "정보 행 오른쪽 눈 토글로 항목별 표시를 조절해요.",
    "why": ""
  },
  {
    "id": "f_missing",
    "group": "필드 편집",
    "name": "필수 누락 안내(제목·개봉연도)",
    "now": "드로어 상단 안내 + 바로가기",
    "fate": "유지",
    "frames": [
      "E-03",
      "E-02"
    ],
    "comps": [
      "C-TAG",
      "C-IROW"
    ],
    "where": "필수 행의 앰버 표시와 완료 실패 시 E-03 토스트로 알려요.",
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
      "K-04",
      "K-08"
    ],
    "comps": [
      "C-INP",
      "C-KBD",
      "C-FLD"
    ],
    "where": "티켓 위 입력 대신 키보드 위 입력 패널에서 고치고, 이전/다음으로 넘어가요.",
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
      "C-INP"
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
      "K-05"
    ],
    "comps": [
      "C-STAR",
      "C-INP"
    ],
    "where": "평점 입력 K-05의 별점이고 0.1 단위는 키패드로 넣어요.",
    "why": ""
  },
  {
    "id": "f_dates",
    "group": "필드 편집",
    "name": "관람일·개봉일(정밀도·표기·재개봉)",
    "now": "DateSheet",
    "fate": "형태 변경",
    "frames": [
      "K-04"
    ],
    "comps": [
      "C-INP",
      "C-ACC"
    ],
    "where": "날짜 시트가 날짜 입력 K-04로 옮겨졌고 표기·정밀도·재개봉은 칩이에요.",
    "why": "시트가 없어져 입력 패널의 칩 한 줄로 합쳤어요."
  },
  {
    "id": "f_logos",
    "group": "필드 편집",
    "name": "극장·포맷 로고(텍스트/이미지·업로드·자르기)",
    "now": "드로어 로고 섹션, 인플레이스",
    "fate": "유지",
    "frames": [
      "G-01",
      "K-07",
      "C-02"
    ],
    "comps": [
      "C-AROW",
      "C-INP",
      "C-DLG"
    ],
    "where": "사진 모드 G-01에서 올리고 K-07에서 텍스트를 고치고 C-02에서 잘라요.",
    "why": ""
  },
  {
    "id": "f_signature",
    "group": "필드 편집",
    "name": "서명(텍스트/이미지)",
    "now": "인플레이스 로고 이미지 버튼",
    "fate": "유지",
    "frames": [
      "K-06",
      "C-02"
    ],
    "comps": [
      "C-INP",
      "C-ACC",
      "C-DLG"
    ],
    "where": "서명·한줄평 입력 K-06의 \"이미지로\" 전환이고 C-02에서 잘라요.",
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
    "where": "랜딩 L-03, 빈 편집 E-02의 정보 모드 버튼, 메뉴 M-01에서 시작해요.",
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
      "G-01",
      "K-06"
    ],
    "comps": [
      "C-AROW",
      "C-BTN"
    ],
    "where": "사진 모드 G-01과 서명 K-06에서 이미지를 \"제거\"해요.",
    "why": ""
  },
  {
    "id": "r_save",
    "group": "결과",
    "name": "저장(Web Share·다운로드)",
    "now": "ResultPanel",
    "fate": "유지",
    "frames": [
      "R-01"
    ],
    "comps": [
      "C-BTN",
      "C-TB"
    ],
    "where": "결과 R-01의 [저장](강조)으로 저장하고, 성공은 위쪽 통보 \"저장했어요\", 실패는 화면 안 경고 한 줄이에요.",
    "why": ""
  },
  {
    "id": "r_link",
    "group": "결과",
    "name": "링크·복사·만료 안내",
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
    "where": "결과 R-02의 [링크]가 만들고 바로 복사해요. 클립보드가 거부될 때만 16px 대체 링크 칸이 뜨고, 만료 문장은 링크가 생긴 뒤 고지 위에 붙어요.",
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
    "where": "결과 R-01의 [공유]가 링크가 없으면 먼저 만들고 OS 시트(R-03)로 보내요. 공유 API가 없으면 복사하고 위쪽 통보예요.",
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
    "where": "공유 페이지 S-01. 만료 · 없는 링크는 404와 함께 빈 상태 \"만료된 링크예요\" + [나도 티켓 만들기]예요(S7 출시).",
    "why": "Next 기본 404 대신 만료 빈 상태를 두고, 기본 CTA에서 화살표를 뺐어요."
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
    "how": "버튼 없이 자동 재생해요. 누르거나 포커스하면 멈추고 동작 줄이기면 격자예요(WCAG 2.2.2 발견성 위험).",
    "name": "자동 재생 정지 수단"
  },
  {
    "id": "slider",
    "frames": [
      "D-03",
      "D-04",
      "D-05",
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
      "K-04",
      "K-05",
      "K-06",
      "K-07",
      "R-02"
    ],
    "comps": [
      "C-FLD",
      "C-INP"
    ],
    "how": "모든 입력 필드가 16px 이상이라 iOS 포커스 확대가 일어나지 않아요.",
    "name": "입력 글꼴 16px 이상"
  },
  {
    "id": "keyboard",
    "frames": [
      "K-01",
      "K-02",
      "K-03",
      "K-04",
      "K-05",
      "K-06",
      "K-07",
      "K-08"
    ],
    "comps": [
      "C-INP",
      "C-KBD"
    ],
    "how": "키보드 위 입력 패널에 라벨과 입력이 보이고 프리뷰가 남으며 닫으면 K-08처럼 복원돼요.",
    "name": "키보드 노출·복원 3조건"
  },
  {
    "id": "smallfield",
    "frames": [
      "E-01",
      "I-01",
      "K-02"
    ],
    "comps": [
      "C-SEL",
      "C-IROW",
      "C-INP"
    ],
    "how": "필드를 직접 탭하고(44px), 오탭이면 정보 목록과 입력 머리의 이전/다음으로 복구해요.",
    "name": "작은 필드 직접 터치"
  },
  {
    "id": "exportmatch",
    "frames": [
      "E-04",
      "R-01"
    ],
    "comps": [
      "C-SEL",
      "C-STAGE"
    ],
    "how": "빈 항목·선택 표시를 끈 같은 렌더러를 저장해서 저장물에 섞이지 않아요.",
    "name": "저장물과 프리뷰 일치"
  }
];
