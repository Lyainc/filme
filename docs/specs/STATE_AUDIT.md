# Seed 상태·이슈 연결 진단

기준일: 2026-10-10. 생애주기 판정의 원본은 각 Seed이고, 이 문서는 지정 커밋에서 확인한 근거와 미검증 범위를 기록해요.

프로덕션 기준은 GitHub main과 일치함을 확인한 `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`예요. 목업은 현재 브랜치 `46798aa4949270c08d6a3a5a617418539d7e4389`를 별도로 읽었어요. 코드 위치는 각 절의 고정 SHA에서 해석하며 현재 체크아웃에 해당 파일이 남았다는 이유로 프로덕션 기능을 되살리지 않아요.

사용자 지시: “상태값 unknown인것들 현행화하고 진단 결과에 따라 수정 필요한 사항 있으면 수정 시작”. 이 지시는 진단에 따른 상태 현행화의 승인 근거이며, 개별 실기기·육안 검증의 통과 승인을 대신하지 않아요.

20개 Seed의 283개 제약·성공 기준을 대조했어요. `closed/discontinued` 9개, `paused` 11개로 정리했고 `completed` 판정은 없어요. 목업 r1~r16 확장은 acceptance-1의 대응표로 별도 보존해요. 현재 제품의 새 결함은 재현되지 않았어요.

## 수정한 명세 결함

- inline `#`가 문장을 주석으로 잘라내던 값 6곳을 따옴표로 복구했어요. registry 제약, 무드 판단 근거·출처, 텍스처 검증 방법·판단 근거, 서명 의존성의 원 출처 문장이에요.
- 생애주기 도입 시 엄격한 읽기에서 거부되던 표현 44곳을 정규화했어요. 다중 행 목록 문자열과 flow mapping을 지원되는 형태로 바꿨어요. 목업의 한국어 우선순위 키는 같은 label·weight 기록으로 보존했어요.
- 표준 YAML 의미 비교 20건과 원 요구사항 ID·내용 동일성 20건을 확인했어요. lifecycle 전환은 정규화한 중간 파일과 비교하며 원본 파일도 별도 보존했어요.
- 스탬프 새 업로드 투명도 현행 설명을 기준 SHA의 `0.5`로 바로잡았어요. 기존 요구 본문과 ID는 변경하지 않았어요.
- 출처 집계를 바로잡고 #524의 명시된 source_session을 복원했어요. 이슈가 Seed를 가리키는 경우는 구현 tracking으로 구분하며 선행·제거·대체 이슈를 구현 이슈에 섞지 않아요.

## 자동 검증

| 검사 묶음 | 기준 SHA | 실행 결과 |
| --- | --- | --- |
| 편집·크롭·접근성 12파일 | `24eb36e` | 113 pass / 0 fail |
| 배경·텍스처·합성 5파일 | `24eb36e` | 113 pass / 0 fail |
| 랜딩·알림·OCR 상호작용 10파일 | `24eb36e` | 81 pass / 0 fail |
| 무드·필드·서체 9파일 | `24eb36e` | 148 pass / 0 fail |

모두 `bun run test <대상 파일>`로 실행했어요. 묶음 사이 중복이 있으므로 합계를 고유 테스트 수로 표시하지 않아요. 전체 스위트·typecheck·새 프로덕션 빌드의 브라우저 실측·실제 iOS/Android·실물 인쇄·사용자 최종 사용성 검토는 수행하지 않았어요. happy-dom·캔버스 mock 통과를 실제 JPEG 픽셀이나 실기기 결과로 세지 않아요.

생애주기 전환·관계 검증은 20개씩 통과했고, 제약·성공 기준·r1~r16·생성 버전·날짜 동일성도 확인했어요. 독립 최종 검토는 요구사항 누락 축으로 1회 수행했어요. 검토에서 지적한 v1 목업 기준 SHA와 서명 의존성의 잘린 출처 문장을 수정한 뒤 해당 생애주기·관계 검사 및 6개 원문 복구를 확인했어요. 스타일만을 위한 변경은 추가하지 않았어요.

## 항목별 근거

“코드·회귀 근거”는 지정 커밋의 정적 구현 또는 해당 대상 테스트 근거예요. 전체 요구 충족을 뜻하지 않아요. “후속 설계와 다름”은 원 요구가 후속 결정·구조와 달라진 항목이에요. 제거된 파일의 옛 경로는 존재 근거가 아니라 해당 고정 SHA의 부재와 삭제 커밋을 함께 읽어요.  “미실행·미확인”은 해당 항목의 완료 판정에 필요한 관찰·승인·역사적 근거가 남은 경우예요.

### background-image-scale-control

- Seed: `docs/specs/background-image-scale-control.yaml`
- 판정: `closed`/`discontinued`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: 전면 cover·PATTERN_CLIP 원안은 #728의 무드별 고정 스탬프로 대체됐으므로 원 요구 묶음을 종료한다. 남아 있는 이미지 배율 컨트롤을 미구현으로 재착수하지 않는다.
- source: `null` · tracking: `#680`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 후속 설계와 다름 | src/utils/backgroundPatterns.tsx:32-36; 8869d219f39797718e0c98d0681b9feb6e740556; https://github.com/Lyainc/filme/issues/728 |
| constraint-2 | 코드·회귀 근거 | __tests__/designRailBackgroundPattern.test.tsx:175; src/components/moods/MoodStub.tsx:248-265 |
| constraint-3 | 코드·회귀 근거 | src/components/v2/designRailItems.tsx:588; src/components/v2/designRailItems.tsx:659 |
| constraint-4 | 코드·회귀 근거 | src/types/index.ts:145; src/components/v2/designRailItems.tsx:656; src/components/moods/MoodStub.tsx:263 |
| constraint-5 | 코드·회귀 근거 | src/components/v2/designRailItems.tsx:658; src/utils/backgroundPatterns.tsx:76-78 |
| constraint-6 | 코드·회귀 근거 | src/utils/backgroundPatterns.tsx:72-78; src/components/v2/designRailItems.tsx:651-668 |
| constraint-7 | 후속 설계와 다름 | src/components/v2/designRailItems.tsx:600-668; https://github.com/Lyainc/filme/issues/728 |
| constraint-8 | 코드·회귀 근거 | src/components/v2/designRailItems.tsx:588 |
| acceptance-1 | 후속 설계와 다름 | src/utils/backgroundPatterns.tsx:32-36; __tests__/designRailBackgroundPattern.test.tsx:202 |
| acceptance-2 | 미실행·미확인 | __tests__/designRailBackgroundPattern.test.tsx:240; src/hooks/usePhototicket.ts:335-368; src/hooks/usePhototicket.ts:675-691 |
| acceptance-3 | 미실행·미확인 | scripts/capture-export.mjs; src/utils/backgroundPatterns.tsx:54-80 |
| acceptance-4 | 코드·회귀 근거 | __tests__/designRailBackgroundPattern.test.tsx:226; src/components/v2/designRailItems.tsx:651 |
| acceptance-5 | 코드·회귀 근거 | __tests__/designRailBackgroundPattern.test.tsx:175 |

이슈 근거:

