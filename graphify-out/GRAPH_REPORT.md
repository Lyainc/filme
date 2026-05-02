# Graph Report - .  (2026-04-12)

## Corpus Check
- Corpus is ~31,160 words - fits in a single context window. You may not need a graph.

## Summary
- 111 nodes · 122 edges · 17 communities detected
- Extraction: 70% EXTRACTED · 30% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `Phase 2: Enhancement (API, Crop, Deploy)` - 6 edges
2. `4DX Screening Format Logo` - 6 edges
3. `Cinema Screening Format` - 6 edges
4. `Megabox Wordmark (Color, PNG)` - 6 edges
5. `Canvas API (Native Browser)` - 5 edges
6. `Phase 1: MVP (Next.js Web App)` - 5 edges
7. `Design Philosophy (Poster-centric Layered Structure)` - 5 edges
8. `KOBIS Open API (KOFIC Movie Database)` - 5 edges
9. `Megabox (Brand)` - 5 edges
10. `Megabox Wordmark Stacked (Color, PNG)` - 5 edges

## Surprising Connections (you probably didn't know these)
- `KOBIS Open API (KOFIC Movie Database)` --semantically_similar_to--> `TMDB API Integration`  [INFERRED] [semantically similar]
  KOBIS_API.md → PRD.md
- `DESIGN_LAYOUT Coordinates (960x1477px)` --semantically_similar_to--> `PhototicketData TypeScript Interface`  [INFERRED] [semantically similar]
  DESIGN_SYSTEM.md → PRD.md
- `Layer Structure (6 Layers: Background to Info)` --references--> `Canvas API (Native Browser)`  [INFERRED]
  DESIGN_SYSTEM.md → PRD.md
- `Core Files (index.tsx, PhototicketCanvas, imageCrop, canvasExport)` --references--> `Canvas API (Native Browser)`  [INFERRED]
  CLAUDE.md → PRD.md
- `KOBIS No Poster Image Limitation` --conceptually_related_to--> `TMDB API Integration`  [INFERRED]
  KOBIS_API.md → PRD.md

