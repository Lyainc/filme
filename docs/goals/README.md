# Goal 청킹 인덱스 — 열린 이슈 15개

> 2026-06-03 기준 열린 GitHub 이슈 #15~#29(15개)를 "해결하면 유리한 단위"로 4개 청크로 묶고,
> 각 청크를 `/goal`에 그대로 던질 수 있게 문서화했다. 각 청크 문서에는 완료 조건·쟁점·슬라이스 순서·E2E 자가 검증이 담겨 있다.

## 청크 한눈에

| 청크 | 문서 | 포함 이슈 | 난이도 | 권장 모델 | 한 줄 |
|---|---|---|---|---|---|
| **C2** 배포 다운로드 핫픽스 | [C2-deploy-download-hotfix.md](./C2-deploy-download-hotfix.md) | #22 | 낮음 | sonnet | `fetch(data:)` CSP 차단 → `atob` Blob 직접 생성. 단일 파일 5줄. |
| **C1** OCR GPT-4o mini 전환 (Epic) | [C1-ocr-gpt4o-migration.md](./C1-ocr-gpt4o-migration.md) | #15·16·17·18·19·20·21 | 높음 | opus | 클라 Tesseract WebWorker → 서버 GPT-4o mini API 전면 교체. 강한 선형 의존. |
| **C3** Phase 1/2 입력·디자인 UX | [C3-phase-canvas-ux.md](./C3-phase-canvas-ux.md) | #23·25·26·29·24 | 중간 | opus | 공유 캔버스 파일 순차 수정 묶음(포맷 칩·박스 높이·Display Fields 이동·flicker·헤더 링크). |
| **C4** 티켓 카드 표시 개선 | [C4-ticket-card-display.md](./C4-ticket-card-display.md) | #27·28 | 낮음 | sonnet | 배우 "외 N명" 축약 + FormatStamp 시인성 상향. 공유 mood 파일. |

## 청크 경계를 이렇게 그은 이유

핵심 기준은 **파일 충돌**과 **의존성**이다. 도메인 분류가 아니라 "같은 파일을 건드리면 묶고, 강한 의존이면 한 epic으로".

- **C1**: `ocr.ts`·`OcrUploadCard`·`parseTicket`·`detectChain`·`api/ocr`·빌드훅을 양끝에서 건드리고, #15→#16/#18→#17→#19→#20/#21로 **반쯤 전환 시 OCR이 통째로 깨지는** 선형 의존. 원자적 epic이어야 의미가 있다.
- **C3**: #23·#25·#26이 `Phase1Canvas.tsx`/`Phase2Canvas.tsx`를 **공유** → 병렬 시 머지 충돌 확정 → 순차 슬라이스로 묶음. #29(`MovieInfoForm`)·#24(`AppHeader`)는 파일 독립이라 같은 청크의 병렬 슬라이스로 끼움.
- **C4**: #27·#28이 `_shared.tsx`+mood 4개를 **공유** → 묶어야 충돌 회피. 검증(캡처 육안)도 공통이라 라운드 1회로 통합.
- **C2**: `captureToImage.ts` 단독·독립·High. 다른 청크와 안 겹쳐 가장 먼저 머지.

## 권장 실행 순서

네 청크가 건드리는 파일이 **서로 겹치지 않아** 전부 병렬 가능하다. 우선순위만 깔면:

```
C2  (즉시 — 배포 핵심 기능 복구, 5줄 핫픽스)
 │
 └─▶  C1 ∥ C3 ∥ C4   (파일 충돌 0 — 동시 진행 가능)
```

- **C2 먼저**: 배포 버전에서 다운로드가 완전히 죽어 있어 사용자 영향이 가장 크고, 비용이 가장 싸다.
- **C1·C3·C4 병렬**: 충돌이 없으니 동시에 띄울 수 있다. 단 머지 순서만 보면, C1이 `OcrUploadCard`를, C3가 그 부모 `Phase1Canvas`를 건드리므로(파일은 안 겹침, import 관계만) 리뷰 시 한쪽을 먼저 머지하고 다른 쪽을 rebase하면 깔끔하다.

## 모델 배정 근거

