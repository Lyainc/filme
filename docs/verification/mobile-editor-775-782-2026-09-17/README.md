# 모바일 편집기 #775·#776·#777·#779·#780·#781·#782 검증

2026-09-17. **로컬 구현·자동 검증 완료, 실제 iPhone Safari 검증 대기**예요. 7개 GitHub 이슈는 모두 OPEN 상태로 유지했고 게시 작업은 하지 않았어요.

## 기준과 WIP

- 시작·종료 로컬 HEAD: `785f1818a371b13444d971d060f880697ce334e9`.
- 요청에 있던 배포 buildId `KLGaUIK8OEPtnUv4ugqwR`는 과거 감사 기준이에요. 이번 전후 측정은 같은 로컬 작업 트리의 수정 전/후이고, 배포를 갱신하지 않았어요.
- 원격 main 조회: `407393e4bb17fad27a1d36897725e37f6b4d8d47`, 기준보다 24커밋 앞서 있어요. 겹친 파일은 FieldDrawer 포커스 복원과 index 메타데이터예요. [해당 diff](remote-overlap.json)를 확인했고 이번 작업에 병합하지 않았어요. 최신 main 통합 완료를 뜻하지 않아요.
- 원래 문서 정리, `types/index.ts`, `backgroundPatterns.tsx`의 diff는 시작 스냅샷과 바이트 단위로 같아요. 공유 파일 `designRailItems.tsx`의 기존 주석 수정도 보존했어요. [WIP 확인](wip-verification.json).
- [이슈 요구사항·상태 스냅샷](issues.json), [현재 앱·테스트·측정 도구 diff](changes.patch), [독립 리뷰 시점 diff](reviewed.patch), [독립 리뷰 결과](review.md).

## 이슈별 상태

**2026-09-19 갱신:** 실제 iPhone Safari 연결을 확인했고, 사용자가 제목의 한글 입력·커서·삭제·되돌리기를 정상으로 확인했어요. 입력란·도구 가림이 없다는 답변도 받았으며, 자동 숫자 키패드(러닝타임)와 나머지 터치 검증은 진행 중이에요. 아래 표와 9월 17일 기기 조회는 당시 기록이며, 최신 실기기 결과는 [9월 19일 검증 기록](iphone-connection-2026-09-19.md)에 있어요.

| 이슈 | 구현 | 로컬 검증 | 남은 조건 |
|---|---|---|---|
| #775 | 직접 필드 편집 동안만 즉시 반영; 닫혀도 마지막 값 유지; 결과는 live state | 네 크기 연속 입력, 실제 Chrome CDP IME 조합·중간 삽입·삭제·undo/redo·결과 값 | 실제 iPhone 한글 키보드·커서·입력 반응 |
| #776 | 완료 전 헤더에 누락 항목 표시; 목록에 저장 필수/표시 구분과 제목·개봉연도 입력 경로 | 빈 문서·제목 입력 후 안내 갱신·숨긴 개봉일·기존 draft 복원, 포스터/OCR 기존 회귀 | 실제 iPhone 전체 진입 흐름 |
| #777 | 기존 엣지 핸들에 `항목 편집` 표기; Criterion 한줄평을 목록·순회에 포함 | 6무드 × 4폭의 필드 경계 5점씩 측정; 목록에서 한줄평 입력; 키보드/32px 툴바 기존 회귀 | 실제 iPhone 필드 선택 과업 |
| #779 | native range 입력 박스 32px, 얇은 트랙 유지 | 중심 ±터치 여유, 이웃 미겹침, 트랙 +10px에서 실제 Chrome touch 탭/드래그; 값 0.2→0.8 | iPhone Safari 드래그 및 #585 숫자 입력 키보드 가림 |
| #780 | 폰트 전용 동일 너비 grid; 선택 서체만 sticky 견본, 빈 텍스트 대체 문구 | 네 폭 마지막 옵션 너비·스크롤 후 꽃길 선택, Criterion 두 그룹·이미지 잠금 8장면 | 실제 iPhone 스크롤·선택 |
| #781 | 빈 콘텐츠와 숨김을 구분하고 기존 로고 편집으로 연결 | 빈 로고 입력→텍스트 로고 복귀, 크기 0.7→0.9, 숨김 안내·값 유지·저장/undo 기존 회귀 | 실제 iPhone 입력 왕복 |
| #782 | 점·라벨을 native switch 버튼 하나로 통합 | 두 곳 touch 탭에 상태 true→false→true, 단일 호출 회귀·44px 높이·헤더 fit | 실제 iPhone 터치·저장 상태 표시 |

