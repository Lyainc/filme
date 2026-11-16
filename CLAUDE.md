# CLAUDE.md - AI Assistant Guidelines

## 🎬 Project: FILME
A Next.js web application for generating high-quality CGV Photoplay premium tickets.

이 파일은 **런타임에 지켜야 할 규칙과 포인터**만 쥔다. 실측 숫자·파괴 실험·이슈별 근거·이력은 `docs/`에 있고, 규칙마다 "근거:"로 가리킨다.

### 📂 Key Documentation References
Before making architectural changes or implementing new features, consult:
- **`README.md`**: 설치·실행·스택.
- **`docs/KOBIS_API.md`**: KOBIS 영화 검색 API 사용법.
- **`docs/PRINT_CALIBRATION.md`**: 실물 인쇄 캘리브레이션(`scripts/make-calibration-sheet.py`, 판독표, 실측 기록). 무드 선 굵기·폰트 크기·코너·export 여백을 건드리기 전에 읽을 것. **배경 도상은 "배경 도상 설계 하한" 절이 hard 제약**: stroke≥3px · 주기 하한 2종(톤 8px/무늬 16px) · alpha 0.08~0.14 · 계조는 밀도로만 · 도트 지름 0.37mm(7.9px) 정규 격자 · **선폭은 배치 폭에서 역산**(`viewBox 선폭 ≥ 602 ÷ 렌더폭px`, 상수 금지). 시안을 그리기 **전에** 읽을 것.
- **`docs/COPY_TONE_GUIDE.md`**: 서비스 UI 문구 톤 규칙. **새 사용자 노출 문구를 쓰기 전에 읽을 것.** 판별 둘: ① 라벨(`aria-label` 포함)에 조건절·종결어미·마침표가 있으면 위반(`-하기`는 허용), ② 실패·차단 문구는 [무슨 일] + [다음 행동] 두 문장, 한 문장 33자·전체 44자(문장 자리 전부). 문구를 바꿀 땐 그 문서의 "테스트가 잠근 문구" 표부터 볼 것(랜딩 이탈 경로 문구 하나가 테스트 9개에 걸린다). 티켓 렌더 문구·법적 고지는 범위 밖.
- **`docs/HARNESS.md`**: 크롬 측정 하네스(`scripts/measure-chrome.mjs`·`capture-export.mjs`·`measure-font-metrics.mjs`) 사용법·기준선·파괴 실험·stale 서버·워크트리 dev 함정. 하네스·레일 슬롯·프레임 봉쇄를 건드리기 전에 읽을 것.
- **`docs/TESTING.md`**: 테스트 규칙의 근거(CI timeout, mock.module 누수, 실행 순서 진단, DOM `received` 직렬화).
- **`docs/CONTRIBUTING.md`**: 리뷰 게이트·Git/릴리즈 규약의 근거, 철거된 기능(TMDB 등), OCR 최신성 판정 근거, LSP 툴링 메모.
- **`docs/user-testing/README.md`**: 사람 눈·기기 검증(Aside, iOS Simulator) 실행서와 케이스표.
- **스킬 위치**: `.agents/skills/<name>`이 canonical이고 `.claude/skills/<name>`은 그 심링크다(`.claude/skills/ocr-pipeline/SKILL.md` 같은 경로로 풀린다).
- 티켓 무드 사양·좌표·카탈로그는 아래 **"Core Mechanisms"** 절 + `src/utils/layouts.ts`.
- **UI 패턴 레퍼런스 3종**(외부): 앱 chrome UI(시트·드로어·모달·랜딩 진입·필드 에디터 = `src/components/v2/*`, `MobileEditorShell`)를 새로 만들거나 재설계할 때 **이름 → 규범 → 실무** 순으로 필요한 것만 본다.
  - **The Component Gallery** `https://component.gallery/components/<slug>` — 이름·별칭과 디자인 시스템별 정의.
  - **W3C ARIA APG** `https://www.w3.org/WAI/ARIA/apg/patterns/<slug>/` — 키보드·ARIA 규범. headless 프리미티브 없이 직접 구현하므로 **이 레포의 실질 스펙**이다(`FieldDrawer`의 `role="dialog"`·`aria-modal`·Escape·`focusin` 포커스 유지가 예).
  - **UX Patterns for Developers** `https://uxpatterns.dev/en/patterns/<category>/<slug>` — anatomy·접근성·테스트·안티패턴, 빈 상태·로딩·검증·토스트까지.
  - **접근 방법이 사이트마다 다르다**: component.gallery는 `curl -sL -A '<브라우저 UA>'`만, w3.org APG는 WebFetch만, uxpatterns.dev는 둘 다. 403 한 번으로 "접근 불가"로 접지 말 것.
  - **범위 밖**: 티켓 렌더 6무드(디자인 시안 소유), 그리고 **여기서 본 걸 근거로 UI 라이브러리를 새로 넣지 말 것** — 이 레포는 `cva`+`cn`(`src/utils/cn.ts`, `src/components/ui/variants.ts`)으로 직접 구현한다.

