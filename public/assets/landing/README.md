# 랜딩 히어로 에셋

랜딩(#612 → #613 → #615)에서 쓰는 이미지 자산 폴더.

## 현재 상태

- `backdrop-tiles.webp` — 배경 타일 그리드 합성 시트(#613 배경 시트 항목). `Landing.tsx`의
  `LandingBackdropTiles`가 그리는 회전 타일 그리드(`MOOD_CHIP_BG` 색면, opacity 20%)를
  `scripts/bake-landing-backdrop.mjs`로 정적 렌더한 것 — 원본 포스터가 아니라 색면이라 D5(원본
  식별 불가)를 자산 자체로 만족한다. 400×675, 다크 테마로 구웠다 — `page.emulateMediaFeatures`로
  `prefers-color-scheme: dark`를 명시적으로 고정한다(헤드리스 Chrome의 기본값은 실행 머신의 OS
  설정을 따르므로, 고정하지 않으면 머신마다 다른 테마로 조용히 구워진다). 현재는 아직 어디서도
  소비하지 않는다(`Landing.tsx`는 여전히 라이브 div를 그린다, 라이브 렌더가 테마별 대비를 스스로
  맞추기 때문). 이 파일을 `<img>`로 실제 연결하는 건 별도 작업이다.
- 전경 무드 6장(`hero-{minimal,editorial,stub,35mm,35mm-wide,criterion}.webp`), `og.jpg`는
  실사 자산이 필요해 아직 없다(#613, 이번 세션 스코프 밖).

## 갱신 조건

**`src/utils/layouts.ts`의 `LAYOUTS`나 `src/components/LayoutPicker.tsx`의 `MOOD_CHIP_BG`가
바뀌면(무드 추가·개편) `backdrop-tiles.webp`가 stale해진다** — 수동 번들이라 잊으면 조용히
안 갈린다. `bun run dev`로 서버를 띄운 채 `bun scripts/bake-landing-backdrop.mjs`를 다시 돌려
같은 경로에 덮어쓸 것.
