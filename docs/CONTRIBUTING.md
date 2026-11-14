# 기여 규칙의 근거 — 리뷰·Git·릴리즈·철거 이력

`CLAUDE.md`의 규칙(리뷰 게이트, 커밋 규약, 철거된 것을 되살리지 않기, OCR 최신성)이 **왜 그렇게 정해졌는지**와 실측 근거를 모은 문서다. 규칙 자체를 바꾸거나 예외를 판단할 때 읽는다.

목차

1. 리뷰 게이트 (#593·#594)
2. Git/릴리즈 (#595·#746)
3. 로컬 툴링 — LSP 도구와 플러그인 로드 표시
4. 철거·삭제 이력 (되살리지 말 것)
5. OCR 최신성 판정 근거 (#388·#793·#806)

---

## 1. 리뷰 게이트 (#593·#594)

**게이트는 두 축이고 소유가 갈린다.**

1. **`.github/workflows/ci.yml`이 결정적 correctness의 유일한 게이트다** — `bun install --frozen-lockfile` → `bun run typecheck` → `bun test`가 모든 PR에서 돌고, main 브랜치의 required check는 이것이다.
2. **`claude-review` 액션은 그 위의 fresh-eyes 패스로 required가 아니다**(워크플로는 유지되고 코멘트도 계속 붙는다). required에서 뺀 근거는 그게 실제로 차단하던 명제가 "코드가 안전한가"가 아니라 "코멘트가 0개가 아닌가"였고(실측 PR 6개에서 P0 0건), 그래서 OAuth 토큰 만료나 API 장애가 코드와 무관한 머지 차단이 됐기 때문이다.

대신 그 리뷰에 기대는 축은 CI가 원리적으로 못 잡는 것 하나다: **없는 테스트, CLAUDE.md에만 사는 불변식 위반, 사라진 사용자 경로.**

### `required_status_checks.strict`는 false다

true면 머지 하나가 열린 PR 전부의 체크를 무효화해 하루 6머지(2026-07에 182 PR)에서 재검증이 연쇄한다. 대가로 stale base 머지가 허용되고, rebase 후 조합은 `push: main` 트리거가 **관측만** 한다 — 그때는 이미 prod 배포가 나간 뒤라 차단 수단이 아니다.

### push 전 claude 리뷰는 습관으로 돌리지 않는다

위 액션과 중복이다. 특히 Workflow-backed `code-review`(`/code-review ultra`·high 워크플로, subagent 다수·고비용)는 같은 "claude가 diff 리뷰"를 한 번 더 하는 거라 아주 무겁거나 복잡한 변경에서 PR 전 깊이가 필요할 때만 쓴다(예: 3파일 변경에 에이전트 7개·38만 토큰 #287은 과투입).

`/simplify`(재사용·단순화·altitude 정리)는 액션의 correctness 축과 겹치지 않으니 품질 패스가 필요할 때 별도로 쓴다.

### Chrome 하네스는 required가 아니다

`chrome-harness.yml`을 required로 걸지 않은 근거는 `docs/HARNESS.md` 6절.

## 2. Git/릴리즈 (#595·#746)

### Merge policy

**rebase merge**(squash/merge-commit는 GitHub에서 비활성화). PR의 커밋이 **main에 그대로(verbatim) 올라오므로**, 각 커밋은 atomic하고 메시지가 깔끔해야 한다. WIP·"fix typo" 같은 커밋은 push 전 정리(squash/reword)한다. 머지 후 브랜치는 자동삭제(`delete_branch_on_merge: true`)되고, 로컬 stale 정리는 `git fetch --prune`.

### Conventional Commits

`type(scope): 설명` 형식. 설명은 한국어/영어 모두 허용(레포 혼용).

- **type**: `feat` · `fix` · `docs` · `perf` · `chore` · `refactor` · `test` (관찰된 어휘 — 새 type은 신중히)
- **scope**: 변경 영역 소문자 (예: `result`, `ui`, `ocr`, `kobis`, `form`, `share`, `moods`, `editor`, `chrome`, `color`, `typography`, `server`, `blob`)
- **이슈 참조**: 관련 이슈는 메시지 끝에 `(#NN)`로 표기 (예: `fix(ocr): undo 배너 위치 개선 (#96, #97)`)

### 자동 semver 릴리즈 (#595)

claude-kit(`Lyainc/claude-kit`) 선례를 따랐다 — `.github/workflows/auto-release.yml` + `scripts/next-version.mjs`.

- 트리거는 둘: 머지된 PR의 `release` 라벨(주 트리거, 항상 릴리즈) 또는 미릴리즈 user-visible 커밋 70개(백스톱, 라벨 무관).
- user-visible은 `feat`/`fix`/`perf`/`refactor`+breaking뿐이고 `docs`/`chore`/`test`/`ci`/`build`/`style`은 단독으로 안 일으키되 다음 릴리즈에 실려간다.
- bump는 breaking>feat(minor)>그외(patch) 중 가장 큰 변화가 이긴다.
- **`package.json`의 `version`은 올리지 않는다.** `private:true`라 배포·설치 어디에도 안 쓰여 태그와 이중 관리할 값이 없다. 그래서 이 워크플로는 main에 커밋을 push하지 않고 태그+`gh release create --generate-notes`만 한다(claude-kit의 release.yml이 겪던 "bump 커밋이 push 트리거를 재발화" 문제 자체가 없다).

### 같은 import를 다른 줄로 넣는 두 PR (#746)

PR #739·#740 실측, 2026-08-21. 같은 파일에 같은 import를 다른 줄로 넣는 두 PR은 git이 충돌로 못 잡고, tsc만 깨지며 `bun test`는 못 잡는다. 둘 다 `Landing.tsx`에 같은 import 2줄을 추가했는데 git이 서로 다른 줄로 봐서 rebase가 clean하게 끝나 두 PR 다 CI green을 받았다(#740 본문이 머지 전에 직접 이걸 적어뒀다). 나중에 머지되는 쪽이 rebase 후 CI를 다시 안 돌리면 두 PR이 각각 green인 채로 main에 `TS2300 Duplicate identifier`가 들어간다.

`required_status_checks.strict`가 false라(1절) 먼저 들어간 머지가 뒤 PR의 stale check를 무효화하지 않으므로, 이 함정은 정책이 대신 막아주지 않는다. 운용 규칙: **같은 파일을 건드리는 PR이 동시에 열려 있으면, 나중에 머지하는 쪽은 머지 직전 로컬에서 rebase 후 `bun run typecheck`를 직접 돌린다** — CI 초록은 rebase 전 스냅샷일 수 있다.

## 3. 로컬 툴링 — LSP 도구와 플러그인 로드 표시

**typescript-lsp 플러그인 "로드 안 됨" ≠ `LSP` 도구 고장.** 이 프로젝트(+워크트리들)엔 typescript-lsp 플러그인이 project/local 스코프로 핀돼 있는데, `LSP` 도구 자체는 그거와 별개로 글로벌 설치돼 있어서 플러그인 로드 여부와 무관하게 동작한다. harness-doctor가 `typescript-lsp@claude-plugins-official`을 "로드 안 됨"(`installPath`에 `.claude-plugin/plugin.json` 없음)으로 찍어도, `LSP` 도구(documentSymbol·hover·findReferences)는 정상 동작하는 걸 실측 확인함(2026-08-26, `@/types` path alias 해석·9개 파일 18개 참조 정확히 조회). 플러그인 등록 문제와 LSP 기능 동작 여부는 다른 층위라, harness-doctor 경고만 보고 LSP가 죽었다고 판단하지 말고 실제로 한 번 찔러본다.

## 4. 철거·삭제 이력 (되살리지 말 것)

### 데스크톱/모바일 셸 이원화 삭제 (#603 → #607)

`DesktopStudioShell`·`ImageUploader`·`FieldAccordion`·`DesktopDesignPanel`·`AppHeader`·`ThemeToggle`·`src/utils/breakpoints.ts`가 사라졌고, `src/pages/index.tsx`의 `useMatchMedia` 셸 분기(`mounted`·`isMobile` SSR 왕복)도 없다. 데스크톱은 같은 `MobileEditorShell`을 `PhoneFrame`(400px, `container-type:size` + `contain:paint`)에 넣어 띄운다.

뷰포트 브레이크포인트가 남은 자리는 `tailwind.config.js`의 `screens.rail`(1024px) 하나고, 소비자도 `PhoneFrame`의 `rail:w-[400px]` 하나뿐이다. JS 미러(`RAIL_BREAKPOINT_PX`)가 없어져 #104의 dead zone 위험이 구조적으로 소멸했다.

### 데스크톱 캐러셀 삭제 (#620)

`LayoutPicker.tsx`의 default-export `LayoutPicker`(데스크톱 캐러셀)와 무드별 SVG 썸네일 레지스트리(`THUMBNAIL_RENDERERS`)는 #620에서 삭제됐다 — #607이 셸을 한 벌로 합친 뒤로 죽은 코드였고 데스크톱 전용 UI 계획이 남아 있지 않아 둘 이유가 없었다.

### 번들 로고·에셋 매니페스트 철거 (#196·#231·#355)

`public/assets/{chains,formats}_transparent/` 파일명이 한때 단일 소스였지만 저작권 문제를 피하려고 **번들 로고를 제거**했다. 지금은 사용자가 필드 드로어(`src/components/v2/FieldDrawer.tsx`)의 극장/포맷 행이나 온티켓 인플레이스 에디터(`src/components/v2/InPlaceFieldEditor.tsx`)에서 로고를 직접 올리고, 각각 자유 비율 크롭(`useLogoCrop` + `ImageCropModal`)을 거친다.

- `FieldEditSheet`는 #355에서 드로어로 대체됐다. `FieldEditorBody`/`StampSheet`는 살아 있는 앱 호출부가 없다 — 앱이 `src/components/v2/FieldEditorBody.tsx`에서 import하는 건 `DateSheet`·`INPUT_CLS`·`KobisResultList`뿐이고(유일한 importer는 `InPlaceFieldEditor.tsx`), `fieldSheets`·`titleSheetSearch` 테스트가 아직 `FieldEditorBody`를 렌더한다.
- 옛 `TheaterChainPicker`/`FormatPicker`는 #231에서 제거됐다.
- 파일 기반 에셋 매니페스트 코드젠(`scripts/generate-asset-manifest.ts` → `assets.generated.ts`, predev/prebuild 훅)은 #196에서 제거됐다.

### TMDB 인앱 포스터 검색 철거 (#665, 2026-08-10)

#537이 넣었던 `TmdbPosterModal`·`/api/tmdb/{search,images,image}` 프록시·`checkTmdbRateLimit`/`checkTmdbImageRateLimit`(#638이 썸네일/원본으로 쪼갠 스코프 분리 포함)·TMDB API 키 환경변수가 전부 사라졌다.

근거는 TMDB API 약관 세 조항(AI 애플리케이션 금지·파생물 금지·상업적 사용은 별도 서면 동의)이고 **어느 하나도 코드로 못 푼다.** 특히 `docs/specs/landing-mood-first-ocr-entry.yaml`이 2차로 그리던 "OCR 제목 → 포스터 자동 검색" 체인이 1번 조항의 정면이라, TMDB를 안고 가면 그 동선을 영영 못 만든다(원문 대조는 `docs/NATIVE_IOS_RFC.md` §7.1·§9). **KOBIS는 그대로다** — 영화 메타데이터 축은 KOBIS가 계속 담당하고, 사라진 건 포스터 이미지를 외부에서 가져오는 기능 하나다. 포스터는 사용자 직접 업로드가 주 경로이고, 포스터 없이 시작하는 길은 #631이 열어놨다.

**철거하면서 일부러 남긴 두 가지(#665).**

1. 랜딩 이탈 경로가 3종 → 2종이 되면서 문구를 쌍으로 다시 잡았다: **"포스터 업로드 · 포스터 없이 직접 입력"**. TMDB가 맡던 "파일을 직접 못 구한 사용자"를 남은 둘이 나눠 받는다는 게 링크 이름만으로 읽혀야 해서다(테스트가 이 문구를 정확히 기대하므로 바꾸려면 같이 볼 것). #665 당시엔 앞쪽이 "포스터 있으면 올리기"였는데 #677 톤 정비가 조건절을 걷어냈다(`Landing.tsx:557` 주석 · `docs/COPY_TONE_GUIDE.md`의 "테스트가 잠근 문구" 표) — 쌍의 의미는 안 줄었다. 있고 없고의 대비를 조건절이 아니라 짝의 "없이"가 이미 지고 있어서다.
2. `usePhototicket.fillEmptyMovieInfo`와 `__tests__/fillEmptyMovieInfoRatingZero.test.tsx`는 **호출부가 0인 채로 남겼다.** "이미 사용자가 채운 필드는 안 덮는다"와 그 회귀(숫자 0을 빈 값으로 오판하지 않기, #638 P2)는 다음 자동 보강 경로에서 다시 필요하다. 미사용 export라고 지우지 않는다.

### 진입 동선 재설계 맥락

진입 동선 재설계(#612·#615·#635)와 포스터 선택 사항화(#631)는 main에 반영됐다. 앱 화면·무드 리뉴얼은 #826 에픽이 다루고, OCR 제목 → 포스터 자동 검색 체인은 #665로 폐기됐다.

## 5. OCR 최신성 판정 근거 (#388·#793·#806)

규칙이 전부 실측(#125·#348, 실 티켓 15장 A/B)에서 나왔다. 프롬프트·Zod·rate limit 등 파이프라인 자체의 근거는 `.claude/skills/ocr-pipeline/SKILL.md`에 있고, 여기엔 **레이스/수명 판정**의 근거만 둔다.

### 최신성은 카드가 아니라 셸이 소유한다 (#388 · claude-review PR #413 P0, 커밋 `007f381`)

in-flight KOBIS 보강의 적용 여부는 인스턴스 로컬 `mountedRef`가 아니라 셸이 쥔 `ocrEpochRef`(`useOcrUndo`의 `epochRef`)가 epoch 비교로 판정하므로, `OcrUploadCard`가 unmount돼도 `titleOg`·`releaseDate`는 유실되지 않는다. 드로어 카드는 닫힐 때마다 그 자리에서 unmount되는데 보강이 살아남는 게 그 근거고, `setInfo`가 이 인스턴스가 아니라 셸의 photo 상태를 갱신하기 때문이다. remount의 실제 대가는 그 카드 로컬 상태(`isProcessing`·토스트) 리셋뿐이다.

**따라서 "카드를 단일 인스턴스로 유지"는 레이스 방어가 아니라 같은 상태를 쓰는 진입점을 안 늘리려는 배치 결정이다.** #363/PR #372 리뷰 P1을 근거로 든 옛 서술("두 번째 인스턴스를 만들면 레이스가 되살아난다")은 2026-07-17부로 철회됐다(#624). 그 문구를 믿고 `mountedRef` 가드를 되살리면 #413 P0을 그대로 재도입한다.

### KOBIS 보강은 epoch에 더해 영화 수명도 본다 (#793)

epoch는 OCR 실행끼리·undo와의 순서만 알아서, 조회 중에 사용자가 다른 영화를 고르면 늦은 결과가 그 선택을 덮고 제목이 바뀌며 선택의 상세 보강(#784)까지 취소했다. 그래서 보강은 `setInfo`가 아니라 조회 시작 때 캡처한 `usePhototicket.captureMovieSelection()` 적용기로만 쓴다 — KOBIS 선택(`beginMovieSelection`)과 같은 `movieSelectionRef`·`docEpochRef` 판정이라, 조회 중의 영화 선택·제목 수정·전역 undo·문서 리셋이 전부 늦은 OCR 결과를 버린다. 이 수명도 셸 소유라 드로어 카드 unmount와는 무관하다.

### OCR 응답 자체는 초기화 세대만 본다 (#806)

`runOcr` 전에 `usePhototicket.captureDraft()`로 `clearDraft`가 올리는 세대를 캡처해, 인식 중에 초기화가 끼면 응답을 통째로 버린다. `docEpochRef`를 쓰지 않는 건 랜딩의 "새로 시작"(포스터 확정·직접 입력·무드 탭, `resetDocument`만 부른다)이 인식 중인 OCR이 들어갈 바로 그 새 문서를 여는 거라서다 — 그걸로 판정하면 랜딩에서 OCR을 올리고 포스터를 확정한 사용자의 인식 결과가 사라진다. 영화 선택도 안 본다(사용자가 영화를 골랐다고 극장·좌석 인식까지 버릴 이유는 없다).
