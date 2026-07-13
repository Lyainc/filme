# CLAUDE.md - AI Assistant Guidelines

## 🎬 Project: FILME
A Next.js web application for generating high-quality CGV Photoplay premium tickets.

### 📌 Core Architecture & Tech Stack
- **Framework**: Next.js 16 (Pages Router), React 19, TypeScript
- **Styling**: Tailwind CSS v3
- **Ticket Rendering**: DOM(JSX/CSS) + `html-to-image` 캡처. `react-easy-crop`로 포스터 매뉴얼 크롭
- **OCR / AI**: 티켓 스크린샷 → Gemini 3.1 Flash Lite vision OCR. `ai` SDK v6 + `@ai-sdk/google`(Google AI Studio 직결), Upstash rate limit, Zod 스키마
- **State Management**: React `useState` / Custom Hooks
- **Package Manager**: Bun

### 📂 Key Documentation References
Before making architectural changes or implementing new features, consult:
- **`docs/PRD.md`**: Overall product requirements, scope, and phases.
- **`README.md`**: Project setup, running instructions, and tech stack overview.
- **`docs/DESIGN_SYSTEM.md`**: Ticket design specs, layout coords, and textures.
- **`docs/KOBIS_API.md`**: Instructions and examples for using the KOBIS movie search API.

### 💻 Development Workflow & Commands
```bash
bun run dev       # Start development server
bun run build     # Build production application
bun run start     # Run production server (after build)
bun test          # Unit + interaction tests
bun run typecheck # tsc --noEmit
```

