# Handoff: Editor Chrome Redesign (v8) — floating toolbar module, styling dock, result-screen link panel

## Overview
Design exploration for the **모바일 편집 화면 (mobile editor screen)** chrome of the `filme` phototicket
app: the top header, the on-ticket field editor toolbar, a new **floating toolbar module**
(undo/redo · field list · maximize · placement · hide — draggable, dockable), the **styling controls**
(무드 · 컬러·톤 · 텍스처 · 투명도), and a lighter-weight **result-screen share flow**. Target repo:
`filme` (local folder `PhototicketMaker`, Next.js 16 / React 19 / TypeScript / Tailwind, `bun`).

**Updated for the latest v8 pass** — refreshed from an earlier v8 snapshot. Since the first bundle:
title row on the result screen removed, its action row retyped to the app's real mono/uppercase
secondary-button convention, the styling panel un-boxed (no card behind mood/color/texture/opacity —
sits directly under the poster preview now), 다음 no longer disappears while a dock tab is open, the
result screen no longer slides up from the bottom (instant), and 포스터 밝기 moved into the 투명도 tab
alongside the component-opacity slider.

## About the Design Files
The files in `design/` are **HTML design references** (a self-contained prototyping format, not
React) — they show intended layout, styling, and interaction, not code to copy verbatim. The task
is to **recreate these decisions inside the existing `filme` codebase**, using its established
components, Tailwind tokens, and CSS custom properties (see **Design Tokens** below) — not to port
the HTML/inline-style markup directly.

- `design/Siyan-C-v8.dc.html` — the current, most complete iteration (mobile editor + result screen).
  Open it directly in a browser; it's a live interactive mock.
- `design/FilmeTicket-v4.dc.html`, `Mark-ClapTix.dc.html`, `Wordmark-Filme.dc.html`, `support.js` —
  dependencies it imports (ticket face renderer, logo mark, wordmark). Reference only.
- `design/exploration/` — earlier concept spreads (`Toolbar-Concepts`, `Bottom-Rail-Concepts`) kept
  for context on options that were considered and discarded; **v8 is the decided direction.**

## Fidelity
**High-fidelity** for visual styling (colors, spacing, radii, type) — recreate pixel-close using the
codebase's own tokens (not the prototype's inline hex values, which were picked to *approximate*
those tokens). **Medium-fidelity for interaction/structure**: the floating toolbar module is a new
interaction pattern with no existing equivalent — treat its behavior spec below as the goal, but use
your judgment reconciling it with existing hooks/state (`usePhototicket`, `useOcrUndo`, etc).

## Important: reconcile with code that already exists
This repo is mid-flight on the *same* redesign (see issue numbers cited in comments in
`MobileEditorShell.tsx`, `DesignRail.tsx`, `ResultPanel.tsx` — #310, #315, #322, #328, #331, #332…).
Some of what the design comments asked for **is already implemented**, sometimes more robustly than
the prototype. Concretely:

- **`ResultPanel.tsx` already does the "collapse the share sheet into the result page" redesign** —
  "링크 만들기" reveals an inline panel with the URL + a 복사 button in place (`permalink` state), no
  separate bottom sheet, no dead "카톡·메신저" duplicate (its "공유" button already calls
  `navigator.share`), no "링크 비활성화". **Don't rebuild this flow — only bring its visual tone in
  line with v8** (see Screens → Result screen below). This is further along than the prototype.
- **`DesignRail.tsx` already has the 4-tab 무드/컬러/후보정/투명도 rail + single expand panel**,
  functionally equivalent to v8's styling dock. Port v8's *visual* treatment (dark immersive
  panel, icon sizing) into this component rather than writing a new one.
- **`MobileEditorShell.tsx`'s header** currently is hamburger (menu) + 완료, with dark
  mode/전체표시/빈 항목/잉크/포스터 교체/재크롭/임시저장/초기화 all living in one dropdown submenu
  under the hamburger. v8's header (편집 메뉴 icon + 다음 pill) is close to this but **simpler** —
  reconcile by keeping the existing submenu's functionality and applying v8's icon-button styling
  (ghost, no filled white chip) and the ambient-aware ink color.
  - v8's "빈 항목 미리보기" fix (must not silently force-enable while any drawer is open, only while
    actually editing a field) should be ported to the `ghostMode` state in `MobileEditorShell.tsx`
    — currently `ghostMode` is a plain unconditional toggle with no editing-time override, so check
    whether that override is even still wanted there, or if it was a prototype-only artifact of the
    prototype's different drawer structure. **Flag this as an open product question**, not a
    mechanical port.
