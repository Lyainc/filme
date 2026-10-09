# FILME 모바일 디자인 목업

> **2026-09-22 v1 독립 목업의 실행 안내와 검증 기록이에요.** v1은 비교 자료로 보존하고 후속 목업은 [v2](../filme-mobile-v2/README.md)에 있어요. 당시 로컬 결과를 현재 프로덕션 요구사항·실기기 검증·사용자 최종 평가로 읽지 않아요.

[목업 열기](index.html) · [전후 비교](comparison.html) · [확정 명세](../../specs/filme-mobile-redesign-mockup.yaml) · [설계와 기능 배치](design.md)

`index.html`을 브라우저에서 열면 동작해요. 폴더와 기존 `public` 자산의 상대 위치는 유지해야 해요. HTML + CSS + IIFE JS 번들을 포함해 실행 시 설치나 CDN 연결이 필요 없어요.

로컬 미리보기:

```sh
bun docs/mockups/filme-mobile-v1/serve.mjs
```

주소: `http://127.0.0.1:3791/docs/mockups/filme-mobile-v1/index.html`

## 범위

- 실제 shadcn Button·Input·Dialog를 사용해요. 공식 소스와 변경 내역은 [THIRD_PARTY.md](THIRD_PARTY.md)에 있어요.
- `#B0423F`, Pretendard, 라이트 테마를 사용해요. 프로덕션 파일이나 기존 티켓 자산을 수정하지 않아요.
- 시작 → 영화 정보 → 꾸미기 → 완성 흐름을 직접 사용할 수 있어요.
- 검색·OCR·저장·공유는 시뮬레이션이에요. 우측 상단 ‘목업 안내’에서 정상·빈 결과·오류 상태를 고를 수 있어요.
- 티켓 미리보기는 고정된 기존 6종 이미지예요. 입력값과 재질·서체·포스터 등은 선택 상태만 바뀌고 이미지에 합성하지 않아요.
- 초안은 `filme-mockup-v1-draft` 키에 따로 저장해요. 프로덕션 초안 키를 사용하지 않아요.
- PC에도 같은 모바일 폭을 보여줘요. iOS 네이티브 코드 전환을 구현하거나 보장한 결과물은 아니에요.

## 재빌드와 검증

이번 실행에서는 이미 설치되어 있던 의존성을 재사용했어요. 다른 환경에서는 루트 프로젝트 의존성에 더해 이 폴더의 `package.json`에 명시한 패키지가 필요해요. 별도 설치가 필요할 때도 루트 manifest를 바꾸지 않아요.

```sh
bun install --cwd docs/mockups/filme-mobile-v1
bun docs/mockups/filme-mobile-v1/build.mjs
bun docs/mockups/filme-mobile-v1/verify.mjs
```

검증 스크립트는 macOS Chrome 설치 경로를 사용해요. `FILME_MOCKUP_URL`을 주면 HTTP 주소에서도 같은 검사를 실행해요.

## 검증 결과 — 2026-09-22

- Chrome에서 HTML 파일 직접 실행: 320×568, 375×667, 393×659, 414×736, 768×900.
- 페이지 가로 넘침 없음, 티켓 이미지 로드, 주 액션 히트 테스트 통과.
- 필수 입력 오류, 빠른 한글 입력과 긴 제목, 화면·브라우저 뒤로 가기, 초안 복원 통과.
- 디자인 선택, 실행 취소·다시 실행, 시트 적용·취소 통과.
- 첫 홈과 꾸미기 화면에서 시트를 연 뒤 브라우저 Back이 시트만 닫는 회귀 검사 통과.
- 검색, OCR 정상·실패, 저장 로딩·완료 시연, OS 다크에서도 앱 라이트 유지 확인.
- 33개 화면 캡처와 [검증 보고서](verification/report.json)를 남겼어요.
- HTTP 미리보기 추가 검사에서 6종 디자인, 모달 초점 가두기·호출 버튼 복귀, 빈 검색, 공유 시연, 320×480 시트의 적용 버튼과 비교 페이지 이미지 로드를 통과했어요. [추가 보고서](verification/states-report.json)와 캡처 4개를 남겼어요.
- [동일 티켓 전후 비교 근거](verification/comparison.json): 기존 로컬 빌드의 티켓 DOM을 캡처해 비교용 새 화면에 그대로 사용했어요. 비교용 교체는 브라우저 메모리에만 적용했어요.
- 루트 TypeScript 검사 통과. 별도 목업이라 프로덕션 전체 테스트·빌드를 재실행하지 않았어요.

독립 정적 검토 1회를 진행했어요. 발견한 P1인 시트 뒤로 가기를 수정하고 회귀 검사를 통과했어요. 독립 검토자의 Chrome 실행은 환경 문제로 실패해 재시도하지 않았고, 브라우저 증거는 작성자의 검증 스크립트 결과예요.

실제 iPhone Safari, 실 OCR/API, JPEG 생성은 이번 결과의 검증 범위가 아니에요. 사용자의 디자인 만족도 승인을 받았다는 뜻도 아니에요.

## 시각 검토

전후 비교에서 도구 위치와 주 액션의 일관성을 확인했어요. 폼과 꾸미기를 분리하면서 기본 티켓 미리보기는 작아지고 화면 이동이 늘어나는 절충이 있어요. 확대 보기와 입력 유지가 그 부담을 줄이도록 구성했어요.

Hallmark 자체 검토: Philosophy 4 / Hierarchy 4 / Execution 4 / Specificity 4 / Restraint 4 / Variety 4. 장식·혼합 서체·가짜 기기 테두리·미확인 성능 주장은 없어요. 모바일 짧은 문구와 사용자 지정 Pretendard·브랜드 컬러는 스킬의 일반 마케팅 레이아웃 규칙보다 우선해요.
