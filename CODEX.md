# CODEX.md - Codex Assistant Guidelines

## 🎬 Project: Phototicket Maker
A Next.js web application for generating high-quality CGV Photoplay premium tickets.

### 📌 Core Architecture & Tech Stack
- **Framework**: Next.js 16 (Pages Router), React 19, TypeScript
- **Styling**: Tailwind CSS v3
- **Image Processing**: Pure Canvas API (Native), `react-easy-crop`
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
bun run lint    # Run ESLint
```

### 🧑‍💻 Coding Standards & Vibe Coding
- **Iterative Delivery**: Prioritize working code over perfect architecture. Implement, verify, then refactor.
- **No Over-abstraction**: Keep components direct and simple. Don't add complex design patterns (like Strategy/Factories) unless there is an immediate practical need.
- **State Management**: Stick to `useState` unless the state logic becomes overwhelmingly complex.
- **Naming Conventions**:
  - Components: `PascalCase` (e.g., `ImageUploader.tsx`)
  - Hooks: `camelCase` (e.g., `usePhototicket.ts`)
  - Utils: `camelCase` (e.g., `canvasRendering.ts`)
- **Types**: Define types locally in `src/types/index.ts` if shared. Use implicit inference where appropriate.

### 🖼️ Core Mechanisms (Canvas Rendering)
- **Logic Location**: `src/utils/canvasRendering.ts` handles all native Canvas API calls (`drawImage`, text wrapping, gradient overlays, texture blending).
- **Component**: `src/components/PhototicketCanvas.tsx` manages the React lifecycle and invokes the canvas rendering utilities.
- **Memory Management**: Always use `URL.revokeObjectURL` to clean up blob URLs created for cropped images to prevent memory leaks.

### 🚧 Current Project Status
- **Completed**: MVP + KOBIS API + Manual Cropping + TCG Premium Textures (Refactoring Complete).
- **Next Up**: TMDB API integration (for automated poster fetching) and Database/Gallery implementation (Supabase).
