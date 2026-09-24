# 브랜치 분리 · 2026-09-24

## 확인한 상태

- 시작 시 로컬 `main`은 `785f181`, 원격 `origin/main`은 `407393e`로 로컬이 24커밋 뒤처져 있었어요. 새 fetch 후에도 같은 상태였어요.
- 목업·실제품 UI·OCR·문서 정리 변경이 같은 작업 디렉터리에 섞여 있었어요. 미해결 merge 인덱스는 없었어요.
- 원격에 이미 반영된 변경도 로컬 미커밋 diff에 포함돼 있었어요. 예를 들어 OCR 재시도 수정은 최신 `main`과 같았어요. 전체 WIP를 새 기능 변경으로 간주하면 중복·역행을 만들 수 있어 분리했어요.

## 결과

| 브랜치 | 역할 | 기준/보존 커밋 |
| --- | --- | --- |
| `main` | 원격과 일치하는 기준 브랜치 | `407393e` |
| `feat/mobile-editor-mockups` | v1/v2 목업·명세·에셋·검증 자료 | 최신 `main`에서 분기; `d6569a7`, `3f9d0db`에 원래 목업 보존 |
| `wip/session-product-changes-20260924` | 목업 외 제품 코드·문서·검증 자료의 원문 보존 | 원래 기준점 `785f181` 위의 복구용 `f020474` |

WIP 보존 커밋은 여러 작업이 섞인 복구 스냅샷이에요. 최신 main에 재통합하거나 병합 준비를 완료한 브랜치가 아니에요. 해당 브랜치와 main의 차이를 확인하지 않고 전체를 병합하는 용도로 만들지 않았어요.

목업 분리에는 `docs/mockups/**`와 `docs/specs/filme-mobile-redesign-mockup.yaml`만 포함했어요. 제품 `src/**`, 루트 설정, 나머지 명세는 목업 브랜치에서 변경하지 않았어요.

최신 Seed를 임시 경로에서 [seed.yaml](../seed.yaml)로 복사했어요. 새 main의 Criterion 목록은 한 줄 기록을 제외하므로 목업 내부에서 그 필드만 노출하도록 했고, 번들을 새 기준으로 다시 빌드했어요.

## 보존과 기존 브랜치

- 분리 전 818개 경로의 내용·삭제 상태를 기록하고 보존 커밋의 Git 객체와 대조했어요. 불일치 0개였어요.
- 전체 세션은 `refs/backup/branch-split-20260924/full-session`에도 고정했어요. 기존 stash와 새 복구용 stash를 모두 유지했어요.
- 실제 경로가 없는 워크트리 등록 8개만 prune했어요. 등록 메타데이터를 복사했고, detached integration/review 커밋도 `refs/backup/branch-split-20260924/` 아래 고정했어요.
- `fix/product-readiness`, `fix/ocr-failure-773`, `fix/landing-og-card`, `fix/drawer-focus-recovery`, `fix/criterion-font-validation`, `Lyainc/refactor-moods-pattern_box-4`는 `git cherry main` 기준 미반영 패치가 없었어요. 기존 브랜치는 삭제하지 않았어요.
- `docs/chrome-harness-skill-refactor`에는 main에 없는 커밋 1개가 남아 있어 유지했어요.
- 살아 있는 `worktree-agent-a051785d917b711f6`의 `scripts/measure-quote-width.mjs` 미커밋 파일을 유지했어요.
- 원격 push·브랜치 삭제·배포는 하지 않았어요.

## 검증

최신 main 기반 목업 빌드가 성공했어요. 분리 후 Chrome 검증은 mobile 8, redesign 15, refinement 9, experience 8개를 통과했어요. 브라우저 종료 Promise의 대기 문제가 있어 실행 결과와 프로세스 종료를 구분해서 확인했어요. 기존 PNG/JSON은 원본 증거로 보존하고 이번 실행에서는 덮어쓰지 않았어요. 실제 iPhone/API/JPEG 검증을 추가로 수행한 것은 아니에요.
