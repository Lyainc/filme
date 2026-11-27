# iOS Simulator 모바일 검증 스크립트

Seed `docs/specs/mobile-device-verification.yaml`의 acceptance-1~4 iOS 행(#777·#779·#768·#585)을 iOS Simulator Mobile Safari에서 실행하는 도구로 시작했고, 지금은 #826 S8 Seed(`docs/specs/826-s8-device-verification.yaml`)의 Simulator 행(acceptance-1·3·4·6·7·12)을 새 화면(상단 줄 + 도크, 키보드에 붙는 입력 패널)에서 재요. 제스처는 **XCTest 합성 터치**(Appium XCUITest driver, NATIVE_APP 컨텍스트 W3C touch pointer action)로 보내고, 상태 준비·측정은 WEBVIEW 컨텍스트 JS로 해요. constraint-3이 이 터치를 판정 근거로 인정해요. 관측 도구라 게이트가 아니며, 판정은 출력 JSON과 스크린샷을 사람이 봐요.

첫 캠페인 기록(2026-10-21, 빌드 `f56dabf`)은 브랜치 `test/mobile-sim-verify-820`의 `docs/user-testing/campaigns/2026-10-21-ios-simulator/RUN.md`에 있어요. 새 화면 기준 실행 기록은 [#826 S8 캠페인](../../docs/user-testing/campaigns/2026-11-27-826-s8/RUN.md)이에요.

## 준비

1. 검증할 SHA를 빌드해 띄워요: `bun run build && bun run start --port 3038`. 같은 포트에 옛 서버가 있으면 stale 빌드를 재요(docs/HARNESS.md §8, #601).
2. 시뮬레이터를 부팅하고 DeviceHub의 I/O › Keyboard › Connect Hardware Keyboard를 꺼요(키보드 항목은 소프트웨어 키보드가 떠야 판정해요).
3. Appium: `bun add -g appium` → `appium driver install xcuitest` → `appium --port 4725`. 첫 세션에서 WebDriverAgent를 빌드해요.
4. Python은 표준 라이브러리만 써요. 비교 스크립트만 `uv run --with pillow --with numpy`가 필요해요.

환경 변수: `FILME_SIM_UDID`(기본: #826 S8 캠페인의 iPhone 18 Pro · iOS 27.0. 이 머신의 iOS 27.1 런타임은 iPhone Duo만 지원해 18 Pro를 만들 수 없어요), `FILME_URL`(기본 `http://localhost:3038/`), `FILME_SIM_DIR`(출력·세션 id, 기본 `/tmp/filme-ios-sim`), `APPIUM_URL`(기본 `http://127.0.0.1:4725`). 세션은 `sim.py`를 import할 때 만들고 `<dir>/apsid`로 재사용해요.

## 실행

이 디렉터리에서 실행해요(스크립트가 서로 import해요).

| 스크립트 | 대상 | 출력(`$FILME_SIM_DIR/ev/`) |
|---|---|---|
| `python3 run585.py [0-5 ...] [fields \| fields=<무드 이름>]` | #585 · S8 acceptance-6: 디자인 도구 % 입력 여섯 × 키보드 '완료'/바깥 탭, 정보 모드 필드 입력 한 바퀴(‹ › 순회, 평점 소수 입력 포함)의 확대 · 16px · 패널 가시 · 문서 스크롤 | `585-<i><a\|b>-{during,typed,after}.png`, `585-field-*.png`, `585-ios.json` |
| `python3 run779.py [light] [dark]` | #779 · S8 acceptance-4: 디자인 '투명도' 도구 '포스터' 슬라이더 트랙 탭·±10/14px·트랙/thumb 드래그·% 입력·undo | `779-<theme>-*.png`, `779-ios.json` |
| `python3 run777.py [light\|dark] [무드 ...]` | #777 · S8 acceptance-3: 필드 직접 탭(보이는 부분의 중심·안쪽 위/아래 2px) → 입력 패널 필드와 포커스 입력 aria-label 대조, 정보 모드 탭·이전/다음·편집 undo(라이트). `FILME_777_LONG=1`이면 공통 입력 긴 입력 | `777-*.png`, `777-ios-<themes>.json` |
| `python3 run777rest.py` | #777 작은 필드 확대 경로(전체 보기·핀치), 다크 복구 경로 | `777-enlarge-*.png`, `777-rest.json` |
| `python3 run826s4.py [a-close b-keyboard c-outside d-back]` · `python3 run826s4.py back` | S8 acceptance-7: 입력 패널 종료 경로 넷 — 입력 · 패널 가시, 프리뷰 노출, 종료 뒤 티켓 transform 항등 · 도크 · 프리뷰 rect 불변 · 값 보존. `back`은 평점 패널 + Safari 툴바 '뒤로'(XCTest) | `826s4-*.png`, `826s4-ios.json`, `826s4-back.json` |
| `python3 run826s12.py` | S8 acceptance-12: 랜딩 '직접 입력' 뒤 50·120·200ms(걷힘 240ms 안)에 제목 필드 · 도크 '디자인' 탭을 XCTest로 탭, 600ms 양성 대조 | `826s12-*.png`, `826s12-ios.json` |
| `python3 run768.py [S01 ...]` | #768 Stub S01–S16: README 공통 입력 seed → 스텝 2·3 → 완료 → '저장' → 공유 시트 '이미지 저장' → 사진 앱 DCIM에서 원본 회수. `STAMP_UPLOAD=1`이면 스탬프를 실제 UI 업로드로 넣어요 | `768/Sxx-{editor,preview,sheet}.png`, `768/Sxx-saved.jpg`, `768/768-ios*.json` |
| `uv run --with pillow --with numpy python compare768.py <dir> S01 ...` | 저장 JPEG를 편집 프리뷰 스크린샷에 티켓 경계로 정렬해 프리뷰/저장본/차이 나란히 | `Sxx-compare.png` |
| `uv run ... python stamp768.py <dir>` | 저장 JPEG의 스탬프 자리 픽셀 표준편차(종이와 같으면 부재) | `stamp-presence.json` |
| `uv run --with pillow python mont.py out.png a.png b.png ...` | 스크린샷 가로 이어 붙이기 | — |

## 함정(2026-10-21 실측)

- **AXe(`axe tap`)는 Xcode 27.1/DeviceHub에서 성공 응답만 하고 화면이 반응하지 않아요.** 호스트 CGEvent 마우스는 포커스·커서를 뺏겨 불안정하고, safaridriver 웹 합성 터치는 click이 안 나요. 모든 터치는 스크린샷이나 DOM 상태로 결과를 확인해요.
- safaridriver 세션이 남으면 Safari가 페어링돼 실제 입력이 막혀요(주소창이 주황색). `xcrun simctl terminate <udid> com.apple.mobilesafari`로 풀어요.
- 16px 미만 입력을 포커스하면 Safari가 확대해요. 좌표는 `visualViewport.scale/offset`로 환산하고(`sim.to_pt`), reload는 확대를 유지하니 새 URL 탐색(`?r=N`)으로 초기화해요(`sim.reset_editor`). 확대 중 화면 밖 버튼은 핀치(`sim.pinch_in_pt`)로 축소한 뒤 눌러요.
- 랜딩 '이어서 만들기' 행이 늦게 나타나 링크 위치가 밀려요. 랜딩이 닫혔는지 확인하고 다시 눌러요.
- 레일을 코드로 스크롤한 직후의 탭은 스크롤 정지로 흡수돼요. 0.8초 기다려요.
- 첫 포스터 업로드는 `fieldVisibility`를 기본값으로 덮어써요. seed에 `hadPoster: true`를 넣어요.
- 이전 셀의 포스터가 IndexedDB(`filme-images`)에서 복원돼요. 셀마다 비워요.
- 공유 시트는 원격 뷰라 요소 rect가 맞지 않아요. 화면 좌표로 '이미지 저장'을 누르고 DCIM에 새 파일이 생겼는지로 성공을 판정해요. 좌표 `(156, 772)`는 iPhone 17 Pro 402×874 기준이라 다른 기기에선 스크린샷으로 다시 읽어요.
- 필드 열림 판정은 하이라이트 위치 휴리스틱보다 포커스된 입력의 `aria-label`이 정확해요. 지금 `run777.OPENED`는 입력 패널의 `data-field-panel` 값이고, 라벨표와 포커스 aria-label을 같이 대조해요.

## 함정(2026-11-27 실측, iPhone 18 Pro · iOS 27.0)

- 핀치 확대 때 iOS 27.0은 `scrollX`와 `visualViewport.offsetLeft`를 같은 값으로 줘요. `getBoundingClientRect`는 이미 보이는 영역 기준이라, `sim.vv()`는 보이는 영역 원점을 `pageLeft − scrollX`로 잡아요(`offsetLeft`를 빼면 탭이 화면 밖으로 나가요).
- WebKit 원격 직렬화가 JS가 돌려준 객체의 최상위 키 `scale`을 떨어뜨려요. `zoom` 같은 다른 이름으로 받아요(중첩 객체 안의 `scale`은 살아요).
- 정보 모드는 '빈 항목 표시'가 항상 켜져 로고 · 포맷 자리표시 줄만큼 티켓이 밀려요(#826 S2). ghost를 끈 프리뷰가 필요하면 디자인 모드에서 찍어요.
- 랜딩이 떠 있는 동안 편집 화면(도크 · 티켓 필드)은 `display:none`이라 rect가 0이에요. 편집 화면 자리는 들어간 뒤에 재요.
- XCTest로는 탭 두 개를 240ms 안에 연달아 보낼 수 없어요: 따로 보내면 최소 약 340ms, 한 손가락 묶음에 누름 둘은 드래그 하나가 되고, 손가락 둘을 시간차로 넣으면 핀치가 돼요(`run826s12.py` 머리말).
- [저장]의 공유 시트가 `NotAllowedError`로 자주 거절돼요(사용자 활성 소실, #826 S8 캠페인 발견 1). `run768.py`는 시트가 뜰 때까지 최대 8번 다시 누르고 시도 횟수를 남겨요. 공유 시트 '이미지 저장' 좌표 `(156, 772)`는 iPhone 18 Pro(402×874)에서도 같아요.
- 날짜 · 시간 입력에 포커스가 가면 iOS가 선택기 팝오버를 띄우고, 그동안의 첫 탭은 팝오버 닫기에 쓰여요.
- zsh는 `noclobber`라 `> 기존파일`이 실패하고 앞 명령이 아예 안 돌아요. 로그를 덮어쓸 땐 `>|`를 써요.

## 도크 개편 이후(#826 S2) — 검증 상태

2026-11-27 [#826 S8 캠페인](../../docs/user-testing/campaigns/2026-11-27-826-s8/RUN.md)에서 iPhone 18 Pro · iOS 27.0 Simulator로 **아래 스크립트를 끝까지 다시 돌렸어요**(빌드 `6791a2f4`, `evidence/exit.txt`). 결과는 Simulator 결과이고 실기기 결과가 아니에요.

| 스크립트 | 실행 | 결과 |
|---|---|---|
| `run768.py` + `stamp768.py` + `compare768.py` | S01~S16 | 16/16 PASS(저장은 시도 2~3회) |
| `run777.py light` · `dark` | 6무드 × 두 테마 | 필드 88개씩 오탭 0 |
| `run777rest.py` | 전체 보기 · 핀치 · 다크 복구 | 동작 |
| `run779.py light dark` | 트랙 탭 · ±10/14px · 드래그 · % 입력 · undo | 두 테마 PASS |
| `run585.py` · `run585.py fields=크라이테리언` | % 입력 12 + 필드 순회(기본 무드 14 · 크라이테리언 15) | PASS(#841 재작성) |
| `run826s4.py` · `back` | 종료 경로 넷 | PASS — 뒤로는 평점 패널 + Safari 툴바만. 텍스트 필드 + 키보드의 엣지 스와이프는 Simulator에서 실패(실기기 몫). `back`은 그 실패를 기록해도 exit 0이라 JSON을 봐요 |
| `run826s12.py` | 랜딩 걷힘 탭 | BLOCKED(위 함정) |
