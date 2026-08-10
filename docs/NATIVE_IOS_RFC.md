# RFC: 네이티브 iOS 전환 — 자산 실측과 구현 경로

상태: **초안 / 부분 결정됨.** 작성 2026-08-08, 개정 2026-08-10(오너 결정 4건 반영 + 조사 3건 추가),
개정 2026-08-11(앱스토어/사업 측 사전작업 §10 추가 — 오너 결정 2건 포함).
코드 변경을 유발하지 않는 조사 문서다.

이 문서는 "네이티브로 갈까"를 설득하지 않는다. 갈 경우 **무엇이 이식되고 무엇이 버려지는지**를
실측으로 고정해, 경로 선택이 감이 아니라 숫자 위에서 이뤄지게 하는 게 목적이다. 아직 정해지지
않은 건 정해지지 않았다고 적었다.

### 오너 결정 (2026-08-10)

초판이 §7에 남겼던 질문 중 넷이 닫혔다. 이 결정들이 §4·§5를 크게 바꿨다.

| 결정 | 값 | 영향 |
|---|---|---|
| WebView | **안 쓴다.** 넘어가면 네이티브 구현 | 초판 경로 A·B 폐기 → §4 |
| 웹 운영 | **계속 운영.** 웹은 거의 같은 기능을 제공하되 앱 설치로 유도 | 로직 이중 관리가 영구 비용 → §5가 뒤집힘 |
| OCR | 앱 전환 시 provider 교체 검토(OpenRouter 등 전용 모델) | → §7.2 |
| 데스크톱 UX | 모바일 규격으로 띄우거나 차단 | **이미 구현돼 있다** — `PhoneFrame` 400px |
| **TMDB** (2026-08-10 추가) | **폐기.** 수익화를 고려하면 약관과 양립하지 않는다. **웹에서도 지금 걷어낸다** | 철수 범위 → §9 |
| **Apple 개발자 계정 종류** (2026-08-11 추가) | **개인(Individual).** 조직 계정과의 차이는 스토어에 뜨는 "제공자" 이름(개인명 vs 법인명)뿐 — 인앱결제 등 수익화 가능 여부와는 무관 | → §10.1 |
| **앱 표시명** (2026-08-11 추가) | **"CGV" 미포함.** 상표 리스크는 스토어 노출 문구 표면이지 코드 표면이 아니다 | → §10.2 |

---

## 1. 지금 상태 (측정 2026-08-08, main 5f91a6c)

`src/` 전체 **19,005줄**(테스트 제외). 이식 관점으로 자르면 이렇게 나뉜다.

| 축 | 줄 | 파일 | 네이티브에서 |
|---|---|---|---|
| 서버 API 라우트 | 601 | `src/pages/api/**` | **그대로 재사용** — HTTP만 부르면 된다 |
| 공유 퍼마링크 SSR | 204 | `src/pages/t/[id].tsx` | **그대로 재사용** — 웹 링크가 공유 채널의 종착지 |
| utils·constants·types | 2,262 | `src/utils/*`, `src/constants/*`, `src/types` | 대부분 순수 TS. 포팅 대상이지 재설계 대상은 아니다 |
| 재질/코팅 레시피 | 612 | `src/utils/textureRecipes.ts` | 레시피는 데이터라 이식됨. SVG 생성부는 웹 결합 (§3) |
| 훅(상태 로직 + 웹 영속) | 1,448 | `src/hooks/*` | 상태 로직은 이식, 영속(localStorage/IDB)은 교체 |
| 무드 렌더 | 4,258 | `src/components/moods/*` | **재작성 대상** |
| 캡처·저장 파이프라인 | 1,031 | `src/utils/captureToImage.ts` | **대부분 소멸**(§3.3) |
| 에디터 셸·UI | 7,174 | `src/components/v2/*`, `ui/*`, `wizard/*` | **재작성 대상** — 가장 큰 덩어리 |
| 루트 컴포넌트 5종 | 1,067 | `TicketRenderer`·`ImageCropModal`·`TmdbPosterModal`·`LayoutPicker`·`DebugConsole` | 재작성 대상 |
| 페이지·문서 | 445 | `src/pages/*.tsx` | 재작성 대상 |
| 기타(errorToast) | 107 | | |

테스트는 별도로 **108파일 15,749줄.** 이 자산은 렌더 트리에 강하게 묶여 있어(`renderToStaticMarkup`
+ testing-library) 재작성 축과 같이 움직인다 — 네이티브 UI를 새로 쓰면 이 테스트는 따라오지 않는다.

### 웹 결합 지점 인벤토리

| API | 파일 수 | 히트 | 몰려 있는 곳 |
|---|---|---|---|
| `document.*` | 20 | 76 | `captureToImage`(28), `usePhototicket`(18) |
| `window.*` | 13 | 43 | 셸·툴바 좌표, 자동저장 |
| `localStorage` | 8 | 23 | 자동저장(`usePhototicket`), 툴바 위치, 드로어 핸들, 테마 |
| `canvas getContext` | 6 | 14 | 캡처 합성, 색 추출, OCR 전처리, 크롭 |
| `ResizeObserver` | 6 | 18 | 프리뷰 스케일링, 프레임 측정 |
| `navigator.*` | 4 | 12 | Web Share (`canShare`/`share`) |
| `indexedDB` | 1 | 1 | `imageDb.ts` — 포스터/로고 영속 |
| `html-to-image` | 4 | 17 | 저장 경로 |