### 🔌 Claude Code 로컬 툴링
- **typescript-lsp 플러그인 "로드 안 됨" ≠ `LSP` 도구 고장.** `LSP` 도구는 플러그인과 무관하게 동작한다. harness-doctor 경고만 보고 판단하지 말고 한 번 찔러볼 것. 근거: `docs/CONTRIBUTING.md` 3절.

### 🧪 Testing
- **Runner**: `bun run test`(= `bun test --timeout 30000`). Tests live in `__tests__/` (not co-located).
- **맨 `bun test`로 재지 말 것** — bun 기본 5000ms라 CI가 못 내는 실패를 로컬에서만 낸다. `package.json`의 `test`/`test:watch`가 CI 값을 들고 있고, 한쪽만 바뀌면 `__tests__/ciLocalTimeoutParity.test.ts`가 깨진다. 근거: `docs/TESTING.md` 1절.
  - **테스트별 명시 timeout이 CLI `--timeout`을 이긴다.** 호출 방법에 안 기대는 방어는 파일에 명시값을 거는 것이다(`captureDualRendererPixelDiff.test.ts` — 무드 캔버스 합성 부류는 파일 전체가 같은 값). 근거: `docs/TESTING.md` 2절.
- **두 부류**: (1) 순수 유닛·static-markup(`renderToStaticMarkup`), (2) 상호작용 테스트 — happy-dom + `@testing-library/react` + `user-event`. 새 상호작용 테스트는 testing-library로(예: `__tests__/ocrUndoRestore.test.tsx`).
- **DOM 환경**: `bunfig.toml`의 `[test] preload = ["./__tests__/setup/happydom.ts"]`가 happy-dom 글로벌 + `IS_REACT_ACT_ENVIRONMENT`를 등록. 미구현 API(예: `scrollIntoView`)는 그 setup에 no-op 폴리필로.
- **모듈 mock**: bun `mock.module`은 hoisting 안 됨 — 등록 **후** `require(...)`로 import. top-level `await import`는 tsconfig `target:es5`에서 막히니 `require`.
- **mock.module 복원은 스프레드 스냅샷으로**: `const real = { ...require(p) }`로 복사해 두고 `afterAll`에서 그걸로 되돌릴 것(살아있는 네임스페이스면 복원이 no-op). 근거: `docs/TESTING.md` 5절.
- **실패가 macOS/Linux로 갈리면 실행 순서를 먼저 의심**하고 깨진 파일을 **단독 실행**한다(단독 통과 = 전역 누수). 근거: `docs/TESTING.md` 6절.
- **모듈 스코프 메모를 비워야 하면 `delete require.cache[...]` 말고 리셋 함수를 열 것**(`captureToImage.resetCtxFilterProbeForTest`). 근거: `docs/TESTING.md` 7절.
- **실패할 수 있는 단언의 `received`에 DOM 엘리먼트를 넣지 말 것 — `!!el`/`el === null`로 강제 변환**(특히 `waitFor` 안; 한 번 실패에 수백 MB·수 초). `bun run lint`가 `queryBy*`·`querySelector`·`closest`·`getElementById` 결과의 `toBeNull()`을 막지만 변수·헬퍼로 감싼 자리는 못 잡으니 손으로 `=== null`. 근거: `docs/TESTING.md` 8절.