- **The floating toolbar module (undo/redo/list/maximize/placement/hide) has no existing
  counterpart.** This is genuinely new. It most likely replaces/absorbs pieces of the current
  header (undo/redo aren't in the header today — check `usePhototicket`/history state exists at
  all before wiring this) and the field-editor's on-ticket mini-bar. Needs a product decision on
  scope before implementation — see Open Questions.

## Screens / Views

### 1. Editor screen — header
- 54px row, `border-b border-line`, background follows the screen (see ambient note below — no
  separate flat header background once a poster is loaded).
- Left: brand mark (existing `Wordmark`/clap-tix mark components — reuse as-is).
- Right, in order (outer edge = highest priority action): **편집 메뉴 icon button** (ghost/no fill,
  no border, icon-only, 38px hit area) → **다음 pill button** (outermost, `bg: linear-gradient(135deg,
  var(--accent-hover), var(--accent))`, disabled state `border: var(--border); background:
  var(--surface); color: var(--fg-faint)`; only rendered once a poster is loaded and title is
  filled). **다음 must stay visible/interactive regardless of whether a styling tab or the fields
  drawer is open** — an earlier pass incorrectly hid it whenever a styling tab was active; confirmed
  as a bug, not intended UX, and fixed in the current v8. Its on-screen *position* (top-right corner)
  had also been questioned by a reviewer in an earlier round but wasn't raised again after this fix,
  so treat the position as settled unless told otherwise.
- Icon/text color on this header must switch to a fixed light ink (`#F3EFEA` in the prototype —
  pick/introduce a token, see Design Tokens) whenever a poster is loaded, regardless of light/dark
  theme, because the backdrop behind it is the ambient gradient (below), not `var(--surface)`.

### 2. Editor screen — ambient backdrop
Once a poster is uploaded, replace the flat `var(--bg)` behind status bar + header + canvas with a
single continuous backdrop so the header doesn't look like a disconnected flat bar:
```
background:
  radial-gradient(120% 50% at 50% 17%, rgba(224,163,58,.16), transparent 46%),
  linear-gradient(180deg, #1c2129 0%, #14171b 42%, #0d0f11 100%);
```
This is intentionally **not** theme-conditional (same dark gradient in light/dark app theme) — it's
an "editing surface" treatment, echoing the ticket's own warm tones. The amber stop
(`rgba(224,163,58,…)`) is deliberately close to `var(--neutral-2)` (`#7A6748` / `#C2A67A`, the
existing "2nd cinematic neutral" token) — reuse that token's hue rather than introducing a new amber.
Opacity fades in/out with poster presence (`.35s ease`), never fully replaces content, and must stay
subtle enough that a bright/saturated poster doesn't fight with it (this was an explicit reviewer
ask — keep the gradient stops low-alpha, don't brighten them later without re-checking against a
saturated poster).

