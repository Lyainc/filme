# CLAUDE.md - AI Assistant Guidelines

## 🎬 Project: Phototicket Maker
A Next.js web application for generating high-quality CGV Photoplay premium tickets.

### 📌 Core Architecture & Tech Stack
- **Framework**: Next.js 16 (Pages Router), React 19, TypeScript
- **Styling**: Tailwind CSS v3
- **Ticket Rendering**: DOM(JSX/CSS) + `html-to-image` 캡처. `react-easy-crop`로 포스터 매뉴얼 크롭
- **OCR / AI**: 티켓 스크린샷 → GPT-4o mini vision OCR. `ai` SDK v6 + Vercel AI Gateway, Upstash rate limit, Zod 스키마
- **State Management**: React `useState` / Custom Hooks
- **Package Manager**: Bun

### 📂 Key Documentation References
Before making architectural changes or implementing new features, consult:
- **`docs/PRD.md`**: Overall product requirements, scope, and phases.
- **`README.md`**: Project setup, running instructions, and tech stack overview.
- **`docs/DESIGN_SYSTEM.md`**: Ticket design specs, layout coords, and textures.
- **`docs/KOBIS_API.md`**: Instructions and examples for using the KOBIS movie search API.
- **`docs/ASSETS.md`**: Specs and guidelines for theater/format logos.

### 💻 Development Workflow & Commands
```bash
bun run dev     # Start development server
bun run build   # Build production application
bun run start   # Run production server (after build)
```

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

### 🖼️ Core Mechanisms (4-Mood Ticket Rendering)
- **Layout catalog**: `src/utils/layouts.ts` — `LAYOUTS` defines 4 mood ids (`minimal`/`criterion`/`35mm`/`editorial`) with dimensions and orientation. `LayoutId` union lives in `src/types/index.ts`.
- **Mood components**: `src/components/moods/Mood{Minimal,Criterion,35mm,Editorial}.tsx` — each mood is a self-contained DOM tree at the layout's natural pixel size (3 portrait 960×1477, Editorial landscape 1477×960).
- **Shared primitives**: `src/components/moods/_shared.tsx` — `Barcode` (memoized), `ChainStamp`, `FormatStamp`, `Poster`, `HorizontalSprockets`, `PerforationStrip`, plus helpers (`pickTitleSize`, `resolveBookingNo`, `isInkLight`, `seedFromString`, `truncateActors`) and font tokens (`FONT_MONO`, `FONT_SANS`, `FONT_KR`). **Add new shared helpers here**, not inline in moods.
- **Renderer**: `src/components/TicketRenderer.tsx` — dispatches to active mood, uses `ResizeObserver` to scale the inner natural-pixel tree to fit the preview, and forwards the inner ref so the export pipeline captures the unscaled DOM.
- **Picker**: `src/components/LayoutPicker.tsx` — typed `Record<LayoutId, ...>` thumbnail registry; renaming a layout id breaks the lookup at compile time.
- **Export**: `src/utils/captureToImage.ts` — awaits `document.fonts.ready` + image loads, then dynamically imports `html-to-image` and forces `transform: 'none'` during capture (otherwise the preview scale wrapper distorts output). Output is a JPEG data URL at the layout's natural pixel dimensions × `pixelRatio: 2`.
- **Memory Management**: Always `URL.revokeObjectURL` on blob URLs created for cropped images. Download (`downloadTicketAsJpeg`) decodes the capture's base64 `data:` URL via `atob` → `Uint8Array` → `Blob` → `createObjectURL`, then revokes after the anchor click. **No `fetch(data:)`** — Vercel CSP `connect-src` blocks it, so base64 is decoded directly (CSP-safe).
- **Asset manifest (auto-generated)**: `public/assets/{chains,formats}_transparent/` filenames are the single source of truth. Pattern `<value>_<label>.png` (value = `[a-z0-9-]+` slug, label = picker display string). `scripts/generate-asset-manifest.ts` scans these folders and emits `src/utils/assets.generated.ts` (gitignored). `predev` / `prebuild` hooks run it automatically; `bun run gen:assets` for explicit runs. `constants.ts`, pickers, and `ChainStamp` / `FormatStamp` derive everything from the manifest — drop a file in, picker updates itself. Filename violations / duplicate values throw at generator time. Spec: `docs/ASSETS.md`.

### 🔍 OCR Pipeline (티켓 스크린샷 자동 인식)
> Tesseract.js 클라이언트 OCR을 GPT-4o mini 서버 vision으로 **전면 교체** 완료. 진입점은 `OcrUploadCard`.
- **Flow**: 스크린샷 → 클라 전처리 → base64 JSON → `POST /api/ocr` → GPT-4o mini vision → 채워진 필드만 반환.
- **UX**: Bounding-box review is deprecated (A1~A3 unimplemented). OCR uses 'optimistic injection + instant revert' (fields are injected directly into the form, with an immediate undo toast).
- **Client preprocess**: `src/utils/ocrPreprocess.ts` — `preprocessForOcr(file)`: 하단 18% 크롭(앱 UI·고지 제거) → width 768px 캡 → JPEG 0.92 재인코딩. SSR-safe(`window` 없으면 원본). 모든 실패 경로에서 throw 없이 원본 file fallback.
- **Client entry**: `src/utils/ocr.ts` — `runOcr(file)`가 전처리 → `/api/ocr` → `Partial<MovieInfo> & { chain? }`. **절대 throw 안 함** — 실패는 빈 객체로 흡수. 반환 필드 분기: `title`은 KOBIS 검색어로, 나머지는 폼에 직접, `chain`은 로고 자동선택.
- **API route**: `src/pages/api/ocr.ts` — base64 JSON 수신(multipart 아님, `bodyParser.sizeLimit: '15mb'`). 가드 순서 method → 입력(MIME 화이트리스트·10MB) → rate limit → 인증 → 모델. **절대 throw 안 함**, 모든 에러를 status + `{ error }`로. Zod 스키마는 전 필드 `.nullable()`(`.optional()` 아님 — OpenAI structured output의 `NoObjectGeneratedError` 회피). `chain` enum 4종(`cgv`/`lotte`/`megabox`/`cineq`, 에셋 슬러그와 1:1).
- **AI provider**: Vercel AI Gateway 경유 `model: 'openai/gpt-4o-mini'` 문자열(provider 패키지 import 없음). 인증은 `AI_GATEWAY_API_KEY` 또는 `VERCEL_OIDC_TOKEN`(배포/`vercel env pull`), 둘 다 없으면 500. ⚠️ **`@opentelemetry/api`는 코드에서 직접 import 안 해도 `dependencies`에 유지** — `ai`@6 + Next 16 Turbopack에서 누락 시 API route 런타임 500.
- **Rate limit**: `src/utils/ratelimit.ts` — Upstash Redis IP sliding window 10/시간·50/일(둘 중 하나라도 초과 시 차단). **env(`UPSTASH_REDIS_REST_URL`/`_TOKEN`) 미설정 시 graceful skip** — 로컬 dev가 막히지 않음.
- **Env**: `AI_GATEWAY_API_KEY`(또는 OIDC, OCR 필수) · `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`(선택) · `KOBIS_API_KEY`(title→KOBIS 조회).

### 🚧 Current Project Status
- **Completed**: MVP + KOBIS API + Manual Cropping + TCG Premium Textures + Editorial Cinema redesign + 4-Mood layout system + GPT-4o mini OCR(Tesseract 클라이언트에서 전환).
- **Next Up**: 확정 로드맵 없음 (이전 TMDB·Supabase 계획은 폐기).