### 📱 셸은 한 벌이다
데스크톱도 같은 `MobileEditorShell`을 `PhoneFrame`(400px, `container-type:size` + `contain:paint`)에 넣어 띄운다. 이원화 구조는 없다(철거 목록: `docs/CONTRIBUTING.md` 4절).
- **뷰포트 브레이크포인트는 `tailwind.config.js`의 `screens.rail`(1024px) 하나**고, 소비자는 `PhoneFrame`의 `rail:w-[400px]` 하나뿐이다.
- **길이는 프레임 기준이지만 조건은 아니다.** `contain:paint`는 fixed의 컨테이닝 블록과 cq 단위 기준점만 바꾸고 미디어쿼리는 안 옮긴다 — 프레임 형상에 따라 갈려야 하는 조건은 `@container`로(`--hero-dvh-budget`이 예: 1440×900 뷰포트는 landscape, 400×900 프레임은 portrait). 셸 안에 `vw`/`vh`/`rail:`/`useMatchMedia`를 심기 전에 "뷰포트 축인가 프레임 축인가"를 정할 것.
- **fixed 오버레이 좌표도 프레임 기준**이다. 이동식 툴바의 드래그·클램프·스냅은 `PhoneFrame`의 `getFrameRect()` — `window.innerWidth`로 계산하면 프레임 밖 좌표가 `localStorage`에 영속된다.

### 📏 크롬 측정 하네스 (400×675)
헤드리스 Chrome 하네스는 **CI·픽셀 측정 축**이다. 사용법·기준선·함정은 전부 `docs/HARNESS.md`. 여기엔 언제 돌리고 무엇이 게이트인지만 둔다.
- **저장물(export JPEG) 픽셀은 `scripts/capture-export.mjs`**(`--material/--coating/--intensity/--out`, `--compare a.jpg b.jpg`). 잡음 바닥 maxΔ 2, 허용치 3. **Stub 무드 픽셀 diff는 prod(`bun run build && next start`)로** — dev는 같은 코드 재캡처로 통제군부터. Web Share 흐름을 헤드리스로 재는 새 스크립트는 `canShare` 스텁이 필요하고, 종료는 `browser.close()` 3초 race + `process.exit(0)`. 근거: `docs/HARNESS.md` 2절.
- **폰트를 더하거나 바꾸면 `scripts/measure-font-metrics.mjs`를 다시 돌려** `_shared.tsx`의 `HANGUL_SIZE_SCALE`·`LATIN_SIZE_SCALE`과 `__tests__/userTextFontOptions.ts`를 **둘 다** 갱신(OS/2 sxHeight·sCapHeight 금지). 근거: `docs/HARNESS.md` 3절.
- **`bun scripts/measure-chrome.mjs --theme dark|light`**: dock·프리뷰 rect, 모달 포커스/닫기, 프레임 봉쇄, 랜딩·posterless 축. 레일 슬롯을 열고 재는 게 전제고 불변식은 **dock 290 / 프리뷰 190.9×305**. 세션 tmp에 다시 쓰지 말 것. 근거: `docs/HARNESS.md` 4절.
  - **새 축을 넣으면 `process.exitCode`에도 실을 것** — 출력만 하는 축은 파괴해도 exit 0이다. **`checked:false`는 실패**다.
  - **`railSlot`은 게이트가 아니라 관측값**이다(`overflows:false`를 불변식으로 걸지 말 것).
  - **`DesignRail.tsx` 슬롯 높이를 건드리면 스크립트 `BASELINE`과 이 파일의 dock/프리뷰 숫자를 같이 다시 잴 것.** 불일치는 `__tests__/measureChromeBaselineCoupling.test.ts`가 잡는다. 근거: `docs/HARNESS.md` 5절.
  - **`.github/workflows/chrome-harness.yml`이 push마다 돌지만 required가 아니다.** ubuntu 러너와 macOS 로컬은 같은 px를 내니 러너에서만 나는 실패는 진짜 회귀이거나 stale 서버다. 러너는 `CHROME_PATH=/usr/bin/google-chrome`. 근거: `docs/HARNESS.md` 6절.