최초 기기 조회는 CoreDeviceService 초기화 오류로 실패했어요. 후속 조회에서 `xcrun`의 Xcode 초기화 래퍼가 응답하지 않아 이번 조회 프로세스를 종료했고, 설치된 CoreDevice 실행 파일을 직접 호출한 읽기 전용 조회는 정상 종료하며 `No devices found.`를 반환했어요. 현재 CoreDevice가 발견한 기기가 없고 원격 기기 환경도 제공되지 않았어요. [기기 조회 근거](device-availability.json). **Chrome 에뮬레이션과 CDP 조합 입력은 실제 iPhone Safari 증거를 대신하지 않아요.**

## 네 크기 측정

[수정 전 JSON](before.json) / [수정 후 JSON](after.json). 가로 폭별 높이는 320×568, 375×667, 393×659, 414×736이에요. 다음은 레일이 열린 상태예요.

| 폭 | 티켓 미리보기 | 수정 전 대비 | range 높이 | 폰트 옵션 너비 |
|---|---|---|---|---|
| 320 | 141.3 × 225.8 | 동일 | 32px | 140px |
| 375 | 187.2 × 299.1 | 동일 | 32px | 109px |
| 393 | 183.5 × 293.2 | 동일 | 32px | 115px |
| 414 | 219.1 × 350.1 | 동일 | 32px | 122px |

- range 높이: 2→32px. 트랙 25% 위치에서 중심 ±3/±10/±15px는 input, ±20px는 바깥 영역이에요. 두 슬라이더 사이에 겹침은 없어요. +10px 위치 touch 탭/드래그로 값 변경을 확인했어요.
- 320px 폰트 마지막 옵션: 288→140px로 다른 옵션과 같아졌어요. 375/393/414px은 109/115/122px로 유지돼요. 기존 고정 슬롯·스크롤 그림자를 유지하고 선택 견본만 추가했어요. 320px 콘텐츠 높이 305px/슬롯 148px라 스크롤은 여전히 필요해요. 넘침을 없앴다고 주장하지 않아요.
- 네 폭 모두 초기 빈 화면·패널 전환 후 미리보기 치수가 수정 전과 같아요. 헤더 버튼 경계가 프레임 안이고 서로 겹치지 않아요.
- 자동저장 버튼은 약 58×44px이고 라벨과 점 각각을 touch 탭했어요.
- 연속 키 입력은 70ms 간격으로 `U→UX→UXT→UXTE→UXTES→UXTEST`. 수정 전 표시가 뒤따르지 못했고 수정 후 각 입력 직후 읽은 티켓 DOM은 매 중간 값과 같았어요. 페인트 지연 백분위나 실사용 실패율 측정은 아니에요.
- [IME·커서·undo·24개 필드 장면](deep.json): `ABCD→ABXCD→ABCD`, `ABㅎCD→AB하CD→AB한CD`, undo `ABCD`, redo/결과 `AB한CD`. 24장면의 표본 내부점에서 다른 필드로 판정된 경우는 0이에요. [프로덕션의 테두리 1px 안쪽 포함 3168점](production-deep.json)에서도 다른 필드 판정은 0이에요. 최초 production 경계 검사는 진입 애니메이션 중 클릭으로 중단됐고, 측정 스크립트에서 240ms 드로어 애니메이션 완료를 기다린 뒤 통과했어요. Editorial 및 320px 35mm Wide의 일부 필드는 기존 이동식 목록 핸들에 가려져요. 이번 처방은 명확한 목록 대체 경로이며 모든 온티켓 필드를 손가락 크기로 확대하지 않았어요.
- [두 폰트 그룹·잠금·숨긴 로고·복원](panel-states.json): 8장면, 스크롤 중 미리보기 크기 유지. 사용한 서체만 브라우저가 로드하며 `_app.tsx`의 `preload:false` 정책을 바꾸지 않았어요.

## 화면 비교

