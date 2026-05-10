# CLAUDE.md - AI Assistant Guidelines

## 🎬 Project: Phototicket Maker
A Next.js web application for generating high-quality CGV Photoplay premium tickets.

### 📌 Core Architecture & Tech Stack
- **Framework**: Next.js 16 (Pages Router), React 19, TypeScript
- **Styling**: Tailwind CSS v3
- **Ticket Rendering**: DOM(JSX/CSS) + `html-to-image` 캡처. `react-easy-crop`로 포스터 매뉴얼 크롭
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

### 🖼️ Core Mechanisms (4-Mood Ticket Rendering)
- **Layout catalog**: `src/utils/layouts.ts` — `LAYOUTS` defines 4 mood ids (`minimal`/`criterion`/`35mm`/`editorial`) with dimensions and orientation. `LayoutId` union lives in `src/types/index.ts`.
- **Mood components**: `src/components/moods/Mood{Minimal,Criterion,35mm,Editorial}.tsx` — each mood is a self-contained DOM tree at the layout's natural pixel size (3 portrait 960×1477, Editorial landscape 1477×960).
- **Shared primitives**: `src/components/moods/_shared.tsx` — `Barcode` (memoized), `ChainStamp`, `FormatStamp`, `Poster`, `HorizontalSprockets`, `PerforationStrip`, plus helpers (`compactDate`, `pickTitleSize`, `resolveBookingNo`, `isInkLight`, `seedFromString`) and font tokens (`FONT_MONO`, `FONT_SANS`, `FONT_SERIF`, `FONT_KR`). **Add new shared helpers here**, not inline in moods.
- **Renderer**: `src/components/TicketRenderer.tsx` — dispatches to active mood, uses `ResizeObserver` to scale the inner natural-pixel tree to fit the preview, and forwards the inner ref so the export pipeline captures the unscaled DOM.
- **Picker**: `src/components/LayoutPicker.tsx` — typed `Record<LayoutId, ...>` thumbnail registry; renaming a layout id breaks the lookup at compile time.
- **Export**: `src/utils/captureToImage.ts` — awaits `document.fonts.ready` + image loads, then dynamically imports `html-to-image` and forces `transform: 'none'` during capture (otherwise the preview scale wrapper distorts output). Output is a JPEG data URL at the layout's natural pixel dimensions × `pixelRatio: 2`.
- **Memory Management**: Always `URL.revokeObjectURL` on blob URLs created for cropped images. Export uses a `data:` URL via anchor element (auto-GC'd, no revoke needed).

### 🚧 Current Project Status
- **Completed**: MVP + KOBIS API + Manual Cropping + TCG Premium Textures + Editorial Cinema redesign + 4-Mood layout system.
- **Next Up**: TMDB API integration (for automated poster fetching) and Database/Gallery implementation (Supabase).