### 3. Editor screen — styling controls (replaces/restyles `DesignRail`)
**No card/panel chrome at all** — this went through two passes: v8's first cut wrapped the tab row +
detail in a dark rounded panel (`rounded-[22px]`, gradient fill, blur, shadow). A reviewer asked for
that boxing removed entirely — the icons and their detail content should read as loose controls
sitting directly under the poster preview, on the ambient backdrop itself, not as a separate
"module". Current v8: the tab row and detail panel are unstyled positioning wrappers only (no
background/blur/border/shadow/radius) — legibility comes entirely from the ambient gradient behind
them being dark enough already (see #2) plus each control's own contrast (white icon fills, light
text). **Don't recreate the boxed-panel look from earlier screenshots/history — the current,
correct version is unboxed.**
- Tab row: 4 items, 무드 · 컬러·톤 · 텍스처 · 투명도. Icon circles are **40×40px**, 17×17px glyph,
  `background: rgba(255,255,255,.14)` idle / `#fff` selected with `color: var(--accent)`; label
  10px under each. Row gap 22px, `justify-center`.
- Detail content appears directly under the tab row (no card wrapper) — mood swatches / color dots /
  texture swatches / sliders, all colored for sitting on the dark ambient backdrop
  (`rgba(255,255,255,.55–.62)` muted text, `rgba(255,255,255,.18)` idle swatch rings).
- Mood/texture swatch chips: **46×46px** (first pass used 52px and the selection ring visibly
  clipped at the top of the scroll row — sized down + added top padding to fix).
- **투명도 tab holds two sliders**, in this order: 포스터 밝기 (poster brightness) then 투명도
  (component/overlay opacity) — this now mirrors `DesignRail.tsx`'s existing opacity tab almost
  exactly (`BrightnessSlider label="포스터"` then `label="컴포넌트"`); 포스터 밝기 was originally
  (incorrectly) grouped under 컬러·톤 and was moved per reviewer feedback.

### 4. Editor screen — floating toolbar module (new)
A small pill-shaped cluster: **undo, redo, divider, field-list, maximize, divider, gear
(placement), hide**. Two independent axes:
- **Orientation**: horizontal or vertical row of the same buttons.
- **Placement**: `fixed` (default: vertical, docked to the left edge, roughly upper-third of the
  screen — raised well above center per reviewer feedback across two rounds) or `movable` (user can
  drag it anywhere via a grip; position persists while the session is open).
- Only the **placement submenu** can change orientation/placement, opened from the toolbar's own
  gear icon, and it must render **attached to the toolbar itself** (flyout beside/below it,
  whichever side has room), not as a bottom sheet.
- **Hide** collapses the whole module to a small circular icon at the same position the module
  itself occupied (anchor to the module's own top-left origin, not the center of its bounding box —
  first pass centered it, which visually jumped to wherever the user last tapped inside the bar).
  Tapping the mini icon restores the full module; if `movable`, the mini icon itself is draggable
  too.
- The **field list** (fields drawer) always opens as a **right-side drawer**, regardless of the
  toolbar's own placement/orientation.
- The toolbar must **stay visible and interactive while a field is being edited** and while the
  styling dock's detail panel is open — it should never auto-hide just because another panel opened
  (this was a real bug in an earlier pass: `!tool` and `!editing` conditions were incorrectly
  ANDed into its visibility).
- No hamburger/menu icon on the toolbar itself controls layout anymore — layout changes only
  through the gear → placement submenu.

### 5. On-ticket field editor toolbar
Small floating bar anchored to the active field on the ticket: **prev, divider, (image chip when
editing a logo/format stamp), visibility toggle, next, done**.
- No text label for the field name in the bar (removed — was redundant with the field's own
  highlight on the ticket).
- **Done** is a checkmark icon button (`accent gradient fill`), not a "완료" text button.
- **Next** sits at the outer edge next to Done (prev stays at the opposite outer edge) — this only
  makes sense now that the label is gone and the bar is symmetric prev…next+done.
- **Visibility toggle icon must unambiguously read as an eye**: draw the open state as an eye
  outline **with a filled pupil dot** (the outline alone, used originally, doesn't read as an eye
  at this size). Apply the same pupil treatment to the equivalent toggle in the fields drawer
  (`VisibilityCheckbox.tsx` / row eye icon) for consistency.
- While editing, the ticket should lift **and scale up slightly (~1.08×, transform-origin top
  center)** so the active field is easier to read/target above the keyboard — reviewer asked for
  more deliberate zoom, not just a vertical lift.

