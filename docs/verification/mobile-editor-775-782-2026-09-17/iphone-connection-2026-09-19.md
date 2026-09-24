# 실제 iPhone Safari 연결 확인 — 2026-09-19

- CoreDevice 조회: `iPhone_BH`, `available (paired)`, 모델 `iPhone17,1`.
- Safari 인스펙터 창: `웹 인스펙터 — iPhone_BH — Safari — 192.168.0.47`.
- 원격 DOM에서 FILME 페이지와 body 402×660 CSS px 확인.
- 콘솔의 페이지 주소: `http://192.168.0.47:3712/`.
- 원격 콘솔의 읽기 전용 식으로 `innerWidth/innerHeight = 402/660`, `visualViewport.width/height = 402/660`을 확인. 이 관측만으로 숫자 키보드가 열린 상태나 #585 통과를 입증하지 않음.
- 3712 서버 PID 21181의 작업 디렉터리: `/Users/Lyainc/dev/prj/PhototicketMaker`.
- HTTP 확인: `/`는 200 HTML, `/_next/static/development/_clientMiddlewareManifest.js`는 200 JSON(`[]`).
- 콘솔에서 위 JSON 리소스의 스크립트 실행 거부(nosniff/MIME)와 `/_next/webpack-hmr` WebSocket 실패를 관찰. 앱 기능 실패 여부와 원인은 아직 확정하지 않음.

[원격 DOM 화면](iphone-inspector-2026-09-19.png) / [콘솔 화면](iphone-console-2026-09-19.png)

9월 17일의 기기 미발견 상태는 해소됨. 이번 확인은 실제 기기의 연결·페이지 로딩·원격 DOM·콘솔 관찰까지이며, 한글 조합·커서·삭제·undo·필드 선택·슬라이더·폰트·자동저장·#585 숫자 키보드 가림의 실제 조작 검증은 아직 미완료임. 연결 성공을 7개 이슈의 기기 검증 통과로 간주하지 않음.

## 사용자 실기기 확인 — #775

2026-09-19, 연결된 iPhone Safari에서 제목에 ‘영화 테스트’를 입력하고 중간 삽입·삭제·앱 되돌리기를 수행한 결과, 사용자가 “모두 정상”이라고 확인함. 확인 범위는 글자의 즉시 표시, 한글 조합, 커서, 삭제, 되돌리기임. 사용자 수동 검증 결과이며 자동 측정한 지연 시간이나 화면 녹화 증거는 아님. 다른 필드·이슈의 동작까지 일반화하지 않음.

#585 숫자 키보드 가림과 나머지 터치 검증은 아직 확인 대기.

## 사용자 실기기 확인 — 입력란과 편집 도구 가림

2026-09-19, 개봉연도 등을 예시로 든 입력란 확인 요청에 사용자가 “입력란과 편집 도구 모두 보이고 조작 가능”이라고 답함. 입력란 가림이 없다는 사용자 수동 관찰은 확보했으나, 실제 선택한 필드와 키패드 종류는 명시되지 않음.

현행 `InPlaceFieldEditor.tsx`에서 자동 `inputMode="numeric"`은 숫자만 들어 있는 러닝타임 필드에 적용됨. 개봉연도는 일반 텍스트 입력이므로, 이전 안내의 예시는 숫자 키패드를 보장하지 않았음. 사용자에게 러닝타임 120의 숫자 키패드 상태를 추가 확인하도록 요청함. #585의 숫자 키패드 조건은 이 추가 확인 전까지 미검증으로 유지함.

## 실제 iOS WebDriver 연결 시도

사용자가 자동 검증을 요청하여 설치된 Safari WebDriver를 로컬 4727 포트에서 실행하고, `platformName: iOS`, `safari:deviceName: iPhone_BH`, `safari:useSimulator: false`로 전용 세션을 요청함. 서버는 HTTP 500 `session not created`와 `iPhone_BH: Remote Automation is turned off (turn it on via Settings > Safari > Advanced > Remote Automation)`를 반환함.