- **대조 기준은 `#phone-frame` rect다.** 프레임이 400×675면 뷰포트와 무관하게 같은 불변식. 근거: `docs/HARNESS.md` 7절.
- **하네스 함정은 stale 서버다.** 포트가 물려 있으면 새 `next start`는 `EADDRINUSE`로 죽고 앞 서버가 200을 준다. 지금 빌드를 재는지 확인하고, 크롭 모달이 안 열리면 **콘솔의 chunk 404**부터. 근거: `docs/HARNESS.md` 8절.
- **워크트리 dev는 `bun run dev`, 포트는 나눌 것** — `bun run dev --port 3010` + 하네스 `--url http://localhost:3010/`. 근거: `docs/HARNESS.md` 9절.
- **프레임 봉쇄 축**(크롭 모달·필드 드로어·편집 메뉴·max 오버레이·결과 스테이지·hero가 프레임 안인지)은 dock/프리뷰 불변식이 못 보는 축이다. `backdrop` 축은 부재 확인이니 배경을 되살리면 봉쇄 축도 같이 되살릴 것. 근거: `docs/HARNESS.md` 10절.
- **`landingShownOnDraft`·`posterless` 축은 draft를 심은 메인 페이지에서 잰다**(저장분 없는 컨텍스트에선 조용히 통과). `MobileEditorShell` 랜딩 판정에 `croppedImageUrl`을 넣지 말 것. fit 스테이지의 `background: 'var(--workbench)'`·`flex-1`·`mode === 'hidden'` 분기는 각각 자기 축으로 운다. 근거: `docs/HARNESS.md` 11절.

