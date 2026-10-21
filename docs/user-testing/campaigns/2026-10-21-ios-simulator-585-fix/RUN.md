# FILME #585 수정 재검증 — iOS Simulator 캠페인 (2026-10-21)

[결과표 형식](../../RUN.md)을 따른 캠페인 기록이에요. 범위는 Seed `docs/specs/mobile-device-verification.yaml`의 **acceptance-4 iOS 행**(#585) 재검증 하나예요. 첫 캠페인(빌드 `f56dabf`, 브랜치 `test/mobile-sim-verify-820`의 `docs/user-testing/campaigns/2026-10-21-ios-simulator/RUN.md` '실패 기록 1')에서 12/12 FAIL이던 포커스 줌을 고친 빌드로 같은 스크립트를 다시 돌렸어요. U01–U14·S01–S16·N01–N04와 acceptance-1~3(#777·#779·#768)은 이 캠페인 범위 밖이라 N/A예요. 이 기록은 Seed 완료나 이슈 닫힘을 뜻하지 않아요 — Android 행이 BLOCKED이고 다른 acceptance에 FAIL이 남아 있어요.

## 실행 환경

- 실행자 / 날짜·시간: Claude Code 세션(소유자 Lyainc 목표 지시) / 2026-10-21
- 대상 URL / 전체 commit SHA: `http://localhost:3038/` 로컬 prod(`bun run build` → `bun run start --port 3038`) / 앱 코드 `fb271a5ff627515b032111ca0ccbea345ec4ff92`(origin/main `3cc5314` + 수정 커밋). 빌드 뒤 커밋은 `scripts/ios-sim/run585.py`(측정 보정)와 이 기록뿐이라 서버 빌드는 그대로예요. 새로 띄운 서버이고 `_next/static/chunks/*.js` 200 확인(stale 서버 아님).
- 기기 / OS / 브라우저: iPhone 17 Pro 시뮬레이터(UDID `2E1CE4CC-1DB0-4D03-A511-4C0AB87CA474`) / iOS 26.5(23F77) / Mobile Safari 26.5
- 시뮬레이터 / 화면: Xcode 27.1(27A9275) / 세로, viewport 402×714, DPR 3 / 보조기술 없음
- 하드웨어 키보드 끔 / 소프트웨어 키보드 표시: 끔, 표시 확인(모든 `during` 스크린샷에 숫자 키패드)
- 테마: 다크(기본)
- 입력 fixture: 빈 문서(포스터 없음), 첫 캠페인과 같음
- 입력 방식: XCTest 합성 터치(Appium 3.8.0 + XCUITest driver, Seed constraint-3이 인정한 경로), 측정은 WEBVIEW JS — `python3 scripts/ios-sim/run585.py`
- 증거: 이 디렉터리의 `evidence/585/`. 스크린샷은 시뮬레이터 원본(1206×2622 PNG)을 JPEG q85로 옮겼어요. `585-ios.json`이 측정 원시값, `measure-chrome-{dark,light}.json`이 같은 서버의 Chrome 하네스 출력이에요.

## 원인 확정

- 수정 전(첫 캠페인 JSON): 12셀 모두 포커스 중 % 입력 `getComputedStyle().fontSize` **11px**, `visualViewport.scale` **1.455** = 16/11. Safari가 입력 글자를 16px로 보이게 하는 배율과 정확히 같고, viewport meta에 `maximum-scale` 없음.
- 수정 후(이 캠페인): 같은 입력의 computed font-size만 **16px**로 바꾸자(보이는 크기는 `transform: scale(11/16)`로 11px 유지) 12셀 모두 포커스 중 scale **1**. 다른 변수는 그대로라 원인은 **입력 글꼴 16px 미만**으로 확정돼요. transform은 줌 판정에 들어가지 않아요.
- 수정 위치: `src/styles/globals.css`의 `@supports (-webkit-touch-callout: none) { .pct-input … }`(iOS WebKit 전용, 데스크톱·Chrome 미적용) + `src/components/wizard/BrightnessSlider.tsx`의 % 입력 클래스. 레이아웃 상자는 수정 전과 같은 29.7×16.5(JSON `before.input`).

## 결과

| ID | 상태 | 실제 결과 / 증거 |
|---|---|---|
| **#585 iOS** 포스터 % · 키보드 ✓ | PASS | 포커스 중 scale 1, 16px, 입력·라벨 가시 1.0, 프리뷰 27.6% 보임. ✓ 뒤 scale 1, 값 37(range 0.37) 유지, dock·프리뷰 rect 원래와 동일, 플로팅 툴바(undo) 제자리 — [during](./evidence/585/585-0a-during.jpg) · [after](./evidence/585/585-0a-after.jpg) |
| #585 iOS 포스터 % · 바깥 탭 | PASS | 같은 결과, 값 42 유지 — [during](./evidence/585/585-0b-during.jpg) · [after](./evidence/585/585-0b-after.jpg) |
| #585 iOS 컴포넌트 % · ✓ / 바깥 탭 | PASS / PASS | 같은 결과(37 / 42) — [1a](./evidence/585/585-1a-during.jpg) · [1b](./evidence/585/585-1b-after.jpg) |
| #585 iOS 재질 강도 % · ✓ / 바깥 탭 | PASS / PASS | 재질 '미술용지' 선택 후 같은 결과 — [2a](./evidence/585/585-2a-during.jpg) · [2b](./evidence/585/585-2b-after.jpg) |
| #585 iOS 코팅 강도 % · ✓ / 바깥 탭 | PASS / PASS | 같은 결과 — [3a](./evidence/585/585-3a-during.jpg) · [3b](./evidence/585/585-3b-after.jpg) |
| #585 iOS 극장 로고 크기 % · ✓ / 바깥 탭 | PASS / PASS | 80 / 90 입력, 같은 결과 — [4a](./evidence/585/585-4a-during.jpg) · [4b](./evidence/585/585-4b-after.jpg) |
| #585 iOS 포맷 로고 크기 % · ✓ / 바깥 탭 | PASS / PASS | 같은 결과. 종료 후 라벨·입력이 6px 위(크기 패널은 #682가 슬롯을 일부러 넘치게 둔 자리라 포커스가 슬롯 안쪽 스크롤을 6px 옮김), dock·프리뷰 rect는 동일 — [5a](./evidence/585/585-5a-during.jpg) · [5b](./evidence/585/585-5b-after.jpg) |
| #585 iOS return 키 | N/A | `inputMode="numeric"` 숫자 키패드에 return 키 없음(첫 캠페인과 같음) |
| #585 Android | BLOCKED | Android Emulator 미설치, 설치 승인 없음 |

### 보호 조건(같은 서버)

- `scripts/measure-chrome.mjs --theme dark` / `--theme light`: **exit 0 / exit 0**, dock 290 / 프리뷰 190.9×305 — [dark](./evidence/585/measure-chrome-dark.json) · [light](./evidence/585/measure-chrome-light.json). 새 규칙은 `-webkit-touch-callout`을 지원하지 않는 Chrome에선 적용되지 않아요.
- `bun run test` 1331개 통과(새 `__tests__/pctInputIosZoom.test.tsx`가 클래스·16px 결합을 잠금), `bun run typecheck` 통과. 레일 슬롯 클래스는 안 바꿔 `measureChromeBaselineCoupling` 대상 변화 없음. 사용자 노출 문구 변화 없음.

### 측정 보정

첫 캠페인의 `visibleDuring`은 rect(레이아웃 뷰포트 좌표)에서 `visualViewport.offsetTop`을 뺐는데, iOS는 scale 1에서도 키보드 스크롤(이번 310px)을 거기 실어 줌이 없을 때 전부 0으로 나왔어요. 보이는 창의 위치를 `pageTop − scrollY`로 고쳤어요(`fix(scripts)` 커밋). 수정 전 FAIL 판정은 scale 1.455와 스크린샷으로 이미 성립해서 이 보정과 무관해요.

## 요약

- 이 캠페인 행 14행: PASS 12 / BLOCKED 1(Android) / N/A 1.
- 결론: **acceptance-4 iOS 행 전부 PASS.** Android 행 BLOCKED와 acceptance-1~3의 남은 FAIL 때문에 Seed는 active 유지예요.
- 이슈 연결: #585 댓글.
