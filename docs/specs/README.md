# 명세와 Seed 안내

기존 Seed는 thinking-tools **6.0.0 호환 계약**으로 읽고 수정해요. 현재 구현은 [CLAUDE.md](../../CLAUDE.md), [README](../../README.md), 코드와 테스트를 기준으로 확인해요. [상태·이슈 연결 진단](STATE_AUDIT.md)은 프로덕션 main `24eb36e`와 목업 브랜치 `46798aa`를 구분한 2026-10-10 근거예요. 이 목록은 구현 백로그나 다음 기능 로드맵이 아니에요.

## 읽기와 변경 계약

- 명명된 Seed는 먼저 `seed-relations.py metadata <path> --json`으로 확인하고 필요한 본문만 읽어요.
- 상태 현행화 지시에 따라 20개 모두 `lifecycle`을 기록했어요. 2026-10-10 진단은 **closed/discontinued 9개·paused 11개·unknown 0개**예요. 전체 항목 충족을 확인한 `completed` 판정은 없어요. 이슈 닫힘·코드 존재를 완료로 읽지 않고 생애주기는 각 Seed의 메타데이터를 먼저 확인해요. 보류·종료 요구는 자동 작업 후보에서 제외하며, 보류 재개는 승인 후 active 전환, 종료 기록 재사용은 새 Seed로 처리해요.
- `version`과 `generated`는 생성 당시 스킬 버전·날짜예요. 호환 정리를 새 인터뷰나 재생성으로 표현하지 않으며 `schema_version: 1`은 그대로예요. 각 파일 머리말이 6.0.0 호환과 현재 적용 경계를 표시해요.
- 제약·성공 기준·판단 근거는 작성 당시 요구를 보존해요. `context.integration_points`는 이 체크아웃을 기준으로 정리한 파일·심볼 위치이며, 프로덕션 상태 판정은 진단 문서의 고정 SHA를 따라요. 나머지 context·백로그 수·실측값은 원래 조사 기록이에요. 테스트 경로는 검증 방법 안내이며 실행 성공 기록이 아니에요.
- `c<N>`/`ac<N>`는 공식 `seed-id-migrate.py`로 `constraint-<N>`/`acceptance-<N>`로 옮겼어요. 번호와 항목 내용은 유지해요. 본문 안의 옛 짧은 표기는 당시 설명이며 같은 번호의 항목을 가리켜요. `s1` 등은 마이그레이터 지원 밖의 기존 ID라 보존해요.
- 기존 확장 필드는 의미를 보존해요. 생애주기 도입의 엄격한 파서에서 거부되던 다중 행 목록·flow mapping은 지원되는 표현으로 정규화했고, 목업 우선순위는 같은 한국어 label·weight 기록으로 바꿨어요. inline `#`로 잘리던 값 6곳도 따옴표로 복구했어요. 새 필드는 설치된 `templates/SEED_SPEC.yaml`의 허용 목록을 따라요. 목업 v2의 `requirements`에 있는 `r1`~`r16`은 기존 확장이고 관계 도구의 항목 조회 대상이 아니에요. 목업 Seed 본문과 [설계 대응표](../mockups/filme-mobile-v2/design.md)를 직접 대조해요.
- `issues.source`는 옛 `issue` 4개(#441·#474·#484·#510)와 명시된 source_session의 #524를 기록해 5개예요. 나머지 15개는 생성 출처 미기록이며 null을 유지해요. `tracking`은 실제 구현 이슈를 확인한 18개에 기록했고, 세션에서 작성된 두 목업은 비워둬요. 선행·참고·제거·대체 이슈는 구현 tracking에 섞지 않아요. Seed 간 부모·자식·이관 관계는 추정하지 않았어요.
- 상태를 승인받아 변경할 때는 수정 전 파일을 보존하고 `seed-lifecycle.py check <seed> --before <prior-file>`, `seed-relations.py check <seed>`로 검증해요. 종료 기록은 동결하고 새 작업은 선택 항목과 고정 출처를 가진 새 Seed로 만들어요.

계약의 원본은 사용 중인 thinking-tools 6.0.0의 `reference/common-schema.md`, `reference/identifiers.md`, `reference/seed-lifecycle.md`, `skills/build-spec/templates/SEED_SPEC.yaml`이에요. 프로젝트에서 별도 생애주기 규칙을 만들지 않아요.

## 활성 잔여 검증

[모바일 실기기 검증](mobile-device-verification.yaml)은 2026-10-11 승인한 독립 active Seed예요. #777·#779·#768·#585의 잔여 검증을 acceptance-1~4로 연결하고, 공통 증거와 경로 연결은 acceptance-5~6에 정의해요. 실제 기기와 조작자가 필요하며 active를 실기기 PASS나 즉시 실행 가능으로 읽지 않아요. 기존 20개는 재개하지 않았어요.

## 기존 20개 Seed 목록과 현재 적용 경계

| Seed | 상태 | 현재 구현과 구분할 내용 |
| --- | --- | --- |
| [배경 이미지 배율](background-image-scale-control.yaml) | closed/discontinued | 전면 cover·PATTERN_CLIP는 과거 구조예요. 현재 고정 스탬프 박스 안 이미지 배율은 1.0~1.5예요. |
| [배경 → 스탬프](background-to-stamp.yaml) | paused | opacity 0.2~1.0, 첫 업로드 0.5예요. Stub은 실제 spacer를 측정하고 박스와 이미지 두 겹을 사용해요. |
| [인쇄 도안](calibration-print-mood.yaml) | closed/discontinued | 당시 /calibration 페이지 요구예요. 현재 도구는 Python/Chrome 스크립트예요. |
| [컬러 입력·접근성](color-picker-hex-removal.yaml) | paused | hex 제거와 radio 계약은 코드에 있어요. 패널 높이·native picker 실기기는 별도 검증 대상이에요. |
| [크롭 세로 맞춤](crop-modal-vertical-fit.yaml) | closed/discontinued | 수정 전 실측과 stub 고정 예외는 역사 자료예요. 현재는 공통 contain·원본 비율 토글을 사용해요. |
| [커스텀 한줄평](design-rail-custom-quote.yaml) | closed/discontinued | 4택·한글 serif 잠금에서 9택·6무드 서명 폰트로 바뀌었어요. |
| [레일 항목 레지스트리](design-rail-item-registry.yaml) | closed/discontinued | desktop surface는 사라졌고 단일 셸의 RAIL_ITEMS·DesignRail이 소비해요. |
| [형압·하이라이트 분리](emboss-highlight-split.yaml) | closed/discontinued | 형압·하이라이트는 프로덕션 기준 main에서 #785로 제거됐어요. 과거 구현을 현재 누락으로 되살리지 않아요. |
| [형압 확대](emboss-zoom-max-viewmode.yaml) | closed/discontinued | 형압 칠하기 작업면은 #785로 제거됐어요. 현재 최대 미리보기와 과거 형압 확대 요구를 구분해요. |
| [알림·탭 피드백](failure-notice-and-tap-targets.yaml) | paused | undo/toast 위치 분리와 CTA spring이 있어요. iOS 조사를 현재 로드맵으로 적용하지 않아요. |
| [모바일 목업 v1](filme-mobile-redesign-mockup.yaml) | closed/discontinued | 고정 이미지 목업의 역사적 요구예요. superseded는 생애주기 종료나 부모 관계가 아니에요. |
| [KOBIS 결과](kobis-title-search-result-redesign.yaml) | paused | 두 편집 경로가 공용 결과 행을 써요. 모바일 한정 원안과 iOS 가시 행 실측을 구분해요. |
| [상시 랜딩·초안 복원](landing-always-visible-entry.yaml) | paused | overlay/hidden·복원·새 문서 경로가 있어요. 이슈 상태와 첫 페인트 실측을 추정하지 않아요. |
| [무드·OCR 진입](landing-mood-first-ocr-entry.yaml) | paused | draft 생략·inline·옛 크롬 수치는 과거예요. 선택 layout은 문서에 커밋하며 TMDB 체인은 재활성화하지 않아요. |
| [로고 크기](logo-stamp-scale-control.yaml) | paused | 상한은 Minimal 1.1·나머지 1.3이에요. raw 값과 IndexedDB 이미지 복원을 보존해요. |
| [무드 v5](mood-redesign-v5.yaml) | paused | 세로·가로 캔버스와 포스터 방향은 별개예요. 옛 썸네일·색상 미게이팅은 당시 요구예요. |
| [서명 이미지](signature-image-upload.yaml) | paused | 6무드 렌더·저장·복원이 있어요. 현재 온티켓 칩과 이미지 없는 텍스트 input도 제공해요. |
| [후가공 강도](texture-intensity-refinement.yaml) | closed/discontinued | 단일 textureIntensity 원안에서 독립 재질·코팅 상태와 공유 bitmap SVG로 바뀌었어요. |
| [재질·코팅 2축](texture-material-coating-2axis.yaml) | paused | 4재질×5코팅이며 공유는 JPEG예요. 강도 0에서도 재질 필터는 남아요. |
| [모바일 목업 v2](../mockups/filme-mobile-v2/seed.yaml) | paused | 로컬 목업 전용이에요. r1~r16·기존 status를 생애주기 완료나 프로덕션 승인으로 읽지 않아요. |

## 다른 설계 문서

- [한줄평·서명 폰트](quote-signature-font-selection.md)는 현재 9택·독립 상태·6무드 배선 안내예요.
- [인쇄 캘리브레이션](../PRINT_CALIBRATION.md)은 현재 Python/Chrome 도구와 날짜가 있는 실물 기록을 보존해요. 과거 기하 배경 규칙은 현재 사진 스탬프에 자동 적용하지 않아요.
- [PRD](../PRD.md), [디자인 시스템](../DESIGN_SYSTEM.md), [iOS 조사](../NATIVE_IOS_RFC.md), [v8 handoff](../design_handoff_editor_chrome_v8/README.md)는 역사적 설계·조사 자료예요. 현재 요구사항이나 착수 승인으로 적용하지 않아요.
- [v1 목업](../mockups/filme-mobile-v1/README.md)·[v2 목업](../mockups/filme-mobile-v2/README.md)의 기능 제거·라이트 테마·샘플 동작은 프로덕션 요구사항이 아니에요. 보고서는 당시 실행 결과이며 이번 명세 정리에서 재실행한 결과가 아니에요.
