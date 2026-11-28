# #826 S8 — iOS Simulator 캠페인 (2026-11-27)

Seed [`docs/specs/826-s8-device-verification.yaml`](../../../specs/826-s8-device-verification.yaml)(기준 `7d9bb678`)의 **Simulator 배정 행 중 T01 · T03 · T04 · T06 · T07 · T12**(acceptance-1 · 3 · 4 · 6 · 7 · 12)를 실행한 기록이에요. 실기기(iPhone_BH) 행과 T11(iPhone SE 3세대 Simulator 없음)은 이번 실행의 범위 밖이라 UNRUN으로 남겼어요.

> **iOS Simulator PASS는 실기기 PASS가 아니에요.** 이 문서의 PASS는 모두 "Simulator PASS(실기기 아님)"이에요(Seed constraint-1). 실제 iPhone Safari 판정은 실기기 행(T02 · T05 · T08~T10 · T13~T20)이 따로 해요. Android 커버리지는 주장하지 않아요(constraint-2).

## 실행 환경

- 실행자 / 날짜: Claude Code 세션(자동화), 2026-11-27 02:20~05:20 KST
- 대상 URL / 빌드: `http://localhost:3038/`, 워크트리 `.claude/worktrees/826-s8-sim`에서 `bun run build && bun run start --port 3038`로 새로 띄운 prod 서버(빌드 ID `zObvPUMwzxolTk6PhNQX0`). 빌드한 `src`는 커밋 **`6791a2f455a4c5cea6efeb14af4643aa4b852c69`**과 같아요(그 뒤 커밋은 Seed · 스크립트 · 문서만 바꿔요). 착수 base는 `7d9bb67857fd06b3f43ca193ff9af74903e91df6`(origin/main). 서버 재기동 뒤 HTML의 buildId로 stale 서버가 아님을 확인했어요(docs/HARNESS.md 8절).
- 기기: **iPhone 18 Pro Simulator · iOS 27.0**(24A434, UDID `0E3F59D2-…`), Mobile Safari 27.0(UA `Version/27.0`), 402×714 CSS px, DPR 3, 세로. Xcode 27.2(27B52).
  - **기기 변경**: Seed가 정한 iOS 27.1에선 iPhone 18 Pro를 만들 수 없어요(`xcrun simctl create … iPhone-18-Pro iOS-27-1` → `Incompatible device`, 27.1 런타임은 iPhone Duo만 지원). 소유자가 같은 기종 · 바로 아래 OS인 27.0을 골랐고, Seed의 기기 표기를 그 사실로 고쳤어요(`1c93243b`).
- 도구: Appium 3.8.0 + XCUITest driver 12.19.1. 탭 · 드래그 · 핀치는 **XCTest 합성 터치**(NATIVE_APP W3C pointer)만 판정에 썼고(constraint-5), 상태 준비 · 측정은 WEBVIEW JS예요. Safari 콘텐츠 원점(62pt)은 touchstart clientY로 이 기기에서 다시 쟀어요.
- 소프트웨어 키보드: 입력 포커스 때 `XCUIElementTypeKeyboard`(402×226)가 뜨고 visualViewport 높이가 714 → 410/411로 줄어든 상태에서만 키보드 항목을 판정했어요.
- 입력: README 공통 입력(짧은 · 긴 입력), 포스터 A `sample-bus.jpg`, 스탬프 B `sample-crossing.jpg`(constraint-7). run777의 옛 시드(실제 영화 · 극장명)는 공통 입력으로 바꿨어요.
- 스크립트: `scripts/ios-sim/` — 이 브랜치의 최종 버전으로 전 항목을 처음부터 다시 돌린 결과예요. 종료 코드는 `evidence/exit.txt`(일괄 실행 + run768 계열 · run585 크라이테리언 보충 실행). 기기 모델 · iOS · 빌드는 각 JSON이 아니라 이 절이 기록이에요(`826s4-ios.json`엔 `simctl list devices booted` 문자열만 있어요). 증거는 `evidence/<항목>/`의 JSON · 로그 원본과 줄인 스크린샷(JPEG)이에요. 경로의 `$FILME_SIM_DIR`은 로컬 출력 폴더예요.

