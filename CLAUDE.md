# CLAUDE.md - AI Assistant Guidelines

## 🎬 Project: FILME
A Next.js web application for generating high-quality CGV Photoplay premium tickets.

### 📂 Key Documentation References
Before making architectural changes or implementing new features, consult:
- **`README.md`**: Project setup, running instructions, and tech stack overview.
- **`docs/KOBIS_API.md`**: Instructions and examples for using the KOBIS movie search API.
- **`docs/PRINT_CALIBRATION.md`**: 실물 인쇄 캘리브레이션 — `scripts/make-calibration-sheet.py` 사용법 + 도안 판독표 + 실측 기록(메가박스 실측·풀블리드 예측·선폭/폰트/톤 하한). 무드 선 굵기·폰트 크기·코너·export 여백을 건드리기 전에 읽을 것.
- Ticket design specs/layout coords/mood catalog live in this file's **"Core Mechanisms (6-Mood Ticket Rendering)"** section + `src/utils/layouts.ts` — not a separate doc.
- **`docs/PRD.md`**, **`docs/DESIGN_SYSTEM.md`**: deprecated (2026-07-19) — pre-#281/#449 snapshots that no longer match current architecture/mood count. Kept for history only; do not treat as current spec.

### 🧪 Testing
- **Runner**: `bun test`. Tests live in `__tests__/` (not co-located).
- **두 부류**: (1) 순수 유닛·static-markup(`renderToStaticMarkup`), (2) **상호작용 테스트** — happy-dom + `@testing-library/react` + `user-event`로 사용자 동작→상태→결과를 검증(#163).
- **DOM 환경**: `bunfig.toml`의 `[test] preload = ["./__tests__/setup/happydom.ts"]`가 happy-dom 글로벌 + `IS_REACT_ACT_ENVIRONMENT`를 등록. happy-dom 미구현 API(예: `scrollIntoView`)는 그 setup에 no-op 폴리필로 추가.
- **모듈 mock**: bun `mock.module`은 hoisting 안 됨 — mock 등록 **후** `require(...)`로 대상(예: `runOcr`)을 import해야 가로채짐. top-level `await import`는 tsconfig `target:es5`에서 막히니 `require` 사용.
- **mock.module 복원은 반드시 스프레드 스냅샷으로**(#611). `mock.module`은 프로세스 전역이고 파일이 끝나도 안 풀린다. `const real = require(p)`로 **살아있는 네임스페이스**를 붙들면 뒤이은 `mock.module(p, ...)`이 그 객체를 제자리에서 갈아끼우므로, `afterAll`의 `mock.module(p, () => real)`은 이미 스텁이 된 자기 자신을 다시 설치하는 **no-op**이다. 반드시 `const real = { ...require(p) }`로 복사해 두고 그걸로 되돌릴 것 — 안 그러면 스텁이 프로세스 끝까지 남아 뒤에 도는 파일이 깨진다.
- **실패가 macOS/Linux로 갈리면 플랫폼이 아니라 실행 순서를 먼저 의심할 것**(#611). `bun test`의 파일 실행 순서는 플랫폼마다 다르고, **인자로 준 순서를 따르지도 않는다** — 그래서 "CI 순서를 로컬에서 재생했는데 통과했다"는 순서 의존을 배제하지 못한다. 대신 **깨진 파일을 단독 실행**해 보라(단독은 통과 = 전역 누수, 단독도 실패 = 진짜 환경 결합). #611의 42개는 전부 전자였다.
- **모듈 스코프 메모를 테스트가 비워야 하면 `delete require.cache[...]` 말고 리셋 함수를 열 것**(#611). 그 모듈이 어딘가에서 한 번이라도 `mock.module`되면 캐시를 지워도 mock 레지스트리가 먼저 잡아 같은 인스턴스를 돌려줘 우회가 조용히 무력화된다 (`captureToImage.resetCtxFilterProbeForTest` 참고).
- **회귀 테스트 예**: `__tests__/ocrUndoRestore.test.tsx` — OCR undo가 chainVisible/chainLabel + 폼 필드를 원자 복원하는지(#141 P1) 검증. 새 상호작용 테스트는 testing-library로 통일 권장.

### 📱 셸은 한 벌이다 (#603 → #607)
데스크톱/모바일 이원화는 **삭제됐다.** `DesktopStudioShell`·`ImageUploader`·`FieldAccordion`·`DesktopDesignPanel`·`AppHeader`·`ThemeToggle`·`src/utils/breakpoints.ts`가 사라졌고, `pages/index.tsx`의 `useMatchMedia` 셸 분기(`mounted`·`isMobile` SSR 왕복)도 없다. 데스크톱은 같은 `MobileEditorShell`을 `PhoneFrame`(400px, `container-type:size` + `contain:paint`)에 넣어 띄운다.
- **뷰포트 브레이크포인트가 남은 자리는 `tailwind.config.js`의 `screens.rail`(1024px) 하나**고, 소비자도 `PhoneFrame`의 `rail:w-[400px]` 하나뿐이다. JS 미러(`RAIL_BREAKPOINT_PX`)가 없어져 #104의 dead zone 위험이 구조적으로 소멸했다.
- **길이는 프레임으로 옮겨졌지만 조건은 아니다.** `contain:paint`는 fixed의 컨테이닝 블록과 cq 단위 기준점만 바꾸지 미디어쿼리를 안 옮긴다 — 프레임 형상에 따라 갈려야 하는 조건은 `@container`로 써야 한다(`--hero-dvh-budget`이 그 예: 1440×900 뷰포트는 landscape인데 400×900 프레임은 portrait이다). 새 `vw`/`vh`/`rail:`/`useMatchMedia`를 셸 안에 심기 전에 "이게 뷰포트 축인가 프레임 축인가"를 먼저 정할 것.
- **fixed 오버레이 좌표도 프레임 기준**이다. 이동식 툴바의 드래그·클램프·스냅은 `PhoneFrame`의 `getFrameRect()`를 쓴다 — `window.innerWidth`로 계산하면 400px 프레임 밖 좌표가 `localStorage`에 영속된다.

### 📏 크롬 측정 하네스 (400×675)
- `scripts/measure-chrome.mjs` (`bun scripts/measure-chrome.mjs --theme dark|light`) — dock·프리뷰 rect, 레일 슬롯 넘침, 항목별 WCAG 대비, 모달 포커스/닫기/클릭통과를 한 번에 잰다. **레일 슬롯을 열고 재는 게 전제**다(#563 불변식 dock 232.6 / 프리뷰 226.8×362.3은 열린 상태 기준 — 안 열면 dock 114.5가 나오고 스크립트는 조용히 성공한다). 세션 tmp에 다시 쓰지 말 것(#586, 여섯 번 반복됨).
- **대조 기준은 뷰포트가 아니라 `#phone-frame` rect다**(#609). 예전엔 `VW===400 && VH===675`로 게이팅해 `--viewport 1440x675`로 돌리면 프레임이 망가져도 `checked:false` + exit 0으로 조용히 통과했다. 지금은 프레임이 400×675면 뷰포트와 무관하게 같은 불변식을 대조한다(1440×675 → 프레임 400×675 at x=520, dock·프리뷰 값 무변경). **`checked:false`는 통과가 아니라 실패다** — 못 재면 그대로 exit 1이라, 1440×900(프레임 400×900)은 이 불변식의 대상이 아니라 실패로 나온다.
- **하네스는 dev 전용이 아니다 — 함정은 stale 서버다**(#601, 2026-07-31 실측 정정). `bun run build && next start`로 **새로** 띄운 prod에서 세 하네스가 다 돌고, px 불변식도 dev와 같은 값이 나온다(dock 232.6 / 프리뷰 226.8×362.3 동일, frameFit 전부 통과). #601이 "prod에선 크롭 '적용'이 끝까지 안 뜬다"로 잡았던 건 앱 버그도 DataTransfer 주입 아티팩트도 아니고, **하루 전부터 떠 있던 `next start`가 옛 빌드의 HTML을 주던 것**이었다 — `_next/static/chunks/*.js`가 전부 404라 앱이 하이드레이션을 못 하고, 그래서 파일 input에 핸들러가 안 붙어 **모달이 아예 안 열린다**(`dialogOpen:false`). 같은 서버에서 DataTransfer 주입과 CDP 실제 파일 선택이 **똑같이** 실패하고, 새 서버에선 **둘 다** 통과한 게 근거다.
  - 착각이 성립하는 이유: 포트가 이미 물려 있으면 새 `next start`는 `EADDRINUSE`로 죽는데 **앞 서버가 그대로 200을 준다.** "방금 띄운 서버"라고 믿은 게 남의 프로세스였다. 재는 대상이 진짜 지금 빌드인지부터 확인할 것.
  - 진단 순서: 크롭 모달이 안 열리면 앱을 뒤지기 전에 **콘솔의 chunk 404**를 본다. 그게 있으면 서버 문제고, 앱 코드는 무관하다.
- **두 번째 축은 프레임 봉쇄다**(#609). 크롭 모달·필드 드로어·편집 메뉴·max 오버레이·결과 스테이지·결과 hero가 프레임 사각형 안인지 방향별 넘침으로 잰다. dock/프리뷰 숫자가 원리적으로 못 보는 축인 게 실측으로 증명돼 있다 — `PhoneFrame`의 `contain:paint`를 지우면 fixed 오버레이 3종이 좌 520px 넘치는데 **dock/프리뷰 불변식은 그대로 통과한다.**

### 🔎 Code Review
- **게이트는 두 축이고 소유가 갈린다**(#593·#594). ① **`.github/workflows/ci.yml`이 결정적 correctness의 유일한 게이트다** — `bun install --frozen-lockfile` → `bun run typecheck` → `bun test`가 모든 PR에서 돌고, main 브랜치의 required check는 이것이다. ② **`claude-review` 액션은 그 위의 fresh-eyes 패스로 required가 아니다**(워크플로는 유지되고 코멘트도 계속 붙는다). required에서 뺀 근거는 그게 실제로 차단하던 명제가 "코드가 안전한가"가 아니라 "코멘트가 0개가 아닌가"였고(실측 PR 6개에서 P0 0건), 그래서 OAuth 토큰 만료나 API 장애가 코드와 무관한 머지 차단이 됐기 때문이다. 대신 그 리뷰에 기대는 축은 CI가 원리적으로 못 잡는 것 하나다: **없는 테스트, CLAUDE.md에만 사는 불변식 위반, 사라진 사용자 경로.**
- **`required_status_checks.strict`는 false다.** true면 머지 하나가 열린 PR 전부의 체크를 무효화해 하루 6머지(2026-07에 182 PR)에서 재검증이 연쇄한다. 대가로 stale base 머지가 허용되고, rebase 후 조합은 `push: main` 트리거가 **관측만** 한다 — 그때는 이미 prod 배포가 나간 뒤라 차단 수단이 아니다.
- **push 전 claude 리뷰는 이 액션과 중복이라 습관으로 돌리지 않는다.** 특히 Workflow-backed `code-review`(`/code-review ultra`·high 워크플로, subagent 다수·고비용)는 같은 "claude가 diff 리뷰"를 한 번 더 하는 거라 아주 무겁거나 복잡한 변경에서 PR 전 깊이가 필요할 때만 쓴다(예: 3파일 변경에 에이전트 7개·38만 토큰 #287은 과투입).
- `/simplify`(재사용·단순화·altitude 정리)는 액션의 correctness 축과 겹치지 않으니 품질 패스가 필요할 때 별도로 쓴다.

### 🌱 Git & Commit Conventions
- **Merge policy = rebase merge** (squash/merge-commit는 GitHub에서 비활성화). PR의 커밋이 **main에 그대로(verbatim) 올라오므로**, 각 커밋은 atomic하고 메시지가 깔끔해야 한다. WIP·"fix typo" 같은 커밋은 push 전 정리(squash/reword)할 것.
- **Conventional Commits 필수**: `type(scope): 설명` 형식. 설명은 한국어/영어 모두 허용(레포 혼용).
  - **type**: `feat` · `fix` · `docs` · `perf` · `chore` · `refactor` (관찰된 어휘 — 새 type은 신중히)
  - **scope**: 변경 영역 소문자 (예: `result`, `ui`, `ocr`, `kobis`, `form`, `share`, `moods`, `editor`, `chrome`, `color`, `typography`, `server`, `blob`)
  - **이슈 참조**: 관련 이슈는 메시지 끝에 `(#NN)`로 표기 (예: `fix(ocr): undo 배너 위치 개선 (#96, #97)`)
- **머지 후 브랜치 자동삭제**(`delete_branch_on_merge: true`). 로컬 stale 정리는 `git fetch --prune`.

### 🧑‍💻 Coding Standards & Vibe Coding
- **Iterative Delivery**: Prioritize working code over perfect architecture. Implement, verify, then refactor.
- **No Over-abstraction**: Keep components direct and simple. Don't add complex design patterns (like Strategy/Factories) unless there is an immediate practical need.
- **State Management**: Stick to `useState` unless the state logic becomes overwhelmingly complex.
- **Types**: Define types locally in `src/types/index.ts` if shared. Use implicit inference where appropriate.
- **Inline style — no `font` shorthand**: Always split into `fontWeight` / `fontStyle` / `fontSize` / `fontFamily`. CSS `font` shorthand resets `line-height` to `normal`, which collides with a sibling `lineHeight` prop and triggers React's "Removing font lineHeight" warning at every rerender.

### 🖼️ Core Mechanisms (6-Mood Ticket Rendering)
- **사이즈 정책(#525)** — 포스터 비율과 캔버스 비율은 **다른 축**이다. `src/utils/constants.ts`가 둘을 별도 상수로 들고 있다(`POSTER_*` vs `TARGET_*`).
  1. 일반 포스터 = **0.667**(세로 2:3 / 가로 3:2). 크롭 프리셋(`POSTER_RATIO`)과 크롭 출력 해상도(`POSTER_WIDTH`×`POSTER_HEIGHT` = 960×1440)가 같은 상수에서 나온다 — 갈리면 `getCroppedImg`가 크롭을 늘여 그린다.
  2. 무드 캔버스 = **0.626**(신용카드, `TARGET_WIDTH`×`TARGET_HEIGHT` = 960×1534). 6무드 전부 이 값 또는 그 역수(가로).
  3. 풀블리드 포스터는 0.667이 0.626 캔버스에 들어가 좌우 레터박스가 생긴다 — **blur 포스터 배경이 덮는다**(#440).
  4. 풀블리드가 아닌 무드도 캔버스는 0.626으로 통일.
  5. 무드 안에 별도 삽입되는 프레임/도판/컬럼도 0.667(가로 슬롯이면 그 역수 1.5). 슬롯 **박스**가 아니라 그 안에 서는 **포스터 프레임**이 판정 대상이다 — contain이면 프레임이 자동으로 0.667이라, 슬롯 박스가 0.667이 아니어도 룰 5는 만족한다. 다만 그때 남는 여백은 전부 blur라, 슬롯 박스 자체를 0.667/1.5로 맞추면 풀블리드가 된다: Stub 밴드가 #527에서 960×900(1.067, 좌우 blur 37.5%) → **960×640(3:2)**으로 이동한 근거다(밴드 폭이 캔버스 960으로 잠겨 있어 3:2를 지키는 최대 크기가 유일하게 그것). 세로 크롭이 넘어오면 프레임 427×640 + 좌우 blur 55.6%.
- **포스터 fit 기본은 contain**(#440 → #525 → #527) — `posterFitProps`가 6무드 공통으로 `fit: 'contain'` + blur 레터박스 배경을 준다. `components.posterFit`의 **전 무드 'cover' opt-in은 #525에서 폐지**됐다: 사용자가 0.667로 잡은 프레임을 슬롯 비율에 맞춰 다시 잘라내 크롭 화면과 결과가 어긋났고, 그 잘림이 룰 5 위반의 유일한 출처였다. 단 **#527이 minimal 한정으로 되살렸다** — DESIGN '크기' 섹션의 "꽉 채우기" 토글이고, 노출 무드는 `POSTER_FILL_MOODS`(`src/constants/fields.ts`)가 단일 소스로 쥔다(토글 노출과 무드의 `posterFit` 소비가 이 표에 맞춰 같이 움직여야 한다 — 한쪽만 늘리면 죽은 컨트롤이나 조용한 잘림이 남는다). 목록이 minimal 하나인 근거는 그 상수 주석의 실측이다: minimal(0.626 캔버스)만 cover가 가로 6.13%를 깎고, 나머지 무드는 슬롯이 이미 0.667이라 cover=contain이라 옵션에 의미가 없다. 크롭 모달의 "원본 비율 보존" 토글은 이제 **크롭 프레임 비율만** 정한다(ON=이미지 자연비 + `maxSide` 출력, OFF=0.667 표준 + 960×1440). **예외**: v5(#524) 이후 35mm·35mm Wide·Criterion은 풀블리드 슬롯이 아니라 고정 비율 컷/도판이라 `posterFitProps` 자체를 안 태우고 `Poster`를 직접 부른다(옵션이 고정 비율 컷엔 의미가 없고 `frameInsetY`를 실으면 레터박스 0이 깨진다). 그중 35mm Wide의 포스터 컷만 **`fit="cover"`**다 — 컷이 포스터 표준의 가로 판(3:2)이라 표준 세로 크롭(2:3)과 방향이 어긋났고, 시안이 cover를 골라(c1 시안 충실) 세로 포스터의 위아래가 잘렸다. #529가 크롭 쪽에서 해소했다(아래 항목). 35mm·Criterion은 컷/도판이 각각 세로·정사각에 가까워 contain으로도 레터박스 0이 선다.
- **크롭 프리셋 방향은 캔버스가 아니라 포스터 슬롯을 따른다**(#529) — 판정 소스는 `LayoutSpec.posterOrientation`(`src/utils/layouts.ts`, 필수 필드라 무드 추가 시 컴파일러가 강제)이고, 캔버스 축인 `orientation`과 헷갈리면 안 되는 이유는 그 필드 주석에 있다. 가로면 프리셋이 `POSTER_LANDSCAPE_RATIO`(3:2), 출력이 `posterOutputSize`로 1440×960이 된다(결정 3). 실측(브라우저, 포스터 프레임 rect): 35mm Wide는 세로 크롭에서 세로 −125%(포스터 높이 55.6% 손실) → 가로 크롭에서 −0.05%, 반대로 editorial에 가로 크롭을 넣으면 레터박스 0이 55.6%로 깨진다. 자동 프리셋이지 잠금이 아니라 프레임은 그대로 조정되고, 무드를 바꿔도 확정된 크롭은 유지된다 — 무드별 재크롭(`posterOriginal` 기반 구조 변경)은 #529 결정 2로 **범위 밖**. 출력 해상도는 크롭 방향에서 읽으므로(표준 경로 크롭은 항상 프리셋 비율로 잠겨 들어온다) 프리셋 판정은 `ImageCropModal` 한 곳에만 산다. **가로 슬롯은 35mm Wide 컷(926×617)과 Stub 밴드(960×640, #527) 둘**이고, 캔버스 가로 2종(editorial·35mm Wide)과 목록이 겹치지 않는 게 두 축이 독립이라는 증거다 — Stub은 캔버스가 세로인데 슬롯이 가로, editorial은 그 반대.
- **Shared primitives**: `src/components/moods/_shared.tsx` — `Barcode` (memoized), `ChainStamp`, `FormatStamp`, `Poster`, 35mm 계열 필름 프리미티브(`FilmStripBand`·`FilmRail`·`FilmCreditCut`·`CutFrameLabel`·`FilmGrain`·`FilmCutEdges`), plus helpers (`fitFontSizeToWidth`, `isInkDark`, `truncateActors`) and font tokens (`FONT_MONO`, `FONT_SANS`, `FONT_KR`). **Add new shared helpers here**, not inline in moods.
- **Renderer**: `src/components/TicketRenderer.tsx` — dispatches to active mood, uses `ResizeObserver` to scale the inner natural-pixel tree to fit the preview, and forwards the inner ref so the export pipeline captures the unscaled DOM.
- **Picker**: `src/components/LayoutPicker.tsx` — exports `LayoutStrip` (46px mood chips, scroll-snap rail, consumed by `designRailItems.tsx`) and `MOOD_CHIP_BG`, a typed `Record<LayoutId, ...>` gradient registry; renaming a layout id breaks the lookup at compile time. The desktop carousel (default-export `LayoutPicker`) and its per-mood SVG thumbnail registry (`THUMBNAIL_RENDERERS`) were deleted in #620 — dead since #607 unified the shell (see "셸은 한 벌이다" above) and no desktop-only UI plan remained to justify keeping them.
- **Export**: `src/utils/captureToImage.ts` — awaits `document.fonts.ready` + image loads, then dynamically imports `html-to-image` and forces `transform: 'none'` during capture (otherwise the preview scale wrapper distorts output). Output is a JPEG data URL at the layout's natural pixel dimensions × `pixelRatio: 2`.
- **Memory Management**: Always `URL.revokeObjectURL` on blob URLs created for cropped images. Download (`downloadTicketAsJpeg`) decodes the capture's base64 `data:` URL via `atob` → `Uint8Array` → `Blob` → `createObjectURL`, then revokes after the anchor click. **No `fetch(data:)`** — Vercel CSP `connect-src` blocks it, so base64 is decoded directly (CSP-safe).
- **Asset manifest**: `public/assets/{chains,formats}_transparent/` filenames were the single source of truth, but to avoid copyright issues, **bundled logos are removed**. Users now upload logos directly via the field editor's Theater/Format stamp rows (`StampSheet` inside `src/components/v2/FieldEditorBody.tsx`, reached from the field drawer or an on-ticket field tap→`FieldEditSheet`) with free-aspect crop (`useLogoCrop` + `ImageCropModal`). The old `TheaterChainPicker`/`FormatPicker` were removed in #231, and the file-based asset-manifest codegen (`scripts/generate-asset-manifest.ts` → `assets.generated.ts`, predev/prebuild hooks) was removed in #196.
- **Dashed Placeholders**: If a user toggles chain/format ON but doesn't upload a logo, a dashed placeholder appears in the preview. This placeholder is explicitly ignored during `html-to-image` capture via the `data-hide-on-export` attribute.

### 🔍 OCR Pipeline (티켓 스크린샷 자동 인식)
- 규칙이 전부 실측(#125·#348, 실 티켓 15장 A/B)에서 나왔으니 **가볍게 고치지 말 것**. OCR 관련 파일(`src/utils/ocr.ts`·`ocrPreprocess.ts`·`ratelimit.ts`, `src/pages/api/ocr.ts`, `scripts/ab-ocr-*`)을 읽거나 고치기 전에 **`.claude/skills/ocr-pipeline/SKILL.md`를 읽을 것** — 프롬프트 규칙, Zod 전 필드 `.nullable()` 제약, `@ai-sdk/google` 3.0.91 고정, rate limit 4겹(per-IP + 키 전체 shared), A/B 하네스 사용법이 거기 있다.
- **최신성 판정은 카드가 아니라 셸이 소유한다 — `mountedRef` 가드를 되살리지 말 것**(#388 / claude-review PR #413 P0, 커밋 `007f381`). in-flight KOBIS 보강의 적용 여부는 인스턴스 로컬 `mountedRef`가 아니라 셸이 쥔 `ocrEpochRef`(`useOcrUndo`의 `epochRef`)가 epoch 비교로 판정하므로, `OcrUploadCard`가 unmount돼도 `titleOg`·`releaseDate`는 유실되지 않는다 — 드로어 카드는 닫힐 때마다 그 자리에서 unmount되는데 보강이 살아남는 게 그 근거고, `setInfo`가 이 인스턴스가 아니라 셸의 photo 상태를 갱신하기 때문이다. remount의 실제 대가는 그 카드 로컬 상태(`isProcessing`·토스트) 리셋뿐이다. **따라서 "카드를 단일 인스턴스로 유지"는 레이스 방어가 아니라 같은 상태를 쓰는 진입점을 안 늘리려는 배치 결정이다** — #363/PR #372 리뷰 P1을 근거로 든 옛 서술("두 번째 인스턴스를 만들면 레이스가 되살아난다")은 2026-07-17부로 철회됐다(#624). 그 문구를 믿고 가드를 되살리면 #413 P0을 그대로 재도입한다.

### 🚧 Current Project Status
- **TMDB 인앱 포스터 검색이 구현됐다(#537, 2026-08-03).** Seed spec `docs/specs/tmdb-poster-search.yaml`은 여전히 레포에 없어 이슈 본문을 스펙으로 직접 구현했다 — 이슈 본문의 스코프 표가 `ImageUploader.tsx`를 언급하지만 그 컴포넌트는 #607에서 이미 삭제됐으므로, 실제 진입점은 `src/components/v2/Landing.tsx`(보조 CTA "영화 검색해서 가져오기")·`MobileEditorShell.tsx`다. `/api/tmdb/{search,images,image}` 서버 프록시(c1: Blob 경유, image 라우트는 SSRF 방지 path 정규식 검증 + fail-closed rate limit) + `TmdbPosterModal`(c6: search/posters 단일 모달) + `usePhototicket.fillEmptyMovieInfo`(c8: 빈 필드만 KOBIS 보강) 신설. 열린 질문 1번(가로 슬롯 × 세로 포스터 충돌)은 **backdrops 미통합, 기존 `ImageCropModal`을 로직 변경 없이 그대로 재사용**으로 결정 — 크롭 모달이 이미 임의 소스 종횡비를 프리셋 비율로 자유 크롭하는 걸 지원해서(수동 업로드와 동일 경로), 사용자가 직접 크롭 영역을 고른다. 실제 TMDB API로 모바일 뷰포트 브라우저 검증 완료(검색→판본선택→크롭→적용→Stub 무드 전환→재크롭→새로고침 복원). **미해결로 남긴 것**: 열린 질문 2번(공유 파이프라인 저작권 노출)·3번(프록시 대역폭 비용, 캐시 정책 — 이미지 프록시는 `immutable` 캐시는 걸었지만 첫 히트 대역폭 비용 자체는 해소 안 됨)은 비즈니스 판단이 필요해 이슈 #537에 남겨뒀다. TMDB 공식 로고 이미지는 첨부 못 함(텍스트 귀속 문구만 구현) — 실제 로고 에셋 확보는 후속 작업.
- **`checkTmdbImageRateLimit`은 size별로 예산이 갈린다(#638, 2026-08-03).** 판본 그리드가 포스터마다 w342 썸네일을 1건씩 부르는 정상 사용만으로도 분당 30 공유 한도를 먼저 태워, 뒤이은 실제 적용(original) 다운로드가 429를 맞는 문제였다 — 원가가 수십 KB인 썸네일과 2~5MB인 원본을 하나의 스코프로 묶은 게 원인이라, `tmdb-image-thumb`(분당 120·일 1200)과 `tmdb-image-original`(분당 30·일 300, 기존 값 유지)로 스코프를 쪼갰다. 둘 다 fail-closed는 유지(대역폭 남용 방어가 목적이라 완화가 무제한 허용으로 이어지면 안 된다).
- **Next Up**: #631(포스터를 선택 사항으로) 닫힘, PR #632 머지 완료(2026-08-02) — `_shared.tsx`의 `data-poster-root` 분기 + `canExport`에서 `hasPoster` 게이트 제거(D3)까지 전부 main에 있다. 진입 동선 재설계 에픽 #612가 착수 가능한 상태고, Seed spec `docs/specs/landing-mood-first-ocr-entry.yaml`이 1차 범위를 #615(히어로 캐러셀 전시 → 선택 재설계)·#635(OCR을 랜딩 주 CTA로 승격 + 이탈 경로 3종)로 확정해뒀다. #537은 그 스펙이 그리던 "OCR 제목 → 자동 검색 체인"이 아니라 **독립된 사용자 트리거 CTA**로 구현됐다 — OCR 연계는 범위 밖으로 남았다.
