# #826 앱 화면 방향 목업

#826 리뉴얼 진행 순서 2단계(방향 목업)의 산출물이에요. 방향 네 개를 나란히 놓고 소유자가 고르도록 만든 로컬 HTML이고, 프로덕션 코드(`src/`)는 건드리지 않아요. 고른 뒤의 디자인 시스템·페이지 마스터·Seed는 이 디렉터리의 범위가 아니에요.

## 여는 법

빌드 없이 `index.html`을 브라우저로 열면 돼요(`file://`로도 동작해요). 각 방향은 `a-workbench.html`·`b-flow.html`·`c-canvas.html`·`d-document.html`이에요.

| 파일 | 방향 | 한 줄 |
| --- | --- | --- |
| `a-workbench.html` | A 작업대 (기준안) | 티켓 중앙 + 하단 6탭 도구 + 공통 패널. `feat/mobile-editor-mockups`의 `docs/mockups/filme-mobile-v2/` v7을 옮기고 #826 코멘트가 지적한 결함(캐러셀 정지 수단, 라이트 전용, 개봉연도 미요구)을 고친 판 |
| `b-flow.html` | B 단계 흐름 | 가져오기 → 정보 → 꾸미기 → 완성, 한 화면엔 한 단계 조작만 |
| `c-canvas.html` | C 캔버스 직접 조작 | 상시 dock 없이 티켓 요소를 눌러 선택 → 문맥 툴바·시트 |
| `d-document.html` | D 한 장 문서 | 상단 접히는 프리뷰 + 모든 설정이 이어지는 단일 목록 |

## 구성

- `shared/directions.js`: 방향별 원칙 단락, 세 문제(정돈·공간·이음새)를 푸는 방식, #826 이관 요구 6개 수용
- `shared/features.js`: 현재 앱 기능 52개 → 방향별 행선지. 사라지는 기능은 `제거:`로 시작하고 근거를 붙여요. 기능은 남고 조작 형태만 바뀌는 건 `형태 변경:`으로 적어요
- `shared/render.js`: 위 데이터를 각 방향 페이지와 비교 페이지에 그리고, 캐러셀 정지/재생·테마 토글을 배선해요
- `shared/base.css`: 공용 토큰(라이트·다크 같은 수준)과 화면 골격. 프로덕션 토큰이 아니라 비교용 근사값이에요
- `verification/`: Aside 393px·375px 스크린샷과 기록

## 기준 자료

- 기준안: `origin/feat/mobile-editor-mockups` (d04719c)의 `docs/mockups/filme-mobile-v2/design.md`·기능 보존표·`verification/v7-*.png`. main에는 넣지 않고 비교 자료로 둬요(#826 2026-11-09 코멘트).
- 보조: `docs/design_handoff_editor_chrome_v8/design/Siyan-C-v8.dc.html`. 떠 있는 툴바·온티켓 드로어·무박스 스타일 dock은 현재 앱에 이미 들어가 있어서, 기능 보존표의 "지금 위치" 열이 사실상 v8 반영 상태예요.
- 현재 기능 인벤토리: main 203ee7c의 `src/components/v2/*`, `src/pages/index.tsx`, `ResultPanel`, `/t/[id]`.

## 경계

- 티켓 그림은 960×1534 비율만 맞춘 자리표시예요. 무드 렌더 리뉴얼은 #826의 별도 갈래예요.
- 검색·OCR·저장·공유·키보드는 그림이에요. 동작하는 건 캐러셀 정지/재생, 슬라이더, 테마 토글, 비교 페이지의 강조·열 숨김뿐이에요.
- 렌더 확인은 Aside로 393px·375px에서 했어요. 헤드리스 하네스나 iOS Simulator 결과가 아니고 실기기 PASS도 아니에요. Android는 #585 보류라 주장하지 않아요.
