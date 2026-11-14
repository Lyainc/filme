# AGENTS.md - Codex Project Guide

## Project

FILME is a Next.js web app for creating CGV Photoplay-style premium tickets.

## Tech Stack

- Framework: Next.js 16 Pages Router, React 19, TypeScript
- Styling: Tailwind CSS v3
- Ticket rendering: natural-pixel DOM/JSX/CSS captured with `html-to-image`
- Cropping: `react-image-crop`
- State: React `useState` and local custom hooks
- Package manager: Bun

## First References

Read only the references relevant to the task:

- `CLAUDE.md` for detailed current architecture and runtime invariants
- `README.md` for setup and user-facing capabilities
- `docs/KOBIS_API.md` for the current server-proxied KOBIS integration
- `docs/PRINT_CALIBRATION.md` before changing print-sensitive ticket visuals
- `docs/COPY_TONE_GUIDE.md` before changing user-visible copy
- `docs/HARNESS.md` before touching the headless Chrome measurement harness, rail slot height, or frame-containment axes
- `docs/TESTING.md` for the rationale behind the test rules (CI timeout parity, `mock.module` restore, DOM `received` serialization)
- `docs/CONTRIBUTING.md` for review-gate/Git/release rationale, removed-feature history (TMDB etc.), and OCR freshness rationale
- `.agents/skills/ocr-pipeline/SKILL.md` before reading or changing the OCR pipeline

## Commands

```bash
bun install
bun run dev
bun run build
bun run start
bun run typecheck
bun run lint
bun run test
```

Use the package scripts instead of bare `bun test`; the script carries the CI timeout.

## Coding Standards

- Prefer working, directly understandable code over abstract architecture.
- Do not add Strategy/Factory-style abstractions unless an immediate project need justifies them.
- Use `useState` and custom hooks unless state complexity clearly needs something heavier.
- Keep shared types in `src/types/index.ts` when they are used across modules.
- Use implicit TypeScript inference where it keeps code clear.
- Follow local naming: components use `PascalCase`; hooks and utils use `camelCase`.

## Current Rendering Architecture

- Layout catalog: `src/utils/layouts.ts`
  - `LAYOUTS` defines six ids: `minimal`, `criterion`, `35mm`, `editorial`, `stub`, and `35mm-landscape`.
  - Portrait layouts are 960x1534; landscape layouts are 1534x960.
  - Canvas orientation and poster-slot orientation are separate fields.
- Mood components: `src/components/moods/Mood*.tsx`
  - Each mood owns a natural-pixel DOM tree.
- Shared mood primitives: `src/components/moods/_shared.tsx`
  - Reuse `Poster`, stamp, barcode, film, typography, and field helpers from here.
- Renderer: `src/components/TicketRenderer.tsx`
  - Dynamically dispatches the active mood, scales the preview with `ResizeObserver`, and forwards the unscaled inner node for export.
- Picker: `src/components/LayoutPicker.tsx`
  - `LayoutStrip` renders the six typed mood chips from `LAYOUTS`.
- Export: `src/utils/captureToImage.ts`
  - Waits for fonts and decoded images, captures at natural dimensions with `pixelRatio: 2`, composites print effects, and revokes the temporary download blob URL.

## Memory and Object URLs

Always revoke blob URLs for cropped posters, uploaded stamps, signatures, and downloaded JPEGs. Preserve the undo-aware lifetime handling in `usePhototicket` and the capture helpers.

## Frontend Work Notes

- Preserve the current single-shell editor interaction model in `MobileEditorShell`.
- Match the dense production-tool UI in `src/components/v2` and reuse existing Tailwind tokens and UI variants.
- Prefer existing mood primitives and `designRailItems.tsx` over one-off controls.
- Ensure controls and ticket text fit at mobile and desktop frame sizes.
- Put tracked visual assets under `public/assets`; landing asset behavior is documented in `public/assets/landing/README.md`.

## Project Status

The current app includes six moods, optional posters, KOBIS search, Gemini OCR, manual cropping, material/coating effects, draft persistence, sharing, and high-resolution export. There is no confirmed next-feature roadmap; do not infer one from old specs.
