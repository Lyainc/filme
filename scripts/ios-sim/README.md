# iOS Simulator 모바일 검증 스크립트

Seed `docs/specs/mobile-device-verification.yaml`의 acceptance-1~4 iOS 행(#777·#779·#768·#585)을 iOS Simulator Mobile Safari에서 실행하는 도구예요. 제스처는 **XCTest 합성 터치**(Appium XCUITest driver, NATIVE_APP 컨텍스트 W3C touch pointer action)로 보내고, 상태 준비·측정은 WEBVIEW 컨텍스트 JS로 해요. constraint-3이 이 터치를 판정 근거로 인정해요. 관측 도구라 게이트가 아니며, 판정은 출력 JSON과 스크린샷을 사람이 봐요.

첫 캠페인 기록(2026-10-21, 빌드 `f56dabf`)은 브랜치 `test/mobile-sim-verify-820`의 `docs/user-testing/campaigns/2026-10-21-ios-simulator/RUN.md`에 있어요.

## 준비

1. 검증할 SHA를 빌드해 띄워요: `bun run build && bun run start --port 3038`. 같은 포트에 옛 서버가 있으면 stale 빌드를 재요(CLAUDE.md #601).
2. 시뮬레이터를 부팅하고 DeviceHub의 I/O › Keyboard › Connect Hardware Keyboard를 꺼요(키보드 항목은 소프트웨어 키보드가 떠야 판정해요).
3. Appium: `bun add -g appium` → `appium driver install xcuitest` → `appium --port 4725`. 첫 세션에서 WebDriverAgent를 빌드해요.
4. Python은 표준 라이브러리만 써요. 비교 스크립트만 `uv run --with pillow --with numpy`가 필요해요.

환경 변수: `FILME_SIM_UDID`(기본: 2026-10-21 캠페인의 iPhone 17 Pro), `FILME_URL`(기본 `http://localhost:3038/`), `FILME_SIM_DIR`(출력·세션 id, 기본 `/tmp/filme-ios-sim`), `APPIUM_URL`(기본 `http://127.0.0.1:4725`). 세션은 `sim.py`를 import할 때 만들고 `<dir>/apsid`로 재사용해요.

## 실행

이 디렉터리에서 실행해요(스크립트가 서로 import해요).

| 스크립트 | 대상 | 출력(`$FILME_SIM_DIR/ev/`) |
|---|---|---|
| `python3 run585.py [0-5 ...]` | #585 여섯 % 입력 × 키보드 ✓/바깥 탭 | `585-<i><a\|b>-{during,typed,after}.png`, `585-ios.json` |
| `python3 run779.py [light] [dark]` | #779 트랙 탭·±10/14px·트랙/thumb 드래그·% 입력·undo | `779-<theme>-*.png`, `779-ios.json` |
| `python3 run777.py [light\|dark] [무드 ...]` | #777 필드 직접 탭(중심·안쪽 위/아래 2px), 핸들·이전/다음·편집 undo(라이트) | `777-*.png`, `777-ios-<themes>.json` |
| `python3 run777rest.py` | #777 작은 필드 확대 경로(최대화·핀치), 다크 복구 경로 | `777-enlarge-*.png`, `777-rest.json` |
| `python3 run768.py [S01 ...]` | #768 Stub S01–S16: README 공통 입력 seed → 스텝 2·3 → 완료 → '사진에 저장' → 공유 시트 '이미지 저장' → 사진 앱 DCIM에서 원본 회수. `STAMP_UPLOAD=1`이면 스탬프를 실제 UI 업로드로 넣어요 | `768/Sxx-{editor,preview,sheet}.png`, `768/Sxx-saved.jpg`, `768/768-ios*.json` |
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
- 필드 열림 판정은 하이라이트 위치 휴리스틱(`OPENED`)보다 포커스된 입력의 `aria-label`이 정확해요.