### 🧪 Testing
- **Runner**: `bun test`. Tests live in `__tests__/` (not co-located).
- **두 부류**: (1) 순수 유닛·static-markup(`renderToStaticMarkup`), (2) **상호작용 테스트** — happy-dom + `@testing-library/react` + `user-event`로 사용자 동작→상태→결과를 검증(#163).
- **DOM 환경**: `bunfig.toml`의 `[test] preload = ["./__tests__/setup/happydom.ts"]`가 happy-dom 글로벌 + `IS_REACT_ACT_ENVIRONMENT`를 등록. happy-dom 미구현 API(예: `scrollIntoView`)는 그 setup에 no-op 폴리필로 추가.
- **모듈 mock**: bun `mock.module`은 hoisting 안 됨 — mock 등록 **후** `require(...)`로 대상(예: `runOcr`)을 import해야 가로채짐. top-level `await import`는 tsconfig `target:es5`에서 막히니 `require` 사용.
- **회귀 테스트 예**: `__tests__/ocrUndoRestore.test.tsx` — OCR undo가 chainVisible/chainLabel + 폼 필드를 원자 복원하는지(#141 P1) 검증. 새 상호작용 테스트는 testing-library로 통일 권장.

### 🔎 Code Review
- **리뷰 게이트 = PR의 GitHub `claude-review` 액션**(main 브랜치 required check). 모든 PR에서 자동으로 돌아 correctness를 잡으니 이게 authoritative 리뷰다.
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
- **Naming Conventions**:
  - Components: `PascalCase` (e.g., `ImageUploader.tsx`)
  - Hooks: `camelCase` (e.g., `usePhototicket.ts`)
  - Utils: `camelCase` (e.g., `captureToImage.ts`, `layouts.ts`)
- **Types**: Define types locally in `src/types/index.ts` if shared. Use implicit inference where appropriate.
- **Inline style — no `font` shorthand**: Always split into `fontWeight` / `fontStyle` / `fontSize` / `fontFamily`. CSS `font` shorthand resets `line-height` to `normal`, which collides with a sibling `lineHeight` prop and triggers React's "Removing font lineHeight" warning at every rerender.

### 🖼️ Core Mechanisms (6-Mood Ticket Rendering)
- **Layout catalog**: `src/utils/layouts.ts` — `LAYOUTS` defines 6 mood ids (`minimal`/`criterion`/`35mm`/`editorial`/`stub`/`35mm-landscape`) with dimensions and orientation. `LayoutId` union lives in `src/types/index.ts`.
- **Mood components**: `src/components/moods/Mood{Minimal,Criterion,35mm,Editorial,Stub,35mmLandscape}.tsx` — each mood is a self-contained DOM tree at the layout's natural pixel size (4 portrait 960×1477, 2 landscape 1477×960: Editorial and 35mm Wide).
- **Shared primitives**: `src/components/moods/_shared.tsx` — `Barcode` (memoized), `ChainStamp`, `FormatStamp`, `Poster`, `HorizontalSprockets`, `PerforationStrip`, plus helpers (`fitFontSizeToWidth`, `isInkDark`, `truncateActors`) and font tokens (`FONT_MONO`, `FONT_SANS`, `FONT_KR`). **Add new shared helpers here**, not inline in moods.
- **Renderer**: `src/components/TicketRenderer.tsx` — dispatches to active mood, uses `ResizeObserver` to scale the inner natural-pixel tree to fit the preview, and forwards the inner ref so the export pipeline captures the unscaled DOM.
- **Picker**: `src/components/LayoutPicker.tsx` — typed `Record<LayoutId, ...>` thumbnail registry; renaming a layout id breaks the lookup at compile time.
- **Export**: `src/utils/captureToImage.ts` — awaits `document.fonts.ready` + image loads, then dynamically imports `html-to-image` and forces `transform: 'none'` during capture (otherwise the preview scale wrapper distorts output). Output is a JPEG data URL at the layout's natural pixel dimensions × `pixelRatio: 2`.
- **Memory Management**: Always `URL.revokeObjectURL` on blob URLs created for cropped images. Download (`downloadTicketAsJpeg`) decodes the capture's base64 `data:` URL via `atob` → `Uint8Array` → `Blob` → `createObjectURL`, then revokes after the anchor click. **No `fetch(data:)`** — Vercel CSP `connect-src` blocks it, so base64 is decoded directly (CSP-safe).
- **Asset manifest**: `public/assets/{chains,formats}_transparent/` filenames were the single source of truth, but to avoid copyright issues, **bundled logos are removed**. Users now upload logos directly via the field editor's Theater/Format stamp rows (`StampSheet` inside `src/components/v2/FieldEditorBody.tsx`, reached from `FieldAccordion` on desktop / `FieldLauncher`→`FieldEditSheet` on mobile) with free-aspect crop (`useLogoCrop` + `ImageCropModal`). The old `TheaterChainPicker`/`FormatPicker` were removed in #231, and the file-based asset-manifest codegen (`scripts/generate-asset-manifest.ts` → `assets.generated.ts`, predev/prebuild hooks) was removed in #196.
- **Dashed Placeholders**: If a user toggles chain/format ON but doesn't upload a logo, a dashed placeholder appears in the preview. This placeholder is explicitly ignored during `html-to-image` capture via the `data-hide-on-export` attribute.

### 🔍 OCR Pipeline (티켓 스크린샷 자동 인식)
> Tesseract.js 클라이언트 OCR → GPT-4o mini 서버 vision → **Gemini 3.1 Flash Lite 직결**로 두 번 교체됐다. 진입점은 `OcrUploadCard`.
- **Flow**: 스크린샷 → 클라 전처리 → base64 JSON → `POST /api/ocr` → Gemini 3.1 Flash Lite vision → 채워진 필드만 반환.
- **UX**: Bounding-box review is deprecated (A1~A3 unimplemented). OCR uses 'optimistic injection + instant revert' (fields are injected directly into the form, with an immediate undo toast).
- **Client preprocess**: `src/utils/ocrPreprocess.ts` — `preprocessForOcr(file)`: 하단 18% 크롭(앱 UI·고지 제거) → width 512px 캡 → JPEG 0.92 재인코딩. SSR-safe(`window` 없으면 원본). 모든 실패 경로에서 throw 없이 원본 file fallback.
- **Client entry**: `src/utils/ocr.ts` — `runOcr(file)`가 전처리 → `/api/ocr` → `Partial<MovieInfo> & { chain? }`. **절대 throw 안 함** — 실패는 빈 객체로 흡수. 반환 필드 분기: `title`은 KOBIS 검색어로, 나머지는 폼에 직접, `chain`/`format`은 **MovieInfo가 아니라 TicketComponents로** 흘러 스탬프 라벨·노출을 자동 활성화(`{chain,format}Visible: true` + `{chain,format}Label`, #141·#348). 이 라벨은 export에 들어가므로 undo가 `prevComponents` 스냅샷으로 원자 복원한다(#141 리뷰 P1) — 새 스탬프 필드를 추가하면 그 스냅샷도 같이 넓힐 것.
- **API route**: `src/pages/api/ocr.ts` — base64 JSON 수신(multipart 아님, `bodyParser.sizeLimit: '15mb'`). 가드 순서 method → 입력(MIME 화이트리스트·10MB) → rate limit → 인증 → 모델. **절대 throw 안 함**, 모든 에러를 status + `{ error }`로. Zod 스키마는 전 필드 `.nullable()`(`.optional()` 아님 — structured output의 `NoObjectGeneratedError` 회피). `chain`은 enum(에셋 슬러그와 1:1이라 4종으로 닫힘), **`format`은 자유 문자열**(#348 — 포맷·특별관 브랜드가 계속 늘어나고 목적지 `formatLabel`이 이미 자유 텍스트라 enum으로 닫으면 브랜드마다 코드를 고쳐야 한다. 인정 토큰은 스키마가 아니라 **프롬프트**가 닫는다 — 브랜드 추가는 프롬프트 한 줄).
- **System prompt**: 지시문 영어 + 예시 한국어. 규칙이 전부 실측에서 나왔으니 **가볍게 고치지 말 것**(#125 A/B 15장 기준 STRICT 100%) — theater/screen 분리(CGV 앱은 지점명 줄 바로 아래 상영관 줄이 붙어서 "전도연관"을 지점명으로 오인함), 지점명 축약 금지, **로고 없는 CGV 티켓의 chain 판별**(CGV 앱 스크린샷엔 로고가 없어서 "판매번호" 라벨 + `연도-월일-4자리-4자리` 형식이 유일한 단서), 심야 상영 `25:00` 표기 보존. **format 규칙도 같은 15장 실측**(#348) — 값은 상영관 줄 안에 섞여 찍히고(`IMAX관`·`MEGA | LED 3관`·`전도연관[CGV아트하우스](Laser)`), CGV 배지는 IMAX/4DX일 때만 떠서 배지만 보면 나머지를 놓친다. 인정 어휘는 **닫힌 토큰 목록**(영사·음향 포맷 + 특별관 브랜드: IMAX·4DX·SCREENX·DOLBY·MEGA LED·아트하우스·르 리클라이너·광음시네마·템퍼시네마·샤롯데·부티크 등) — 예전 `formats_transparent/` 로고 에셋과 같은 어휘다. 자유 문자열로 열면 상영관 줄의 아무 토막이나 들어와 STRICT 채점이 성립하지 않는다. **LASER는 어휘에 없다**(옛 에셋에도 없었고 CGV 거의 모든 관에 붙어 정보량이 없음). 좌석등급(컴포트석)·이름관(전도연관)·목록 밖 브랜드(디즈니시네마·아르떼)도 제외 — 사용자가 직접 입력한다.
- **AI provider**: **Google AI Studio 직결** — `@ai-sdk/google`의 `google('gemini-3.1-flash-lite')`, 인증 env `GOOGLE_GENERATIVE_AI_API_KEY` 하나(없으면 500). ⚠️ **`@ai-sdk/google`는 `3.0.91`로 고정** — 최신 4.x는 provider spec v4용이라 `ai@6`(spec v2/v3)와 `AI_UnsupportedModelVersionError`로 충돌한다. Vercel AI Gateway는 **더 이상 안 쓴다**(free tier의 모델별 요청 한도가 실사용에서 자주 걸렸고, 무료 크레딧 잔액과 무관하게 paid credits 구매 여부로 게이팅됨 — #125·#299). 대가로 Gateway의 provider fallback·통합 비용 관측·OIDC 무키 인증은 포기. `imageDetail`은 OpenAI 전용이라 제거됨. ⚠️ **`@opentelemetry/api`는 코드에서 직접 import 안 해도 `dependencies`에 유지** — `ai`@6 + Next 16 Turbopack에서 누락 시 API route 런타임 500.
- **Rate limit**: `src/utils/ratelimit.ts` — Upstash Redis sliding window. OCR은 **per-IP(10/시간·20/일) + shared(키 전체 12/분·450/일)** 4겹이고, 하나라도 초과하면 429 + `Retry-After`. shared 윈도우는 IP 대신 고정 키 `'global'`로 세는 게 핵심 — **Google free tier 한도가 API 키(프로젝트) 단위(gemini-3.1-flash-lite: 15 RPM·500 RPD, 2026-07-13 실측)라 IP별 카운터만으론 키 소진을 원리적으로 못 막는다**(#299). 체크 순서는 per-IP 먼저 → shared 나중(IP에서 막힐 요청은 벤더를 안 부르므로 총량을 갉으면 안 된다). **env(`UPSTASH_REDIS_REST_URL`/`_TOKEN`) 미설정 시 graceful skip** — 로컬 dev가 막히지 않음. Google 쪽 429는 **재시도하지 않는다** — 벤더 한도가 키 전체 단위라 재시도가 소진을 가속시킨다. Tier 1(4K RPM·150K RPD)로 올릴 땐 shared 수치도 같이 올릴 것.
- **Env**: `GOOGLE_GENERATIVE_AI_API_KEY`(OCR 필수) · `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`(선택) · `KOBIS_API_KEY`(title→KOBIS 조회).
- **A/B 하네스**: `scripts/ab-ocr-model.ts` + `scripts/ab-ocr-groundtruth.json`(실 티켓 15장 정답지). `AB_MODELS`로 모델, `AB_PROMPT=en`으로 프롬프트 판본, `AB_OUT`으로 결과 파일을 고른다. 결과는 `(파일, 모델)` 단위로 캐시돼 재개 가능 — **프롬프트를 고쳤으면 반드시 새 `AB_OUT`으로** 돌릴 것(옛 프롬프트 결과와 섞이면 채점이 오염된다).

### 🚧 Current Project Status
- **Completed**: MVP + KOBIS API + Manual Cropping + TCG Premium Textures + Editorial Cinema redesign + 6-Mood layout system(#281: Stub·35mm Wide 등 마스터 시안 재동기화) + GPT-4o mini OCR(Tesseract 클라이언트에서 전환) + 단일 에디터 재편(#86: 2-step Phase 폐기 → 단일 에디터 셸, `useScreen` 훅) + 모바일 편집 셸 dead-code 정리(#283: 도달 불가 OCR·폼·rail 경로 제거, Poster 드롭존만 `MobileEditorShell`에 인라인) + Serial/Collection 입력·EditionMark 제거(#84) + K-means 색 추출 Web Worker 오프로드(#80: `src/utils/colorExtraction.worker.ts`) + 상호작용 테스트 인프라(#163: happy-dom + testing-library, OCR undo 회귀 테스트) + 업로드 영역 포스터 주연 재설계(#142: 드롭존 메인 + OCR 보조 액션) + 폼 입력 자유화(#316/#317: placeholder 제거, 극장/포맷 자유입력) + 명시적 임시저장/초기화 전환(#310/#344) + 제목 폭 맞춤 폰트 자동 축소(#318/#345) + 공유 액션 단일화(#325: 저장/링크/공유 3종) + disclaimer footer(#327).
- **Next Up**: 확정 로드맵 없음 (이전 TMDB·Supabase 계획은 폐기).
