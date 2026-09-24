# Third-party components

`src/ui/button.tsx`, `input.tsx`, and `dialog.tsx` are actual shadcn/ui component sources retrieved on 2026-09-22 from the official New York registry (Tailwind 3-compatible).

- https://ui.shadcn.com/r/styles/new-york/button.json
- https://ui.shadcn.com/r/styles/new-york/input.json
- https://ui.shadcn.com/r/styles/new-york/dialog.json

Changes: use the repository's existing `cn` helper; replace the Lucide close glyph with the mockup's consistent local SVG icon; translate the close label; add hooks for an opaque bottom sheet, backdrop and 44px close button. The Radix Dialog implementation remains intact. Layout and visual overrides live in `src/styles.css`.

Runtime packages (React, React DOM, Radix, clsx, tailwind-merge and class-variance-authority) retain their respective licenses in the installed packages and bundled license comments. The prototype package declares the versions used; the app's root manifest/lockfile was not changed.

The existing six ticket assets and Pretendard remain at their original repository locations. Refer to `public/assets/landing/README.md` and `public/fonts/LICENSES.md` for repository asset context. No new fonts or ticket artworks were generated.

## shadcn/ui — MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
