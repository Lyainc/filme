# 포토티켓 디자인 시스템

CGV Photoplay 프리미엄 티켓을 모방한 4-mood 카탈로그 + 자산 자동 동기화 기반 렌더링 시스템이에요. 렌더는 React DOM(JSX/CSS)로 그리고 `html-to-image`로 캡처해요. (Canvas API는 v1에서 폐기.)

---

## 🎨 4-mood 시스템

| Mood       | 비율             | 자연 픽셀 사이즈 | 특징                                       |
|------------|------------------|------------------|--------------------------------------------|
| MINIMAL    | 0.65 : 1 (세로)  | 960 × 1477       | 미니멀 시네마틱. 깔끔한 타이포 + 미세한 메타 |
| CRITERION  | 0.65 : 1 (세로)  | 960 × 1477       | 크라이테리언 임프린트. 세리프 + 좌측 사이드바 |
| 35MM       | 0.65 : 1 (세로)  | 960 × 1477       | 35mm 필름 모티프. 위/아래 sprocket + 프레임 카운터 |
| EDITORIAL  | 1.54 : 1 (가로)  | 1477 × 960       | 에디토리얼 스텁. 프랑스어 라벨 + 좌측 포스터 |

- 카탈로그: `src/utils/layouts.ts` (`LAYOUTS` array + `LayoutId` 유니온)
- 무드 컴포넌트: `src/components/moods/Mood{Minimal,Criterion,35mm,Editorial}.tsx`
- 공통 primitive: `src/components/moods/_shared.tsx` — `ChainStamp`, `FormatStamp`, `Barcode`, `Poster`, `HorizontalSprockets`, `PerforationStrip` 등
- 렌더러: `src/components/TicketRenderer.tsx` — active mood로 dispatch + ResizeObserver로 자연 픽셀 트리를 preview 영역에 맞게 스케일

---

## 🧩 자산 자동 동기화

극장 체인 로고와 상영 포맷 로고는 **폴더의 파일명**이 진실의 원천. 자세한 규약과 워크플로는 [`ASSETS.md`](./ASSETS.md) 참고. 요약하면:

```
public/assets/{chains,formats}_transparent/<value>_<label>.png
   ↓  (bun scripts/generate-asset-manifest.ts — predev/prebuild hook)
src/utils/assets.generated.ts
   ↓
THEATER_CHAINS / SCREENING_FORMATS  ←  constants.ts (NONE 항목만 prepend)
   ↓
TheaterChainPicker / FormatPicker / ChainStamp / FormatStamp
```

`ChainStamp` / `FormatStamp`은 entry lookup miss 또는 `file`이 비어있을 때 **null을 렌더**해요. raw value가 티켓에 새어 나가지 않도록 안전망.

---

## ✂️ 캡처 파이프라인 (export)

`src/utils/captureToImage.ts`:
1. `document.fonts.ready` + 모든 image `complete` 대기
2. `html-to-image` 동적 import
3. **`transform: 'none'`을 캡처 시점에 강제** — preview 스케일 wrapper가 결과를 왜곡하지 않도록
4. JPEG data URL 출력, `pixelRatio: 2`로 자연 픽셀의 2배 해상도
5. anchor element click으로 다운로드 (자동 GC, blob URL revoke 불필요)

캡처 호환성을 위해 `<img>` 태그는 **`crossOrigin="anonymous"`**를 일관 적용해요. 같은 origin이라도 명시해두면 caching/CORS 미스로 인한 taint canvas 이슈를 회피할 수 있어요.

---

## 🚫 React inline style 컨벤션

**`font` shorthand 금지.** 같은 객체에 `lineHeight`를 따로 지정할 때 React가 rerender마다 "Removing font lineHeight" 경고를 띄우고, 캡처 시점에 lineHeight가 reset될 수 있어요.

```tsx
// ❌ NO
style={{ font: `800 22px ${FONT_KR}`, lineHeight: 1.3 }}

// ✅ YES
style={{
  fontWeight: 800,
  fontSize: 22,
  fontFamily: FONT_KR,
  lineHeight: 1.3,
}}
```

`fontStyle` (`italic`)도 같이 분해. 만약 inline style에 `lineHeight` 자체를 안 쓰는 경우는 무해하지만, 일관성 위해 모든 신규 코드는 분해 형태로.

---

## 🎯 디자인 철학

