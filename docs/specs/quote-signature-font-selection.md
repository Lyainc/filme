# 한줄평·서명 한글 폰트 다중 선택 — 구현 스펙 (#437)

> **상태: 구현 착수 가능.** 이 문서로 #437을 "즉시 구현 보류(기획 검토)"에서 옮긴다.
> 실제 폰트 파일 로딩·UI 구현 코드는 이 문서의 범위 밖 — 다음 세션이 착수한다.

## 0. #437 이슈 본문과 라이브 코드의 괴리 (P5 재확인)

이슈 본문(및 최초 지시가 인용한 `_shared.tsx:196-234`/`_app.tsx:20-76`)은 **2026-07 초 스냅샷**이다.
그 사이 #558(PR #560)이 **quote 축을 폰트 파일 추가 없이 부분 착수**했고, 이슈 코멘트 5건이
스코프를 이미 재정의해뒀다. 이 문서는 이슈 본문이 아니라 **2026-08-26 기준 라이브 코드**를
근거로 삼는다.

현재 실제 상태:

- `TicketComponents.quoteFont?: QuoteFont`(`src/types/index.ts:31,102`)가 이미 존재.
  값은 `'auto' | 'hand' | 'gothic' | 'serif'` 4택.
- `_shared.tsx:324`의 `userTextFont(text, font: QuoteFont = 'auto')`가 quote·signature 공용
  단일 진입점 — **인자가 이미 확장돼 있다**(이슈 코멘트가 "인자를 더 받게 넓혀야 한다"고 남긴
  건 그새 해소됨).
- **신규 폰트 파일은 0건** — 4택 전부 `_app.tsx`가 이미 로드 중인 3종(`pretendard`·`iceJaram`·
  `instrumentSerif`) + `auto`.
- 레일 커스텀 패널(`designRailItems.tsx:210-225` `CustomPanel`)이 `components.quoteFont`를
  칩으로 노출 — 단, **quote 자신에게만** 적용(`MoodCriterion.tsx:381`).
- **signature는 6무드 전부에서 이미 `userTextFont(signatureVal)`을 호출하지만, 두 번째 인자
  (font) 없이 호출해 항상 `'auto'` 자동분기 고정** — `MoodCriterion.tsx:403`·
  `MoodMinimal.tsx:350`·`MoodStub.tsx:423`·`MoodEditorial.tsx:447`, 그리고 **35mm·
  35mm-landscape도 포함**된다: 이 둘은 필름 엣지 스텐실(`FONT_LCD` 고정, 대상 아님)과는
  별개로 `FilmCreditCut`(`_shared.tsx:1920`, `Mood35mm.tsx:114`·`Mood35mmLandscape.tsx:120`에서
  렌더)이라는 "크레딧 컷" 패널을 항상 갖고, 그 안의 `Collected by` 행(`_shared.tsx:2050`)이
  다른 4무드와 완전히 같은 `userTextFont(signatureVal)` 텍스트 스팬이다. 선택 UI가 없을 뿐,
  배선 지점은 6무드 전부에 이미 나 있다.