실기기 자동화 경로와 구체적인 설정 차단 원인을 확인했으며, 사용자에게 아이폰의 원격 자동화 토글을 켜도록 요청함. 설정 변경이나 자동 테스트 성공을 아직 주장하지 않음. 기존 수동 확인 결과는 유지하고, 남은 조작은 설정 완료 후 WebDriver가 실제로 지원하는 명령 범위에서 자동 검증할 예정임.

## 원격 자동화 활성화 후 실행 결과

사용자가 원격 자동화를 켠 뒤 실제 iPhone_BH의 WebDriver 세션 생성에 성공함. `safari:useSimulator: false`, 플랫폼 버전 26.7, Safari 26.6.2로 보고됨. 상세 근거는 [WebDriver 결과 폴더](iphone-webdriver-2026-09-19/)에 보존함.

개발 서버에서 페이지가 초기 화면으로 돌아가는 현상이 있어, 기존 검증 빌드 `DgB7iqfFMQf27m2vdXtu_`를 별도 3713 포트에서 실행하여 후속 검사를 수행함. 기존 3712 서버는 유지함.

### 실제 Safari에서 확인한 내용

- 빈 문서의 완료 버튼 아래 `제목·연도 필요` 안내가 보임.
- 슬라이더 2개의 실제 높이 32px, 중심 위아래 15px까지 각 자기 input에 hit.
- 폰트 옵션 너비 일치, 패널 스크롤 뒤 꽃길 선택 표시와 견본의 sangSangFlowerRoad 계산 서체 확인.
- 자동저장 점·라벨의 DOM 클릭에 true→false→true 상태 전이 확인.
- 빈 문서 6개 무드의 필드 경계 5점씩 hit-test 수행. Criterion의 극장·상영관·좌석, 35mm의 원제·서명 아래 경계에서 인접 필드 hit를 발견함. 직접 선택 전부 무오탭이라는 검사는 실패했으며 이를 통과로 바꾸지 않음.
- 위 5개 필드 각각에 대해 목록 버튼 중심의 정확한 hit와 해당 입력란 연결을 별도로 확인함. Criterion 한줄평도 목록에서 입력란이 열림. 요구사항의 명확한 목록 대체 경로는 프로그램으로 확인했으나 물리 터치 통과를 뜻하지 않음.

### 자동화의 실제 한계

WebDriver의 element click, touch/mouse Actions 요청이 성공 응답을 주더라도 버튼 상태는 바뀌지 않음. FILME와 무관한 onclick 버튼 하나짜리 data URL 대조군에서도 native click 후 클릭 횟수 0을 확인함. 따라서 이를 앱 클릭 결함으로 판정하지 않음. Element Send Keys로 러닝타임에 120을 전송한 뒤에도 값은 빈 문자열이며, visualViewport는 402×660으로 유지되고 스크린샷에 네이티브 키보드가 나타나지 않음.

위 성공한 화면·상태 검사는 WebDriver execute script의 DOM .click() 및 읽기 전용 기하 측정을 사용함. 합성 클릭은 실제 손가락 터치·드래그·한글 IME·네이티브 숫자 키보드 검증을 대신하지 않음. 사용자의 #775 수동 확인은 유지하며, #585 숫자 키패드 조건과 남은 실제 터치 검증은 미완료임.

### 초안 보호

6개 무드용 localStorage 직접 덮어쓰기 시도는 자동 승인 검토에서 기존 초안 손실 위험으로 실행 전 거절됨. 이 명령은 실행하지 않았음. 이후 읽기 전용 확인으로 3713 전용 문서가 제목·개봉일 등 입력 내용이 없는 테스트 초안임을 확인하고, 기존 무드 선택 UI로만 변경해 검사함. 사용자 입력 데이터를 넣거나 저장소를 직접 덮어쓰지 않음.

## 디자인 명세 인터뷰 중 진단 재시도

기존 수정 검증을 병행하라는 사용자 요청에 따라 `safaridriver --diagnose`로 다시 세션 생성을 시도했다. 이번에는 `session not created`와 `device was disconnected`가 반환돼, 버튼·숫자 입력 대조 페이지까지 진행하지 못했다. 테스트 초안과 앱 저장소는 변경하지 않았으며, 진단용 WebDriver 서버는 종료했다. 앞서 확보한 수동 확인 결과는 유지하고, 실제 터치 및 숫자 키패드 검증은 여전히 미완료다.
