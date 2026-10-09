# FILME 모바일 편집 목업

> **2026-09-24 v7 반영 상태의 v2 로컬 목업 기록이에요.** 아래 “현재”·“최신”과 검증 결과는 당시 목업 상태를 가리켜요. 프로덕션 적용 승인이나 Seed 생애주기 완료를 뜻하지 않으며 샘플 동작·실기기·사용자 평가의 검증 경계를 유지해요. [명세 안내](../../specs/README.md)를 확인해요.

```sh
# 새 체크아웃에서 재빌드할 때: 루트 의존성 + v1의 shadcn 의존성
bun install
bun install --cwd docs/mockups/filme-mobile-v1
bun docs/mockups/filme-mobile-v2/build.mjs
bun docs/mockups/filme-mobile-v2/serve.mjs
# 별도 터미널
bun docs/mockups/filme-mobile-v2/verify-experience.mjs
bun docs/mockups/filme-mobile-v2/verify-redesign.mjs
bun docs/mockups/filme-mobile-v2/verify-mobile.mjs
bun docs/mockups/filme-mobile-v2/verify-refinement.mjs
```

열기: http://127.0.0.1:3793/docs/mockups/filme-mobile-v2/index.html

[설계·기능 보존 표·레퍼런스·검증 경계](./design.md). v1은 비교용으로 보존해요. v1의 shadcn Button/Input/Dialog, 아이콘과 토큰을 재사용하고 추가 패키지는 설치하지 않았어요. 변경 후 build로 번들을 갱신해요.

최신 증거는 `verification/experience-report.json`, `verification/redesign-report.json`, `verification/mobile-report.json`, `verification/refinement-report.json`, `verification/v7-*.png`예요. Chrome 모바일 크기 및 VisualViewport 모사 결과이며 실제 iPhone Safari 검증은 아니에요. 이전 report/live-report와 v3/v4/v5/v6 PNG는 이전 버전의 증거예요. `verify.mjs`와 `verify-live.mjs`는 기존 명령 호환용으로 최신 검증에 연결돼요.

감상용 자동 캐러셀, 편집→완료→공유 전환, 티켓을 보며 입력하는 하단 패널, 출처 표시, 꾸미기, 이미지 업로드·자르기, 실행 취소, 임시 저장은 실제로 동작해요. OCR·영화 검색·JPEG 저장·OS 공유는 샘플이에요. 프로덕션/API/기존 티켓 조판은 변경하지 않아요.

티켓 서체는 현재 앱과 같아요. 기존 Next 빌드의 Google Fonts 파일을 `fonts/`로 복사하고 OFL 라이선스 5개를 함께 포함해요. 한글 로컬 폰트는 `public/fonts`와 [라이선스](../../../public/fonts/LICENSES.md)를 재사용해요. 선택 서체 전체를 선로딩하지 않아요. UI 라이선스는 [v1 THIRD_PARTY.md](../filme-mobile-v1/THIRD_PARTY.md)에 있어요.

현재 v7 반영 명세: `docs/mockups/filme-mobile-v2/seed.yaml` (브랜치에 보존된 명세). 요구사항별 구현 대응은 design.md에 남겼어요.

[Seed 최종 점검](./verification/seed-audit.md): r1–r16 대조, 두 결함 수정, Chrome 검증 40개와 실기기/사용성 평가의 검증 경계를 기록했어요.

목업은 `main` 기반 `feat/mobile-editor-mockups` 브랜치에 분리했어요. 최신 명세는 [seed.yaml](./seed.yaml)에 보존했어요. Criterion의 한 줄 기록은 목업의 그룹 입력에서 노출하며, 프로덕션 항목 목록의 제외 규칙에 의존하지 않아요. [브랜치 분리 기록](./verification/branch-split.md)에 보존 범위와 확인 결과를 남겼어요.