- **`components.signatureImage`(#484)가 텍스트 서명보다 렌더 우선순위가 높다** — 6무드 전부
  `signatureImage ? <SignatureStamp> : signatureVal ? <span style={userTextFont(...)}>` 패턴
  (`MoodCriterion.tsx:397`·`_shared.tsx:2047` 등). 서명 이미지를 업로드한 상태에서는
  `signatureFont` 피커를 조작해도 시각적으로 아무 효과가 없다.

즉 이 문서가 실제로 답해야 할 건 이슈가 열어둔 두 갈래뿐이다:

1. **signature 축을 연다** — quote와 값을 공유할지, 별도 필드를 둘지.
2. **신규 폰트 후보를 추가한다** — 눈누 라이선스 확인.

## 1. 확정 후보 목록

### 1-1. 기존 4택 (변경 없음, 재사용)

| value | 라벨 | 실제 폰트 | 토큰 | 비고 |
|---|---|---|---|---|
| `auto` | 자동 | — | `containsHangul` 분기 | 기본값 |
| `hand` | 손글씨 | 아이스자람체(IceJaram-Rg) | `FONT_QUOTE_KR` | `--font-quote-kr`, preload:false |
| `gothic` | 고딕 | Pretendard Variable | `FONT_KR` | 한글 커버 정상 |
| `serif` | 세리프 | Instrument Serif | `FONT_DISPLAY` | 한글 글리프 없음 → 한글 입력 시 disabled |

### 1-2. 신규 후보 (추가 검토 대상 — 이번 스펙에서 라이선스만 확정, 채택 여부는 후속 판단)

`serif` 칩은 한글에서 항상 잠긴다(1-1 비고). 신규 후보의 가치는 **한글에서도 쓸 수 있는
세리프 대체**와 **손글씨 옵션 다양화** 둘이다.

| 후보 | 스타일 | 대체/추가 대상 | 권장 |
|---|---|---|---|
| **나눔명조** (Nanum Myeongjo) | 명조/세리프, 완성형 한글 | `serif` 한글 대체 | **1순위** — 제작사 신뢰도(네이버)·인지도 높음 |
| 우아한 세리프 (Elegant Serif) | 명조/세리프, 완성형 한글 | `serif` 한글 대체 | 대안(스타일 취향 차이, A/B 택1) |
| 온글잎 박다현체 | 손글씨, 완성형 한글 | `hand`에 두 번째 선택지 추가 | 2순위 — 손글씨 다양화, 시급성 낮음 |

**권장 최소 세트(2종)**: 나눔명조 하나만 추가해 `serif` 한글 disabled를 해소. 온글잎 박다현체는
"손글씨가 하나뿐이면 부족한가"가 실제 요구인지 다음 세션이 사용자 확인 후 3번째로 얹는다.

## 2. 라이선스 확인 결과 (눈누, 개별 조사·2026-08-26)

| 폰트 | 출처 | 라이선스 | 상업적 이용 | 웹폰트 임베딩 | 비고 |
|---|---|---|---|---|---|
| 나눔명조 | 네이버 | OFL | ✅ | ✅ ("웹사이트 및 프로그램 서버 내 폰트 탑재" 명시) | 폰트 파일 자체의 유료 재판매만 금지 |
| 우아한 세리프 | 디스이즈페어웨이 | OFL | ✅ | ✅ (동일 문구 + E-book) | 동일 제약 |
| 온글잎 박다현체 | 온글잎/㈜보이저엑스 | OFL(변형) | ✅ | ✅ (동일 문구) | **수정·복제·배포·유료판매 전부 금지** — 자체 호스팅(서버 탑재)은 별도로 명시 허용되므로 저촉 없음. 파일을 그대로 재배포·재가공하지 않는 한 현재 레포 컨벤션(자체 호스팅, CDN @import 금지)과 충돌 없음. |

세 폰트 모두 완성형 한글 전체 커버 폰트라 정확한 파일 용량은 실제 반입 시 실측 필요 —
참고로 기존 아이스자람체(완성형 11172자)가 3.6MB.

## 3. state 스키마

### 결정: `signatureFont` 신설(분리), `quoteFont`와 공유하지 않는다

```ts
// src/types/index.ts — TicketComponents
signatureFont?: QuoteFont;  // 기존 QuoteFont 타입 재사용, 새 타입 불필요(값 집합 동일)
```

```ts
// src/hooks/usePhototicket.ts — INITIAL_STATE.components
signatureFont: 'auto',
```

**근거(분리 > 공유)**:

- 노출 대상 무드 자체가 다르다 — `quoteFont`는 Criterion 1개, `signatureFont`는 **6개 전부**
  (Criterion·Minimal·Stub·Editorial 텍스트 스팬 + 35mm·35mm-landscape 크레딧 컷). appliesTo
  합집합 정의부터 갈리므로 공유 필드로는 두 노출 조건을 한 값에 우겨넣어야 한다.
- 텍스트 성격이 다르다 — 한줄평(인용구)과 서명(사인)을 항상 같은 서체로 묶을 이유가 없고,
  #437 코멘트가 짚은 "한줄평=고딕/서명=손글씨" 조합은 사고가 아니라 정상 허용 범위로 보는 게
  자연스럽다.
- 구현 비용 차이가 없다 — `userTextFont(text, font)`가 이미 두 번째 인자를 받으므로, 분리해도
  호출부는 quote와 동일하게 한 줄(`userTextFont(signatureVal, components.signatureFont)`)이다.
  공유였다면 오히려 "같은 값을 quote·signature 두 필드가 같이 읽는다"는 암묵 규약을 문서화해야
  했을 것.
- 마이그레이션 없음 — 필드 부재 시 `?? 'auto'`로 읽으므로 기존 저장분 호환.

## 4. 우선순위 (선택값 vs 자동분기)

기존 `userTextFont`의 동작을 그대로 재사용한다 — **변경 없음**:

```
font === 'auto'          → containsHangul(text) ? FONT_QUOTE_KR : FONT_DISPLAY   (기존 자동분기)
font === 'hand'          → FONT_QUOTE_KR
font === 'gothic'        → FONT_KR
font === 'serif' + 한글X → FONT_DISPLAY
font === 'serif' + 한글O → FONT_QUOTE_KR   (강제 auto 폴백, 아래 예외)
```

선택값이 있으면 그 값이 우선이고, 미설정(`undefined`/`'auto'`)일 때만 기존 `containsHangul`
자동분기로 폴백한다 — **단 하나 예외**: `_shared.tsx:326` `resolved = font === 'serif' && hangul
? 'auto' : font`가 있어, `serif`가 명시 선택된 상태에서 텍스트에 한글이 섞이면 저장값이
`'serif'`인 채로도 강제로 `auto`(→한글이므로 `FONT_QUOTE_KR`)로 되돌린다. 레일 disabled는
"새로 고르는 것"만 막으므로(라틴으로 `serif`를 고른 뒤 한글을 입력하는 경로가 있음) 렌더 쪽에
이 안전망이 따로 필요하다 — quote가 이미 이 규칙으로 동작 중이므로 signature도 동일 함수를
그대로 통과시키면 규칙이 자동으로 따라온다.

## 5. preload:false 지연 로드 전략

`_app.tsx`에 신규 폰트를 추가할 때도 기존 `iceJaram`과 동일하게 **전부 `preload: false`**로
선언한다 — 완성형 한글 전체 커버 폰트는 전부 3MB급이라, 실제로 그 폰트가 선택됐을 때만
지연 로드되어야 한다(루트 선언이어도 다른 무드·페이지에서 강제 preload로 매번 주입되지 않게).
`document.fonts.ready` 대기 + `html-to-image`의 `getWebFontCSS`(computed fontFamily 기준
자체 인라인)가 이미 지연 로드 폰트의 캡처 누락을 막아준다는 게 #437 코멘트에서 실측 확인됨
(재검증 불필요).

## 6. 무드별 fontFamily 매핑표

| 무드 | quote 필드 | quote 폰트 선택 | signature 폰트 선택 | 렌더 방식 |
|---|---|---|---|---|
| Criterion | 있음(전용) | `components.quoteFont` | `components.signatureFont`(신설) | `userTextFont(text, font)` 텍스트 스팬(`MoodCriterion.tsx:403`) |
| Minimal | 없음(제외) | — | `components.signatureFont`(신설) | 위와 동일(`MoodMinimal.tsx:350`) |
| Stub | 없음(제외) | — | `components.signatureFont`(신설) | 위와 동일(`MoodStub.tsx:423`) |
| Editorial | 없음(제외) | — | `components.signatureFont`(신설) | 위와 동일(`MoodEditorial.tsx:447`) |
| 35mm | 없음(제외) | — | `components.signatureFont`(신설) — **크레딧 컷 한정** | 두 표면이 공존한다: ① 필름 엣지 스텐실("COLLECTED BY {text}", `buildEdgeCodes` → `FilmRail`)은 `FONT_LCD`(Share Tech Mono, 한글 글리프 없음) 고정 + code 단위 `containsHangul`→`FONT_KR` 폴백뿐, **대상 아님**(텍스트 스팬이 아니라 사용자 폰트 선택 적용 불가). ② `FilmCreditCut`(`_shared.tsx:1920`, `Mood35mm.tsx:114`)의 `Collected by` 행(`_shared.tsx:2050`)은 다른 4무드와 동일한 `userTextFont(signatureVal)` 텍스트 스팬 — **대상**. |
| 35mm-landscape | 없음(제외) | — | `components.signatureFont`(신설) — **크레딧 컷 한정** | 위와 동일(`FilmStripBand` 엣지=대상 아님, `FilmCreditCut`(`Mood35mmLandscape.tsx:120`)=대상) |

`serif` disabled 판정은 **필드별 독립**이다 — quote는 `movieInfo.quote` 텍스트로,
signature는 `movieInfo.signature`(또는 `fv?.signature`) 텍스트로 각자 `containsHangul` 판정.
한쪽이 한글이라고 다른 쪽 칩까지 잠그지 않는다.

### 6-1. `signatureImage` 우선순위와 피커의 상호작용

6무드 전부 `components.signatureImage ? <SignatureStamp> : signatureVal ? <span style={userTextFont(...)}>`
패턴(`MoodCriterion.tsx:397-403`, `_shared.tsx:2047-2050` 등)이라, 서명 이미지가 업로드된
상태에서는 `signatureFont`를 아무리 바꿔도 화면·산출물에 아무 변화가 없다. quote의
`serif`-한글 disabled(§1-1 비고, `CustomPanel` hangul 판정)와 같은 문법으로 —
**`signatureImage`가 있으면 `signatureFont` 피커 전체를 disabled + 사유 문구
("서명 이미지가 있으면 폰트가 적용되지 않아요" 류)로 잠근다.** 숨기지 않고 잠그는 이유는
동일: 이미지를 지우면 다시 유효해지는 조건이라 개념 자체는 존재한다.

## 7. 레일 UI 게이팅 (참고 — appliesTo 패턴 재사용)

`signatureFont` 피커의 `appliesTo`는 6무드 전부
`['criterion', 'minimal', 'stub', 'editorial', '35mm', '35mm-landscape']` —
`design-rail-custom-quote.yaml`의 c1(appliesTo는 항목 노출 무드의 합집합, 컨트롤별 게이팅은
render 클로저 안에서 각자 표를 다시 봄)과 동일 패턴을 그대로 따른다. `CustomPanel`이 이미
그 구조라 항목을 새로 안 만들고 같은 패널에 컨트롤만 추가하면 된다.

## 8. 남은 구현 작업 (코드 미작성 — 다음 세션 스코프)

1. `types/index.ts`: `signatureFont?: QuoteFont` 추가.
2. `usePhototicket.ts`: `INITIAL_STATE.components.signatureFont: 'auto'`.
3. `_shared.tsx` 또는 각 무드: **5곳**(`MoodCriterion`·`MoodMinimal`·`MoodStub`·`MoodEditorial`의
   signature 호출부 4곳 + `FilmCreditCut`의 `Collected by` 호출부 1곳 — 35mm·35mm-landscape는
   `FilmCreditCut`을 공유하므로 이 1곳이 두 무드 모두에 적용된다)의 `userTextFont(signatureVal)`
   호출에 `components.signatureFont` 인자 배선. 필름 엣지 스텐실(`FONT_LCD`)은 건드리지 않는다.
4. `designRailItems.tsx` `CustomPanel`: `signatureFont` 칩 추가, `appliesTo`를 6무드로 확장,
   signature 텍스트 기준 독립 `containsHangul` 판정으로 `serif` disabled,
   `components.signatureImage` 존재 시 피커 전체 disabled(§6-1).
5. (선택) 나눔명조 반입: `_app.tsx`에 `next/font/local` 선언(`preload:false`) +
   `_shared.tsx`에 `FONT_SERIF_KR` 같은 토큰 + `userTextFont`/`QuoteFont` 유니온에
   신규 value 추가.
6. 각 축 회귀 테스트: signature 폰트 전환 시 6무드 렌더 스냅샷, `serif` disabled 조건,
   `signatureImage` 존재 시 피커 disabled 조건.

## 참고

- 이슈 코멘트 근거: https://github.com/Lyainc/filme/issues/437 (2026-07-22~27, 5건)
- 선행 스펙(quote 축 부분 착수): `docs/specs/design-rail-custom-quote.yaml`