| 폭 | 빈 편집기 전 / 후 | 폰트 전 / 후 | 슬라이더 전 / 후 | 로고 전 / 후 |
|---|---|---|---|---|
| 320 | [전](screenshots/before-320-empty.png) / [후](screenshots/after-320-empty.png) | [전](screenshots/before-320-fonts.png) / [후](screenshots/after-320-fonts.png) | [전](screenshots/before-320-opacity.png) / [후](screenshots/after-320-opacity.png) | [전](screenshots/before-320-logo.png) / [후](screenshots/after-320-logo.png) |
| 375 | [전](screenshots/before-375-empty.png) / [후](screenshots/after-375-empty.png) | [전](screenshots/before-375-fonts.png) / [후](screenshots/after-375-fonts.png) | [전](screenshots/before-375-opacity.png) / [후](screenshots/after-375-opacity.png) | [전](screenshots/before-375-logo.png) / [후](screenshots/after-375-logo.png) |
| 393 | [전](screenshots/before-393-empty.png) / [후](screenshots/after-393-empty.png) | [전](screenshots/before-393-fonts.png) / [후](screenshots/after-393-fonts.png) | [전](screenshots/before-393-opacity.png) / [후](screenshots/after-393-opacity.png) | [전](screenshots/before-393-logo.png) / [후](screenshots/after-393-logo.png) |
| 414 | [전](screenshots/before-414-empty.png) / [후](screenshots/after-414-empty.png) | [전](screenshots/before-414-fonts.png) / [후](screenshots/after-414-fonts.png) | [전](screenshots/before-414-opacity.png) / [후](screenshots/after-414-opacity.png) | [전](screenshots/before-414-logo.png) / [후](screenshots/after-414-logo.png) |

[320px 마지막 폰트 선택](screenshots/after-320-fonts-scrolled.png) · [320px 서명 이미지 잠금](screenshots/after-320-criterion-fonts-locked.png) · [한글 조합](screenshots/after-ime.png).

## 검사 결과와 재현

- `bun run test`: **1294 pass, 0 fail**, 140파일. [로그](test.log). 기존 6무드 × 1x/2x 캡처 픽셀 비교와 저장/복원/undo·포스터·OCR 진입 회귀를 포함해요.
- `bun run typecheck`: 통과. [로그](typecheck.log).
- `bun run lint`: 통과. [로그](lint.log). 원래 gitignored `.omc/workflows/c3-canvas-ux.mjs`의 최상위 return이 lint를 막아서, 해당 임시 도구 디렉터리만 eslint ignore에 추가했어요. 원본 임시 파일은 수정하지 않았어요.
- `bun run build`: 통과. [로그](build.log).
- 최종 로컬 production buildId: `DgB7iqfFMQf27m2vdXtu_`. [프로덕션 네 크기 입력·터치](production-mobile.json), [프로덕션 기존 Chrome 하네스](chrome-production.json)도 통과했어요.
- 기존 `scripts/measure-chrome.mjs`: [전](chrome-before.json) / [후](chrome-after.json) 통과. 400×675 dock 290px / preview 190.9×305px, 모달·포커스·대비·프레임·포스터 없는 진입·OCR 배너 축 통과. 이 고정 기준을 바꾸지 않았어요.
- 독립 리뷰: 1회 ACCEPT, 확정 P0/P1/P2 없음. 최대 2라운드 규칙에서 추가 리뷰를 사용하지 않았어요.

```sh
bun run dev --port 3712
bun scripts/measure-chrome.mjs --url http://localhost:3712/ --label check --theme light
bun scripts/measure-mobile-editor.mjs after /tmp/filme-mobile-check http://localhost:3712
bun docs/verification/mobile-editor-775-782-2026-09-17/deep-check.mjs /tmp/filme-mobile-check http://localhost:3712
bun docs/verification/mobile-editor-775-782-2026-09-17/panel-states.mjs /tmp/filme-mobile-check http://localhost:3712
```

브라우저 스크립트는 별도 임시 Chrome 프로필을 만들고 닫아요. 기존 사용자 브라우저·3711 서버는 건드리지 않았어요. 외부 OCR/KOBIS 실제 API 정확도와 실제 기기 JPEG는 이번 새 검증 범위 밖이에요.

## 남은 완료 조건 / 재개 위치

실제 iPhone Safari에서 네이티브 한글 입력·커서/삭제/undo, 작은 필드와 목록, slider 트랙 주변 탭/드래그, font 스크롤/선택, logo 입력 왕복, autosave 점/라벨, #585 숫자 키보드가 dock을 덮는지를 확인해야 해요. 증거가 없어서 이슈 전체 완료와 goal complete는 보류해요. Git 게시 승인도 없으므로 commit/push/PR/merge/이슈 변경은 하지 않았어요.

재개할 때는 이 표의 실제 기기 열과 최신 main 통합 여부부터 확인하고, 이미 통과한 로컬 검증을 무조건 반복하지 않아요. 이번 구현은 120분/80턴 제한 이전에 로컬 검증을 마쳤어요.

참고한 공식 동작 문서: [React input](https://react.dev/reference/react-dom/components/input), [MDN native range](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/range).