## 결과 (T01~T21)

| ID | 배정 | 결과 | 기기 · iOS · 빌드 | 증거 · 사유 |
|---|---|---|---|---|
| T01 | Simulator | **PASS(Simulator, 실기기 아님)** | iPhone 18 Pro · 27.0 · `6791a2f4` | [아래 T01](#t01--768-저장-jpeg--프리뷰-s01s16) · `evidence/768/` |
| T02 | 실기기 | UNRUN | — | 이번 실행 범위 밖(iPhone_BH 수동) |
| T03 | Simulator | **PASS(Simulator, 실기기 아님)** | iPhone 18 Pro · 27.0 · `6791a2f4` | [아래 T03](#t03--777-필드-직접-탭) · `evidence/777/` |
| T04 | Simulator | **PASS(Simulator, 실기기 아님)** | iPhone 18 Pro · 27.0 · `6791a2f4` | [아래 T04](#t04--779-슬라이더) · `evidence/779/` |
| T05 | 실기기 | UNRUN | — | 이번 실행 범위 밖 |
| T06 | Simulator | **PASS(Simulator, 실기기 아님)** | iPhone 18 Pro · 27.0 · `6791a2f4` | [아래 T06](#t06--입력-16px--확대-없음-run585-재작성) · `evidence/585/` |
| T07 | Simulator | **PASS(Simulator, 실기기 아님)** — 뒤로는 평점 패널 + Safari 툴바 경로만 | iPhone 18 Pro · 27.0 · `6791a2f4` | [아래 T07](#t07--키보드와-편집-화면-노출--복원) · `evidence/826s4/` — 텍스트 필드 + 키보드의 뒤로(엣지 스와이프)는 Simulator에서 실패해 실기기 T09 몫 |
| T08 | 실기기 | UNRUN | — | 이번 실행 범위 밖 |
| T09 | 실기기 | UNRUN | — | 이번 실행 범위 밖(참고: Simulator에선 텍스트 필드 + 키보드 상태의 엣지 스와이프가 패널을 닫지 못했어요 — T07 back-A) |
| T10 | 실기기 | UNRUN | — | 이번 실행 범위 밖 |
| T11 | Simulator | UNRUN | — | Seed의 iPhone SE 3세대 · iOS 27.1은 만들 수 없어요(27.1 런타임은 iPhone Duo만 지원, SE 3세대는 27.0까지). constraint-4 대체 규칙의 적용 여부를 정하지 않은 채 소유자가 이번 범위에서 뺐어요 |
| T12 | Simulator | **BLOCKED** | iPhone 18 Pro · 27.0 · `6791a2f4` | [아래 T12](#t12--랜딩-걷힘-240ms-동안의-탭) · `evidence/826s12/` — XCTest로 걷힘 창 안에 두 번째 탭을 보낼 수 없음 |
| T13~T20 | 실기기 | UNRUN | — | 이번 실행 범위 밖 |
| T21 | 위험 수용 | 위험 수용 | — | VoiceOver 미검증 · 위험 수용(2026-11-26 소유자) |

집계(이번 실행 6행): Simulator PASS 5(T01 · T03 · T04 · T06 · T07) · BLOCKED 1(T12) · FAIL 0. 실기기 PASS 0.

### T01 — #768 저장 JPEG = 프리뷰, S01~S16

`run768.py`(16칸) → `stamp768.py` → `compare768.py`. 셀마다 편집 프리뷰(ghost 끔, 디자인 모드)와 사진 앱 DCIM에서 꺼낸 저장 원본(1960×3108)을 티켓 경계로 맞춰 나란히 놓고 사람이 봤어요.

| 셀 | 섹션 · 포스터 · 입력 | 스탬프(자리 표준편차 / 종이) | 프리뷰-저장 평균 차 | [저장] 시도 | 판정 |
|---|---|---|---|---|---|
| S01 | 둘 다 · 있음 · 짧은 | 78.9 / 8.7 | 2.18 | 3 | PASS |
| S02 | 둘 다 · 있음 · 긴 | 80.3 / 8.7 | 4.46 | 2 | PASS |
| S03 | 둘 다 · 없음 · 짧은 | 78.9 / 8.7 | 2.06 | 3 | PASS |
| S04 | 둘 다 · 없음 · 긴 | 80.3 / 8.7 | 3.47 | 2 | PASS |
| S05 | Admission만 · 있음 · 짧은 | 79.4 / 8.7 | 1.89 | 3 | PASS |
| S06 | Admission만 · 있음 · 긴 | 80.4 / 8.7 | 3.00 | 2 | PASS |
| S07 | Admission만 · 없음 · 짧은 | 79.4 / 8.7 | 1.46 | 3 | PASS |
| S08 | Admission만 · 없음 · 긴 | 80.4 / 8.7 | 2.53 | 2 | PASS |
| S09 | Film만 · 있음 · 짧은 | 79.4 / 8.7 | 1.91 | 3 | PASS |
| S10 | Film만 · 있음 · 긴 | 80.4 / 8.7 | 3.18 | 2 | PASS |
| S11 | Film만 · 없음 · 짧은 | 79.4 / 8.7 | 1.52 | 3 | PASS |
| S12 | Film만 · 없음 · 긴 | 80.4 / 8.7 | 2.86 | 2 | PASS |
| S13 | 둘 다 끔 · 있음 · 짧은 | 79.4 / 8.7 | 1.57 | 3 | PASS |
| S14 | 둘 다 끔 · 있음 · 긴 | 80.3 / 8.7 | 2.66 | 2 | PASS |
| S15 | 둘 다 끔 · 없음 · 짧은 | 79.4 / 8.7 | 2.23 | 3 | PASS |
| S16 | 둘 다 끔 · 없음 · 긴 | 80.3 / 8.7 | 1.95 | 2 | PASS |

- 16칸 모두 스탬프 · 글자 누락 · 잘림 · 겹침 · 배치 불일치 0이에요(`S??-compare.jpg`의 차이 그림엔 축소 재표본화로 생긴 글자 테두리만 있어요). 셀 안 조작(원제 표시 끔→켬, 제목 짧은→긴→원래, 스탬프 크기 1→1.5, 전체 보기 진입 · 복귀) 뒤 편집 화면의 스탬프-글자 겹침도 16칸 모두 0이에요(`768-ios.json`의 `textOverlap`).
- **[저장] 첫 시도가 16칸 모두 실패했어요("저장하지 못했어요").** 2~3번째 시도에서 공유 시트가 떠서 저장본을 얻었어요. 이 행의 판정 축(저장물 = 프리뷰)과는 별개의 결함이라 [발견 1](#발견-1--저장이-ios-27-simulator에서-자주-실패-858에서-수정--simulator-재검증)에 따로 적었어요.
- 하네스 수정: 정보 모드는 '빈 항목 표시'가 항상 켜져(#826 S2) 로고 · 포맷 자리표시 줄만큼 티켓이 밀려요. 편집 화면은 디자인 모드에서 찍게 고쳤고, 비교 스크립트의 맞춤 폭 탐색 범위를 새 프리뷰(약 243pt)까지 넓혔어요.

### T03 — #777 필드 직접 탭

`run777.py light` · `run777.py dark` · `run777rest.py`. 필드마다 보이는 부분의 중심 · 안쪽 위 2px · 안쪽 아래 2px를 탭하고, 열린 입력 패널(`data-field-panel`)과 **포커스된 입력의 aria-label**을 라벨표와 대조했어요(평점은 숫자 버튼이라 포커스 입력 없음).

- 6무드 × 라이트 · 다크: 필드 **88개씩 전부 OK, 오탭 0**(`777-light.log` · `777-dark.log`). 셸 크롬(상단 줄 · 도크)에 가린 필드 0.
- 복구 경로: 정보 모드 탭 · 정보 목록 행(26~28개) · '이전 항목' · '다음 항목'(6무드 × 두 테마), 제목 편집 뒤 실행 취소(6무드 × 두 테마 — 다크 미니멀은 보충 실행 `777-rest-minimal-dark-extras.json`) 모두 동작.
- 전체 보기: 전체 보기 안에선 필드 탭 타깃이 0이고(설계), 티켓을 누르면 기본 크기로 돌아와요. Safari 핀치 4.2배 확대 뒤 상영관 탭 → 상영관 패널 · 포커스 '상영관'.
- 한계: 손가락 접촉 면적은 포인터 한 점으로 재현되지 않아요(Seed acceptance-3).
- 관찰(사용성, 마스터로): 공통 입력 **긴 입력**의 미니멀에선 상영관이 Venue 칸 말줄임 뒤로 통째로 잘려 티켓에서 보이지 않아요(`777-ios-light-long-minimal.json`의 `hidden`, `777-minimal-light-start-long.jpg`). 보이지 않는 필드라 탭 판정에서 빼고 따로 적었어요.

### T04 — #779 슬라이더

`run779.py light` · `run779.py dark`. 도크 디자인 '투명도' 도구의 '포스터' 슬라이더(32px 터치 박스).

| 경우 | 라이트 | 다크 |
|---|---|---|
| 트랙 25% 탭(중심 · ±10px · ±14px, 5종) | 50 → 20, 5/5 | 50 → 20, 5/5 |
| 트랙에서 시작한 드래그 25%→80% | 50 → 80 | 50 → 80 |
| thumb 드래그 → 80% | 50 → 80 | 50 → 80 |
| % 입력 37 → 실행 취소 | 37 → 50, 확대 1 | 37 → 50, 확대 1 |
| 드래그 뒤 실행 취소 | 80 → 50 | 80 → 50 |

트랙 중심 ±14px 탭이 값을 바꾸고 트랙 시작 드래그가 값을 바꿔요 → PASS.

### T06 — 입력 16px · 확대 없음 (run585 재작성)

`run585.py`를 도크 탭(`#dock-mode-tab-design` → `#design-tool-tab-<id>`)과 % 입력 패널, 정보 모드 필드 입력 순회로 다시 썼어요(#841).

- % 입력 6종(포스터 · 컴포넌트 · 재질 강도 · 코팅 강도 · 극장 로고 크기 · 포맷 로고 크기) × 종료(키보드 '완료' · 바깥 탭) = **12/12 PASS**: 포커스 뒤 visualViewport.scale 1, 입력 font-size 16px, 입력 100% 보임, 친 값이 슬라이더에 커밋, 종료 뒤 도크 · 프리뷰 rect 그대로.
- 필드 입력 한 바퀴(순회는 그 무드가 그린 필드만 돌아요. 평점은 소수 입력을 열어서): '직접 입력' 기본 무드 **14/14 PASS**(`585-ios.json`, 한줄평을 안 그리는 무드), 한줄평까지 그리는 크라이테리언 **15/15 PASS**(`585-ios-fields-criterion.json`, `run585.py fields=크라이테리언`). 모든 단계 scale 1, 16px, 패널 100% 보임, 문서 스크롤 0. 소프트웨어 키보드는 텍스트 · 숫자 입력 단계에서 떠 있었고, 날짜 · 시간 단계는 iOS 선택기라 키보드가 없어요(제목 첫 단계는 측정 순간 키보드가 아직 올라오기 전이었어요 — scale · 16px 판정엔 영향 없음).
- 관찰(사용성, 마스터로): 개봉일 · 관람일 · 관람 시간에 오면 iOS가 달력 · 시간 선택기를 자동으로 띄워 티켓을 덮고, ›를 두 번 눌러야 다음으로 가요(`585-ios.json`의 `nextTapsNeeded: 2`, `bugs/date-picker-covers-ticket.jpg`).

### T07 — 키보드와 편집 화면 노출 · 복원

`run826s4.py`(극장 필드) · `run826s4.py back`(평점 패널).

| 경로 | 입력 · 패널 보임 | 프리뷰 노출 | 종료 뒤 transform 항등 · 도크 · 프리뷰 rect · 탭 | 값 보존 | 판정 |
|---|---|---|---|---|---|
| 닫기(XCTest) | 100% | 108px(24%) | 예 | 예 | PASS |
| 키보드 '완료'(XCTest) | 100% | 350px(76%) | 예 | 예 | PASS |
| 바깥 탭(XCTest) | 100% | 350px(76%) | 예 | 예 | PASS |
| 뒤로 — 평점 패널 + Safari 툴바 '뒤로'(XCTest) | 패널 100% | 459px(100%) | 예(URL · history 토큰도 정리) | — | PASS |

- 텍스트 필드 + 키보드 상태의 뒤로는 Simulator에서 엣지 스와이프(dragFromToForDuration · W3C 포인터)가 패널을 닫지 못했고, 툴바는 키보드에 가려 누를 수 없었어요(`826s4-back.json` A). 이 조합은 Seed가 실기기 T09로 넘긴 몫이에요. 기본 실행의 d-back은 WebDriver back(터치 아님)이라 판정에 쓰지 않았어요.

### T12 — 랜딩 걷힘 240ms 동안의 탭

`run826s12.py`. **BLOCKED** — 측정 절차의 "'직접 입력' 탭 직후 50 · 120 · 200ms의 XCTest 탭"을 이 하네스로 보낼 수 없어요.

- 탭을 따로 보내면 첫 click → 두 번째 touchstart가 최소 **349ms**(창 240ms 밖). 이 양성 대조 탭은 제목 패널을 열고 디자인 탭을 골라 탭 자리는 유효해요.
- 한 손가락 액션 묶음에 누름 둘 → XCUITest가 중간의 손 떼기를 무시해 드래그 하나가 됐어요. 손가락 둘을 시간 오프셋으로 → iOS가 핀치로 받아 화면이 확대됐어요(scale 1.8~3.9).
- 구조 증거(판정 아님): '직접 입력' click 순간부터 랜딩은 `pointer-events:none`이고, 50ms(랜딩 불투명도 0.48) 시점에 그 자리의 hit-test가 이미 아래 편집 화면의 제목 필드 · 디자인 탭이에요(`826s12-ios.json`의 `hitTest`). 걷힘 동안의 탭이 아래로 통과할 가능성이 높아 마스터에 결정 항목으로 올렸어요.
- 재개 조건: 240ms 안에 두 번째 탭을 보낼 수 있는 수단(사람의 시뮬레이터 직접 조작은 시각을 맞출 수 없어요) 또는 소유자가 측정 방법을 바꾸는 Seed 수정.

## 발견과 처리

권한: 소유자 지시(2026-11-27 세션) "이번세션에서 발견된 에러나 버그 중에 UXUI나 유저 사용성과 관련된건 내가 의사결정할 수 있도록 마스터에 반영해줘. 그 외에 코드레벨에서의 버그는 바로 수정해도 좋아." — Seed constraint-6("앱 코드는 바꾸지 않는다")보다 넓은 이 지시로 아래 수정 1건을 했어요.

### 수정 — 입력 패널 ‹ › 전환에서 패널이 키보드 뒤로 감 (`6791a2f4`)

키보드가 떠 있는 채 '다음 항목'으로 제목 → 원제로 가면 새 입력의 autoFocus에 Safari가 문서를 176px 스크롤해, 프레임 기준 fixed 패널이 키보드 · 액세서리 바 뒤로 밀렸어요(`bugs/panel-behind-keyboard-before-fix.jpg`). 그 자리를 누르면 패널이 닫혔어요. 패널 입력의 마운트 포커스를 `focus({ preventScroll: true })`로 바꿨어요(같은 기기 plain 176 → 0, 키보드 유지). 회귀 테스트 `__tests__/panelFocusNoScroll.test.tsx`, `bun run typecheck` · `lint` · `test`(1583 pass / 0 fail) exit 0. T06 필드 순회의 `noDocScroll` · `allPanelVisible`이 기기 축 확인이에요.

### 발견 1 — [저장]이 iOS 27 Simulator에서 자주 실패 (#858에서 수정 · Simulator 재검증)

- 현상: 결과 화면 [저장] → "저장하지 못했어요". 같은 결과 화면 새로 열기 5회 중 4회(`save/768-save-activation.json`), T01 16칸은 첫 시도 16/16 실패.
- 원인까지 본 것: 캡처(약 0.75초) 뒤 부르는 `navigator.share`가 `NotAllowedError`. 실패한 회차는 클릭 뒤 0.1~0.2초에 이미 `navigator.userActivation.isActive`가 false였어요(성공 회차는 share 순간까지 true). fetch 완료와는 무관했고, 활성을 끈 API는 좁히지 못했어요.
- 재현: 결과 화면에서 [저장] XCTest 탭 → 0.8초 뒤 경고(`bugs/save-not-allowed-alert.jpg`). 제때 불리면 시트가 정상으로 떠요(`bugs/save-sheet-when-in-time.jpg`). 마지막 정상 상태: 2026-10-21 캠페인(iPhone 17 Pro · iOS 26.5)에선 저장이 됐어요.
- 후속 조사(#858, 2026-11-28): 실패는 **새로 연 페이지의 첫 [저장]**에 몰려요(9/10, 같은 페이지 2회차 이후 11/11 성공). 캡처를 미리 한 번 돌려 두면 첫 탭이 4/4 성공했고, 페이지 JS 호출 중 활성을 끈 것은 없었어요(원인 API 미특정). 배제한 가설과 원자료: `save/858-probe/REPORT.md`.
- 처리: 고치는 방식(결과 화면 진입 때 미리 캡처 vs 거절 뒤 "다시 눌러 저장")이 동작 설계라 마스터 "소유자에게 묻는 것"에 올렸어요. [공유]도 같은 구조예요. 실기기 재현은 T02 · T17에서 확인해요. 새 이슈 #858로 넘겼어요(acceptance-23).
- 수정(#858, 2026-11-28, 소유자 결정 ①): 결과 화면에 들어올 때 저장본을 미리 캡처하고 [저장]은 클릭 안에서 바로 share해요. 빌드 `7537nMbskCHE_4wG-bJ2y`(`13ce425c`)에서 새 페이지 [저장] 첫 탭 **10/10 시트**(share는 클릭 뒤 0~1ms, 활성 true · `save/858-verify/858-ios.json`), `run768.py` S01~S16 `saveAttempts` **모두 1**(`save/858-verify/768-ios-after-858.json`). [공유] 첫 탭은 로컬에 Blob 토큰이 없어 링크 발급에서 멈춰(0/3, "링크를 만들지 못했어요") share 단계를 재지 못했어요. Simulator 결과이고 실기기 결과가 아니에요.
- 하네스 기록: 첫 실행(`save/858-verify/858-ios-run1-harness-errors.json`)은 탭 전 단계에서 Appium 연결이 3번 끊겨 판정 회차가 모자랐어요(정상 회차 [저장] 8/8 시트). `run858.py`를 탭 전 단계만 다시 하게 고친 두 번째 실행이 위 10/10이에요. [공유] 축은 마스터 '소유자에게 묻는 것'에 따로 올렸어요.

### 마스터에 올린 사용성 결정 4건

`docs/mockups/826-master/evidence/05-questions.js`("소유자에게 묻는 것"): ① [저장] 실패 처리 방식 ② 랜딩 걷힘 중 탭을 막을지(T12) ③ 미니멀 긴 극장명에서 상영관이 잘려 사라짐(T03) ④ ‹ › 순회 중 날짜 · 시간 필드의 iOS 선택기(T06).

### 하네스 수정(앱 아님)

- `sim.vv()`: iOS 27.0은 핀치 확대 때 `scrollX`와 `visualViewport.offsetLeft`를 같은 값으로 줘서, 보이는 영역 원점을 `pageLeft − scrollX`로 바꿨어요(옛 식은 탭이 화면 밖으로 나갔어요).
- WebKit 원격 직렬화가 최상위 키 `scale`을 떨어뜨려 run585는 `zoom`으로 받아요.
- run777: 열린 필드 판정을 하이라이트 휴리스틱에서 `data-field-panel` + 포커스 aria-label로, 잘려 안 보이는 필드는 `hidden`으로.

## #841 run585 재작성 체크

- [x] `run585.py`를 도크 탭 경로(`#dock-mode-tab-design`, `#design-tool-tab-<id>`)와 % 입력 패널로 다시 썼어요.
- [x] iPhone 18 Pro · iOS 27.0 Simulator에서 끝까지 돌았어요 — `python3 run585.py` exit 0, `evidence/585/585-ios.json`(overall PASS).
- [x] `scripts/ios-sim/README.md`의 "도크 개편 이후 미검증" 표기를 이 실행 기준으로 고쳤어요.