- [680](https://github.com/Lyainc/filme/issues/680)
- [728](https://github.com/Lyainc/filme/issues/728)

### background-to-stamp

- Seed: `docs/specs/background-to-stamp.yaml`
- 판정: `paused`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: 고정 스탬프·배율·투명도와 관련 회귀는 구현돼 있으나 저장 JPEG 겹침·재방문·실기기 검증이 남아 완료 판정을 보류한다. Stub의 후속 측정 앵커 구현을 유지한다.
- source: `null` · tracking: `#728`, `#768`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 코드·회귀 근거 | src/components/v2/designRailItems.tsx:635; src/components/v2/designRailItems.tsx:654-685; __tests__/designRailBackgroundPattern.test.tsx:119 |
| constraint-2 | 코드·회귀 근거 | src/components/v2/designRailItems.tsx:572; __tests__/designRailBackgroundPattern.test.tsx:119 |
| constraint-3 | 코드·회귀 근거 | src/utils/backgroundPatterns.tsx:46; src/components/v2/designRailItems.tsx:651-668 |
| constraint-4 | 코드·회귀 근거 | src/components/v2/designRailItems.tsx:598; src/components/v2/designRailItems.tsx:614-619; __tests__/designRailBackgroundPattern.test.tsx:326-356 |
| constraint-5 | 코드·회귀 근거 | src/components/v2/designRailItems.tsx:653-668 |
| constraint-6 | 코드·회귀 근거 | __tests__/designRailBackgroundPattern.test.tsx:175; src/components/moods/MoodStub.tsx:248-265 |
| constraint-7 | 코드·회귀 근거 | src/types/index.ts:126; src/utils/backgroundPatterns.tsx:11-14 |
| constraint-8 | 코드·회귀 근거 | src/utils/backgroundPatterns.tsx:32-36; src/components/moods/MoodStub.tsx:276-289; __tests__/designRailBackgroundPattern.test.tsx:269-302 |
| constraint-9 | 미실행·미확인 | src/components/moods/MoodStub.tsx:75-117; scripts/capture-export.mjs:313-341; 77c252eca020c88aaf68fbb5c139226f16036cd1 |
| constraint-10 | 코드·회귀 근거 | src/utils/backgroundPatterns.tsx:54-80 |
| acceptance-1 | 코드·회귀 근거 | __tests__/designRailBackgroundPattern.test.tsx:188; src/components/moods/MoodStub.tsx:260 |
| acceptance-2 | 코드·회귀 근거 | __tests__/designRailBackgroundPattern.test.tsx:326; src/components/moods/MoodStub.tsx:264 |
| acceptance-3 | 코드·회귀 근거 | __tests__/designRailBackgroundPattern.test.tsx:337; src/components/v2/designRailItems.tsx:614-619 |
| acceptance-4 | 미실행·미확인 | __tests__/designRailBackgroundPattern.test.tsx:240; src/hooks/usePhototicket.ts:335-368; src/hooks/usePhototicket.ts:675-691 |
| acceptance-5 | 미실행·미확인 | __tests__/moodStubPatternBoxAnchoring.test.tsx:84-113; scripts/capture-export.mjs:313-341; src/components/moods/MoodStub.tsx:227-246 |
| acceptance-6 | 미실행·미확인 | scripts/capture-export.mjs; __tests__/designRailBackgroundPattern.test.tsx:188 |
| acceptance-7 | 코드·회귀 근거 | src/components/v2/designRailItems.tsx:635-685; __tests__/designRailBackgroundPattern.test.tsx:119 |

이슈 근거:

- [728](https://github.com/Lyainc/filme/issues/728)
- [768](https://github.com/Lyainc/filme/issues/768)

### calibration-print-mood

- Seed: `docs/specs/calibration-print-mood.yaml`
- 판정: `closed`/`discontinued`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: 단일 /calibration 페이지 원안은 #591의 Python/Chrome 캘리브레이션 스크립트로 대체됐으므로 종료한다. 기존 인쇄 기록은 해당 페이지 요구 전체의 완료 증거로 재사용하지 않는다.
- source: `#510` · tracking: `#510`, `#521`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 후속 설계와 다름 | scripts/make-calibration-sheet.py:18-21; 0a28c7de989d3ed66d567dbef11ac4454072fc48 |
| constraint-2 | 후속 설계와 다름 | 0a28c7de989d3ed66d567dbef11ac4454072fc48; docs/PRINT_CALIBRATION.md:35-45 |
| constraint-3 | 후속 설계와 다름 | scripts/make-calibration-sheet.py:83-86; docs/PRINT_CALIBRATION.md:76-100 |
| constraint-4 | 후속 설계와 다름 | scripts/make-calibration-sheet.py; docs/PRINT_CALIBRATION.md:63-64; https://github.com/Lyainc/filme/issues/591 |
| constraint-5 | 후속 설계와 다름 | scripts/make-calibration-sheet.py:23-46; https://github.com/Lyainc/filme/issues/591 |
| s1 | 후속 설계와 다름 | 0a28c7de989d3ed66d567dbef11ac4454072fc48; scripts/make-calibration-sheet.py:18-21 |
| s2 | 미실행·미확인 | docs/PRINT_CALIBRATION.md:76-100; https://github.com/Lyainc/filme/issues/591 |
| s3 | 미실행·미확인 | docs/PRINT_CALIBRATION.md:76-125; https://github.com/Lyainc/filme/issues/591 |

이슈 근거:

- [510](https://github.com/Lyainc/filme/issues/510)
- [591](https://github.com/Lyainc/filme/issues/591)
- [521](https://github.com/Lyainc/filme/issues/521)

### color-picker-hex-removal

- Seed: `docs/specs/color-picker-hex-removal.yaml`
- 판정: `paused`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: hex 제거·공유 라디오 접근성·관련 회귀는 구현돼 있으나 361px 한 줄 배치와 무드별 실제 패널 높이 측정이 남아 완료 판정을 보류한다.
- source: `null` · tracking: `#730`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 코드·회귀 근거 | src/components/wizard/ColorPicker.tsx:43-157 |
| constraint-2 | 코드·회귀 근거 | src/components/wizard/ColorPicker.tsx:48-65 |
| constraint-3 | 코드·회귀 근거 | src/utils/radioGroupKeyboard.ts; src/components/LayoutPicker.tsx:63-85; src/components/wizard/TexturePicker.tsx:104-127; __tests__/radioGroupTabStopFallback.test.tsx; docs/specs/STATE_AUDIT.md#자동-검증 |
| constraint-4 | 코드·회귀 근거 | src/components/wizard/ColorPicker.tsx:119-135 |
| constraint-5 | 코드·회귀 근거 | src/components/ui/variants.ts:52-60 |
| constraint-6 | 코드·회귀 근거 | src/components/wizard/ColorPicker.tsx:78-93; __tests__/colorPickerLockedNoteAdjacency.test.tsx:105-113 |
| constraint-7 | 코드·회귀 근거 | src/components/wizard/ColorPicker.tsx:96-106 |
| constraint-8 | 코드·회귀 근거 | src/components/wizard/ColorPicker.tsx:102-105 |
| constraint-9 | 코드·회귀 근거 | src/components/wizard/ColorPicker.tsx:45 |
| constraint-10 | 코드·회귀 근거 | src/components/wizard/ColorPicker.tsx:151-155; __tests__/colorPickerLockedNoteAdjacency.test.tsx:4-6;46-64 |
| acceptance-1 | 미실행·미확인 | src/components/wizard/ColorPicker.tsx:45-148 |
| acceptance-2 | 미실행·미확인 | src/components/v2/DesignRail.tsx:133; src/components/wizard/ColorPicker.tsx:151-155 |
| acceptance-3 | 코드·회귀 근거 | __tests__/colorPickerLockedNoteAdjacency.test.tsx:68-85; docs/specs/STATE_AUDIT.md#자동-검증 |
| acceptance-4 | 코드·회귀 근거 | __tests__/radioGroupTabStopFallback.test.tsx:125-207; __tests__/colorPickerLockedNoteAdjacency.test.tsx:87-103; docs/specs/STATE_AUDIT.md#자동-검증 |
| acceptance-5 | 코드·회귀 근거 | __tests__/colorPickerLockedNoteAdjacency.test.tsx:36-43; docs/specs/STATE_AUDIT.md#자동-검증 |
| acceptance-6 | 코드·회귀 근거 | __tests__/colorPickerLockedNoteAdjacency.test.tsx:46-64; docs/specs/STATE_AUDIT.md#자동-검증 |
| acceptance-7 | 코드·회귀 근거 | __tests__/colorPickerLockedNoteAdjacency.test.tsx:105-113; docs/specs/STATE_AUDIT.md#자동-검증 |

이슈 근거:

- [730](https://github.com/Lyainc/filme/issues/730)

### crop-modal-vertical-fit

- Seed: `docs/specs/crop-modal-vertical-fit.yaml`
- 판정: `closed`/`discontinued`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: 공통 contain 수정은 남아 있으나 Stub 고정 크롭 유지 원안은 #525의 공통 contain·원본 비율 정책으로 대체됐으므로 원 요구 묶음을 종료한다.
- source: `#474` · tracking: `#474`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 미실행·미확인 | src/components/ImageCropModal.tsx:240-267 |
| constraint-2 | 미실행·미확인 | src/components/ImageCropModal.tsx:246-267 |
| constraint-3 | 코드·회귀 근거 | src/components/ImageCropModal.tsx:243-267 |
| constraint-4 | 코드·회귀 근거 | 7e7bade90aca4771b53025dc89ad7b0212600a83; src/components/ImageCropModal.tsx:243-267 |
| constraint-5 | 코드·회귀 근거 | src/components/ImageCropModal.tsx:267 |
| constraint-6 | 코드·회귀 근거 | 7e7bade90aca4771b53025dc89ad7b0212600a83; src/components/ImageCropModal.tsx:235-237 |
| constraint-7 | 후속 설계와 다름 | src/components/ImageCropModal.tsx:44-60; __tests__/logoCropFreeAspect.test.tsx:158-161 |
| s1 | 미실행·미확인 | src/components/ImageCropModal.tsx:238-267 |
| s2 | 미실행·미확인 | src/components/ImageCropModal.tsx:238-267 |
| s3 | 미실행·미확인 | src/components/ImageCropModal.tsx:238-267 |
| s4 | 미실행·미확인 | src/components/ImageCropModal.tsx:238-267 |
| s5 | 미실행·미확인 | src/components/ImageCropModal.tsx:101-117; __tests__/logoCropFreeAspect.test.tsx:210 |
| s6 | 미실행·미확인 | docs/specs/STATE_AUDIT.md#자동-검증; __tests__/logoCropFreeAspect.test.tsx |

이슈 근거:

- [474](https://github.com/Lyainc/filme/issues/474)

### design-rail-custom-quote

- Seed: `docs/specs/design-rail-custom-quote.yaml`
- 판정: `closed`/`discontinued`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: Criterion 전용 4택·22자·서체 추가 금지 원안은 #437의 9택·6무드 서명과 #754의 31자 재산정으로 대체됐으므로 종료한다. 기존 좁은 선택 구조를 복원하지 않는다.
- source: `null` · tracking: `#558`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 코드·회귀 근거 | src/components/v2/designRailItems.tsx:234-264 |
| constraint-2 | 후속 설계와 다름 | c7eb503ccd07c3852b61eb4dd5681bf550582082; 31718720bcb382182291cc9d8a35c2c35a6ed0dd; __tests__/designRailQuoteFont.test.tsx |
| constraint-3 | 코드·회귀 근거 | src/components/moods/_shared.tsx:343-361; __tests__/designRailQuoteFont.test.tsx; docs/specs/STATE_AUDIT.md#자동-검증 |
| constraint-4 | 후속 설계와 다름 | src/components/v2/designRailItems.tsx:266-268; __tests__/designRailQuoteFont.test.tsx:175 |
| constraint-5 | 코드·회귀 근거 | src/components/v2/designRailItems.tsx:257-321 |
| constraint-6 | 후속 설계와 다름 | 64e6fa64651809fc310137e2ea0f75d177c5cd12; 9b05ccacbe479cde554860cdc80246ec2ebe07b8 |
| constraint-7 | 코드·회귀 근거 | src/types/index.ts:116; src/hooks/usePhototicket.ts:173; src/components/v2/designRailItems.tsx:297 |
| constraint-8 | 후속 설계와 다름 | src/constants/fields.ts:196; da57991 |
| constraint-9 | 코드·회귀 근거 | eba119d33b82f0aaa7a0bc098ed0ecca44f63a65; 7ba73747043347beaa7fa1a249565aa6be3e3772 |
| acceptance-1 | 후속 설계와 다름 | __tests__/designRailQuoteFont.test.tsx; src/components/v2/designRailItems.tsx:247-250; docs/specs/STATE_AUDIT.md#자동-검증 |
| acceptance-2 | 후속 설계와 다름 | https://github.com/Lyainc/filme/issues/558#issuecomment-5090644725; src/components/v2/designRailItems.tsx:291 |
| acceptance-3 | 미실행·미확인 | src/components/v2/DesignRail.tsx:126-127; https://github.com/Lyainc/filme/issues/558#issuecomment-5090644725 |
| acceptance-4 | 후속 설계와 다름 | da57991; src/components/moods/_shared.tsx:343-361 |

이슈 근거:

- [558](https://github.com/Lyainc/filme/issues/558)

### design-rail-item-registry

- Seed: `docs/specs/design-rail-item-registry.yaml`
- 판정: `closed`/`discontinued`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: 모바일·데스크톱 surface를 함께 다루던 원안은 #607 단일 셸과 #701 eyebrow 제거로 대체됐으므로 종료한다. 현재 RAIL_ITEMS·필터·패널 닫기 동작은 유지한다.
- source: `null` · tracking: `#523`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 후속 설계와 다름 | src/components/v2/designRailItems.tsx:24-56; 64e6fa64651809fc310137e2ea0f75d177c5cd12; 3cc13ec6a8d0c724a9d8fa91d74f296a465ff6f2 |
| constraint-2 | 후속 설계와 다름 | src/components/v2/designRailItems.tsx:24-29;56;64 |
| constraint-3 | 코드·회귀 근거 | src/components/v2/DesignRail.tsx:185-192; __tests__/designRailMoodHiding.test.tsx:60; docs/specs/STATE_AUDIT.md#자동-검증 |
| constraint-4 | 코드·회귀 근거 | src/components/v2/designRailItems.tsx:50-55;713-732 |
| constraint-5 | 코드·회귀 근거 | src/components/v2/DesignRail.tsx:185-201; __tests__/designRailPanelLookup.test.tsx; docs/specs/STATE_AUDIT.md#자동-검증 |
| constraint-6 | 미실행·미확인 | docs/specs/design-rail-item-registry.yaml:113; 16bd0701c8f14fd7850401cbe6ac1bee27addf0e; abb3c7719e415aa20754b75ddccc2f50c8e66b3f |
| constraint-7 | 후속 설계와 다름 | https://github.com/Lyainc/filme/issues/523#issuecomment-5081858124; src/components/v2/designRailItems.tsx:821;835 |
| acceptance-1 | 후속 설계와 다름 | 64e6fa64651809fc310137e2ea0f75d177c5cd12; https://github.com/Lyainc/filme/issues/523#issuecomment-5081858124 |
| acceptance-2 | 후속 설계와 다름 | src/components/v2/designRailItems.tsx:24-29 |
| acceptance-3 | 코드·회귀 근거 | __tests__/designRailItemsFilter.test.ts:19-35; docs/specs/STATE_AUDIT.md#자동-검증 |
| acceptance-4 | 코드·회귀 근거 | __tests__/designRailMoodHiding.test.tsx:60; docs/specs/STATE_AUDIT.md#자동-검증 |

이슈 근거:

- [523](https://github.com/Lyainc/filme/issues/523)

### emboss-highlight-split

- Seed: `docs/specs/emboss-highlight-split.yaml`
- 판정: `closed`/`discontinued`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: #785에 기록된 사용자 결정으로 형압·하이라이트 기능과 마스크·도구·JPEG 합성이 제거됐으므로 원 요구 묶음을 종료한다. 과거 구현을 현재 누락으로 재분류하지 않는다.
- source: `null` · tracking: `#732`, `#733`, `#734`, `#735`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785 |
| constraint-2 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785 |
| constraint-3 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785 |
| constraint-4 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785 |
| constraint-5 | 코드·회귀 근거 | src/components/v2/DesignRail.tsx:104-124; __tests__/designRailSlotBudget.test.tsx |
| constraint-6 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785 |
| constraint-7 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785 |
| constraint-8 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785 |
| constraint-9 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785 |
| constraint-10 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785 |
| acceptance-1 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785 |
| acceptance-2 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785 |
| acceptance-3 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785 |
| acceptance-4 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785 |
| acceptance-5 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785 |
| acceptance-6 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; src/components/v2/DesignRail.tsx:104-124 |
| acceptance-7 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785 |

이슈 근거:

- [732](https://github.com/Lyainc/filme/issues/732)
- [785](https://github.com/Lyainc/filme/issues/785)
- [733](https://github.com/Lyainc/filme/issues/733)
- [734](https://github.com/Lyainc/filme/issues/734)
- [735](https://github.com/Lyainc/filme/issues/735)

### emboss-zoom-max-viewmode

- Seed: `docs/specs/emboss-zoom-max-viewmode.yaml`
- 판정: `closed`/`discontinued`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: 형압 확대 작업면은 과거 구현됐으나 #785로 브러시·올가미·마스크가 의도적으로 제거됐으므로 종료한다. 남아 있는 최대 미리보기와 제거된 칠하기 요구를 구분한다.
- source: `null` · tracking: `#729`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 코드·회귀 근거 | src/components/v2/MobileEditorShell.tsx:247; src/components/v2/viewMode.tsx |
| constraint-2 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785; fa8d234db8b706901f60fa7f5da00865afb5541e |
| constraint-3 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785; fa8d234db8b706901f60fa7f5da00865afb5541e |
| constraint-4 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785; fa8d234db8b706901f60fa7f5da00865afb5541e |
| constraint-5 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785; fa8d234db8b706901f60fa7f5da00865afb5541e |
| constraint-6 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785; fa8d234db8b706901f60fa7f5da00865afb5541e |
| constraint-7 | 코드·회귀 근거 | src/components/v2/MobileEditorShell.tsx:674; src/components/v2/viewMode.tsx |
| constraint-8 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785; fa8d234db8b706901f60fa7f5da00865afb5541e |
| acceptance-1 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785; fa8d234db8b706901f60fa7f5da00865afb5541e |
| acceptance-2 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785; fa8d234db8b706901f60fa7f5da00865afb5541e |
| acceptance-3 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785; fa8d234db8b706901f60fa7f5da00865afb5541e |
| acceptance-4 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785; fa8d234db8b706901f60fa7f5da00865afb5541e |
| acceptance-5 | 후속 설계와 다름 | 10c9922c3404ef7d6771d05c73d46025b8dd4133; https://github.com/Lyainc/filme/issues/785; fa8d234db8b706901f60fa7f5da00865afb5541e |
| acceptance-6 | 미실행·미확인 | scripts/measure-chrome.mjs; __tests__/measureChromeBaselineCoupling.test.ts |

이슈 근거:

- [785](https://github.com/Lyainc/filme/issues/785)
- [729](https://github.com/Lyainc/filme/issues/729)

### failure-notice-and-tap-targets

- Seed: `docs/specs/failure-notice-and-tap-targets.yaml`
- 판정: `paused`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: #731의 알림 분리·CTA 피드백과 관련 회귀는 구현돼 있으나 실제 화면의 비겹침·프레임 적합성과 추천색 성공·실패 동선 확인이 남아 완료 판정을 보류한다.
- source: `null` · tracking: `#731`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 코드·회귀 근거 | https://github.com/Lyainc/filme/issues/731; src/components/ui/variants.ts:26 |
| constraint-2 | 코드·회귀 근거 | src/components/v2/MobileEditorShell.tsx:1404; src/components/v2/OcrUndoBanner.tsx:38; src/utils/errorToast.tsx |
| constraint-3 | 코드·회귀 근거 | src/components/v2/MobileEditorShell.tsx:1413; __tests__/ocrUndoRestore.test.tsx:650 |
| constraint-4 | 코드·회귀 근거 | src/components/ui/variants.ts:26; __tests__/pressableVariantsLiteralLock.test.ts |
| constraint-5 | 코드·회귀 근거 | src/components/ui/variants.ts:29; __tests__/pressableVariantsSpringMotion.test.ts:11 |
| constraint-6 | 코드·회귀 근거 | src/pages/index.tsx:76; src/pages/index.tsx:86 |
| constraint-7 | 코드·회귀 근거 | https://github.com/Lyainc/filme/issues/731; src/components/ui/variants.ts:26 |
| constraint-8 | 코드·회귀 근거 | https://github.com/Lyainc/filme/issues/731; src/components/ui/variants.ts:26 |
| constraint-9 | 코드·회귀 근거 | src/pages/index.tsx:86; docs/COPY_TONE_GUIDE.md |
| constraint-10 | 코드·회귀 근거 | src/components/v2/MobileEditorShell.tsx:1424; src/components/v2/PhoneFrame.tsx |
| acceptance-1 | 미실행·미확인 | src/components/v2/MobileEditorShell.tsx:1413; __tests__/ocrUndoRestore.test.tsx:650 |
| acceptance-2 | 코드·회귀 근거 | __tests__/a11yFieldTapAndTapTargets.test.tsx; __tests__/pressableVariantsLiteralLock.test.ts; src/pages/index.tsx:72; src/pages/_document.tsx |
| acceptance-3 | 코드·회귀 근거 | __tests__/pressableVariantsSpringMotion.test.ts:11 |
| acceptance-4 | 미실행·미확인 | src/pages/index.tsx:76; __tests__/errorToastPriority.test.tsx |
| acceptance-5 | 코드·회귀 근거 | src/pages/index.tsx:86; docs/specs/STATE_AUDIT.md#자동-검증 |
| acceptance-6 | 미실행·미확인 | scripts/measure-chrome.mjs:162; src/components/v2/MobileEditorShell.tsx:1413 |

이슈 근거:

- [731](https://github.com/Lyainc/filme/issues/731)

### filme-mobile-redesign-mockup

- Seed: `docs/specs/filme-mobile-redesign-mockup.yaml`
- 판정: `closed`/`discontinued`
- 코드 기준: `46798aa4949270c08d6a3a5a617418539d7e4389`
- 이유: 원안의 superseded_by와 v2 설계가 후속 대체를 명시하므로 v1 요구 묶음을 종료한다. 비교 자료는 보존하며 v2 작업을 이 Seed에서 재개하지 않는다.
- source: `null` · tracking: 없음

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 코드·회귀 근거 | docs/mockups/filme-mobile-v1/src/app.jsx; git:46798aa4949270c08d6a3a5a617418539d7e4389 |
| constraint-2 | 코드·회귀 근거 | docs/mockups/filme-mobile-v1/src/app.jsx; docs/mockups/filme-mobile-v1/src/styles.css; docs/mockups/filme-mobile-v1/README.md; docs/mockups/filme-mobile-v1/THIRD_PARTY.md |
| constraint-3 | 코드·회귀 근거 | docs/mockups/filme-mobile-v1/src/app.jsx; docs/mockups/filme-mobile-v1/src/styles.css; docs/mockups/filme-mobile-v1/README.md; docs/mockups/filme-mobile-v1/THIRD_PARTY.md |
| constraint-4 | 코드·회귀 근거 | docs/mockups/filme-mobile-v1/src/app.jsx; docs/mockups/filme-mobile-v1/src/styles.css; docs/mockups/filme-mobile-v1/README.md; docs/mockups/filme-mobile-v1/THIRD_PARTY.md |
| constraint-5 | 미실행·미확인 | docs/mockups/filme-mobile-v1/src/app.jsx; docs/mockups/filme-mobile-v1/src/styles.css; docs/mockups/filme-mobile-v1/README.md; docs/mockups/filme-mobile-v1/THIRD_PARTY.md |
| constraint-6 | 미실행·미확인 | docs/mockups/filme-mobile-v1/src/app.jsx; docs/mockups/filme-mobile-v1/src/styles.css; docs/mockups/filme-mobile-v1/README.md; docs/mockups/filme-mobile-v1/THIRD_PARTY.md |
| constraint-7 | 코드·회귀 근거 | docs/mockups/filme-mobile-v1/src/app.jsx; docs/mockups/filme-mobile-v1/src/styles.css; docs/mockups/filme-mobile-v1/README.md; docs/mockups/filme-mobile-v1/THIRD_PARTY.md |
| constraint-8 | 코드·회귀 근거 | docs/mockups/filme-mobile-v1/src/app.jsx; docs/mockups/filme-mobile-v1/src/styles.css; docs/mockups/filme-mobile-v1/README.md; docs/mockups/filme-mobile-v1/THIRD_PARTY.md |
| constraint-9 | 코드·회귀 근거 | docs/mockups/filme-mobile-v1/src/app.jsx; docs/mockups/filme-mobile-v1/src/styles.css; docs/mockups/filme-mobile-v1/README.md; docs/mockups/filme-mobile-v1/THIRD_PARTY.md |
| constraint-10 | 코드·회귀 근거 | docs/mockups/filme-mobile-v1/src/app.jsx; docs/mockups/filme-mobile-v1/src/styles.css; docs/mockups/filme-mobile-v1/README.md; docs/mockups/filme-mobile-v1/THIRD_PARTY.md |
| constraint-11 | 미실행·미확인 | docs/mockups/filme-mobile-v1/src/app.jsx; docs/mockups/filme-mobile-v1/src/styles.css; docs/mockups/filme-mobile-v1/README.md; docs/mockups/filme-mobile-v1/THIRD_PARTY.md |
| acceptance-1 | 미실행·미확인 | docs/mockups/filme-mobile-v1/README.md:39; docs/mockups/filme-mobile-v1/verification/report.json; docs/mockups/filme-mobile-v2/design.md:1 |
| acceptance-2 | 미실행·미확인 | docs/mockups/filme-mobile-v1/README.md:39; docs/mockups/filme-mobile-v1/verification/report.json; docs/mockups/filme-mobile-v2/design.md:1 |
| acceptance-3 | 미실행·미확인 | docs/mockups/filme-mobile-v1/README.md:39; docs/mockups/filme-mobile-v1/verification/report.json; docs/mockups/filme-mobile-v2/design.md:1 |
| acceptance-4 | 미실행·미확인 | docs/mockups/filme-mobile-v1/README.md:39; docs/mockups/filme-mobile-v1/verification/report.json; docs/mockups/filme-mobile-v2/design.md:1 |
| acceptance-5 | 미실행·미확인 | docs/mockups/filme-mobile-v1/README.md:39; docs/mockups/filme-mobile-v1/verification/report.json; docs/mockups/filme-mobile-v2/design.md:1 |
| acceptance-6 | 코드·회귀 근거 | docs/mockups/filme-mobile-v1/src/app.jsx:20; docs/mockups/filme-mobile-v1/README.md:23; docs/mockups/filme-mobile-v1/comparison.html |

이슈 근거:

- 세션 요청에서 작성됐거나 생성·구현 이슈가 미기록이에요. 외부 이슈를 추정해 만들지 않아요.

### kobis-title-search-result-redesign

- Seed: `docs/specs/kobis-title-search-result-redesign.yaml`
- 판정: `paused`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: 공용 영화 결과 행·메타데이터·상태 토큰은 구현돼 있으나 실제 모바일 키보드가 열린 상태의 최소 3행 노출과 현재 화면 측정이 남아 완료 판정을 보류한다.
- source: `null` · tracking: `#476`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 코드·회귀 근거 | src/components/v2/FieldEditorBody.tsx:262-272; src/hooks/useKobisSearch.ts |
| constraint-2 | 코드·회귀 근거 | fea076cf17e4bde341e9fbe79f1f8157af1e1c52; 511edc66d476d813ff447ef1e0b8f0fba73d5260 |
| constraint-3 | 코드·회귀 근거 | src/components/v2/InPlaceFieldEditor.tsx:200-223;573-580 |
| constraint-4 | 코드·회귀 근거 | src/components/v2/InPlaceFieldEditor.tsx:573-580; src/components/v2/FieldEditorBody.tsx:252-270 |
| constraint-5 | 코드·회귀 근거 | src/components/v2/InPlaceFieldEditor.tsx:223;519 |
| constraint-6 | 코드·회귀 근거 | 511edc66d476d813ff447ef1e0b8f0fba73d5260; src/components/v2/FieldEditorBody.tsx:209;231; src/components/v2/InPlaceFieldEditor.tsx:519 |
| acceptance-1 | 미실행·미확인 | src/components/v2/InPlaceFieldEditor.tsx:217-223; https://github.com/Lyainc/filme/issues/476#issuecomment-5035395579 |
| acceptance-2 | 코드·회귀 근거 | src/components/v2/FieldEditorBody.tsx:257-267; __tests__/inPlaceKobisResultRow.test.tsx:91-138; docs/specs/STATE_AUDIT.md#자동-검증 |
| acceptance-3 | 미실행·미확인 | src/components/v2/InPlaceFieldEditor.tsx:573-580; src/components/v2/FieldEditorBody.tsx:252-270 |

이슈 근거:

- [476](https://github.com/Lyainc/filme/issues/476)

### landing-always-visible-entry

- Seed: `docs/specs/landing-always-visible-entry.yaml`
- 판정: `paused`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: #727의 상시 랜딩·초안 복원·문서 교체와 대상 회귀는 검증됐으나 constraint-11 및 acceptance-8·acceptance-9의 새 프로덕션 빌드 실측이 남아 완료 판정을 보류한다.
- source: `null` · tracking: `#727`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 코드·회귀 근거 | src/components/v2/MobileEditorShell.tsx:1096; src/components/v2/Landing.tsx:376; __tests__/landingOverlay.test.tsx:83; __tests__/awaitingPosterRestore.test.tsx:67 |
| constraint-2 | 코드·회귀 근거 | src/components/v2/MobileEditorShell.tsx:1096; src/components/v2/Landing.tsx:376; __tests__/landingOverlay.test.tsx:83; __tests__/awaitingPosterRestore.test.tsx:67 |
| constraint-3 | 코드·회귀 근거 | src/components/v2/MobileEditorShell.tsx:1096; src/components/v2/Landing.tsx:376; __tests__/landingOverlay.test.tsx:83; __tests__/awaitingPosterRestore.test.tsx:67 |
| constraint-4 | 코드·회귀 근거 | src/components/v2/MobileEditorShell.tsx:1096; src/components/v2/Landing.tsx:376; __tests__/landingOverlay.test.tsx:83; __tests__/awaitingPosterRestore.test.tsx:67 |
| constraint-5 | 코드·회귀 근거 | src/components/v2/Landing.tsx:483; __tests__/landingOverlay.test.tsx:97 |
| constraint-6 | 코드·회귀 근거 | src/components/v2/Landing.tsx:491; __tests__/landingOverlay.test.tsx:97 |
| constraint-7 | 코드·회귀 근거 | src/hooks/usePhototicket.ts:838; src/components/v2/MobileEditorShell.tsx:622; __tests__/landingFreshStart.test.tsx:51 |
| constraint-8 | 코드·회귀 근거 | src/hooks/usePhototicket.ts:392; src/hooks/usePhototicket.ts:838; __tests__/awaitingPosterRestore.test.tsx:132 |
| constraint-9 | 코드·회귀 근거 | src/pages/_document.tsx:23; src/styles/globals.css:373; src/hooks/usePhototicket.ts:46; __tests__/landingPaintGate.test.tsx:44 |
| constraint-10 | 코드·회귀 근거 | https://github.com/Lyainc/filme/issues/717#issuecomment-5318662995; https://github.com/Lyainc/filme/issues/717#issuecomment-5346600196; https://github.com/Lyainc/filme/issues/717#issuecomment-5350344835 |
| constraint-11 | 미실행·미확인 | scripts/measure-chrome.mjs:436; https://github.com/Lyainc/filme/issues/727#issuecomment-5346806367 |
| constraint-12 | 코드·회귀 근거 | src/components/v2/Landing.tsx:488; __tests__/a11yFieldTapAndTapTargets.test.tsx |
| acceptance-1 | 코드·회귀 근거 | __tests__/landingOverlay.test.tsx:83; __tests__/awaitingPosterRestore.test.tsx:67 |
| acceptance-2 | 코드·회귀 근거 | __tests__/landingOverlay.test.tsx:97 |
| acceptance-3 | 코드·회귀 근거 | __tests__/landingOverlay.test.tsx:114; __tests__/landingFreshStart.test.tsx:112 |
| acceptance-4 | 코드·회귀 근거 | __tests__/landingFreshStart.test.tsx:51 |
| acceptance-5 | 코드·회귀 근거 | __tests__/awaitingPosterRestore.test.tsx:132 |
| acceptance-6 | 코드·회귀 근거 | src/components/v2/Landing.tsx:376; src/components/v2/MobileEditorShell.tsx:1096 |
| acceptance-7 | 코드·회귀 근거 | __tests__/landingPaintGate.test.tsx:44 |
| acceptance-8 | 미실행·미확인 | scripts/measure-chrome.mjs:436; scripts/measure-chrome.mjs:962 |
| acceptance-9 | 미실행·미확인 | scripts/measure-chrome.mjs:436; scripts/measure-chrome.mjs:461 |

이슈 근거:

- [727](https://github.com/Lyainc/filme/issues/727)

### landing-mood-first-ocr-entry

- Seed: `docs/specs/landing-mood-first-ocr-entry.yaml`
- 판정: `paused`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: 무드 선택·OCR 진입 구현은 존재하지만 시각 실측과 전체 불변식 근거가 남아 완료 판정을 보류한다. draft 생략·inline·옛 크롬 수치와 폐기된 TMDB 체인은 현행 요구로 재활성화하지 않는다.
- source: `null` · tracking: `#615`, `#635`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 코드·회귀 근거 | src/components/moods/_shared.tsx:1185; __tests__/posterFitMoodRender.test.tsx |
| constraint-2 | 코드·회귀 근거 | __tests__/landingHeroMood.test.tsx:55; src/components/v2/Landing.tsx:501 |
| constraint-3 | 미실행·미확인 | public/assets/landing/README.md; src/components/v2/Landing.tsx:60 |
| constraint-4 | 미실행·미확인 | scripts/measure-chrome.mjs:211 |
| constraint-5 | 후속 설계와 다름 | src/components/v2/Landing.tsx:357; git:3f08a1c |
| constraint-6 | 후속 설계와 다름 | src/components/v2/Landing.tsx:501; src/components/v2/Landing.tsx:518 |
| constraint-7 | 미실행·미확인 | https://github.com/Lyainc/filme/issues/635 |
| acceptance-1 | 미실행·미확인 | src/components/v2/MobileEditorShell.tsx:1139; __tests__/ocrUndoRestore.test.tsx |
| acceptance-2 | 코드·회귀 근거 | __tests__/landingHeroMood.test.tsx:55; __tests__/landingOverlay.test.tsx:129; __tests__/ocrUndoRestore.test.tsx |
| acceptance-3 | 미실행·미확인 | scripts/measure-chrome.mjs; package.json |

이슈 근거:

- [615](https://github.com/Lyainc/filme/issues/615)
- [635](https://github.com/Lyainc/filme/issues/635)

### logo-stamp-scale-control

- Seed: `docs/specs/logo-stamp-scale-control.yaml`
- 판정: `paused`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: 상태·배율·슬라이더·undo·저장 회귀는 통과했으나 기본값 픽셀 동일성·6무드 극단값 배치·프리뷰와 JPEG 대조가 남아 완료 판정을 보류한다.
- source: `#441` · tracking: `#441`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 코드·회귀 근거 | src/types/index.ts:100-102; src/hooks/usePhototicket.ts:167-168 |
| constraint-2 | 코드·회귀 근거 | src/components/moods/_shared.tsx:731-798 |
| constraint-3 | 코드·회귀 근거 | src/components/moods/MoodMinimal.tsx:210-215; src/components/moods/MoodCriterion.tsx:431-436; src/components/moods/_shared.tsx:2018; __tests__/logoStampScale.test.tsx:83-88; docs/specs/STATE_AUDIT.md#자동-검증 |
| constraint-4 | 코드·회귀 근거 | src/components/moods/_shared.tsx:783; __tests__/logoStampScale.test.tsx:54-69; docs/specs/STATE_AUDIT.md#자동-검증 |
| constraint-5 | 코드·회귀 근거 | src/components/v2/designRailItems.tsx:79-84; __tests__/logoStampScale.test.tsx:120-173; docs/specs/STATE_AUDIT.md#자동-검증 |
| constraint-6 | 코드·회귀 근거 | src/hooks/usePhototicket.ts:639-687; __tests__/logoStampScale.test.tsx:178-223; docs/specs/STATE_AUDIT.md#자동-검증 |
| constraint-7 | 코드·회귀 근거 | 353031bbd38625e0a68979ee0cfc1f13fe4b0873; 907c65d2cfc123879b831ad1e38ff32b3b3ee714; https://github.com/Lyainc/filme/issues/441#issuecomment-5039836069 |
| s1 | 코드·회귀 근거 | __tests__/logoStampScale.test.tsx:120-173; docs/specs/STATE_AUDIT.md#자동-검증 |
| s2 | 미실행·미확인 | __tests__/logoStampScale.test.tsx:66-69 |
| s3 | 미실행·미확인 | __tests__/stampWidthCap.test.tsx; src/components/v2/designRailItems.tsx:83-84 |
| s4 | 코드·회귀 근거 | __tests__/logoStampScale.test.tsx:178-223; docs/specs/STATE_AUDIT.md#자동-검증 |
| s5 | 미실행·미확인 | src/components/moods/_shared.tsx:775-790 |
| s6 | 미실행·미확인 | docs/specs/STATE_AUDIT.md#자동-검증 |

이슈 근거:

- [441](https://github.com/Lyainc/filme/issues/441)

### mood-redesign-v5

- Seed: `docs/specs/mood-redesign-v5.yaml`
- 판정: `paused`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: 무드 골격과 관련 회귀는 구현돼 있으나 시안·JPEG·브라우저 육안 대조 및 역사적 PR 조건 근거가 남아 완료 판정을 보류한다. 제거된 썸네일과 이후 색상 정책을 옛 미구현으로 복원하지 않는다.
- source: `#524` · tracking: `#524`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 후속 설계와 다름 | src/components/moods/MoodCriterion.tsx:81; src/components/moods/MoodCriterion.tsx:143; git:f853d30e99c914add4f3ecebaa52dd01407f9582 |
| constraint-2 | 코드·회귀 근거 | src/components/moods/_shared.tsx:1595; __tests__/mood35mmWideResync.test.tsx:68 |
| constraint-3 | 코드·회귀 근거 | src/components/moods/_shared.tsx:1901; src/components/moods/MoodCriterion.tsx:173; __tests__/onTicketFieldTap.test.tsx:267; __tests__/moodCriterionResync.test.tsx:89 |
| constraint-4 | 후속 설계와 다름 | src/utils/layouts.ts; __tests__/mood35mmWideResync.test.tsx:31 |
| constraint-5 | 코드·회귀 근거 | src/components/moods/_shared.tsx:2021; __tests__/moodCriterionResync.test.tsx:108 |
| constraint-6 | 코드·회귀 근거 | src/components/moods/_shared.tsx:1921; src/components/moods/MoodCriterion.tsx:216 |
| constraint-7 | 코드·회귀 근거 | src/components/moods/MoodCriterion.tsx:72; src/components/moods/MoodCriterion.tsx:322; __tests__/moodCriterionResync.test.tsx:46 |
| constraint-8 | 코드·회귀 근거 | src/components/moods/_shared.tsx; __tests__/inkColorFidelity.test.tsx |
| constraint-9 | 후속 설계와 다름 | src/components/LayoutPicker.tsx:31; src/components/LayoutPicker.tsx:57; git:ad98d51 |
| constraint-10 | 코드·회귀 근거 | __tests__/inkColorFidelity.test.tsx:14 |
| constraint-11 | 미실행·미확인 | git:94e2d68; git:cb30c53; git:31e093e; git:f853d30e99c914add4f3ecebaa52dd01407f9582; https://github.com/Lyainc/filme/issues/524 |
| constraint-12 | 미실행·미확인 | __tests__/moodMinimalResync.test.tsx; __tests__/moodEditorialResync.test.tsx; __tests__/moodStubResync.test.tsx; git:f853d30e99c914add4f3ecebaa52dd01407f9582 |
| constraint-13 | 코드·회귀 근거 | src/components/moods/MoodCriterion.tsx:149; git:f853d30e99c914add4f3ecebaa52dd01407f9582 |
| acceptance-1 | 코드·회귀 근거 | __tests__/onTicketFieldTap.test.tsx:267; __tests__/moodCriterionResync.test.tsx:89 |
| acceptance-2 | 미실행·미확인 | scripts/capture-export.mjs; https://github.com/Lyainc/filme/issues/524 |
| acceptance-3 | 미실행·미확인 | https://github.com/Lyainc/filme/issues/524; src/components/moods/MoodCriterion.tsx:143 |
| acceptance-4 | 미실행·미확인 | package.json; docs/specs/STATE_AUDIT.md#자동-검증 |
| acceptance-5 | 미실행·미확인 | __tests__/moodMinimalResync.test.tsx; __tests__/moodEditorialResync.test.tsx; __tests__/moodStubResync.test.tsx |
| acceptance-6 | 미실행·미확인 | src/components/LayoutPicker.tsx:31 |

이슈 근거:

- [524](https://github.com/Lyainc/filme/issues/524)

### signature-image-upload

- Seed: `docs/specs/signature-image-upload.yaml`
- 판정: `paused`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: 공용 이미지·텍스트 편집과 6무드 렌더는 구현돼 있으나 수동 업로드·배율·JPEG 검증이 남아 완료 판정을 보류한다. constraint-6·s4의 옛 시트·캐럿 규칙은 최초 구현부터 현재 테스트와 달라 별도 판단이 필요하며 자동 복원하지 않는다.
- source: `#484` · tracking: `#484`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 코드·회귀 근거 | src/types/index.ts:123-125; src/hooks/usePhototicket.ts:169-170 |
| constraint-2 | 코드·회귀 근거 | src/components/v2/FieldEditorBody.tsx:452-485;571-615; __tests__/fieldSheets.test.tsx:175-257; docs/specs/STATE_AUDIT.md#자동-검증 |
| constraint-3 | 코드·회귀 근거 | src/components/v2/FieldEditorBody.tsx:592-615; src/components/v2/InPlaceFieldEditor.tsx:153-157 |
| constraint-4 | 코드·회귀 근거 | src/components/moods/_shared.tsx:2005-2010; src/components/v2/FieldEditorBody.tsx:497-501; __tests__/fieldSheets.test.tsx:241-249; docs/specs/STATE_AUDIT.md#자동-검증 |
| constraint-5 | 코드·회귀 근거 | src/components/moods/MoodMinimal.tsx:339-343; src/components/moods/MoodCriterion.tsx:397-399; src/components/moods/MoodEditorial.tsx:434-438; src/components/moods/MoodStub.tsx:486-492; src/components/moods/_shared.tsx:2005-2008 |
| constraint-6 | 후속 설계와 다름 | src/components/v2/InPlaceFieldEditor.tsx:153-157;301-306;452-457;552-563; __tests__/inPlaceFieldEditor.test.tsx:174-195; 907c65d2cfc123879b831ad1e38ff32b3b3ee714 |
| constraint-7 | 코드·회귀 근거 | src/components/v2/FieldEditorBody.tsx:602; __tests__/fieldSheets.test.tsx:233; docs/specs/STATE_AUDIT.md#자동-검증 |
| s1 | 코드·회귀 근거 | src/types/index.ts:123-125; src/hooks/usePhototicket.ts:169-170 |
| s2 | 미실행·미확인 | src/components/v2/FieldEditorBody.tsx:452-615; __tests__/fieldSheets.test.tsx; docs/specs/STATE_AUDIT.md#자동-검증 |
| s3 | 미실행·미확인 | src/components/moods/_shared.tsx:2005-2008; src/components/moods/MoodMinimal.tsx:339-343 |
| s4 | 후속 설계와 다름 | __tests__/inPlaceFieldEditor.test.tsx:176-194; docs/specs/STATE_AUDIT.md#자동-검증 |
| s5 | 코드·회귀 근거 | __tests__/editHistory.test.tsx:171-188; src/hooks/usePhototicket.ts:639-687; __tests__/draftImageRestore.test.tsx:103-133; docs/specs/STATE_AUDIT.md#자동-검증 |
| s6 | 미실행·미확인 | docs/specs/STATE_AUDIT.md#자동-검증 |

이슈 근거:

- [484](https://github.com/Lyainc/filme/issues/484)

### texture-intensity-refinement

- Seed: `docs/specs/texture-intensity-refinement.yaml`
- 판정: `closed`/`discontinued`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: 단일 texture·textureIntensity 원안은 #475의 재질·코팅 2축과 독립 강도, #471·#506의 레시피·공유 합성으로 대체됐으므로 원 요구 묶음을 종료한다.
- source: `null` · tracking: `#434`, `#471`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 코드·회귀 근거 | src/utils/captureToImage.ts:860-880; __tests__/captureComposite.test.ts:284-370 |
| constraint-2 | 코드·회귀 근거 | src/utils/textureRecipes.ts:77-176; src/components/moods/_shared.tsx:1297-1382 |
| constraint-3 | 후속 설계와 다름 | src/types/index.ts:85-92; src/components/v2/designRailItems.tsx:342-365; 59f7b19f9484d1aa7980ca5d78b39bd7a9b4679e |
| constraint-4 | 미실행·미확인 | src/utils/captureToImage.ts:596-644; src/components/moods/_shared.tsx:1297-1382 |
| constraint-5 | 미실행·미확인 | src/components/moods/_shared.tsx:1107-1251; src/components/moods/MoodMinimal.tsx:190; src/components/moods/MoodCriterion.tsx:267; src/components/moods/Mood35mm.tsx:100; src/components/moods/Mood35mmLandscape.tsx:106; src/components/moods/MoodEditorial.tsx:303; src/components/moods/MoodStub.tsx:273 |
| constraint-6 | 후속 설계와 다름 | src/types/index.ts:85-92; src/utils/textureRecipes.ts:217-240; src/hooks/usePhototicket.ts:620-653 |
| constraint-7 | 후속 설계와 다름 | src/utils/textureRecipes.ts:77-176; src/components/moods/_shared.tsx:1297-1382; src/utils/captureToImage.ts:596-644 |
| acceptance-1 | 미실행·미확인 | https://github.com/Lyainc/filme/issues/475; src/utils/textureRecipes.ts:20-22 |
| acceptance-2 | 미실행·미확인 | __tests__/textureRecipes.test.ts:23-35; src/components/v2/designRailItems.tsx:360-365 |
| acceptance-3 | 미실행·미확인 | src/utils/textureRecipes.ts:77-176 |
| acceptance-4 | 미실행·미확인 | src/components/moods/_shared.tsx:1107-1251 |
| acceptance-5 | 후속 설계와 다름 | src/hooks/usePhototicket.ts:620-653; __tests__/usePhototicketPersistence.test.tsx:218 |

이슈 근거:

- [475](https://github.com/Lyainc/filme/issues/475)
- [471](https://github.com/Lyainc/filme/issues/471)
- [434](https://github.com/Lyainc/filme/issues/434)

### texture-material-coating-2axis

- Seed: `docs/specs/texture-material-coating-2axis.yaml`
- 판정: `paused`
- 코드 기준: `24eb36e91eb48d9dca0ec5227508bd48ad28df1c`
- 이유: 2축 모델·독립 강도·마이그레이션·공유 합성은 구현돼 있으나 실제 iOS·옵션 구분감 승인·프리뷰와 JPEG 대조가 남아 완료 판정을 보류한다. 옛 공유 링크 상태 직렬화와 두 셸 전제는 현행 JPEG 공유·단일 셸에 자동 적용하지 않는다.
- source: `null` · tracking: `#475`

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 후속 설계와 다름 | src/types/index.ts:85-92; src/hooks/usePhototicket.ts:150-160; src/hooks/usePhototicket.ts:620-691; src/pages/api/ticket.ts:40-46; src/pages/api/ticket.ts:86-110; src/pages/t/[id].tsx:50-74 |
| constraint-2 | 코드·회귀 근거 | src/components/moods/_shared.tsx:1248-1251; src/utils/captureToImage.ts:860-880; __tests__/captureComposite.test.ts:338 |
| constraint-3 | 코드·회귀 근거 | src/components/moods/_shared.tsx:1125-1127; src/components/moods/_shared.tsx:1248-1251; src/utils/captureToImage.ts:848-880 |
| constraint-4 | 코드·회귀 근거 | src/utils/textureRecipes.ts:198-240; __tests__/textureRecipes.test.ts:73-105; __tests__/usePhototicketPersistence.test.tsx:218 |
| constraint-5 | 코드·회귀 근거 | src/utils/captureToImage.ts:596; src/components/moods/_shared.tsx:1317; src/components/moods/_shared.tsx:1379; __tests__/textureRecipes.test.ts:23 |
| constraint-6 | 코드·회귀 근거 | src/utils/constants.ts:45-58; src/components/v2/designRailItems.tsx:342-365 |
| constraint-7 | 후속 설계와 다름 | src/components/v2/designRailItems.tsx:342-395; src/components/v2/MobileEditorShell.tsx |
| constraint-8 | 미실행·미확인 | src/utils/textureRecipes.ts:77-176; __tests__/textureRecipes.test.ts:64 |
| constraint-9 | 미실행·미확인 | src/utils/textureRecipes.ts:52-65; src/utils/captureToImage.ts:612; https://github.com/Lyainc/filme/issues/475 |
| constraint-10 | 미실행·미확인 | __tests__/textureRecipes.test.ts; __tests__/captureComposite.test.ts; src/components/moods/_shared.tsx:1107 |
| acceptance-1 | 미실행·미확인 | src/components/moods/_shared.tsx:1248-1251; src/utils/captureToImage.ts:860-880; __tests__/captureComposite.test.ts:338 |
| acceptance-2 | 미실행·미확인 | src/components/v2/designRailItems.tsx:342-365; __tests__/textureRecipes.test.ts:23; src/utils/captureToImage.ts:596 |
| acceptance-3 | 미실행·미확인 | __tests__/textureRecipes.test.ts:64; src/utils/textureRecipes.ts:77-176 |
| acceptance-4 | 미실행·미확인 | __tests__/textureRecipes.test.ts:73-105; __tests__/usePhototicketPersistence.test.tsx:218; src/pages/t/[id].tsx:50-74 |
| acceptance-5 | 미실행·미확인 | __tests__/textureRecipes.test.ts:108-128; 59f7b19f9484d1aa7980ca5d78b39bd7a9b4679e; ff110da4954648725f9a4e64ea169831643e391c |
| acceptance-6 | 미실행·미확인 | https://github.com/Lyainc/filme/issues/475; src/utils/captureToImage.ts:612 |

이슈 근거:

- [475](https://github.com/Lyainc/filme/issues/475)
- [471](https://github.com/Lyainc/filme/issues/471)

### seed

- Seed: `docs/mockups/filme-mobile-v2/seed.yaml`
- 판정: `paused`
- 코드 기준: `46798aa4949270c08d6a3a5a617418539d7e4389`
- 이유: 목업 구현과 기존 Chrome 검증 기록은 존재하지만 acceptance-5의 사용자 최종 사용성 검토가 미완료여서 완료 판정을 보류한다. 로컬 목업 전용이며 프로덕션 재설계 승인으로 확대하지 않는다.
- source: `null` · tracking: 없음

| 항목 | 판정 | 확인 위치 |
| --- | --- | --- |
| constraint-1 | 코드·회귀 근거 | docs/mockups/filme-mobile-v2/src/app.jsx; docs/mockups/filme-mobile-v2/src/LiveTicket.jsx; docs/mockups/filme-mobile-v2/verification/branch-split.md |
| constraint-2 | 코드·회귀 근거 | docs/mockups/filme-mobile-v2/tokens.css; docs/mockups/filme-mobile-v2/src/app.jsx |
| constraint-3 | 코드·회귀 근거 | docs/mockups/filme-mobile-v2/design.md; docs/mockups/filme-mobile-v2/src/app.jsx; docs/mockups/filme-mobile-v2/src/LiveTicket.jsx |
| constraint-4 | 코드·회귀 근거 | docs/mockups/filme-mobile-v2/src/Landing.jsx; docs/mockups/filme-mobile-v2/src/landing.css; docs/mockups/filme-mobile-v2/verification/seed-audit.md |
| constraint-5 | 미실행·미확인 | docs/mockups/filme-mobile-v2/src/styles.css; docs/mockups/filme-mobile-v2/verification/mobile-report.json |
| constraint-6 | 미실행·미확인 | docs/mockups/filme-mobile-v2/src/styles.css; docs/mockups/filme-mobile-v2/verification/refinement-report.json |
| constraint-7 | 코드·회귀 근거 | docs/mockups/filme-mobile-v2/src/app.jsx; docs/mockups/filme-mobile-v2/README.md |
| acceptance-1 | 미실행·미확인 | docs/mockups/filme-mobile-v2/design.md; docs/mockups/filme-mobile-v2/verification/seed-audit.md |
| acceptance-2 | 미실행·미확인 | docs/mockups/filme-mobile-v2/verification/mobile-report.json; docs/mockups/filme-mobile-v2/verification/refinement-report.json |
| acceptance-3 | 미실행·미확인 | docs/mockups/filme-mobile-v2/src/app.jsx; docs/mockups/filme-mobile-v2/src/LiveTicket.jsx; docs/mockups/filme-mobile-v2/verification/mobile-report.json |
| acceptance-4 | 미실행·미확인 | docs/mockups/filme-mobile-v2/verification/experience-report.json; docs/mockups/filme-mobile-v2/verification/redesign-report.json |
| acceptance-5 | 미실행·미확인 | docs/mockups/filme-mobile-v2/verification/seed-audit.md |
| acceptance-6 | 미실행·미확인 | docs/mockups/filme-mobile-v2/src/app.jsx; docs/mockups/filme-mobile-v2/verification/refinement-report.json |
| acceptance-7 | 미실행·미확인 | docs/mockups/filme-mobile-v2/src/styles.css; docs/mockups/filme-mobile-v2/verification/refinement-report.json |

이슈 근거:

- 세션 요청에서 작성됐거나 생성·구현 이슈가 미기록이에요. 외부 이슈를 추정해 만들지 않아요.
