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
- **회귀 테스트 예**: `__tests__/ocrUndoRestore.test.tsx` — OCR undo가 chainVisible/chainLabel + 폼 필드를 원자 복원하는지(#141 P1) 검증. 새 상호작용 테스트는 testing-library로 통일 권장.

### 📱 셸은 한 벌이다 (#603 → #607)
데스크톱/모바일 이원화는 **삭제됐다.** `DesktopStudioShell`·`ImageUploader`·`FieldAccordion`·`DesktopDesignPanel`·`AppHeader`·`ThemeToggle`·`src/utils/breakpoints.ts`가 사라졌고, `pages/index.tsx`의 `useMatchMedia` 셸 분기(`mounted`·`isMobile` SSR 왕복)도 없다. 데스크톱은 같은 `MobileEditorShell`을 `PhoneFrame`(400px, `container-type:size` + `contain:paint`)에 넣어 띄운다.
- **뷰포트 브레이크포인트가 남은 자리는 `tailwind.config.js`의 `screens.rail`(1024px) 하나**고, 소비자도 `PhoneFrame`의 `rail:w-[400px]` 하나뿐이다. JS 미러(`RAIL_BREAKPOINT_PX`)가 없어져 #104의 dead zone 위험이 구조적으로 소멸했다.
- **길이는 프레임으로 옮겨졌지만 조건은 아니다.** `contain:paint`는 fixed의 컨테이닝 블록과 cq 단위 기준점만 바꾸지 미디어쿼리를 안 옮긴다 — 프레임 형상에 따라 갈려야 하는 조건은 `@container`로 써야 한다(`--hero-dvh-budget`이 그 예: 1440×900 뷰포트는 landscape인데 400×900 프레임은 portrait이다). 새 `vw`/`vh`/`rail:`/`useMatchMedia`를 셸 안에 심기 전에 "이게 뷰포트 축인가 프레임 축인가"를 먼저 정할 것.
- **fixed 오버레이 좌표도 프레임 기준**이다. 이동식 툴바의 드래그·클램프·스냅은 `PhoneFrame`의 `getFrameRect()`를 쓴다 — `window.innerWidth`로 계산하면 400px 프레임 밖 좌표가 `localStorage`에 영속된다.

### 📏 크롬 측정 하네스 (400×675)
- `scripts/measure-chrome.mjs` (`bun scripts/measure-chrome.mjs --theme dark|light`) — dock·프리뷰 rect, 레일 슬롯 넘침, 항목별 WCAG 대비, 모달 포커스/닫기/클릭통과를 한 번에 잰다. **레일 슬롯을 열고 재는 게 전제**다(#563 불변식 dock 232.6 / 프리뷰 226.8×362.3은 열린 상태 기준 — 안 열면 dock 114.5가 나오고 스크립트는 조용히 성공한다). 400×675면 불변식을 자동 대조하고 어긋나면 exit 1. 세션 tmp에 다시 쓰지 말 것(#586, 여섯 번 반복됨).

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
- **Picker**: `src/components/LayoutPicker.tsx` — typed `Record<LayoutId, ...>` thumbnail registry; renaming a layout id breaks the lookup at compile time.
- **Export**: `src/utils/captureToImage.ts` — awaits `document.fonts.ready` + image loads, then dynamically imports `html-to-image` and forces `transform: 'none'` during capture (otherwise the preview scale wrapper distorts output). Output is a JPEG data URL at the layout's natural pixel dimensions × `pixelRatio: 2`.
- **Memory Management**: Always `URL.revokeObjectURL` on blob URLs created for cropped images. Download (`downloadTicketAsJpeg`) decodes the capture's base64 `data:` URL via `atob` → `Uint8Array` → `Blob` → `createObjectURL`, then revokes after the anchor click. **No `fetch(data:)`** — Vercel CSP `connect-src` blocks it, so base64 is decoded directly (CSP-safe).
- **Asset manifest**: `public/assets/{chains,formats}_transparent/` filenames were the single source of truth, but to avoid copyright issues, **bundled logos are removed**. Users now upload logos directly via the field editor's Theater/Format stamp rows (`StampSheet` inside `src/components/v2/FieldEditorBody.tsx`, reached from the field drawer or an on-ticket field tap→`FieldEditSheet`) with free-aspect crop (`useLogoCrop` + `ImageCropModal`). The old `TheaterChainPicker`/`FormatPicker` were removed in #231, and the file-based asset-manifest codegen (`scripts/generate-asset-manifest.ts` → `assets.generated.ts`, predev/prebuild hooks) was removed in #196.
- **Dashed Placeholders**: If a user toggles chain/format ON but doesn't upload a logo, a dashed placeholder appears in the preview. This placeholder is explicitly ignored during `html-to-image` capture via the `data-hide-on-export` attribute.

### 🔍 OCR Pipeline (티켓 스크린샷 자동 인식)
- 규칙이 전부 실측(#125·#348, 실 티켓 15장 A/B)에서 나왔으니 **가볍게 고치지 말 것**. OCR 관련 파일(`src/utils/ocr.ts`·`ocrPreprocess.ts`·`ratelimit.ts`, `src/pages/api/ocr.ts`, `scripts/ab-ocr-*`)을 읽거나 고치기 전에 **`.claude/skills/ocr-pipeline/SKILL.md`를 읽을 것** — 프롬프트 규칙, Zod 전 필드 `.nullable()` 제약, `@ai-sdk/google` 3.0.91 고정, rate limit 4겹(per-IP + 키 전체 shared), A/B 하네스 사용법이 거기 있다.

### 🚧 Current Project Status
- **Next Up**: 확정 로드맵 없음 (이전 TMDB·Supabase 계획은 폐기).