### 6. Fields drawer ("항목" list)
Right-side drawer, frosted/translucent so the ticket is visible behind it. First pass used
`rgba(255,255,255,.60)` (light theme) / `rgba(18,22,24,.62)` (dark theme) at `blur(22px)` and still
read as a flat gray card, not glass — **lower the alpha** (~`.36`–`.40`) and blur (`~13px`) so the
ticket's color clearly bleeds through; keep the theme-conditional tint (light glass in light theme,
dark glass in dark theme) since row text color depends on it.
- The "아직 저장 안 됨 / N분 전 저장됨" relative-time subtitle under "임시저장" should be **removed**
  — keep just the "임시저장" label; this duplicates the header's own icon-state-only save feedback
  pattern already used in `AppHeader.tsx`'s `SaveDraftButton`, which doesn't need a persistent
  subtitle either.

### 7. Result screen
Structurally, **`ResultPanel.tsx` is already right** (see note above) — this is a **visual tone**
pass, now in its second iteration:
- Background: same ambient gradient as the editor screen (always-on here — a result screen always
  has a poster).
- **No screen title** — "완성된 티켓" was removed entirely per reviewer ("이거 필요 없어"); the row is
  now just the back button, nothing else next to it.
- Back button: dark-glass treatment (`rgba(255,255,255,.08)` fill, `rgba(255,255,255,.16)` border,
  light ink) matching the rest of the dark chrome.
- **No slide-up-from-bottom transition** when entering this screen from 완료/다음 — a reviewer asked
  for that animation removed; the screen now just appears (position/transform still used to show/hide
  it, but with no `transition` on that property, so the change is instant either direction).
- "사진에 저장" stays as the accent-filled primary CTA (icon nudged 21px→19px for restraint).
- A **1px hairline divider** (`rgba(194,166,122,.28)`, echoing `--neutral-2`) now separates the
  primary CTA from the 링크 만들기/공유 row, matching `ResultPanel.tsx`'s existing
  `<div className="h-px w-full bg-neutral-2" />` divider — reuse `bg-neutral-2` directly rather than
  a bespoke rgba.
- **"링크 만들기" / "공유" row retyped to match the app's real secondary-button convention**: first
  pass used prose-case Pretendard at 13.5px, which read as a different product entirely from
  `ResultPanel.tsx`'s actual `text-mono uppercase tracking-widest text-[11px]` styling on these same
  two buttons. v8 now matches that: 11px, `JetBrains Mono`, uppercase, `letter-spacing: .08em`,
  `font-weight: 700`, icons sized down 18px→16px, button height 54px→50px. Apply the identical
  treatment to the inline link panel's "복사" button (was plain 13px Pretendard, now the same
  mono/uppercase/11px treatment) — all three should look like one family of quiet actions.
- Icons/background otherwise unchanged from the previous pass (dark-glass fill/border, `--accent`
  icon color).

## Interactions & Behavior
- Toolbar drag: pointer-based (`onPointerDown/Move/Up/Cancel`), clamps within screen bounds minus
  its own measured size, `touch-action: none` on the drag handle.
- Toolbar/mini position transitions: animate `left`/`top` (`.2s cubic-bezier(.32,.72,0,1)`) except
  while actively dragging (no transition, so it tracks the pointer 1:1).
- Styling dock tab tap: toggles that tab's detail open/closed; opening one tab closes any other.
- Ambient backdrop and dark-glass surfaces: opacity/color transitions `.3–.35s ease`, never abrupt.

## State Management
New/changed state the target implementation will need (naming illustrative, match existing
conventions):
- Toolbar: `orientation ('h'|'v')`, `placement ('fixed'|'movable')`, `x`, `y` (only meaningful when
  movable), `hidden`, `placementMenuOpen`. Reset `x`/`y` to a computed default when `placement`
  switches to `fixed` or orientation changes.
