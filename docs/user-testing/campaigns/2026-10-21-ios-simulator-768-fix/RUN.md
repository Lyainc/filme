# FILME #768 수정 재검증 — iOS Simulator 캠페인 (2026-10-21)

[결과표 형식](../../RUN.md)을 따른 캠페인 기록이에요. 범위는 Seed `docs/specs/mobile-device-verification.yaml`의 **acceptance-3 iOS 행(#768 S01–S16)**만이에요. 같은 Seed의 acceptance-1·2·4(#777·#779·#585)와 Android 행, 결과표의 U01–U14·N01–N04는 이 기록의 범위 밖이에요. 수정 전 캠페인(빌드 `f56dabf`, 16/16 FAIL)은 브랜치 `test/mobile-sim-verify-820`의 `docs/user-testing/campaigns/2026-10-21-ios-simulator/RUN.md`에 있어요. **이 기록은 Seed 완료나 이슈 닫힘을 뜻하지 않아요.** Seed의 다른 필수 행(#777·#779·#585, Android)이 아직 남아 있어요.

## 실행 환경

- 빌드: `98595bb1f5c8518e309fa02b541fbfd1a22688c6`(브랜치 `fix/ios-stub-stamp-export-768`의 HEAD, base `origin/main` `06ec05b`)예요. 워크트리에서 `bun run build`를 한 직후 `bun run start --port 3051`로 **새로** 띄운 prod 서버를 썼어요. 그 포트를 잡은 프로세스가 같은 워크트리의 `next start --port 3051`인지도 확인했어요(#601 stale 서버 함정).
- 기기: iPhone 17 Pro 시뮬레이터(UDID `2E1CE4CC-…`), iOS 26.5 / Mobile Safari 26.5, Xcode 27.1, 402×714 CSS px, DPR 3. **라이트와 다크 두 테마**로 돌렸어요.
- 도구: main의 `scripts/ios-sim/run768.py`(Appium XCUITest 12.19.1 + XCTest 합성 터치, Seed constraint-3이 판정 근거로 인정), `stamp768.py`, `compare768.py`를 썼어요. 스크립트는 고치지 않았어요. 다크 테마는 `run768.seed_cell`의 `theme` 인자만 `'dark'`로 고정한 래퍼로 같은 `main()`을 돌렸어요.
- 입력 fixture: [README](../../README.md)의 공통 입력(짧은/긴), 포스터 A `sample-bus.jpg`, 스탬프 B `sample-crossing.jpg`예요. 대조군은 `STAMP_UPLOAD=1`(DESIGN '스탬프 이미지 업로드' + 크롭 적용)이에요.
- 증거: 라이트는 `evidence/768/`, 다크는 `evidence/768-dark/`에 있어요.
  - `Sxx-saved.jpg`: 사진 앱 DCIM에서 꺼낸 **저장 원본 그대로**예요(1960×3108 = 자연 960×1534 + 여백 10px, ×2).
  - `Sxx-editor.jpg`·`Sxx-preview.jpg`·`Sxx-compare.jpg`: 시뮬레이터 스크린샷과 비교 PNG를 JPEG q85로 옮긴 거예요.
  - `768-ios*.json`: 측정 원시값이에요.
  - `saved-grid.jpg`: 저장 원본을 줄여서 한 장에 모은 거예요.

## 원인 (수정 전 빌드 `06ec05b`, 같은 시뮬레이터에서 재현)

결과 화면의 저장 대상 노드에 html-to-image 1.11.13을 캡처와 같은 옵션·filter로 직접 돌려서 clone(toSvg)과 base PNG(toPng)를 떴어요. 증거는 [clone 발췌](./evidence/cause/clone-excerpt-06ec05b-ios.txt)와 [base PNG](./evidence/cause/base-png-06ec05b-ios.png)예요. 원인은 두 가지이고 성격이 달라요.

1. **스탬프 누락은 iOS에서만 나요.** 라이브 DOM과 clone 모두에서 `[data-bg-pattern]`은 제자리(absolute, 604,1111, 300×42)에 있어요. 안쪽 `[data-bg-pattern-image]`의 배경은 763KB짜리 `data:image/jpeg` URL로 인라인돼 있어요. 그런데 iOS가 그린 base PNG에서는 그 자리가 종이색으로 비어 있어요.
   - 그래서 레이아웃, `data-hide-on-export`, 이미지 디코드 대기는 원인이 아니에요. **foreignObject 안의 raster를 iOS Safari가 떨어뜨리는 #439와 같은 함정**이에요. 같은 트리를 Chrome은 그려요.
   - 포스터와 로고는 이미 이 경로를 피해서 캔버스에 직접 합성해요. 이 레이어만 CSS `background-image`라 피할 길이 없었어요. `backgroundPatterns.tsx`의 기존 `[risk]` 주석이 예고한 그대로예요.
   - 한계: iOS가 SVG 이미지 안의 raster를 "버리는지", "디코드 전에 그리는지"는 구분하지 않았어요. 수정이 그 경로 자체를 안 타서 어느 쪽이든 해소돼요.
2. **제목 위 빈 슬롯(세로 선)은 플랫폼 공통이에요.** clone의 워드마크 행에는 `span[data-stamp-divider]` 하나만 남아 있어요.
   - 저장 대상 `TicketRenderer`가 `ghost`를 받지 않아서(`undefined`), `stampWillRender`가 "켠 체인/포맷이 비어 있으면 점선 placeholder"로 판정해 스탬프 행을 세웠어요.
   - 저장물은 placeholder만 `data-hide-on-export`로 빼서 구분선과 여백이 남았어요. 편집 프리뷰는 `ghost=false`라 이 행이 없어요.
   - Chrome에서도 같은 seed(로고 없음)로 재현돼요: [Chrome 수정 전](./evidence/cause/chrome-stub-nologo-06ec05b.jpg) / [수정 후](./evidence/cause/chrome-stub-nologo-7341c4e.jpg).
   - README의 Chrome 16조합은 `--full-fields`로 체인·포맷 텍스트 라벨(CGV/IMAX)을 넣어서 이 조건을 원리적으로 밟을 수 없었어요.

## 수정 (`7341c4e` + `98595bb`)

- `captureToImage.ts`, 스탬프 경로 판정: 캡처 직전에 **실제 스탬프 이미지**를 foreignObject SVG에 넣어 한 번 그려 봐요(`foreignObjectDrawsBackground`). UA 판별이 아니라 실제 능력 검사예요.
  - 그려지는 엔진(Chrome)은 기존 경로를 그대로 타서 저장물이 바뀌지 않아요.
  - 그려지지 않거나 판정할 수 없는 엔진(iOS Safari)에서만 스탬프를 toPng에서 빼고 `compositeBgPattern`으로 캔버스에 직접 그려요(바깥 박스 클립, cover/center, `scale`이 반영된 렌더 박스, `opacity`).
- 직접 합성 경로의 z-order는 포스터 조상 배경 → 포스터 → 후가공 → 스탬프 조상 배경 → 스탬프 → base → 로고예요.
  - 스탬프에만 걸린 불투명 조상 배경(Editorial 메인 컬럼)도 base에서 빼서 캔버스에 칠해요.
  - 이 배경은 포스터 **다음**에 칠해요. 그래야 포스터 blur의 scale(1.2) 번짐을 덮어요. 처음에 포스터보다 먼저 칠했더니 번짐이 새어 나오는 회귀가 Chrome 비교에서 잡혔어요.
- `ResultPanel.tsx`(저장 대상)와 `ResultStage.tsx`(hero)에 `ghost={false}`를 명시했어요.
- 회귀 테스트: `__tests__/captureBgPatternComposite.test.ts`(두 경로 모두)와 `__tests__/resultGhostOff.test.tsx`를 추가했어요.

## 결과

| 행 | 결과 | 근거 |
|---|---|---|
| **S01**–**S16** 라이트(#768) | PASS ×16 | 16셀 모두 저장 원본을 확보했어요([모음](./evidence/768/saved-grid.jpg)). **저장 JPEG 16장 모두 스탬프 B가 프리뷰와 같은 빈 공간에 있어요.** `stamp768.py`(프리뷰에서 잰 상대 좌표로 저장본의 스탬프 자리를 측정)의 슬롯 표준편차는 78.9–80.4, 옆 종이는 8.7이에요([stamp-presence.json](./evidence/768/stamp-presence.json)). 수정 전에는 S01이 10.9 vs 8.7이었어요. 제목 위 빈 슬롯·세로 선이 없고, 잘림·겹침도 없어요(프리뷰 `textOverlap` 16셀 모두 `[]`, 저장본은 육안으로 확인). 예: [S01 저장](./evidence/768/S01-saved.jpg) · [S01 비교](./evidence/768/S01-compare.jpg) · [S16 저장](./evidence/768/S16-saved.jpg) |
| S01 대조군(스탬프 실제 업로드 경로, 라이트) | PASS | 슬롯 표준편차 39.2 vs 종이 8.7이에요([값](./evidence/768/stamp-presence-upload.json)). 크롭 결과라 seed 이미지와 내용이 달라서 값이 낮고, 존재는 육안으로 확인했어요: [editor](./evidence/768/S01-upload-editor.jpg) · [saved](./evidence/768/S01-upload-saved.jpg) |
| S01–S16 다크 | PASS ×16 | 라이트와 같은 기준이에요. 슬롯 표준편차 78.9–80.4 vs 종이 8.7([값](./evidence/768-dark/stamp-presence.json)), `textOverlap` 16셀 모두 `[]`, [모음](./evidence/768-dark/saved-grid.jpg)을 육안으로 확인했어요. |

- `compare768.py`의 정렬 잔차(meanAbs)는 라이트 4.5–8.1, 다크 0.8–5.5예요.
- 라이트의 S11·S15는 정렬 자체가 어긋났어요(fit 폭 904/912, 나머지 셀은 972/975). 포스터 없는 셀은 상단 검은 띠가 균일해서 오프셋 탐색이 엇나가는 비교 도구 한계예요. [S11 비교](./evidence/768/S11-compare.jpg)의 두 패널은 같은 배치예요. 이 두 셀의 위치 판정은 `stamp768.py`, 육안, 다크의 정상 정렬 결과에 기대요.

## Chrome 사전 점검·보호 조건 (같은 빌드 `98595bb`, 같은 서버)

- README의 Chrome 16조합을 일괄 실행해서 **16/16 PASS**예요([로그](./evidence/chrome/chrome16-and-6mood-compare.log)).
- 수정 전(`06ec05b`)과 후(`98595bb`)의 6무드 `capture-export.mjs --bg --full-fields --compare` 결과, **6무드 모두 Chrome 저장물이 바뀌지 않았어요.**
  - minimal·35mm·Editorial·Stub·35mm Wide는 maxAbsDiff 0으로 비트까지 같아요.
  - Criterion은 maxAbsDiff 1, 3 초과 픽셀 0이에요. 하네스 잡음 바닥(maxΔ 2) 안이에요.
- 중간 커밋 `7341c4e`는 Chrome에서도 직접 합성을 타서 스탬프 무드 셋이 maxΔ27–46만큼 달랐어요. 능력 검사(`98595bb`)로 그 차이를 없앴어요.
- `bun run test` 1329 pass / 0 fail, `bun run typecheck` 통과예요(`98595bb`).
- 6무드 중 스탬프 레이어가 있는 무드는 Editorial·Criterion·Stub 셋이에요. 나머지 셋은 바뀐 경로를 타지 않아서 비트 동일이 그 근거예요. 포커스·undo 경로는 diff에 없어요.

## 캠페인 판정

- 이 기록의 행은 33행이에요: PASS 33 / FAIL 0 / BLOCKED 0 / UNRUN 0(라이트 16 + 대조군 1 + 다크 16). 이 빌드에서 Seed acceptance-3 iOS 행의 충족 근거가 생겼어요.
- 수정은 아직 main에 머지되지 않았어요. 머지 후 production에 반영되기 전까지 사용자 환경은 `f56dabf` 계열로 동작해요.
- 이슈 연결: #768 댓글.

## 재개 지점

1. Seed의 남은 필수 행이 있어요: #777(acceptance-1)·#779(acceptance-2)·#585(acceptance-4)의 iOS FAIL 행과 Android Emulator 전 행(BLOCKED)이에요. 모든 필수 행이 PASS가 되기 전에는 Seed를 completed로 바꾸지 않아요.
2. 수정 PR은 소유자 승인을 받은 뒤 `fix/ios-stub-stamp-export-768`에서 열어요. 이 증거 브랜치(`test/ios-sim-768-fix-verify`)는 머지 대상이 아니에요.
3. 재실행 순서는 위 환경대로 서버를 새로 띄우고 Safari를 새 origin으로 한 번 이동한 다음 `run768.py` → `STAMP_UPLOAD=1 run768.py S01` → `stamp768.py` → `compare768.py`예요. 함정: 탭이 이전 origin(죽은 서버)에 남아 있으면 seed의 첫 fetch가 `Load failed`로 끝나서 전 셀이 실패해요.