### 🔬 검증 도구 (사람 눈·기기)
브라우저·시각 검증은 아래 둘을 쓴다. 실행서와 케이스표: `docs/user-testing/README.md`.
- **Aside**(`aside` CLI): 위임은 `aside exec`, DOM·스크린샷 검사는 `aside repl`(모바일 폭은 `page.setViewportSize`). **먼저 `aside guide`를 읽을 것.**
- **iOS Simulator**: `scripts/ios-sim/`(Appium XCUITest 합성 터치). 런타임 iOS 26.5/27.0/27.1.
- 헤드리스 Chrome 하네스는 위 📏의 CI·픽셀 측정 축으로 **그대로 남는다 — Aside가 대체하지 않는다.**
- **Android Emulator는 이 머신에 없다.** Android 커버리지를 주장하지 말 것(#585 보류). **iOS Simulator PASS는 실기기 iPhone PASS가 아니다.**

### 🔎 Code Review
- **게이트는 두 축이다.** ① **`.github/workflows/ci.yml`(`bun install --frozen-lockfile` → `typecheck` → `bun test`)이 결정적 correctness의 유일한 required 게이트**. ② **`claude-review` 액션은 required가 아닌 fresh-eyes 패스**이고, 기댈 축은 CI가 못 잡는 것 하나다: **없는 테스트, CLAUDE.md에만 사는 불변식 위반, 사라진 사용자 경로.**
- **`required_status_checks.strict`는 false다.** stale base 머지가 허용되고 rebase 후 조합은 `push: main`이 관측만 한다.
- **push 전 claude 리뷰는 액션과 중복이라 습관으로 돌리지 않는다.** `/code-review ultra`·high는 아주 무겁거나 복잡한 변경에서만. `/simplify`는 품질 패스가 필요할 때 별도로.
- 근거: `docs/CONTRIBUTING.md` 1절.

### 🌱 Git & Commit Conventions
- **Merge policy = rebase merge**(squash/merge-commit 비활성). PR 커밋이 main에 그대로 올라가니 각 커밋은 atomic하고 메시지가 깔끔해야 한다. WIP·"fix typo"는 push 전 정리.
- **Conventional Commits 필수**: `type(scope): 설명`(한국어/영어 혼용 가능).
  - **type**: `feat` · `fix` · `docs` · `perf` · `chore` · `refactor` · `test`
  - **scope**: 변경 영역 소문자(`result`, `ui`, `ocr`, `kobis`, `form`, `share`, `moods`, `editor`, `chrome`, `color`, `typography`, `server`, `blob` …)
  - **이슈 참조**: 메시지 끝에 `(#NN)`.
- **머지 후 브랜치 자동삭제**. 로컬 정리는 `git fetch --prune`.
- **자동 semver 릴리즈**: 머지된 PR의 `release` 라벨(주 트리거) 또는 미릴리즈 user-visible 커밋 70개(백스톱)로 `.github/workflows/auto-release.yml` + `scripts/next-version.mjs`가 태그+GitHub release만 만든다. **`package.json`의 `version`은 올리지 않는다.** 세부: `docs/CONTRIBUTING.md` 2절.
- **같은 파일을 건드리는 PR이 동시에 열려 있으면, 나중에 머지하는 쪽은 머지 직전 로컬에서 rebase 후 `bun run typecheck`를 직접 돌릴 것** — 같은 import를 다른 줄에 넣은 두 PR은 git도 `bun test`도 못 잡아 main에 `TS2300`이 들어간다. CI 초록은 rebase 전 스냅샷일 수 있다.

### 🧑‍💻 Coding Standards & Vibe Coding
- **Iterative Delivery**: Prioritize working code over perfect architecture. Implement, verify, then refactor.
- **No Over-abstraction**: Keep components direct and simple. No Strategy/Factory patterns without an immediate practical need.
- **State Management**: Stick to `useState` unless the state logic becomes overwhelmingly complex.
- **Types**: Shared types in `src/types/index.ts`. Use implicit inference where appropriate.
- **Inline style — no `font` shorthand**: Always split into `fontWeight` / `fontStyle` / `fontSize` / `fontFamily`. The shorthand resets `line-height` and triggers React's "Removing font lineHeight" warning at every rerender.
- **주석의 근거 인용은 이슈 번호나 `docs/*.md` 절로** — CLAUDE.md는 규칙 문서라 언제든 줄어든다. `src`·`__tests__`·`scripts`의 CLAUDE.md 인용은 `__tests__/noClaudeMdCitations.test.ts`가 막는다.

### 🖼️ Core Mechanisms (6-Mood Ticket Rendering)
- **사이즈 정책** — 포스터 비율과 캔버스 비율은 **다른 축**이고, `src/utils/constants.ts`가 별도 상수로 든다(`POSTER_*` vs `TARGET_*`).
  1. 일반 포스터 = **0.667**(세로 2:3 / 가로 3:2). 크롭 프리셋(`POSTER_RATIO`)과 크롭 출력(`POSTER_WIDTH`×`POSTER_HEIGHT` = 960×1440)이 같은 상수에서 나온다 — 갈리면 `getCroppedImg`가 크롭을 늘여 그린다.
  2. 무드 캔버스 = **0.626**(신용카드, `TARGET_WIDTH`×`TARGET_HEIGHT` = 960×1534). 6무드 전부 이 값 또는 역수(가로).
  3. 풀블리드 포스터(0.667)가 0.626 캔버스에 들어가 생기는 좌우 레터박스는 **blur 포스터 배경이 덮는다**.
  4. 풀블리드가 아닌 무드도 캔버스는 0.626.
  5. 무드 안에 삽입되는 프레임/도판/컬럼도 0.667(가로 슬롯이면 1.5). 판정 대상은 슬롯 **박스**가 아니라 그 안의 **포스터 프레임**이다 — contain이면 프레임이 자동으로 0.667이고, 남는 여백은 blur다. 슬롯 박스 자체를 0.667/1.5로 맞추면 풀블리드가 된다(Stub 밴드 960×640이 그 경우, 세로 크롭이 오면 프레임 427×640 + 좌우 blur).
- **포스터 fit 기본은 contain** — `posterFitProps`가 6무드 공통으로 `fit: 'contain'` + blur 레터박스를 준다. **cover는 minimal 한정 opt-in**이다: DESIGN '크기'의 "꽉 채우기" 토글이고, 노출 무드는 `POSTER_FILL_MOODS`(`src/constants/fields.ts`)가 단일 소스로 쥔다(토글 노출과 무드의 `posterFit` 소비가 이 표에 맞춰 같이 움직여야 한다). 다른 무드는 슬롯이 이미 0.667이라 cover=contain이다. 크롭 모달의 "원본 비율 보존" 토글은 **크롭 프레임 비율만** 정한다(ON=이미지 자연비 + `maxSide` 출력, OFF=0.667 표준 + 960×1440). **예외**: 35mm·35mm Wide·Criterion은 고정 비율 컷/도판이라 `posterFitProps`를 안 타고 `Poster`를 직접 부르며(`frameInsetY`를 실으면 레터박스 0이 깨진다), 그중 35mm Wide 포스터 컷만 **`fit="cover"`**다.
- **크롭 프리셋 방향은 캔버스가 아니라 포스터 슬롯을 따른다** — 판정 소스는 `LayoutSpec.posterOrientation`(`src/utils/layouts.ts`, 필수 필드; 캔버스 축 `orientation`과 다른 이유는 그 필드 주석). 가로면 프리셋 `POSTER_LANDSCAPE_RATIO`(3:2), 출력 `posterOutputSize` 1440×960. 자동 프리셋이지 잠금이 아니고, 무드를 바꿔도 확정된 크롭은 유지된다(무드별 재크롭은 범위 밖). 프리셋 판정은 `ImageCropModal` 한 곳에만 산다. **가로 슬롯은 35mm Wide 컷(926×617)과 Stub 밴드(960×640) 둘**이고, 캔버스 가로 2종(editorial·35mm Wide)과 목록이 겹치지 않는다 — 두 축은 독립이다.
- **Shared primitives**: `src/components/moods/_shared.tsx` — `Barcode`(memoized), `ChainStamp`, `FormatStamp`, `Poster`, 35mm 계열 필름 프리미티브(`FilmStripBand`·`FilmRail`·`FilmCreditCut`·`CutFrameLabel`·`FilmGrain`·`FilmCutEdges`), helpers(`fitFontSizeToWidth`, `isInkDark`, `truncateActors`), font tokens(`FONT_MONO`, `FONT_SANS`, `FONT_KR`). **새 공용 헬퍼는 여기에**.
- **Renderer**: `src/components/TicketRenderer.tsx` — 활성 무드로 디스패치, `ResizeObserver`로 natural-pixel 트리를 프리뷰에 맞춰 스케일, export 파이프라인이 스케일 전 DOM을 잡도록 inner ref를 넘긴다.
- **Picker**: `src/components/LayoutPicker.tsx` — `LayoutStrip`(46px 무드 칩, scroll-snap, `designRailItems.tsx`가 소비)과 `MOOD_CHIP_BG`(`Record<LayoutId, ...>`; 레이아웃 id를 바꾸면 컴파일 타임에 깨진다).
- **Export**: `src/utils/captureToImage.ts` — `document.fonts.ready` + 이미지 로드를 기다리고, `html-to-image`를 동적 import, 캡처 중 `transform: 'none'`(프리뷰 스케일이 출력을 왜곡하지 않게). 출력은 natural 크기 + 인쇄 여백 10px/변(`EXPORT_MARGIN_PX`) × `pixelRatio: 2` JPEG data URL — 1960×3108 세로 / 3108×1960 가로.
- **Memory Management**: 크롭 이미지 blob URL은 항상 `URL.revokeObjectURL`. 다운로드(`downloadTicketAsJpeg`)는 data URL을 `atob` → `Uint8Array` → `Blob` → `createObjectURL`로 풀고 앵커 클릭 뒤 revoke. **`fetch(data:)` 금지** — Vercel CSP `connect-src`가 막는다.
- **Logos**: **번들 로고는 없다**(저작권). 사용자가 필드 드로어(`src/components/v2/FieldDrawer.tsx`)의 극장/포맷 행이나 온티켓 인플레이스 에디터(`src/components/v2/InPlaceFieldEditor.tsx`)에서 올리고, 각각 자유 비율 크롭(`useLogoCrop` + `ImageCropModal`)을 거친다. `FieldEditorBody.tsx`에서 앱이 import하는 건 `DateSheet`·`INPUT_CLS`·`KobisResultList`뿐이다.
- **Dashed Placeholders**: 보이는 체인/포맷 스탬프는 업로드 로고 → 비어 있지 않은 텍스트 라벨 → 둘 다 없을 때만 점선 자리표시(프리뷰 전용, `ChainStamp`/`FormatStamp`). 자리표시는 `data-hide-on-export`로 캡처에서 빠진다.

### 🔍 OCR Pipeline (티켓 스크린샷 자동 인식)
- 규칙이 전부 실측(실 티켓 15장 A/B)에서 나왔으니 **가볍게 고치지 말 것**. OCR 파일(`src/utils/ocr.ts`·`ocrPreprocess.ts`·`ratelimit.ts`, `src/pages/api/ocr.ts`, `scripts/ab-ocr-*`)을 읽거나 고치기 전에 **`.claude/skills/ocr-pipeline/SKILL.md`를 읽을 것** — 프롬프트 규칙, Zod 전 필드 `.nullable()`, `@ai-sdk/google` 3.0.91 고정, rate limit 4겹, A/B 하네스.
- **최신성 판정은 카드가 아니라 셸이 소유한다 — `mountedRef` 가드를 넣지 말 것.** in-flight KOBIS 보강은 셸의 `ocrEpochRef`(`useOcrUndo`의 `epochRef`) epoch 비교로 판정하므로 `OcrUploadCard` unmount와 무관하다. 카드를 단일 인스턴스로 두는 건 진입점을 안 늘리려는 배치 결정이다.
- **KOBIS 보강은 `setInfo`가 아니라 조회 시작 때 캡처한 `usePhototicket.captureMovieSelection()` 적용기로만 쓴다** — 조회 중의 영화 선택·제목 수정·전역 undo·문서 리셋이 늦은 결과를 버린다. **OCR 응답은 `runOcr` 전에 `captureDraft()`로 잡은 초기화 세대만 본다**(`docEpochRef`·영화 선택은 보지 않음 — 랜딩의 "새로 시작"이 인식 중인 OCR이 들어갈 새 문서를 여는 것이라서). 근거: `docs/CONTRIBUTING.md` 5절.

### 🚧 Current Project Status
- **TMDB 등 인앱 포스터 검색을 넣지 말 것.** 약관(AI 애플리케이션 금지·파생물 금지·상업적 사용 별도 동의)을 코드로 못 풀고, "OCR 제목 → 포스터 자동 검색"이 그 정면이다. **KOBIS는 그대로**(메타데이터). 포스터는 사용자 업로드가 주 경로이고 포스터 없이 시작할 수 있다. 근거: `docs/CONTRIBUTING.md` 4절, `docs/NATIVE_IOS_RFC.md` §7.1·§9.
- **일부러 남긴 것**: 랜딩 이탈 경로 문구 쌍 **"포스터 업로드 · 포스터 없이 직접 입력"**(테스트가 정확히 기대, `docs/COPY_TONE_GUIDE.md`), 호출부 0인 `usePhototicket.fillEmptyMovieInfo`와 `__tests__/fillEmptyMovieInfoRatingZero.test.tsx`(다음 자동 보강 경로에서 필요 — 미사용 export라고 지우지 말 것).
- **진행 중**: 앱 화면·무드 리뉴얼은 에픽 #826이 다룬다.