- Styling dock: `activeTab (null | 'mood' | 'color' | 'texture' | 'opacity')` — this already exists
  as `DesignRail`'s local `pop` state; just add the `'opacity'` union member if not already present
  (it is — `DesignRail.tsx` already has `Pop = 'mood' | 'color' | 'texture' | 'opacity'`, good).
- Result screen: no new state needed — `permalink`/`permaState` already model this.

## Design Tokens
Use the existing CSS custom properties in `src/styles/globals.css` / Tailwind config wherever they
match — **do not hardcode new hex values for anything that already has a token**:
- Accent: `var(--accent)` (`#B0423F` light / `#C45550` dark) — matches the prototype's accent
  exactly, no change needed.
- Surfaces/text/borders: `var(--surface)`, `var(--surface-elevated)`, `var(--fg)`, `var(--fg-muted)`,
  `var(--fg-faint)`, `var(--border)`, `var(--border-strong)`.
- Radii: `var(--r-card)` (14px) ≈ dock/detail cards, `var(--r-pill)` (999px) for pills/circular
  buttons, existing Tailwind `rounded-card` / `rounded-chip` / `rounded-field-sm` utilities.
- Shadows: `var(--shadow-card)`, `var(--shadow-pop)` — close matches for the toolbar/dock elevation;
  prefer these over the prototype's bespoke shadow strings.
- Fonts: already correct — `Pretendard Variable` (`font-sans`) for UI, `JetBrains Mono`
  (`font-mono`/`.text-mono`) for the ticket-code-style numerics (URL, dates). No Newsreader serif
  exists in the app today; the prototype uses it decoratively ("made with", "now showing") — **flag
  to the team whether to add this Google Font or drop the flourish**, don't add a new font silently.

**New tokens this design needs that don't exist yet** — add as CSS custom properties (both themes),
don't inline them:
- `--chrome-ink` (or similar): `#F3EFEA` — light ink for header/back-button/title text once the
  ambient dark backdrop is behind them, independent of the light/dark app theme.
- Dark-glass surface pair for use over the ambient backdrop: fill `rgba(255,255,255,.08)` / border
  `rgba(255,255,255,.14–.16)` — used by the toolbar, styling dock detail rows, result-screen
  secondary buttons/back-button/link panel.
- Ambient gradient (editor + result screen backdrop) — see snippet in Screens → 2 above. Consider
  deriving its amber stop from `var(--neutral-2)` via `color-mix()` instead of a fresh literal, to
  stay consistent with how `--accent-soft`/`--focus-ring` are already derived in this codebase.

## Open Questions / Not Fully Resolved
Carry these into implementation planning rather than treating v8 as final on them:
1. ~~다음 button placement~~ — the concrete bug (disappearing while a styling tab was open) is fixed;
   no further placement objection raised since. Treat as settled.
2. **"빈 항목 미리보기" (ghost) toggle scope** — should editing a field force ghosts on regardless of
   the toggle? Should opening the fields drawer? The prototype's fix (only editing forces it) is a
   guess, not a confirmed decision.
3. **Floating toolbar module scope** — confirm this is meant to fully replace today's header
   undo/redo (if that exists elsewhere) and the on-ticket mini-bar's maximize/list shortcuts, versus
   living alongside them.
4. Newsreader serif flourish (see Design Tokens) — keep or drop.

## Assets
- Fonts: Pretendard Variable (already in-app), JetBrains Mono (already in-app), Newsreader (prototype-only, see Open Questions).
- No bitmap/icon assets — all icons in the prototype are inline SVG paths; recreate with the
  project's existing icon approach (inline SVG, matching the style already used throughout
  `v2/*.tsx`).

## Files
- `design/Siyan-C-v8.dc.html` — primary reference, open directly in a browser.
- `design/FilmeTicket-v4.dc.html`, `Mark-ClapTix.dc.html`, `Wordmark-Filme.dc.html`, `support.js` — its dependencies.
- `design/exploration/` — earlier discarded concept spreads, background only.