## Hyperedges (group relationships)
- **Phototicket Rendering Pipeline** — prd_canvas_api, prd_cgv_photoplay_spec, design_system_layers, design_system_layout, prd_realtime_preview, prd_jpeg_download [EXTRACTED 0.90]
- **Asset Management System (Chains, Formats, Icons)** — assets_chains_folder, assets_formats_folder, assets_icons_folder, assets_naming_convention, design_system_color_unification [EXTRACTED 0.90]
- **Movie API Integration (KOBIS + TMDB)** — kobis_api_overview, prd_tmdb_api, kobis_nextjs_api_route, kobis_data_mapping [EXTRACTED 0.85]
- **Dolby Screening Format Family** — dolby_cinema_logo, dolby_atmos_logo, dolby_va_logo [EXTRACTED 1.00]
- **Megabox Premium Seating Formats** — boutique_logo, boutiquesuite_logo, boutiqueprivate_logo, lerecliner_logo [EXTRACTED 0.95]
- **Immersive Motion Cinema Formats** — 4dx_logo, ultra4dx_logo, smx4d_logo, screenx_logo [INFERRED 0.80]
- **Korean Cinema Theater Chains** — cgv_logo, lotte_logo, megabox_logo, cineq_logo [EXTRACTED 1.00]
- **Premium Screening Formats** — imax_logo, 4dx_logo, superplex_logo, superled_logo, crazysound_logo, crazysoundled_logo [EXTRACTED 1.00]
- **LED-Based Screening Formats** — superled_logo, crazysoundled_logo [INFERRED 0.85]
- **Megabox Brand Color Palette (#3C2A78, #503296, #5ABEC8, #53565B)** — megabox_bi_preview, megabox_bi_wordmark_png, megabox_bi_logotype_korean_png [EXTRACTED 1.00]
- **Megabox White/Inverted Logo Variants for Dark Backgrounds** — megabox_bi_wordmark_white_png, megabox_bi_wordmark_stacked_white_png, megabox_bi_logotype_korean_white_png [EXTRACTED 1.00]
- **Megabox SVG Vector Asset Collection (Scalable)** — megabox_bi_wordmark_svg, megabox_bi_wordmark_stacked_svg, megabox_bi_logotype_korean_svg [EXTRACTED 1.00]

## Communities

### Community 0 - "Megabox Brand Identity Assets"
Cohesion: 0.15
Nodes (17): Megabox Korean Logotype (Color, PNG), Megabox Korean Logotype (Color, SVG), Megabox Korean Logotype (White, PNG), Megabox Korean Logotype (White, SVG), Megabox BI Preview (All Variants), Megabox Wordmark (Color, PNG), Megabox Wordmark with Slogan (Color, PNG), Megabox Wordmark with Slogan (Color, SVG) (+9 more)

### Community 1 - "Core App Components"
Cohesion: 0.19
Nodes (0): 

### Community 2 - "Screening Format Logos"
Cohesion: 0.22
Nodes (13): 4DX Screening Format Logo, CJ 4DPLEX (Brand), CrazySound Logo (Korean), CrazySoundLED Logo, IMAX Logo, MEGA LED Screening Format Logo, Cinema Screening Format, ScreenX Screening Format Logo (+5 more)

### Community 3 - "Tech Stack & Architecture Decisions"
Cohesion: 0.17
Nodes (12): Core Files (index.tsx, PhototicketCanvas, imageCrop, canvasExport), Layer Structure (6 Layers: Background to Info), KOBIS Next.js API Route Proxy (/api/kobis/search), Canvas API (Native Browser), Fabric.js Removal Decision, Next.js 16 (Pages Router) + React 19 + TypeScript, Phase 0: HTML Prototype, Phase 1: MVP (Next.js Web App) (+4 more)

### Community 4 - "API Integration & Future Phases"
Cohesion: 0.2
Nodes (12): Typography (Pretendard, Font Sizes), KOBIS Open API (KOFIC Movie Database), KOBIS No Poster Image Limitation, KOBIS searchMovieInfo API Endpoint, KOBIS searchMovieList API Endpoint, KOBIS API (PRD Reference), Phase 2: Enhancement (API, Crop, Deploy), Phase 3: Data (Supabase, History) (+4 more)

### Community 5 - "Phototicket Core Specification"
Cohesion: 0.2
Nodes (10): CLAUDE.md Project Guide, DESIGN_LAYOUT Coordinates (960x1477px), KOBIS to PhototicketData Mapping, CGV Photoplay Premium Spec (960x1477px, 0.65:1), Image Auto-Crop (0.65:1 Ratio), JPEG Download (960x1477px), Paddie (Reference Project), PhototicketData TypeScript Interface (+2 more)

### Community 6 - "Asset Management & Theater Data"
Cohesion: 0.32
Nodes (8): Theater Chain Logo Assets (public/assets/chains/), Screening Format Logo Assets (public/assets/formats/), UI Icon Assets (public/assets/icons/), Asset Naming Convention (lowercase, english, hyphen), Assets README Folder Structure, Asset Color Unification (White/Black Monochrome), Screening Formats (IMAX, 4DX, Dolby, etc.), Theater Chains (CGV, Lotte, Megabox, CineQ)

### Community 7 - "Design System & Visual Style"
Cohesion: 0.33
Nodes (6): CGV That's The Ticket (Design Reference), Gradient Overlay + Vignetting Effect, Megabox Original Ticket (Design Reference), Design Philosophy (Poster-centric Layered Structure), Remove Translucent Box Overlay Rationale, Text Shadow/Outline for Readability

### Community 8 - "Megabox Premium Formats"
Cohesion: 0.7
Nodes (5): BOUTIQUE by MEGA Screening Format Logo, BOUTIQUE PRIVATE by MEGA Screening Format Logo, BOUTIQUE SUITE by MEGA Screening Format Logo, LE RECLINER by MEGA Screening Format Logo, Megabox (Brand)

### Community 9 - "Dolby Format Family"
Cohesion: 0.83
Nodes (4): Dolby Atmos Screening Format Logo, Dolby (Brand), Dolby Cinema Screening Format Logo, Dolby Vision + Atmos Screening Format Logo

### Community 10 - "Theater Chain Logos"
Cohesion: 1.0
Nodes (4): CGV Logo, CineQ Logo, Lotte Cinema Logo, MEGABOX Logo

### Community 11 - "Next.js App Entry"
Cohesion: 2.0
Nodes (0): 

### Community 12 - "Tailwind Config"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Next.js Config"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "PostCSS Config"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Vercel Deployment"
Cohesion: 1.0
Nodes (1): Vercel Deployment

### Community 16 - "Chalotte Logo"
Cohesion: 1.0
Nodes (1): Chalotte Screening Format Logo

## Knowledge Gaps
- **40 isolated node(s):** `Fabric.js Removal Decision`, `Tailwind v4 to v3 Downgrade Rationale`, `Supabase (Database, Auth, History)`, `Vercel Deployment`, `Phase 0: HTML Prototype` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Next.js App Entry`** (2 nodes): `_app.tsx`, `App()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tailwind Config`** (1 nodes): `tailwind.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Config`** (1 nodes): `next.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PostCSS Config`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vercel Deployment`** (1 nodes): `Vercel Deployment`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Chalotte Logo`** (1 nodes): `Chalotte Screening Format Logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Phase 1: MVP (Next.js Web App)` connect `Tech Stack & Architecture Decisions` to `API Integration & Future Phases`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `Phase 2: Enhancement (API, Crop, Deploy)` connect `API Integration & Future Phases` to `Tech Stack & Architecture Decisions`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `Cinema Screening Format` connect `Screening Format Logos` to `Dolby Format Family`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `4DX Screening Format Logo` (e.g. with `ULTRA 4DX Screening Format Logo` and `CJ 4DPLEX (Brand)`) actually correct?**
  _`4DX Screening Format Logo` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `Megabox Wordmark (Color, PNG)` (e.g. with `Megabox Wordmark Stacked (Color, PNG)` and `Megabox Wordmark with Slogan (Color, PNG)`) actually correct?**
  _`Megabox Wordmark (Color, PNG)` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `Canvas API (Native Browser)` (e.g. with `Layer Structure (6 Layers: Background to Info)` and `Core Files (index.tsx, PhototicketCanvas, imageCrop, canvasExport)`) actually correct?**
  _`Canvas API (Native Browser)` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Fabric.js Removal Decision`, `Tailwind v4 to v3 Downgrade Rationale`, `Supabase (Database, Auth, History)` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._