1. **포스터 중심** — 이미지를 가리는 대신 강조. 박스/오버레이는 최소화.
2. **시인성 확보** — 텍스트 그림자/아웃라인 + posterOpacity slider로 사용자가 직접 조정.
3. **레이어 구조** — 포스터 → 텍스처 오버레이(스코딕스/메탈/홀로그램 등) → 메타 → 로고 stamp.
4. **자연 픽셀 + 스케일 분리** — 무드 컴포넌트는 layout의 natural pixel(예 960×1477)을 그대로 렌더, preview는 ResizeObserver로 css transform scale만 적용. 캡처는 항상 natural pixel.
5. **빈 상태는 비운다** — 포스터 업로드 전에는 프리뷰 영역(`PreviewFilmCell`)을 아예 렌더하지 않아요. 빈 티켓 틀·천공 장식이 먼저 보이면 "아직 미완성"이라는 인상을 주거든요. `croppedImageUrl`이 생긴 뒤에만 프리뷰가 등장. `PreviewFilmCell`의 상하 천공(동그란 구멍) 장식은 제거됐어요 — 실제 티켓에 이미 충분한 그래픽이 있어 컨테이너 장식은 중복이라.

---

## 🖌️ 폰트 토큰 (`_shared.tsx`)

티켓(mood) 렌더링에서 쓰는 폰트 토큰이에요. mood 컴포넌트와 stamp에서 import.

```ts
FONT_MONO = "JetBrains Mono", "SF Mono", ui-monospace, monospace
FONT_SANS = "Pretendard Variable", "Pretendard", "Noto Sans KR", sans-serif
FONT_KR   = "Pretendard Variable", "Noto Sans KR", "Inter", sans-serif
```

> 장식용 serif 토큰(`FONT_SERIF`)은 직관성·시인성 정리 과정에서 제거됐어요. 모든 mood는 Pretendard(sans) + JetBrains Mono 두 계열만 사용해요. 실제 폰트 로드는 `_app.tsx`의 `next/font`(Pretendard local + JetBrains Mono google)에서 담당.

---

## 🔤 앱 UI 타이포그래피

티켓이 아닌 **앱 인터페이스**(Phase 캔버스, 위저드, 헤더 등)의 폰트 정책이에요.

- **폰트**: Pretendard (`--font-sans`). Tailwind `font-sans` 토큰으로 일관 적용.
- **본문 기준 weight: 450** — `globals.css`의 `body`에 지정. Pretendard 기본 400은 `-webkit-font-smoothing: antialiased` 환경에서 얇게 읽혀 시인성이 낮아, 본문 기준선을 450으로 올렸어요. 제목·라벨은 `font-medium`(500) 이상을 명시.
- **장식 weight 지양**: `font-light`/`font-thin`(300 이하)은 UI 본문에서 사용하지 않음. (큰 `+` 같은 순수 기호 글리프도 `font-normal` 이상)

---

## 🎨 후가공 텍스처

`TextureOverlay`(`_shared.tsx`)가 `components.texture`에 따라 포스터 위에 추가 레이어를 얹어요.

| Texture     | 효과                                       | mix-blend-mode                |
|-------------|--------------------------------------------|-------------------------------|
| `original`  | 무가공 (원본 그대로)                       | —                             |
| `none`      | 일반 인화지 (유광 grain)                   | screen                        |
| `hologram`  | 무지개빛 반사                              | color-dodge                   |
| `metal`     | 차가운 금속 질감                           | hard-light                    |
| `artpaper`  | 캔버스/수채화 결                           | multiply                      |
| `vintage`   | 빛바랜 sepia (CSS filter)                  | — (필터만)                    |
| `newspaper` | 거친 망점/흑백 (CSS filter)                | — (필터만)                    |
| `scodix`    | 부분 코팅/엠보싱 광택                      | overlay                       |

`posterOpacity` slider(`components.posterOpacity`, 0-1)는 텍스처 위 검은 막을 통해 포스터 밝기를 조정. 캡처에도 그대로 반영.

---

## 📝 테스트 체크리스트

새 mood / 새 자산을 적용한 후 다양한 포스터로 검증:

- [ ] 밝은 포스터 (흰색 배경) — 검은 ink 자동 선택 잘 되는지 (`isInkLight` helper)
- [ ] 어두운 포스터 (검은 배경) — 흰 ink + 충분한 contrast
- [ ] 다채로운 포스터 — 추출된 추천 색상이 가독성 해치지 않는지
- [ ] 가로/세로 포스터 모두 — 0.65:1 크롭으로 손실 없는지
- [ ] EDITORIAL 가로 (1477×960) — 좌측 포스터 + 우측 메타 균형
- [ ] 캡처 결과 픽셀 사이즈가 layout natural size × 2인지 (`pixelRatio: 2`)

모든 경우에 텍스트 가독 + 로고 stamp + 텍스처 적용 + 다운로드 JPEG 생성까지 정상 동작해야 해요.

---

**마지막 업데이트**: 2026-05-30