`src/utils` 27개 파일 중 **브라우저 API를 하나도 안 쓰는 파일이 19개**다(`layouts`·`constants`·
`dateFormat`·`colorCluster`·`kobisLookup`·`ratelimit`·`ticketCleanup`·`posterFeather`·`ocrRoute` 등).
도메인 계층은 이미 웹에서 떨어져 있다 — 이건 이번 조사에서 가장 좋은 소식이다.

---

## 2. 이미 렌더러가 둘이다 — 그리고 앱에선 하나로 줄어든다

전환 논의에서 제일 먼저 알아야 할 사실. **웹에서 프리뷰와 저장은 같은 코드로 안 그린다.**

- **프리뷰** = React DOM + CSS (`linear-gradient` 29곳, `mix-blend-mode` 6곳, `-webkit-line-clamp` 6곳,
  SVG 필터 `feTurbulence`/`feDiffuseLighting`/`feComponentTransfer` 등 14개 primitive)
- **저장** = canvas 픽셀 연산 (`applyCssColorFilterToPixel`, `bakeColorFilter`, `compositeOverlay`).
  iOS Safari가 `ctx.filter`를 무시해서(#490/#495) 색보정을 픽셀 단위로 직접 굽는 경로를 따로 만들었다.

둘이 어긋나는 걸 CI에서 잡으려고 픽셀 diff 회귀 테스트가 있다(#512). 그 테스트의 타임아웃
불안정성(#660)은 **아직 main에 안 들어갔다** — 수정 커밋(`2952900`, @2x variant에 CI 기준선 위
명시 timeout 부여)이 `Lyainc/test-export-capturedualrendererpixeldiff-2x-bun` 브랜치에 있으나 PR이
열리지 않았고 이슈도 OPEN이다. 그물이 아직 헐겁다는 뜻이고, "그물이 몇 겹이어야 하는가"는 그와
별개로 그대로 남는 질문이다.

**초판은 여기서 "네이티브가 3번째 렌더러가 된다"고 적었다. 그건 틀렸다.** SwiftUI에는
`ImageRenderer`가 있어서(iOS 16+) **화면에 띄우는 그 뷰 트리를 그대로 이미지로 내보낸다.** `scale`을
2.0으로 주면 지금 `pixelRatio: 2`와 같은 자리에 선다. 즉 앱 안에서는 프리뷰와 저장이 **구조적으로
같은 코드**라 드리프트가 생길 여지 자체가 없다.

정확한 그림은 3-way가 아니라 이렇다.

```
웹:  프리뷰(CSS/SVG) ↔ 저장(canvas)     ← 2-way, 지금의 #512 픽셀 diff가 지킨다
앱:  프리뷰 == 저장 (ImageRenderer)      ← 0-way, 구조적으로 일치
경계: 웹 결과 ↔ 앱 결과                  ← 1개의 새 경계
```

새로 생기는 경계는 **하나**고, 그 하나조차 "픽셀로 같아야 하는가"가 정해지면 요구 강도가 갈린다
(§7). 웹 내부 2-way가 앱에선 없어지므로, 전체 드리프트 표면은 오히려 **줄어들 수도 있다.**

---

## 3. iOS에서 재질·필터를 어떻게 구현하나

초판은 이 절을 "재작성이 어려운 두 곳"이라 적고 feTurbulence를 사실상 불가로 취급했다.
**조사 결과 가능하다.** 아래가 구현 경로다.

### 3.1 SVG 필터 → Metal / Core Image 매핑

SwiftUI는 iOS 17부터 뷰에 Metal 셰이더를 직접 붙이는 세 modifier를 준다.

- `.colorEffect(_:)` — 픽셀 좌표 + 그 픽셀 색을 받아 새 색을 반환. 색보정 체인이 여기 붙는다
- `.layerEffect(_:)` — 렌더된 레이어 텍스처 전체를 읽을 수 있다. blur·컨볼루션·왜곡처럼 이웃
  픽셀이 필요한 필터가 여기 붙는다
- `.distortionEffect(_:)` — 좌표만 변형

지금 쓰는 primitive의 대응은 이렇다.

| 지금 (SVG) | 쓰이는 곳 | iOS 대응 | 난이도 |
|---|---|---|---|
| `feTurbulence` (fractalNoise) ×10 | 물리재질 3종 종이결 | **Metal 셰이더로 Perlin/fBm 직접 구현** | 중 — 알고리즘은 명세돼 있다 |
| `feDiffuseLighting` ×5 | 형압(emboss) 입체감 | Metal (노멀맵 → 라이팅) | 중 |
| `feComponentTransfer`/`feFunc*` ×5 | 톤 커브 | `CIToneCurve`·`CIColorPolynomial` 또는 `.colorEffect` | 하 |
| `feGaussianBlur` ×4 | 레터박스 blur 배경 | `CIGaussianBlur` / `.blur(radius:)` | 하 |
| `feColorMatrix` ×1 | 채도 제거 | `CIColorMatrix` | 하 |
| `feComposite` ×2 | 합성 | SwiftUI `blendMode` | 하 |
| `linear-gradient` ×29 | 스크림·코팅 광택 | `LinearGradient` | 하 |
| `mix-blend-mode` ×6 | 재질/코팅 합성 | `.blendMode()` | 하 |
| `-webkit-line-clamp` ×6 | 제목·배우 2줄 클램프 | `.lineLimit(2)` + `.truncationMode` | 하 — 네이티브가 더 낫다 |

`feTurbulence`가 가능한 근거: 이건 Perlin noise 기반이고 **W3C Filter Effects 명세가 알고리즘을
글로 정의한다** — `stitchTiles`의 baseFrequency 보정 규칙(`lowFreq=floor(width*f)/width`,
`hiFreq=ceil(width*f)/width` 중 상대 변화가 작은 쪽 선택)과 타일 경계에서 반대편 격자 벡터를
복사하는 규칙까지 포함해서다. Metal Shading Language로 옮길 수 있는 수준으로 적혀 있고, GPU에서
도는 만큼 지금 SVG 필터 경로보다 빠를 여지가 크다.

### 3.2 남는 진짜 문제는 "값"이지 "기능"이 아니다

기능은 되지만, 지금 값은 계산이 아니라 **실기기 육안 튜닝**으로 잡혔다(`textureRecipes.ts:146`,
#561에서 baseFrequency를 0.55→0.4로 내렸다가 0.7로 되올린 기록). W3C 명세를 그대로 옮겨도
브라우저 구현마다 노이즈가 미묘하게 다르고(명세의 참조 구현이 랜덤 벡터를 정규화하는 방식에
알려진 편향이 있다), Metal 구현은 또 그 나름의 결이 난다.

**그래서 이식 후 재튜닝을 예산에 넣어야 한다.** "수식은 같은데 안 똑같아 보이는" 상태가 기본값이고,
그걸 맞추는 건 코드가 아니라 눈으로 하는 작업이다. 참고할 자산이 있다 — `docs/PRINT_CALIBRATION.md`가
같은 종류의 육안 대조를 이미 도구화해뒀다.

### 3.3 색보정 알고리즘과 캡처 배관

`applyCssColorFilterToPixel`은 CSS/SVG Filter Effects 스펙을 0..255 정수 픽셀에 구현한 순수
함수다. 플랫폼 의존이 없어 Swift로 거의 1:1 포팅되고, `.colorEffect` 셰이더로 옮기면 GPU에서 돈다.

반대로 캡처 파이프라인 1,031줄의 **배관은 대부분 존재 이유가 사라진다.** 그 구조는 브라우저 제약을
우회하려고 만들어진 것이기 때문이다 — iOS Safari가 `ctx.filter`를 무시해서 픽셀을 직접 굽고(#490/#495),
`foreignObject` 경로가 큰 raster를 조용히 떨어뜨려서 포스터를 따로 합성하고(#439), `document.fonts.ready`를
기다리고, `transform: none`을 강제하고, 색보정 베이킹이 전 픽셀을 도는 비용을 최적화한다(#538).
파일 안에서 iOS/Safari 우회를 명시적으로 언급하는 줄만 52줄이고, 그 우회가 canvas 직접 합성이라는
구조 자체의 이유다. `ImageRenderer`에는 이 문제군이 없다.

---

## 4. 구현 경로 (WebView 폐기 후)

오너 결정으로 초판의 A(WKWebView 래핑)·B(하이브리드)는 폐기됐다. 남는 건 둘이고, 사실상 D다.

### D. SwiftUI 전면 네이티브 ← 기본 경로

- UI 전량 재작성 + 도메인 TS(2,262 + 612)를 Swift 포팅 → **같은 로직이 두 언어에 존재**한다.
  웹을 계속 운영하기로 했으므로 이 이중 관리는 영구 비용이고, §5가 그걸 줄이는 방법을 다룬다
- 재질을 Metal로 다시 쓰면 §3의 제약이 오히려 상한을 올린다(GPU 실행, 연속 intensity)
- `ImageRenderer`로 프리뷰=저장이 되어 앱 내부 드리프트가 0 (§2)
- 재작성 ≈ 14,000줄 (캡처 배관 1,031은 대부분 소멸하므로 초판 16,000에서 내렸다)

### C. React Native / Expo — 채택하지 않는 근거를 남겨둔다

- 장점은 하나다: TS를 계속 써서 도메인 코드 이중 관리를 피한다
- 그런데 이 앱의 값어치가 몰린 곳이 정확히 RN이 약한 곳이다. `react-native-svg`의 필터 지원은
  부분적이고 `feTurbulence`는 플랫폼별로 갈린다. `ImageRenderer` 같은 "뷰 트리를 그대로 고해상도
  이미지로" 경로도 RN에선 서드파티(view-shot 계열)에 의존하고, 그게 지금 웹에서 겪는
  `html-to-image` 문제군을 그대로 재현할 소지가 크다
- 즉 RN을 고르면 §2의 이득(0-way 드리프트)과 §3의 이득(Metal 재질)을 **둘 다 잃는다**

---

## 5. 렌더링 구조를 앱에서 슬림화할 수 있나

**할 수 있다. 다만 줄 수를 줄이는 방식이 아니다.** 무드 4,258줄을 뜯어보면 편집 UI
(`FieldTap`/`FieldGhost`/ghost 분기/`onField`)가 걸린 줄은 무드 6종 268줄 + `_shared` 127줄로
**전체의 9.3%**다. 이걸 걷어낸다고 렌더가 확 작아지지 않는다.

실제 슬림화는 세 군데서 나온다.

1. **캡처 파이프라인이 통째로 사라진다** — 1,031줄 → `ImageRenderer` 호출부 수십 줄. §3.3
2. **웹이 손으로 하던 것을 프레임워크가 한다** — `fitFontSizeToWidth`(canvas `measureText`로 폭을
   재서 폰트 크기를 역산) + `useFontsReady`(폰트 로드 전 잘못된 메트릭 캐시 방지)는 SwiftUI에서
   `.minimumScaleFactor` + `.lineLimit`으로 대체된다. `ResizeObserver` 기반 프리뷰 스케일링(18곳)도
   레이아웃 시스템이 흡수한다
3. **조건 분기의 원인이 줄어든다** — 무드 JSX가 장황한 이유는 값/ghost/탭 3상태를 필드마다 삼항으로
   펼치기 때문이다(MoodMinimal은 365줄 중 72줄). SwiftUI에서 이건 필드 하나를 그리는 뷰 하나로
   접히는 종류의 중복이다

**슬림화의 전제 조건이 하나 있다.** 무드를 지금처럼 "무드마다 레이아웃을 손으로 배치한 코드"로
그대로 옮기면 6종을 두 번(웹·앱) 유지하게 된다. §6이 그 대안이다.

---

## 6. 지금 해도 되는 사전작업 / 하면 안 되는 것

**초판의 이 절은 뒤집혔다.** 초판은 "경로 A/B로 결정되면 순손실"이라는 이유로 스펙 단일화를
하지 말 것으로 분류했는데, A/B가 폐기되고 **웹 유지가 확정**되면서 근거가 사라졌다. 웹과 앱이
같은 티켓을 영구히 나란히 그린다면, 레이아웃이 두 벌로 갈리는 건 미루는 만큼 비싸진다.

### 이제 해야 할 것

1. **무드 레이아웃을 선언적 스펙으로 뽑기** ← 초판에서 "하지 말 것"이었다가 뒤집힌 항목.
   좌표·폰트·간격·슬롯을 데이터로 만들고 웹/앱이 각자 그 스펙을 소비하면, 무드 6종의 진실이 한
   벌로 남는다. **단 지금 당장 착수할 일은 아니다** — 어떤 형태가 맞는지는 SwiftUI 쪽에서 무드
   하나를 실제로 그려봐야 안다. **먼저 할 것은 무드 1종(Minimal 권장) 프로토타입**이고, 스펙
   형태는 그 결과에서 역산한다. 이 순서를 뒤집으면 웹에만 맞는 스펙이 나온다
2. **폰트 라이선스·포맷 확인**(조사, 코드 무변경). 티켓이 쓰는 폰트는 7종이다:
   `Pretendard Variable`·`IceJaram`(로컬 woff2) + `JetBrains Mono`·`Instrument Serif`·`Nunito`·
   `Share Tech Mono`(`next/font/google`) + 시스템 폴백. **woff2는 iOS 앱에 직접 못 번들한다**(ttf/otf
   필요) 하고, Google Fonts를 앱에 번들하는 건 웹 서빙과 라이선스 조건이 다를 수 있다
3. **TMDB 철거**(§9 · 이슈 #665). 라이선스 결론이 "폐기"로 났고, 위험이 웹/앱 공통이라 앱을
   기다릴 이유가 없다. 앱 착수와 독립적으로 지금 실행 가능한 유일한 코드 작업이다
4. **`#660` 픽셀 diff 타임아웃 수정을 main에 넣기.** 수정 커밋은 이미 있으나 브랜치에만 있고
   PR이 없다(§2). 네이티브가 새 렌더 경계를 만들기 전에 웹 2-way를 지키는 그물부터 CI에서
   실제로 도는 상태여야 한다

### 여전히 하지 말 것

- **영속 계층 추상화** — 앱은 어차피 자체 저장(SwiftData/파일)을 쓴다. 웹 쪽 `localStorage`/IndexedDB를
  인터페이스 뒤로 미는 건 앱에 아무것도 주지 않는다
- **API 클라이언트 계층 신설** — 네이티브는 그냥 HTTP를 부르면 된다. 서버 601줄은 이미 그대로 재사용된다
- **캡처 파이프라인 인터페이스화** — 앱에선 그 파이프라인 자체가 사라진다(§3.3). 사라질 것에
  인터페이스를 씌우는 건 순손실이다

### 이미 끝난 것

- **죽은 코드 삭제** — 전수 스캔 결과 미사용 파일은 `InfoTooltip.tsx` 하나(107줄)였고 지웠다.
  "정리해서 이식량을 줄인다"는 선택지는 측정으로 닫혔다
- **데스크톱 → 모바일 규격 유도** — `PhoneFrame`(400px, `container-type:size`)이 #607부터 이미 한다.
  오너가 말한 "데스크톱 진입자에게 모바일 규격을 띄운다"는 새로 만들 게 아니라 이미 있는 동작이다

---

## 7. 경로와 무관한 리스크

### 7.1 TMDB — 조항을 확인했고, 폐기하기로 했다

**결론부터: 오너 결정으로 TMDB 기능은 철수한다(2026-08-10). 철수 범위는 §9.**
아래는 그 결정의 근거이고, 결정이 뒤집힐 경우를 대비해 남긴다.

[TMDB API Terms of Use](https://www.themoviedb.org/api-terms-of-use) 원문 기준이다. 초판은 "앱스토어
심사가 더 엄격하다"고만 적었는데, 실제 위험은 심사가 아니라 **약관 자체**에 있다.

1. **AI 애플리케이션 금지 조항.** 금지 목록에 이게 있다 — *"Use the TMDB APIs or TMDB Content in
   connection with … a machine learning (ML) or artificial intelligence (AI) based Application."*
   FILME는 OCR에 Gemini vision을 쓴다. **지금은 안전 쪽에 가깝다** — #537의 TMDB 검색은 OCR과
   분리된 독립 CTA로 구현됐기 때문이다. 그런데 `docs/specs/landing-mood-first-ocr-entry.yaml`이
   그리는 "OCR 제목 → 자동 TMDB 검색" 체인을 구현하면 AI 출력이 TMDB API 호출을 직접 먹이는
   구조가 되어 *in connection with*에 정면으로 들어간다. 이 조항이 특히 무거운 건, 그 체인이
   **우리가 원래 만들려던 것**이기 때문이다 — 즉 TMDB를 안고 가면 스펙이 그린 동선을 영영 못 만든다.
   §9의 철수로 이 위험은 소멸한다.
2. **파생물 금지.** *"Make derivatives of the TMDB APIs or TMDB Content."* 포스터를 티켓에 합성하는
   게 여기 걸리는지는 해석이 갈린다. 유리한 사정: TMDB는 포스터 이미지의 저작권자가 아니라
   호스팅 주체이고, 이 조항의 무게중심은 메타데이터 쪽으로 읽힌다. 불리한 사정: 문구가 Content를
   좁히지 않는다. **원저작권자(배급사) 축은 TMDB 약관과 별개로 남는다** — 그건 지금 웹에서도 이미
   지고 있는 위험이고 앱이라고 새로 생기지 않는다
3. **상업적 사용은 별도 서면 동의.** *"Any commercial use without such a written agreement
   constitutes a material breach."* 무료 앱이면 당장은 비상업이지만, 유료화·광고·구독을 붙이는
   순간 TMDB와 서면 합의가 선행돼야 한다. **수익화 계획이 있다면 이게 앱 착수보다 먼저다**

안전한 것도 확인해두자. **캐시 6개월 제한은 위반이 아니다** — `/api/tmdb/image`는
`s-maxage=86400`(1일)이고 search/images는 1시간이다. 귀속 문구도 이미 요구 문장 그대로 넣었다.

**폐기가 합리적인 이유.** 위 셋 중 어느 하나도 코드로 못 푼다. AI 조항은 OCR을 빼지 않는 한
해석 위험이 남고, 상업적 사용은 서면 합의라는 외부 절차에 걸리고, 파생물 조항은 우리가
포스터를 티켓에 합성한다는 기능의 본질 자체를 겨눈다. 셋 다 "지금은 회색, 수익화하면 적색"이라
**수익화 계획이 있는 이상 미루는 게 이득이 아니다.** 대체 경로도 이미 있다 — 사용자 직접 업로드가
원래 주 경로이고, 포스터 없이 시작하는 길도 #631에서 열렸다. §9가 철수 범위를 정리한다.

### 7.2 rate limit — OpenRouter는 이 문제를 풀지 않는다

오너 안은 "앱으로 가면 OpenRouter 같은 걸 써서 전용 OCR 모델로 바꾼다"였다. 그런데 지금 rate
limit이 존재하는 이유를 보면 provider 교체로는 안 풀린다.

지금 OCR은 **4겹**이다(`ratelimit.ts`) — per-IP(10/시간·20/일) + **shared(키 전체 12/분·450/일)**.
shared 윈도우가 IP가 아니라 고정 키 `'global'`로 세는 건, Google 무료 티어 한도가 **API 키 단위**
(15 RPM·500 RPD)라 IP별 카운터만으론 키 소진을 원리적으로 못 막기 때문이다(#299).

OpenRouter로 옮기면 이 구조에서 바뀌는 것과 안 바뀌는 것이 갈린다.

- **바뀜**: 무료 티어의 낮은 키 단위 한도가 사라진다. shared 윈도우를 벤더 한도가 아니라 **내 예산**
  기준으로 다시 잡을 수 있고, provider fallback도 얻는다(Gateway를 버리며 포기했던 것, #125·#299)
- **안 바뀜**: **비용 방어는 그대로 필요하다.** 오히려 한도가 "무료 티어에서 막힘"에서 "잔액이
  녹음"으로 바뀌어, 남용 방어의 실패 대가가 커진다. 플랫폼 수수료(pay-as-you-go 5.5%)도 붙는다
- **안 바뀜**: 캐리어 NAT 뒤 per-IP 오검출도 그대로다. 이건 provider가 아니라 **식별자** 문제라,
  앱이면 기기 단위 식별자나 App Attest로 옮겨야 풀린다

**진짜 지렛대는 다른 데 있다: iOS Vision 온디바이스 OCR과의 하이브리드.**

### 7.2.1 Vision은 앱에서 바로 부를 수 있나 — 그렇다

Vision은 **iOS에 내장된 시스템 프레임워크**다. `import Vision` 한 줄이면 되고 SDK 설치·계정 발급·
API 키·서버가 전부 없다. 호출 비용 0, 호출 횟수 제한 0, 네트워크 0 — 기기 안에서 돈다.
그래서 우리가 지금 rate limit으로 방어하는 대상(벤더 키 소진, 대역폭, 비용)이 이 축에선 **애초에
존재하지 않는다.**

| 항목 | 내용 |
|---|---|
| 진입 API | `VNRecognizeTextRequest`(iOS 13+). iOS 18부터 Swift-native 재설계판 `RecognizeTextRequest`가 async/await로 제공 |
| 한국어 | `VNRecognizeTextRequestRevision3`(iOS 16+)의 지원 언어에 한국어 포함. **실기기에서 `supportedRecognitionLanguages(for:revision:)`로 직접 확인할 것** — 리비전마다 목록이 다르고(revision2엔 한국어가 없다) 2차 자료가 엇갈린다 |
| 반환 | `VNRecognizedTextObservation` 배열. 관측마다 **인식 후보 문자열 + `confidence` + `boundingBox`**(정규화 좌표) |
| 정확도 조절 | `recognitionLevel`이 `.accurate` / `.fast` 둘. `.accurate`가 느리지만 정확 — 티켓 한 장짜리 작업이라 `.accurate`가 맞다 |
| 구조화 | **`RecognizeDocumentsRequest`(iOS 18+)** 가 한 단계 위다. 줄을 문단·리스트·**표 행**으로 묶어 `DocumentObservation`으로 준다. 영수증·양식을 겨냥한 API라 티켓 레이아웃과 성격이 맞는다 |
| 알려진 함정 | `.accurate`에서 bounding box가 기대와 다르게 나온다는 보고가 있다. bbox를 규칙에 쓸 거면 실측으로 먼저 확인할 것 |

부르는 모양은 이 정도로 짧다.

```swift
import Vision

let request = VNRecognizeTextRequest { req, _ in
    let lines = (req.results as? [VNRecognizedTextObservation] ?? []).compactMap {
        $0.topCandidates(1).first.map { c in (c.string, c.confidence, $0.boundingBox) }
    }
    // lines → 텍스트 + 신뢰도 + 위치. 이걸 직렬화해 서버 LLM으로 보낸다
}
request.recognitionLevel = .accurate
request.recognitionLanguages = ["ko-KR", "en-US"]
try VNImageRequestHandler(cgImage: image).perform([request])
```

### 7.2.2 그대로는 못 쓴다 — 우리가 필요한 건 구조화다

Vision이 주는 건 "무슨 글자가 어디 있나"까지다. 우리 OCR의 값어치는 거기가 아니라 **필드 구조화**에
있다 — theater/screen 분리(CGV 앱은 지점명 줄 바로 아래 상영관 줄이 붙어서 "전도연관"을 지점명으로
오인한다), 지점명 축약 금지, **로고 없는 CGV 티켓의 chain 판별**("판매번호" 라벨 + `연도-월일-4자리-4자리`
형식이 유일한 단서), 심야 상영 `25:00` 표기 보존. 전부 실 티켓 15장 A/B로 잡힌 규칙이다(#125·#348).

그래서 이런 분업이 성립한다.

```
지금:   이미지 → (업로드) → Gemini vision → 구조화 JSON
하이브리드: 이미지 → Vision(온디바이스, 텍스트+bbox) → (텍스트만 업로드) → LLM → 구조화 JSON
```

기대 이득이 크다. 업로드가 이미지에서 텍스트로 바뀌어 **이미지 토큰이 통째로 빠지고**(요청당 비용이
한 자릿수 배로 내려간다), 사진이 서버로 안 나가니 프라이버시가 좋아지고, 그만큼 rate limit 압력이
내려간다. Vision이 bbox를 주므로 "지점명 줄 **바로 아래** 상영관 줄" 같은 레이아웃 의존 규칙도
직렬화해서 넘길 수 있다.

**대가는 정확도 재검증이다.** 지금 프롬프트 규칙은 모델이 이미지를 직접 본다는 전제 위에 서 있어서,
입력이 텍스트로 바뀌면 STRICT 100%(#125)가 유지된다는 보장이 없다. 다행히 검증 수단이 이미 있다 —
`scripts/ab-ocr-model.ts` + 실 티켓 15장 정답지. **provider를 바꾸든 하이브리드로 가든, 이 하네스로
먼저 재보고 결정할 것.** 프롬프트를 고쳤으면 반드시 새 `AB_OUT`으로 돌려야 채점이 안 섞인다.

### 7.3 나머지

- **비용 포스처.** 공유 파이프라인은 Hobby 한도를 넘지 않으려고 의도적으로 조여둔 상태다(#194 —
  자동 발급 폐기, TTL 3일). 앱 사용자당 호출 패턴이 웹과 다르면 이 가정이 다시 계산돼야 한다
- **오프라인.** 지금은 OCR·KOBIS가 서버 왕복이다(TMDB는 §9로 빠진다). §7.2의 하이브리드로 가면 OCR의 읽기
  절반은 오프라인이 되지만 구조화는 여전히 서버다. 렌더·저장은 앱에서 완전히 로컬이 된다

---

## 8. 남은 결정

초판의 세 질문 중 둘이 닫혔다(WebView 안 씀 → §4, 웹 유지 → §6). 남은 것과 새로 생긴 것.

1. **티켓 렌더가 웹과 픽셀로 같아야 하는가.** §2대로 앱 내부는 0-way라, 이 질문은 이제 "웹 결과와
   앱 결과가 같아야 하는가" 하나로 좁혀졌다. "같아야 한다"면 웹/앱 산출물을 대조하는 하네스가
   필요하고, "앱이 더 좋아도 된다"면 Metal 재튜닝을 자유롭게 할 수 있다. §6-1의 스펙 단일화 형태도
   이 답에 따라 갈린다
2. **OCR 경로.** provider만 교체(OpenRouter)인지, Vision 하이브리드까지 가는지. 어느 쪽이든 착수
   전에 A/B 하네스로 재는 게 선행이다(§7.2)
3. **최소 지원 iOS 버전.** 두 기능이 서로 다른 하한을 요구한다 — `.colorEffect`/`.layerEffect`가
   **iOS 17+**, `RecognizeDocumentsRequest`(문단·표 구조화)가 **iOS 18+**다. 한국어 텍스트 인식
   자체는 revision3(iOS 16+)이라 하한을 올리지 않는다. **iOS 17을 하한으로 잡으면** 재질은 Metal로
   가되 OCR 구조화는 `VNRecognizeTextRequest` + 자체 정렬로 가야 하고, **18로 잡으면** 둘 다 최신
   경로를 쓰되 기기 커버리지를 그만큼 포기한다
4. ~~수익화 계획이 있는가~~ — **닫힘.** 수익화를 고려한다는 답이 나왔고, 그래서 TMDB는 폐기로
   결정됐다(§7.1 · §9)

---

## 9. TMDB 철수 범위

오너 결정(2026-08-10): **TMDB 기능은 폐기하고, 앱을 기다리지 않고 웹에서 지금 걷어낸다.**
약관 위험이 웹/앱 공통이라 미룰 이유가 없다(§7.1).

이 절은 **작업 범위 목록이지 실행 결과가 아니다** — 이 RFC 브랜치는 문서만 다루고, 실제 철거는
별도 이슈·PR로 간다.

### 삭제 (1,000줄)

| 대상 | 줄 |
|---|---|
| `src/components/TmdbPosterModal.tsx` | 333 |
| `src/pages/api/tmdb/{search,images,image}.ts` | 161 |
| `__tests__/tmdbPosterEntry.test.tsx` | 191 |
| `__tests__/tmdbRoutes.test.ts` | 182 |
| `__tests__/tmdbPosterModalOverlayContrast.test.tsx` | 133 |

### 수정

- **`src/components/v2/MobileEditorShell.tsx`** — dynamic import, `tmdbOpen` 상태, `handleTmdbSelect`·
  `handleTmdbFallback`, `onTmdbSearch` 전달, 모달 렌더 블록
- **`src/components/v2/Landing.tsx`** — `onTmdbSearch` prop과 "영화 검색해서 가져오기" 버튼
- **`src/utils/ratelimit.ts`** — `LimitPolicy.scope`에서 `'tmdb' | 'tmdb-image-thumb' | 'tmdb-image-original'`
  세 값, `checkTmdbRateLimit`·`checkTmdbImageRateLimit` 두 함수. **#638에서 썸네일/원본으로 쪼갠
  스코프 분리도 같이 사라진다**
- **환경변수** — TMDB API 키 항목(`.env.example`과 Vercel 프로젝트 설정 양쪽에서 제거. 키 이름을
  여기 다시 적지 않는 건 "코드·문서 어디에도 안 남는다"가 #665의 완료 조건이라서다)
- **문서** — `CLAUDE.md`의 "Current Project Status" TMDB 두 항목(#537·#638),
  `docs/specs/landing-mood-first-ocr-entry.yaml`의 TMDB 합류 서술

### 판단이 필요한 두 곳 — 단순 삭제가 아니다

1. **랜딩 이탈 경로가 3종 → 2종이 된다.** `Landing.tsx`의 세 링크("포스터부터 올리기 · 영화 검색해서
   가져오기 · 직접 입력")는 #635 c6이 "스크린샷 없음"의 이탈로 설계한 묶음이고, TMDB가 그중
   **"파일을 직접 못 구했을 때의 진입로"**를 맡고 있다. 그게 빠지면 그 사용자는 갈 곳이 "직접
   입력"(포스터 없이 시작, #631)뿐이다. 구멍이 치명적이진 않다 — #631이 이미 포스터 없는 경로를
   정식으로 열어놨기 때문이다. 다만 **문구는 손봐야 한다**: 남는 두 링크가 "포스터를 못 구한
   사용자"를 여전히 받아준다는 걸 읽히게 할 것
2. **`usePhototicket.fillEmptyMovieInfo`가 고아가 된다.** 이 함수는 범용으로 쓰였지만(빈 필드만
   KOBIS 값으로 보강) 실제 호출부는 `MobileEditorShell`의 TMDB 확정 경로 **하나뿐**이다. TMDB가
   빠지면 호출부가 0이 되고 `__tests__/fillEmptyMovieInfoRatingZero.test.tsx`(#638 P2 회귀)도 같이
   뜬다. **그런데 지우기 아까운 코드다** — "이미 사용자가 채운 필드는 덮지 않는다"는 규칙과 그
   회귀(숫자 0을 빈 값으로 오판하지 않기)는 앞으로 어떤 자동 보강 경로가 생겨도 다시 필요하다.
   **권장: 함수와 테스트는 남기고, 다음 보강 경로(#635 OCR 체인 등)가 붙을 때까지 미사용으로 둔다.**
   미사용 export가 하나 생기는 건 감수할 값이다

### 남기는 것

KOBIS는 그대로다. 영화 메타데이터(제목·개봉일·배우·러닝타임) 축은 KOBIS가 담당하고 약관 문제도
없다. 사라지는 건 **포스터 이미지를 외부에서 가져오는 기능** 하나다.

---

## 10. 앱스토어/사업 측 사전작업 (경로·마이그레이션과 독립)

조사 2026-08-11. 이 절은 §1~§9의 코드 이식 문제와 완전히 독립이다 — Swift 한 줄 안 써도 진행되고,
반대로 마이그레이션이 다 끝나도 이게 안 돼 있으면 앱을 못 낸다.

### 10.1 Apple Developer 계정 — 개인으로 결정, 연회비는 계정 종류 무관

- 오너 결정: **개인(Individual) 계정.**
- 연회비 $99/년은 개인·조직 **둘 다 동일**, 피할 수 없다.
- **개인/조직의 차이는 스토어에 뜨는 "제공자" 이름뿐이다** — 개인 계정은 개인 법적 이름이,
  조직 계정은 법인명("FILME" 같은)이 노출된다. **인앱결제·구독 등 수익화는 두 계정 유형 모두
  동일하게 지원**되고, 수수료율(30% 또는 Small Business Program 자격 시 15%)도 계정 종류와
  무관하게 매출 규모로 갈린다. 유일한 예외는 조직이 **수수료 면제(fee waiver) 프로그램**으로
  등록한 경우인데(비영리 등 대상), 이건 우리가 해당하지 않는 별개 트랙이다.
- 나중에 "FILME"라는 브랜드명을 스토어에 노출하고 싶어지면 그때 조직 계정 전환을 검토하면
  된다 — 지금 개인으로 시작하는 게 이 선택지를 막지 않는다.

### 10.2 상표 — 앱 표시명·설명·스크린샷에서 "CGV" 제외

- 오너 결정: 앱 이름/설명/스크린샷 문구에서 "CGV" 미노출. "CGV 감성/무드 재현" 정도의
  간접 표현으로 대체.
- 코드 쪽은 이미 로고 번들을 걷어내고 사용자 직접 업로드로 돌려서 상표 리스크를 낮춰놨다
  (`CLAUDE.md` "Asset manifest" 절, #231). 그런데 그건 **산출물(티켓)** 표면이고, 스토어
  노출 문구는 **별개 표면**이다 — Apple 심사가 상표권 침해를 직접 판정하진 않지만, 실제
  CGV 측 문제 제기 시 앱이 내려갈 수 있는 구조라 코드가 안전해도 이름/설명은 따로 챙겨야 한다.

### 10.3 KOBIS 이용약관 — 상업적 이용은 가능해 보이나 "운영단계 심의승인"이 확인 안 됐다

공공데이터포털(data.go.kr)에 등록된 KOBIS 영화 상세정보 API 항목 기준(원문 전문은 미확인,
아래는 포털 표기 요약):

- **"이용허락범위 제한 없음"**, 비용 무료. 상업적 이용을 명시적으로 막는 조항은 확인되지 않았다.
- 걸리는 지점: **"심의유형 = 개발단계 자동승인 / 운영단계 심의승인."** 개발 단계 키 발급은
  자동이지만, 실 서비스로 전환하는 시점(운영단계)엔 KOFIC의 별도 심의를 거쳐야 한다는 뜻으로
  읽힌다. 이 심의가 정확히 뭘 요구하는지(서류·기간·거부 사유)는 포털 메뉴 구조만 확인했을 뿐
  원문을 못 열어봤다.
- **액션 (수익화 착수 전 선행):** KOBIS 오픈API 포털(kobis.or.kr/kobisopenapi)에서 실제 키를
  발급받을 때 뜨는 이용약관 전문과 "운영단계 심의승인" 절차를 직접 확인할 것. TMDB(§7.1)가
  약관 원문을 안 보고 넘어갔다가 나중에 크게 걸린 전례라, 같은 실수를 반복하지 않는다.

### 10.4 프라이버시 — Nutrition Label과 Privacy Manifest는 다른 시점에 결정된다

두 항목을 하나로 뭉치면 안 된다. 결정 시점이 다르다.

- **Privacy Nutrition Label**(스토어 페이지 노출용 데이터수집 표) — §7.2의 OCR 경로 결정
  (Gemini 서버 전송 유지 vs iOS Vision 온디바이스 하이브리드)에 따라 "사진 데이터를 수집하는가"
  자체가 바뀐다. **그 결정이 날 때까지 홀딩이 맞다.**
- **Privacy Manifest**(`PrivacyInfo.xcprivacy`, iOS 17+ 필수) — OCR 경로와 **무관하게** 필요하다.
  `UserDefaults` 같은 흔한 시스템 API 하나만 써도(자동저장 로직을 옮기면 거의 확실히 쓴다)
  Required Reason API에 걸려서, 앱 골격을 잡는 단계에서 같이 넣어야 한다. **이건 홀딩 대상이
  아니다.**

### 10.5 개인정보처리방침 + Support URL — 정적 페이지 하나로 통합

- App Store Connect가 요구하는 개인정보처리방침 URL과 Support URL은 둘 다 **"열리는 웹페이지"**여야
  한다 — 이메일 주소 자체(`mailto:`)만 넣는 건 반려 사례가 보고돼 있어 권장하지 않는다.
- **해법:** 정적 페이지 1개에 처리방침 본문 + 하단 문의 이메일 링크를 같이 배치해서 두 필드를
  한 페이지로 해결한다.
- 처리방침 내용은 **실제 데이터 흐름과 일치해야 한다** — 사진 업로드 → Gemini로 OCR 전송,
  KOBIS 조회, (§7.2 하이브리드로 가면) Vision 온디바이스 처리. 이 내용이 §10.4의 Nutrition
  Label과 어긋나면 심사에서 걸린다. 참조 템플릿은 아직 없다 — Apple이 요구하는 항목(수집 데이터
  종류·목적·제3자 공유 여부·보관기간)을 채우는 형태로 새로 작성해야 한다.

### 10.6 연령등급 — 자기신고 설문, 실질 리스크 낮음

법적 판단이 아니라 App Store Connect의 콘텐츠 디스크립터 **자기신고 설문**이다(폭력성·도박·UGC
등 항목 체크). 사용자가 스크린샷(영화 티켓)을 업로드하는 정도라 폭력적/성인 콘텐츠 항목에
안 걸려서, 사실상 **4+**로 나올 가능성이 높다. 별도 대응이 필요한 자리는 아니다.
