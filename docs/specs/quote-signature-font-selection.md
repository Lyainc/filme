# 한줄평·서명 폰트 선택 — 현재 구현 명세 (#437)

이 문서는 현재 코드의 상태·렌더·UI 계약을 설명해요. `signatureFont`와 여섯 무드 배선, 9택 UI는 이미 존재해요. 새 구현 착수 지시나 실기기·인쇄 검증 완료 선언은 아니에요. [Seed 안내](README.md)의 생애주기 적용 규칙을 따라요.

## 0. 현재 구현의 기준

- 타입: `src/types/index.ts`의 `QuoteFont`, `TicketComponents.quoteFont/signatureFont`.
- UI: `src/components/v2/designRailItems.tsx`의 `QUOTE_FONT_OPTIONS`, `CustomPanel`.
- 렌더: `src/components/moods/_shared.tsx`의 `userTextFont`, `SignatureStamp`, `FilmCreditCut`.
- 로드: `src/pages/_app.tsx`의 로컬 폰트와 `Nanum_Brush_Script` 선언.
- 원래 quote 축: [design-rail-custom-quote/constraint-1 · 컨트롤 노출 무드의 합집합](design-rail-custom-quote.yaml). 원안의 4택·Criterion 전용 custom 조건은 현재 9택·서명 피커와 구분해요.

## 1. 현재 선택값

| 값 | UI 라벨 | 렌더 폰트 |
| --- | --- | --- |
| `auto` | 자동 | 한글 포함 시 아이스자람체, 나머지는 Instrument Serif 이탤릭 |
| `gothic` | 고딕 | Pretendard |
| `batang` | 바탕 | 경기천년바탕 |
| `hand` | 자람 | 아이스자람체 |
| `ink` | 잉크 | 잉크립퀴드체 |
| `eunyoung` | 은영 | KCC은영체 |
| `brush` | 붓 | 나눔손글씨붓 |
| `coolguy` | 쿨가이 | 쿨가이 |
| `flower` | 꽃길 | 꽃길 |

`serif`는 현재 union과 피커에 없어요. 옛 저장값 `serif`는 렌더에서 `auto`와 같은 경로로 폴백하므로 별도 저장 마이그레이션을 하지 않아요. 한글일 때 serif 선택을 잠그던 UI도 제거됐어요.

## 2. 폰트 출처와 최초 후보의 구분

반입 파일·출처 고지와 사용 조건은 [public/fonts/LICENSES.md](../../public/fonts/LICENSES.md)가 소유해요. 이 문서에서 라이선스 규칙을 다시 관리하지 않아요.

2026-08-26 최초 검토의 나눔명조·우아한 세리프·온글잎 박다현체는 당시 후보였어요. 현재 선택 목록은 위 표이며 당시 후보 조사만으로 새 폰트 채택이나 사용 허용을 판단하지 않아요. 이번 명세 정리에서는 외부 약관을 다시 확인하지 않았어요.

## 3. 독립 상태와 저장 호환

`quoteFont?: QuoteFont`와 `signatureFont?: QuoteFont`는 별도 필드예요. 초기값은 각각 `auto`이며, 필드가 없는 저장본도 피커·렌더에서 `auto`로 읽어요. 한줄평을 고딕으로, 서명을 손글씨로 고르는 조합이 가능해요.

서명 이미지는 텍스트 서명보다 렌더 우선순위가 높아요. 이미지를 올렸을 때는 텍스트 폰트 값 자체를 지우지 않고 서명 폰트 피커 전체를 잠가요. 이미지를 지우면 보존된 폰트 선택이 다시 적용돼요.

## 4. 렌더 함수와 크기 보정

공용 함수는 `userTextFont(text, font = 'auto', baseFontSize?)`예요. 유효한 사용자 선택은 그 폰트를 사용하고, 자동·미설정·알 수 없는 옛 값은 한글 여부로 기본 폰트를 결정해요. 선택 폰트의 `fontStyle`과 `fontWeight`도 함수가 정해요.

`baseFontSize`가 있으면 `HANGUL_SIZE_SCALE` 또는 `LATIN_SIZE_SCALE`의 배율을 곱하고 소수점 둘째 자리까지 반올림한 `fontSize`를 반환해요. 호출부가 스프레드 뒤에 별도 `fontSize`를 다시 쓰면 보정이 덮이므로 기본 크기는 세 번째 인자로 넘겨요. 배율의 측정 도구는 `scripts/measure-font-metrics.mjs`예요.

## 5. 폰트 로드와 캡처

장식 한글 폰트는 `_app.tsx`에서 `preload: false`로 선언해요. 나눔손글씨붓은 로컬 단일 파일 추가가 아니라 `next/font/google`의 `Nanum_Brush_Script`를 통한 자체 호스팅·unicode-range 분할 경로예요. 파일 종류와 크기를 전부 동일하다고 가정하지 않아요.

캡처는 `captureToImage.ts`의 폰트 준비 대기와 `html-to-image` 경로를 사용해요. 폰트 변경 후 실기기나 인쇄 결과가 맞는지는 별도 실행 증거로 판단해요.

## 6. 무드별 적용 범위

| 무드 | 한줄평 폰트 | 서명 폰트 |
| --- | --- | --- |
| Criterion | `components.quoteFont` | `components.signatureFont` |
| Minimal · Stub · Editorial | 한줄평 없음 | `components.signatureFont` |
| 35mm · 35mm-landscape | 한줄평 없음 | 공유 `FilmCreditCut`의 Collected by 텍스트 |

35mm 계열의 필름 엣지 스텐실은 별도 `FONT_LCD`와 한글 폴백을 사용해요. 서명 폰트 선택은 크레딧 컷에 적용하며 엣지 스텐실까지 바꾸지 않아요. 여섯 무드 모두 이미지 서명은 `SignatureStamp`로 먼저 렌더해요.

## 7. 레일 UI 게이팅

`QUOTE_FONT_MOODS`는 Criterion, `SIGNATURE_FONT_MOODS`는 여섯 무드예요. `CUSTOM_PANEL_MOODS`는 둘의 합집합이고, 패널 내부에서 각 피커를 다시 게이팅해요. 서명 이미지가 있으면 9개 선택지를 모두 disabled로 만들고 이유를 표시해요. 문구 입력은 레일이 아니라 필드 편집 경로가 소유해요.

## 8. 회귀 근거와 검증 경계

- `__tests__/designRailQuoteFont.test.tsx`: 한줄평 피커와 상태 변경.
- `__tests__/designRailSignatureFont.test.tsx`: 무드별 노출·독립 값·이미지 잠금.
- `__tests__/moodSignatureFont.test.tsx`: 여섯 무드 서명 렌더·옛 값 폴백·크기 보정.
- `__tests__/userTextFontOptions.ts`: 폰트 선택 테스트가 공유하는 값 목록.

위 목록은 현재 검증 위치 안내예요. 이번 문서 정리는 폰트 파일·UI·렌더 코드를 바꾸지 않았으며, 테스트 실행·iPhone 키보드·실물 인쇄의 새로운 통과 증거를 만들지 않아요.
