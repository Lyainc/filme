# CLAUDE.md - AI Assistant Guidelines

## 🎬 Project: FILME
A Next.js web application for generating high-quality CGV Photoplay premium tickets.

이 파일은 **런타임에 지켜야 할 규칙과 포인터**만 쥔다. 실측 숫자·파괴 실험·이슈 번호별 근거·삽질 이력은 `docs/`에 있고, 규칙마다 "근거:"로 가리킨다.

### 📂 Key Documentation References
Before making architectural changes or implementing new features, consult:
- **`README.md`**: Project setup, running instructions, and tech stack overview.
- **`docs/KOBIS_API.md`**: Instructions and examples for using the KOBIS movie search API.
- **`docs/PRINT_CALIBRATION.md`**: 실물 인쇄 캘리브레이션 — `scripts/make-calibration-sheet.py` 사용법 + 도안 판독표 + 실측 기록. 무드 선 굵기·폰트 크기·코너·export 여백을 건드리기 전에 읽을 것. **배경 도상(#530)은 "배경 도상 설계 하한" 절이 hard 제약** — stroke≥3px·주기 하한 2종(톤 8px/무늬 16px)·alpha 0.08~0.14·계조는 밀도로만·도트 지름 0.37mm(7.9px) 정규 격자·**선폭은 상수가 아니라 배치 폭에서 역산**(`viewBox 선폭 ≥ 602 ÷ 렌더폭px`). 규칙 5·6은 실측 없인 안 나오고 둘 다 한 번씩 틀린 뒤에 나왔으니(3.6px는 하한을 설계값으로 오독한 값, viewBox 상수 선폭은 9개 배치 중 6개에서 하한을 깼다), 시안을 그리기 **전에** 읽을 것.
- **`docs/COPY_TONE_GUIDE.md`**: 서비스 UI 문구 톤 규칙(#677). **새 사용자 노출 문구를 쓰기 전에 읽을 것.** 핵심 판별 둘: ① 라벨(`aria-label` 포함)에 조건절·종결어미·마침표가 있으면 위반(`-하기`는 금지가 아니다), ② 실패·차단 문구는 [무슨 일] + [다음 행동] 두 문장이고, 길이 상한(한 문장 33자·전체 44자)은 문장 자리 전부에 걸린다. 문구를 실제로 바꿀 때는 그 문서의 "테스트가 잠근 문구" 표부터 볼 것(랜딩 이탈 경로 2종 #665, OCR 배너, 초기화 arm #374가 문자열을 정확히 기대하며, 랜딩 이탈 경로 하나가 테스트 9개에 걸린다). 티켓 렌더 문구·법적 고지는 범위 밖.
- **`docs/HARNESS.md`**: 크롬 측정 하네스(`scripts/measure-chrome.mjs`·`capture-export.mjs`·`measure-font-metrics.mjs`) 사용법 + 실측 기준선 + 파괴 실험 + stale 서버·워크트리 dev 함정. 하네스·레일 슬롯·프레임 봉쇄를 건드리기 전에 읽을 것.
- **`docs/TESTING.md`**: 테스트 규칙의 근거(CI timeout 문턱 실측, mock.module 누수, 실행 순서 진단, DOM `received` 직렬화 함정). 테스트 인프라를 건드리거나 "왜 이렇게 쓰나"가 의심될 때 읽을 것.
- **`docs/CONTRIBUTING.md`**: 리뷰 게이트·Git/릴리즈 규약의 근거, 철거된 기능(TMDB 등)의 이력, OCR 최신성 판정 근거, LSP 툴링 메모.
- **`docs/user-testing/README.md`**: 사람 눈·기기 검증(Aside, iOS Simulator) 실행서와 케이스표.
- **스킬 위치**: `.agents/skills/<name>`이 canonical이고 `.claude/skills/<name>`은 그 심링크다. 이 파일은 `.claude/skills/ocr-pipeline/SKILL.md`처럼 예전 경로로 가리키며 그대로 풀린다.
- Ticket design specs/layout coords/mood catalog live in this file's **"Core Mechanisms (6-Mood Ticket Rendering)"** section + `src/utils/layouts.ts` — not a separate doc.
- **UI 패턴 레퍼런스 3종** (외부): **앱 chrome UI**(시트·드로어·모달·랜딩 진입·필드 에디터 = `src/components/v2/*`, `MobileEditorShell`)를 새로 만들거나 재설계할 때 본다. 셋은 축이 달라 서로 대체가 아니다 — **이름 → 규범 → 실무** 순으로 필요한 것만 집어 쓸 것.
  - **The Component Gallery** `https://component.gallery/components/<slug>` — **이름**. 컴포넌트마다 별칭(Drawer = Tray·Flyout·Sheet)과 수십 개 디자인 시스템의 정의·usage guidelines 링크를 모아둔 인덱스. 지금 만들려는 게 업계에서 뭐라 불리는지, 남들은 어디까지를 그 패턴으로 보는지 맞출 때.
  - **W3C ARIA APG** `https://www.w3.org/WAI/ARIA/apg/patterns/<slug>/` — **동작 규범**. 32개 패턴의 키보드 상호작용 + ARIA 역할/상태/속성이 규범적으로 적혀 있다. **이 레포엔 이게 실질 스펙이다** — Radix·Base UI 같은 headless 프리미티브 없이 직접 구현하니까(`FieldDrawer`의 `role="dialog"`·`aria-modal`·Escape·`focusin` 포커스 유지가 그 예), 라이브러리가 대신 지켜주던 걸 우리가 지켜야 한다.
  - **UX Patterns for Developers** `https://uxpatterns.dev/en/patterns/<category>/<slug>` — **실무**. 패턴당 한 페이지에 anatomy·best practice·접근성·테스트·안티패턴이 있고, APG가 안 덮는 축(빈 상태·로딩·검증 메시지·토스트)까지 있다. 오픈소스(`thedaviddias/ux-patterns-for-developers`).
  - **접근 방법이 사이트마다 정반대다**(실측): component.gallery는 `curl -sL -A '<브라우저 UA>'`만 되고 WebFetch는 403, w3.org APG는 WebFetch만 되고 curl은 403, uxpatterns.dev는 둘 다 된다. 403 한 번 보고 "접근 불가"로 접지 말 것.
  - **범위 밖 둘**: ① 티켓 렌더 6무드는 디자인 시안이 소유하니 대상이 아니고(폰트 스코프가 티켓 vs UI로 갈리는 것과 같은 축), ② **여기서 본 걸 근거로 UI 라이브러리를 새로 넣지 말 것** — 거기 걸린 시스템(shadcn/ui·Radix·Base UI·Ant·Chakra…)은 정의·ARIA·네이밍 참고용이고, 이 레포는 `cva`+`cn`(`src/utils/cn.ts`, `src/components/ui/variants.ts`)으로 직접 구현하는 자세다.

### 🔌 Claude Code 로컬 툴링
- **typescript-lsp 플러그인 "로드 안 됨" ≠ `LSP` 도구 고장.** `LSP` 도구는 플러그인 로드 여부와 무관하게 글로벌로 동작한다. harness-doctor 경고만 보고 LSP가 죽었다고 판단하지 말고 실제로 한 번 찔러볼 것. 근거: `docs/CONTRIBUTING.md` 3절.

### 🧪 Testing
- **Runner**: `bun run test`(= `bun test --timeout 30000`). Tests live in `__tests__/` (not co-located).
- **맨 `bun test`로 재지 말 것** — CI는 `--timeout 30000`, bun 기본은 5000ms라 로컬에서만 CI가 못 내는 실패를 낸다. `package.json`의 `test`/`test:watch`가 CI와 같은 값을 들고 있고, 한쪽만 바뀌면 `__tests__/ciLocalTimeoutParity.test.ts`가 깨진다. 근거: `docs/TESTING.md` 1절(#714).
  - **테스트별 명시 timeout이 CLI `--timeout`을 이긴다.** 호출 방법에 안 기대는 방어는 파일에 명시값을 거는 것이다(`captureDualRendererPixelDiff.test.ts`가 예 — 무드 캔버스 합성 부류는 파일 전체가 같은 값). 근거: `docs/TESTING.md` 2절.
- **두 부류**: (1) 순수 유닛·static-markup(`renderToStaticMarkup`), (2) **상호작용 테스트** — happy-dom + `@testing-library/react` + `user-event`(#163). 새 상호작용 테스트는 testing-library로 통일(예: `__tests__/ocrUndoRestore.test.tsx`).
- **DOM 환경**: `bunfig.toml`의 `[test] preload = ["./__tests__/setup/happydom.ts"]`가 happy-dom 글로벌 + `IS_REACT_ACT_ENVIRONMENT`를 등록. happy-dom 미구현 API(예: `scrollIntoView`)는 그 setup에 no-op 폴리필로 추가.
- **모듈 mock**: bun `mock.module`은 hoisting 안 됨 — mock 등록 **후** `require(...)`로 대상(예: `runOcr`)을 import. top-level `await import`는 tsconfig `target:es5`에서 막히니 `require` 사용.
- **mock.module 복원은 반드시 스프레드 스냅샷으로**: `const real = { ...require(p) }`로 복사해 두고 `afterAll`에서 그걸로 되돌릴 것. 살아있는 네임스페이스를 붙들면 복원이 no-op이 되어 스텁이 프로세스 끝까지 남는다. 근거: `docs/TESTING.md` 5절(#611).
- **실패가 macOS/Linux로 갈리면 플랫폼이 아니라 실행 순서를 먼저 의심**하고, 깨진 파일을 **단독 실행**해 본다(단독 통과 = 전역 누수). 근거: `docs/TESTING.md` 6절(#611).
- **모듈 스코프 메모를 비워야 하면 `delete require.cache[...]` 말고 리셋 함수를 열 것**(`captureToImage.resetCtxFilterProbeForTest` 참고). 근거: `docs/TESTING.md` 7절(#611).
- **실패할 수 있는 단언의 `received`에 DOM 엘리먼트를 그대로 넣지 말 것 — `!!el`/`el === null`로 강제 변환**(특히 `waitFor` 안). bun이 happy-dom 노드 그래프 전체를 직렬화해 한 번 실패에 697MB · 4.6초를 쓴다. `bun run lint`가 `queryBy*`·`querySelector`·`closest`·`getElementById` 결과의 `toBeNull()`을 막지만(#811), 변수·헬퍼로 한 번 감싼 자리는 못 잡으니 손으로 `=== null`로 쓴다. 근거: `docs/TESTING.md` 8절(#693).

### 📱 셸은 한 벌이다 (#603 → #607)
데스크톱/모바일 이원화는 **삭제됐다.** 데스크톱은 같은 `MobileEditorShell`을 `PhoneFrame`(400px, `container-type:size` + `contain:paint`)에 넣어 띄운다. 삭제 목록과 이력: `docs/CONTRIBUTING.md` 4절.
- **뷰포트 브레이크포인트가 남은 자리는 `tailwind.config.js`의 `screens.rail`(1024px) 하나**고, 소비자도 `PhoneFrame`의 `rail:w-[400px]` 하나뿐이다.
- **길이는 프레임으로 옮겨졌지만 조건은 아니다.** `contain:paint`는 fixed의 컨테이닝 블록과 cq 단위 기준점만 바꾸지 미디어쿼리를 안 옮긴다 — 프레임 형상에 따라 갈려야 하는 조건은 `@container`로 써야 한다(`--hero-dvh-budget`이 그 예: 1440×900 뷰포트는 landscape인데 400×900 프레임은 portrait이다). 새 `vw`/`vh`/`rail:`/`useMatchMedia`를 셸 안에 심기 전에 "이게 뷰포트 축인가 프레임 축인가"를 먼저 정할 것.
- **fixed 오버레이 좌표도 프레임 기준**이다. 이동식 툴바의 드래그·클램프·스냅은 `PhoneFrame`의 `getFrameRect()`를 쓴다 — `window.innerWidth`로 계산하면 400px 프레임 밖 좌표가 `localStorage`에 영속된다.

### 📏 크롬 측정 하네스 (400×675)
헤드리스 Chrome 하네스는 **CI·픽셀 측정 축**이다. 사용법·기준선·파괴 실험·함정은 전부 `docs/HARNESS.md`. 여기엔 언제 돌리고 무엇이 게이트인지만 둔다.
- **저장물(export JPEG)을 픽셀로 재려면 `scripts/capture-export.mjs`**(`--material/--coating/--intensity/--out`, `--compare a.jpg b.jpg`). 잡음 바닥 maxΔ 2, 허용치 3. **Stub 무드의 픽셀 diff는 prod(`bun run build && next start`)로 잴 것** — dev는 같은 코드 재캡처로 통제군부터 잡고 회귀로 단정하지 말 것. Web Share를 타는 흐름을 헤드리스로 재는 새 스크립트는 `canShare` 스텁이 필요하고, 종료는 `browser.close()` 3초 race + `process.exit(0)`. 근거: `docs/HARNESS.md` 2절(#506·#751).
- **폰트를 더하거나 갈아치우면 `scripts/measure-font-metrics.mjs`를 다시 돌려** `_shared.tsx`의 `HANGUL_SIZE_SCALE`·`LATIN_SIZE_SCALE`과 `__tests__/userTextFontOptions.ts`를 **둘 다** 갱신할 것(OS/2 sxHeight·sCapHeight는 쓰지 말 것). 근거: `docs/HARNESS.md` 3절(#437).
- **`bun scripts/measure-chrome.mjs --theme dark|light`**: dock·프리뷰 rect, 모달 포커스/닫기, 프레임 봉쇄, 랜딩·posterless 축을 한 번에 잰다. 레일 슬롯을 열고 재는 게 전제고 불변식은 **dock 290 / 프리뷰 190.9×305**다. 세션 tmp에 다시 쓰지 말 것(#586). 근거: `docs/HARNESS.md` 4절.
  - **새 축을 넣으면 종료 조건(`process.exitCode`)에도 실었는지 확인**할 것 — 재고 출력만 하는 축은 파괴해도 exit 0이다(#714). **`checked:false`는 통과가 아니라 실패**다(#609).
  - **`railSlot`은 게이트가 아니라 관측값**이다(`overflows:false`를 불변식으로 걸지 말 것 — 의도된 넘침 상태가 있다). 근거: `docs/HARNESS.md` 4절.
  - **`DesignRail.tsx`의 슬롯 높이를 건드리면 스크립트 `BASELINE`과 이 파일의 dock/프리뷰 숫자를 같이 다시 잴 것**(#707). 선언 불일치는 `__tests__/measureChromeBaselineCoupling.test.ts`가 머지 전에 잡는다(#714). 근거: `docs/HARNESS.md` 5절.
  - **`.github/workflows/chrome-harness.yml`이 push마다 같은 하네스를 돌리지만 required가 아니다.** ubuntu 러너와 macOS 로컬은 같은 px를 내니, 러너에서만 나는 실패를 "플랫폼 차이"로 접지 말 것 — 진짜 회귀이거나 stale 서버다. 러너는 `CHROME_PATH=/usr/bin/google-chrome` 필요. 근거: `docs/HARNESS.md` 6절.
- **대조 기준은 뷰포트가 아니라 `#phone-frame` rect다**(#609). 프레임이 400×675면 뷰포트와 무관하게 같은 불변식을 대조한다. 근거: `docs/HARNESS.md` 7절.
- **하네스 함정은 stale 서버다**(#601). 포트가 이미 물려 있으면 새 `next start`는 `EADDRINUSE`로 죽고 앞 서버가 그대로 200을 준다. 재는 대상이 진짜 지금 빌드인지 확인하고, 크롭 모달이 안 열리면 앱을 뒤지기 전에 **콘솔의 chunk 404**부터 볼 것. 근거: `docs/HARNESS.md` 8절.
- **워크트리에서 dev는 그냥 `bun run dev`**(#708)지만 **포트는 나눠 쓸 것** — `bun run dev --port 3010` + 하네스에 `--url http://localhost:3010/`. 근거: `docs/HARNESS.md` 9절.
- **프레임 봉쇄 축**(크롭 모달·필드 드로어·편집 메뉴·max 오버레이·결과 스테이지·hero가 프레임 안인지)은 dock/프리뷰 불변식이 원리적으로 못 보는 축이다(#609). `backdrop` 축은 부재 확인이고(#786) 배경을 되살리면 봉쇄 축도 같이 되살릴 것. 근거: `docs/HARNESS.md` 10절.
- **`landingShownOnDraft`·`posterless` 축은 draft를 심은 메인 페이지에서 잰다**(별도 저장분 없는 컨텍스트에선 조용히 통과한다). `MobileEditorShell` 랜딩 판정에 `croppedImageUrl`을 되살리지 말 것(#727). fit 스테이지의 `background: 'var(--workbench)'`·`flex-1`·`mode === 'hidden'` 분기는 각각 자기 축으로 운다(#674). 파괴 실험 기록: `docs/HARNESS.md` 11절.

### 🔬 검증 도구 (사람 눈·기기)
앞으로 브라우저·시각 검증은 아래 둘을 쓴다. 실행서와 케이스표: `docs/user-testing/README.md`.
- **Aside**(`aside` CLI, 사용자의 AI 브라우저): 위임 작업은 `aside exec`, Playwright 방식의 DOM·스크린샷 검사는 `aside repl`(모바일 폭은 `page.setViewportSize`). **먼저 `aside guide`를 읽을 것.**
- **iOS Simulator**: 기존 `scripts/ios-sim/` 스크립트(Appium XCUITest 합성 터치). 런타임 iOS 26.5/27.0/27.1 설치됨.
- 헤드리스 Chrome 하네스(`scripts/measure-*.mjs`, `capture-export.mjs`)는 위 📏의 CI·픽셀 측정 축으로 **그대로 남는다 — Aside가 대체하지 않는다.**
- **Android Emulator는 이 머신에 없다.** Android 검증은 기술 검토(#585) 대기로 보류이고, **Android 커버리지를 주장하지 말 것.** **iOS Simulator PASS는 실기기 iPhone PASS가 아니다.**

### 🔎 Code Review
- **게이트는 두 축이다**(#593·#594). ① **`.github/workflows/ci.yml`(`bun install --frozen-lockfile` → `typecheck` → `bun test`)이 결정적 correctness의 유일한 required 게이트**다. ② **`claude-review` 액션은 그 위의 fresh-eyes 패스로 required가 아니고**, 기댈 축은 CI가 못 잡는 것 하나다: **없는 테스트, CLAUDE.md에만 사는 불변식 위반, 사라진 사용자 경로.**
- **`required_status_checks.strict`는 false다.** 대가로 stale base 머지가 허용되고 rebase 후 조합은 `push: main`이 관측만 한다(차단 수단 아님).
- **push 전 claude 리뷰는 액션과 중복이라 습관으로 돌리지 않는다.** Workflow-backed `code-review`(`/code-review ultra`·high)는 아주 무겁거나 복잡한 변경에서 PR 전 깊이가 필요할 때만 쓴다. `/simplify`는 correctness 축과 겹치지 않으니 품질 패스가 필요할 때 별도로 쓴다.
- 근거와 실측: `docs/CONTRIBUTING.md` 1절.

### 🌱 Git & Commit Conventions
- **Merge policy = rebase merge** (squash/merge-commit는 GitHub에서 비활성화). PR의 커밋이 **main에 그대로(verbatim) 올라오므로**, 각 커밋은 atomic하고 메시지가 깔끔해야 한다. WIP·"fix typo" 같은 커밋은 push 전 정리(squash/reword)할 것.
- **Conventional Commits 필수**: `type(scope): 설명` 형식. 설명은 한국어/영어 모두 허용(레포 혼용).
  - **type**: `feat` · `fix` · `docs` · `perf` · `chore` · `refactor` · `test` (관찰된 어휘 — 새 type은 신중히)
  - **scope**: 변경 영역 소문자 (예: `result`, `ui`, `ocr`, `kobis`, `form`, `share`, `moods`, `editor`, `chrome`, `color`, `typography`, `server`, `blob`)
  - **이슈 참조**: 관련 이슈는 메시지 끝에 `(#NN)`로 표기 (예: `fix(ocr): undo 배너 위치 개선 (#96, #97)`)
- **머지 후 브랜치 자동삭제**(`delete_branch_on_merge: true`). 로컬 stale 정리는 `git fetch --prune`.
- **자동 semver 릴리즈**(#595): 머지된 PR의 `release` 라벨(주 트리거) 또는 미릴리즈 user-visible 커밋 70개(백스톱)로 `.github/workflows/auto-release.yml` + `scripts/next-version.mjs`가 태그+GitHub release만 만든다. **`package.json`의 `version`은 올리지 않는다**(`private:true`, 태그와 이중 관리할 값이 없다). 규칙 세부: `docs/CONTRIBUTING.md` 2절.
- **같은 파일을 건드리는 PR이 동시에 열려 있으면, 나중에 머지하는 쪽은 머지 직전 로컬에서 rebase 후 `bun run typecheck`를 직접 돌릴 것** — 같은 import를 다른 줄에 넣은 두 PR은 git이 충돌로 못 잡고 `bun test`도 못 잡아 main에 `TS2300`이 들어간다(#746). CI 초록은 rebase 전 스냅샷일 수 있다.

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
- **Picker**: `src/components/LayoutPicker.tsx` — exports `LayoutStrip` (46px mood chips, scroll-snap rail, consumed by `designRailItems.tsx`) and `MOOD_CHIP_BG`, a typed `Record<LayoutId, ...>` gradient registry; renaming a layout id breaks the lookup at compile time. 데스크톱 캐러셀·`THUMBNAIL_RENDERERS`는 없다(#620, `docs/CONTRIBUTING.md` 4절).
- **Export**: `src/utils/captureToImage.ts` — awaits `document.fonts.ready` + image loads, then dynamically imports `html-to-image` and forces `transform: 'none'` during capture (otherwise the preview scale wrapper distorts output). Output is a JPEG data URL at the layout's natural pixel dimensions plus a 10px print margin per side (`EXPORT_MARGIN_PX`) × `pixelRatio: 2` — 1960×3108 portrait / 3108×1960 landscape.
- **Memory Management**: Always `URL.revokeObjectURL` on blob URLs created for cropped images. Download (`downloadTicketAsJpeg`) decodes the capture's base64 `data:` URL via `atob` → `Uint8Array` → `Blob` → `createObjectURL`, then revokes after the anchor click. **No `fetch(data:)`** — Vercel CSP `connect-src` blocks it, so base64 is decoded directly (CSP-safe).
- **Logos / asset manifest**: **번들 로고는 없다**(저작권 회피). 사용자가 필드 드로어(`src/components/v2/FieldDrawer.tsx`)의 극장/포맷 행이나 온티켓 인플레이스 에디터(`src/components/v2/InPlaceFieldEditor.tsx`)에서 직접 올리고, 각각 자유 비율 크롭(`useLogoCrop` + `ImageCropModal`)을 거친다. `FieldEditorBody.tsx`에서 앱이 import하는 건 `DateSheet`·`INPUT_CLS`·`KobisResultList`뿐이다. 철거된 것(`FieldEditSheet`·옛 Picker 2종·에셋 매니페스트 코드젠): `docs/CONTRIBUTING.md` 4절.
- **Dashed Placeholders**: A visible chain/format stamp renders the uploaded logo first, then a non-empty text label (OCR can fill one without an image), and only when both are missing a dashed placeholder in the preview (`ChainStamp`/`FormatStamp` in `_shared.tsx`). This placeholder is explicitly ignored during `html-to-image` capture via the `data-hide-on-export` attribute.

### 🔍 OCR Pipeline (티켓 스크린샷 자동 인식)
- 규칙이 전부 실측(#125·#348, 실 티켓 15장 A/B)에서 나왔으니 **가볍게 고치지 말 것**. OCR 관련 파일(`src/utils/ocr.ts`·`ocrPreprocess.ts`·`ratelimit.ts`, `src/pages/api/ocr.ts`, `scripts/ab-ocr-*`)을 읽거나 고치기 전에 **`.claude/skills/ocr-pipeline/SKILL.md`를 읽을 것** — 프롬프트 규칙, Zod 전 필드 `.nullable()` 제약, `@ai-sdk/google` 3.0.91 고정, rate limit 4겹(per-IP + 키 전체 shared), A/B 하네스 사용법이 거기 있다.
- **최신성 판정은 카드가 아니라 셸이 소유한다 — `mountedRef` 가드를 되살리지 말 것**(#388, #413 P0 재도입 방지). in-flight KOBIS 보강은 셸이 쥔 `ocrEpochRef`(`useOcrUndo`의 `epochRef`) epoch 비교로 판정하므로 `OcrUploadCard` unmount와 무관하다. "카드를 단일 인스턴스로 유지"는 레이스 방어가 아니라 진입점을 안 늘리려는 배치 결정이다(옛 "두 번째 인스턴스를 만들면 레이스" 서술은 #624로 철회).
- **KOBIS 보강은 `setInfo`가 아니라 조회 시작 때 캡처한 `usePhototicket.captureMovieSelection()` 적용기로만 쓴다**(#793) — 조회 중의 영화 선택·제목 수정·전역 undo·문서 리셋이 늦은 OCR 결과를 버린다. **OCR 응답 자체는 `runOcr` 전에 `captureDraft()`로 잡은 초기화 세대만 본다**(#806) — `docEpochRef`·영화 선택은 보지 않는다(랜딩의 "새로 시작"이 인식 중인 OCR이 들어갈 새 문서를 여는 것이라서). 근거 전문: `docs/CONTRIBUTING.md` 5절.

### 🚧 Current Project Status
- **TMDB 인앱 포스터 검색은 철거됐다(#665, 2026-08-10) — 되살리지 말 것.** 약관 세 조항(AI 애플리케이션 금지·파생물 금지·상업적 사용은 별도 서면 동의)을 코드로 못 풀고, "OCR 제목 → 포스터 자동 검색" 체인이 1번 조항의 정면이다. **KOBIS는 그대로**(영화 메타데이터 축). 포스터는 사용자 직접 업로드가 주 경로이고 포스터 없이 시작하는 길은 #631이다. 철거 범위·근거: `docs/CONTRIBUTING.md` 4절, `docs/NATIVE_IOS_RFC.md` §7.1·§9.
- **일부러 남긴 것**: 랜딩 이탈 경로 문구 쌍 **"포스터 업로드 · 포스터 없이 직접 입력"**(테스트가 정확히 기대 — 바꾸려면 같이 볼 것, `docs/COPY_TONE_GUIDE.md`), 그리고 호출부가 0인 `usePhototicket.fillEmptyMovieInfo`와 `__tests__/fillEmptyMovieInfoRatingZero.test.tsx`(미사용 export라고 지우지 말 것 — 다음 자동 보강 경로에서 필요, #638 P2).
- **현재 맥락**: 진입 동선 재설계(#612·#615·#635)와 포스터 선택 사항화(#631)는 main에 반영됐다. 앱 화면·무드 리뉴얼은 #826 에픽이 다루고, OCR 제목 → 포스터 자동 검색 체인은 #665로 폐기됐다.