| 모델 | 청크 | 왜 |
|---|---|---|
| **opus** | C1, C3 | C1은 외부 API·비용·env graceful degradation·multipart 파싱 등 통합 판단/함정이 분산. C3는 공유 캔버스 파일의 충돌 순서와 `fieldVisibility` 매핑을 정밀하게 짜야 함. |
| **sonnet** | C2, C4 | C2는 단일 함수 5줄 교체. C4는 helper 1개 + prop 4곳, 시각 검증 중심으로 통합 추론 부담이 낮음. |

## ⚠️ 교차 함정 (청크 경계를 넘는 의존 — `/goal` 실행 전 반드시 읽을 것)

### 1. chain enum 불일치 — C1 ↔ C3 (Strong, 둘 다 영향)
- `detectChain.ts`의 `ChainId`는 **4종**(`cgv|lotte|megabox|cineq`)이고, 체인 에셋도 4종 존재.
- 그런데 #16 OCR 스키마 초안은 **3종**(`cgv|lotte|megabox|null`)으로 `cineq`가 빠져 있다.
- **C1을 3종으로 구현하면**: OCR로 씨네Q 티켓을 올려도 `chain` 자동선택이 안 된다(에셋은 있는데).
- **그리고 C3 #23은 정확히 cineq를 다룬다**(cineq일 때 포맷 칩 숨김). 두 청크가 cineq를 서로 다르게 취급하면 일관성이 깨진다.
- **결정 권장(Strong)**: C1의 OCR 스키마에 `cineq`를 포함시켜 4종으로 통일. 에셋이 이미 있어 비용 0. → C1 문서 §3 쟁점 B 참조.

### 2. `bookingNo`(fieldVisibility 키) ↔ `bookingNumber`(MovieInfo 필드) — C3 내부
- C3 #26의 disabled 매핑에서 키와 필드명을 혼동하면 엉뚱한 입력이 비활성화된다. C3 §4 Slice 1 매핑표에 명시됨.

### 3. C1 정리 범위 — `next.config.js`의 `serverExternalPackages` (검증 완료)
- #21 청크 개요엔 없었지만 `next.config.js:5`에 `serverExternalPackages: ['tesseract.js']`가 실재. C1 Slice 7에서 함께 제거해야 죽은 설정이 안 남는다.

### 4. C1 #17(rate limit)의 외부 인프라 의존 — 분리 가능 지점
- #17만 Upstash Redis(Vercel Marketplace) 외부 인프라를 끌어온다. 나머지 OCR 전환(#15·16·18·19·20·21)만으로 기능은 완성되므로, Upstash 셋업이 지연되면 #17을 C1의 **후행 선택 슬라이스**로 미뤄도 된다(env 미설정 시 graceful skip이 이미 명세에 있어 안전). C1 문서 §3 쟁점 E 참조.

## `/goal` 사용법

각 청크 문서는 그 자체로 `/goal` 핸드오프 입력이다. 권장 흐름:

1. **C2부터** — `/goal docs/goals/C2-deploy-download-hotfix.md` 내용을 목표로 실행(또는 문서를 컨텍스트로 주입).
2. C2 머지 후 **C1·C3·C4를 각각 별도 goal로** 띄운다. 동시에 진행해도 파일 충돌이 없다.
3. 각 문서의 **§6 E2E 자가 검증**을 goal의 완료 게이트로 사용 — 에이전트가 `bun run typecheck && bun test && bun run build`와 문서에 적힌 UI/시각 절차를 스스로 수행하고 통과를 보고하게 한다.
4. C1은 슬라이스가 7개(일부 병렬)라 가장 무겁다. §4 슬라이스 순서를 어기면 "OCR이 죽은 커밋"이 생기니, **#19 E2E 통과를 #20·#21의 선행 게이트로** 둘 것.

## 모든 청크 공통 완료 게이트

```bash
bun run typecheck   # 종료코드 0, 에러 0
bun test            # 종료코드 0, 잔존 테스트 pass
bun run build       # 종료코드 0
```

UI/시각 변경(C3·C4 대부분, C1 #19)은 자동 테스트로 못 잡으니 각 문서 §6의 브라우저 수동 절차를 반드시 수행한다.
