# Goal: OCR Tesseract → GPT-4o mini 전환 (Epic)

> 클라이언트 Tesseract WebWorker OCR을 서버사이드 GPT-4o mini(Vercel AI Gateway / AI SDK) API로 전면 교체. 포함 이슈: #15, #16, #17, #18, #19, #20, #21

## 1. 배경 / 왜 이 단위인가

### 묶은 근거
이 7개 이슈는 "OCR 엔진 교체"라는 단일 동작을 위해 같은 파일군을 차례로 건드려요. 공유하는 핵심 자원이 명확해서 한 청크예요.
- `src/utils/ocr.ts` — #19에서 전면 교체. #15(의존성)·#16(API)·#18(전처리)가 모두 이 파일이 호출할 인프라거든요.
- `src/components/v2/OcrUploadCard.tsx` — #19가 수정. 현재 `runOcr` → `parseTicket` → `detectChain` 3단 호출을 단일 API 반환으로 줄여요(132·135번 줄).
- `src/utils/parseTicket.ts` / `detectChain.ts` / `parseTicket.test.ts` — #20이 단순화/삭제. API가 구조화 JSON을 직접 주니 정규식 파서 대부분이 죽어요.
- `package.json` / `next.config.js` / `scripts/vendor-tesseract.ts` / `public/tesseract/` — #15(추가)·#21(제거)이 빌드·의존성 레이어를 양끝에서 건드려요.

### 왜 이 순서인가 (강한 선형 의존)
**반쯤 전환하면 OCR이 통째로 깨지는** 구조라, 슬라이스 순서가 곧 "항상 동작하는 상태를 유지하는" 안전 순서예요.
1. `#15`(AI SDK 의존성·env) 없이는 #16 API가 import조차 안 돼요.
2. `#16`(API route)와 `#18`(클라 전처리)는 서로 독립 — **병렬 가능**. 단 #19가 둘 다 필요해요.
3. `#17`(rate limit·비용 방지)은 #16 route 내부에 얹는 거라 #16 다음.
4. `#19`(ocr.ts + OcrUploadCard 전환)가 **실제 스위치를 당기는 슬라이스**. 여기서 Tesseract → API로 바뀌어요. #16·#18이 끝나야 함.
5. `#20`(파서 단순화)·`#21`(에셋·의존성·빌드훅 정리)은 #19 검증 완료 후에야 안전 — 둘은 서로 다른 파일이라 **병렬 가능**.

순서를 어기면(예: #21을 #19 검증 전에) Tesseract를 지웠는데 API 경로가 아직 안 붙어 OCR이 완전히 죽은 커밋이 생겨요.

## 2. 완료 조건 (Definition of Done)

- [ ] `ai`, `@ai-sdk/openai` 설치됨, `bun install --frozen-lockfile` 통과 (#15)
- [ ] `.env.local.example` 신규 생성 — `OPENAI_API_KEY` (또는 `AI_GATEWAY_API_KEY`, §3 결정), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` 키 항목 존재 (#15, #17)
- [ ] `src/pages/api/ocr.ts` 존재 — `multipart/form-data` 이미지 수신 → `generateObject`+Zod로 GPT-4o mini vision 호출 → `{ title?, theater?, screen?, watchDate?, watchTime?, seat?, bookingNumber?, chain? }` JSON 반환 (#16)
- [ ] API는 **절대 throw 안 함** — 키 미설정/모델 오류/파싱 실패 시 적절한 status + `{ error: string }` 반환 (#15, #16)
- [ ] 파일 크기 >10MB → 413, MIME image/png·jpeg·webp 외 → 415(또는 400) 거부, Content-Type 검증 (#17)
- [ ] IP sliding window rate limit: 10회/시간·50회/일, 초과 시 429 + `Retry-After`. **Upstash env 미설정 시 graceful skip** (#17)
- [ ] `src/utils/ocrPreprocess.ts` 존재 — `preprocessForOcr(file: File): Promise<Blob>`. 하단 18% 크롭 + width 768px 캡 + JPEG 0.92 export, SSR-safe(`typeof window === 'undefined'` 시 원본 반환) (#18)
- [ ] 1170×2532 입력 → 768×1363(±2px) 출력, 출력 blob MIME `image/jpeg` (#18)
- [ ] `runOcr(file)`가 전처리 → `/api/ocr` 호출 → `Partial<MovieInfo> & { chain? }` 반환. `warmUpOcr` 및 Tesseract Worker 로직 전부 제거 (#19)
- [ ] `OcrUploadCard`에서 `warmUpOcr()` 호출 3곳 제거(`handleClick`/`onPointerEnter`/`onFocus`), `parseTicket`/`detectChain` 직접 호출 제거, chain은 API 반환값으로 `setComponents({ chain })` (#19)
- [ ] 진행 표시: progress bar(0–1) 제거 → 무한 스피너(스캔 아이콘 애니메이션 유지) (#19)
- [ ] 페이지 첫 로드 시 Tesseract 모델·worker 네트워크 요청 0건 (#19, #21)
- [ ] `parseTicket.ts` 정규식 파서 제거(또는 잔존 유틸만 유지), `detectChain.ts` 미사용 시 삭제, `parseTicket.test.ts` 삭제된 로직 테스트 제거 (#20)
- [ ] `public/tesseract/` 디렉토리 삭제, `scripts/vendor-tesseract.ts` 삭제, `tesseract.js` 의존성 제거, `package.json` predev/prebuild에서 `vendor-tesseract` 제거(`gen:assets`는 유지), `next.config.js`의 `serverExternalPackages: ['tesseract.js']` 제거 (#21)
- [ ] `bun run typecheck` 통과 (dead import 0)
- [ ] `bun test` 통과 (잔존 테스트 기준)
- [ ] `bun run build` 성공, 번들에 tesseract.js 없음

## 3. 쟁점과 트레이드오프

### 쟁점 A — `OPENAI_API_KEY` 직결 vs `AI_GATEWAY_API_KEY` (Vercel AI Gateway)
이 레포는 Vercel 배포(`vercel.json` 존재) + vercel 플러그인 환경이에요. AI SDK 5는 `gateway` provider를 기본 내장해서, 모델을 `'openai/gpt-4o-mini'` 문자열로 지정하면 별도 provider import 없이 AI Gateway로 라우팅돼요(`AI_GATEWAY_API_KEY` 또는 Vercel OIDC 자동 인증).

| 방식 | 장점 | 단점 |
|---|---|---|
| `@ai-sdk/openai` + `OPENAI_API_KEY` | 이슈 #15 명세 그대로, 로컬에서 OpenAI 키만 있으면 바로 동작, 의존성·멘탈모델 단순 | Vercel AI Gateway의 사용량 대시보드/비용 추적/failover 미활용, 키를 직접 관리 |
| AI Gateway(`'openai/gpt-4o-mini'` 문자열) + `AI_GATEWAY_API_KEY` | Vercel 통합 비용 추적·rate observability, 배포 환경에서 OIDC로 키리스, provider 교체 쉬움 | 로컬 dev에서 게이트웨이 키 발급 필요, 이슈 #15 명세(`@ai-sdk/openai`)와 어긋남, 첫 도입 마찰 |

**권장(Leaning): #16 본문 명세대로 `@ai-sdk/openai` + `OPENAI_API_KEY`로 시작.** 근거 — (1) 이슈가 명시적으로 `OPENAI_API_KEY`를 요구하고 `bun add ai @ai-sdk/openai`를 완료 기준으로 박아둠, (2) 비용/observability는 이 단계에서 over-engineering이고 rate limit(#17)으로 1차 방어가 이미 들어감, (3) AI Gateway는 `model: 'openai/gpt-4o-mini'` 문자열 한 줄로 나중에 무중단 전환 가능 — 지금 묶을 이유 없음. 단, env 키 이름을 추상화해 두면(`process.env.OPENAI_API_KEY`만 참조) 전환 비용이 거의 0이에요. **반론 가능 지점**: 운영자가 Vercel 통합 비용 추적을 강하게 원하면 처음부터 Gateway가 낫지만, 그건 운영 결정이라 이슈 범위 밖. 실행 에이전트는 `OPENAI_API_KEY` 미설정 graceful 에러를 반드시 구현해야 함(#15 완료 기준).

### 쟁점 B — chain enum 불일치
- 기존 `detectChain.ts`의 `ChainId = 'cgv'|'lotte'|'megabox'|'cineq'` (4종).
- #16 API 스키마는 `chain: 'cgv'|'lotte'|'megabox'|null` (cineq 없음, 3종).
- 에셋 슬러그(`public/assets/chains_transparent/`)는 `cgv`/`lotte`/`megabox`/`cineq` 4종.

`setComponents({ chain })`는 `TicketComponents.chain: string`(자유 문자열)이라 타입은 안 깨져요. 하지만 **cineq 티켓은 chain 자동선택이 빠져요.** 권장: GPT 프롬프트/스키마에 `cineq`를 enum으로 포함시켜 4종 유지(에셋이 이미 있으니 비용 0). #16 본문이 3종이라 명세 충돌 — 실행 시 "스키마에 cineq 추가" 여부를 결정하고 메모. (Leaning: 추가하는 쪽. 에셋이 존재하는데 굳이 떨굴 이유가 없음.)

### 쟁점 C — title 흐름 분리
`runOcr` 반환을 `Partial<MovieInfo> & { chain }`로 바꿔도, `title`은 여전히 `OcrUploadCard.applyOcr`에서 `triggerKobisLookup(title)`으로 따로 흘러야 해요(KOBIS 자동조회 유지). 즉 API의 `title`은 폼에 직접 안 쓰고 KOBIS 검색어로만 써요. 현재 `OCR_DIRECT_FIELDS`에 title이 없는 구조(8번 줄)를 그대로 유지하면 됨 — `parsed.title`만 KOBIS로 보내고 나머지 6필드는 direct 적용. 이 분기 로직은 #19에서 보존.

### 쟁점 D — 전처리 위치 (클라 vs 서버)
#18은 클라 Canvas 전처리예요. 트레이드오프: 클라에서 768px·하단 크롭으로 줄이면 (1) 업로드 페이로드↓, (2) GPT 이미지 토큰↓(−24%, #18 표) 둘 다 얻어요. 서버 전처리(sharp)면 클라 부담은 줄지만 업로드 페이로드는 원본 그대로라 비용 방어가 약해짐. **클라 전처리 유지가 맞아요.** 단 SSR/비브라우저 경로에서 Canvas가 없으니 `typeof window` 가드 필수(#18 명세).

### 쟁점 E — rate limit graceful skip 강제
`@upstash/ratelimit`은 env 미설정 시 throw하면 로컬 dev가 통째로 막혀요. **반드시 env 존재 여부를 먼저 체크하고 없으면 limiter 자체를 만들지 않는(=skip) 분기**를 둬야 함(#17 명세). 이걸 빼먹으면 로컬에서 OCR이 죽어 회귀로 보임.

## 4. 슬라이스 순서 (goal 내부 실행 순서)

> 같은 파일을 만지는 슬라이스는 순차. 병렬 표시된 쌍만 동시 진행 가능.

1. **Slice 1 — AI SDK 의존성 + env 스캐폴딩** (이슈 #15)
   - 파일: `package.json`(deps), `.env.local.example`(신규), 필요 시 `README.md`/주석.
   - 변경: `bun add ai @ai-sdk/openai`. `.env.local.example`에 `OPENAI_API_KEY=`(+ §3 결정 시 `AI_GATEWAY_API_KEY=`) 추가. #17 대비 `UPSTASH_REDIS_REST_URL=`, `UPSTASH_REDIS_REST_TOKEN=`도 함께 기재(주석으로 "선택" 표기).
   - 완료 기준: `bun install --frozen-lockfile` 통과, `.env.local.example` 키 존재.

2. **Slice 2 — OCR API route** (이슈 #16) — *Slice 3과 병렬 가능 (서로 다른 파일)*
   - 파일: `src/pages/api/ocr.ts`(신규).
   - 변경: `kobis/search.ts` 패턴(method 가드, env 키 가드, try/catch, `{ error }` 반환) 따름. `multipart/form-data` 파싱(Next.js Pages Router는 기본 bodyParser가 multipart를 안 줌 → `export const config = { api: { bodyParser: false } }` + formidable/직접 파싱, 또는 base64 JSON 수신 중 택1 — §7 리스크 참조). `generateObject`(model `gpt-4o-mini`) + Zod 스키마로 7필드 추출. 없는 필드는 `.optional()`로 생략. **절대 throw 안 함.**
   - 완료 기준: `curl -F image=@ticket.png localhost:3000/api/ocr` → 유효 JSON. `OPENAI_API_KEY` 미설정 시 명확한 에러 status.

3. **Slice 3 — 클라 이미지 전처리** (이슈 #18) — *Slice 2와 병렬 가능*
   - 파일: `src/utils/ocrPreprocess.ts`(신규).
   - 변경: `preprocessForOcr(file): Promise<Blob>`. Canvas로 디코드 → 하단 18% 크롭 → width 768 캡(비율 유지) → `toBlob('image/jpeg', 0.92)`. `typeof window === 'undefined'` 시 원본 file 반환.
   - 완료 기준: 1170×2532 → 768×1363(±2px), MIME `image/jpeg`.

4. **Slice 4 — rate limit + 입력 검증** (이슈 #17) — *Slice 2 위에 얹음, 순차*
   - 파일: `src/pages/api/ocr.ts`(수정), 필요 시 `src/utils/ratelimit.ts`(신규 헬퍼).
   - 변경: `bun add @upstash/ratelimit @upstash/redis`. 파일크기>10MB→413, MIME 화이트리스트→415, Content-Type 검증. IP(`x-forwarded-for`) sliding window 10/h·50/d → 429+`Retry-After`. **Upstash env 둘 다 있을 때만 limiter 생성, 없으면 skip.**
   - 완료 기준: 11번째 요청 429, 10MB 초과 413, env 미설정 시 정상 동작.

5. **Slice 5 — ocr.ts + OcrUploadCard 전환 (스위치 당김)** (이슈 #19) — *#16·#18·#17 완료 후, 순차*
   - 파일: `src/utils/ocr.ts`(전면 교체), `src/components/v2/OcrUploadCard.tsx`(수정).
   - 변경: `runOcr(file)` = `preprocessForOcr` → FormData → `fetch('/api/ocr')` → `Partial<MovieInfo> & { chain? }`. `warmUpOcr`·Worker·tesseract import 전부 삭제. `OcrUploadCard`: `warmUpOcr` 3곳 제거, `parseTicket`/`detectChain` import·호출 제거, chain은 반환값으로 `setComponents({ chain })`, title은 `triggerKobisLookup`로(쟁점 C), progress bar → 스피너.
   - 완료 기준: 실제 CGV 스크린샷 업로드 → 필드 자동입력, 첫 로드 시 tesseract 네트워크 0.

6. **Slice 6 — parseTicket/detectChain 단순화** (이슈 #20) — *#19 검증 후. Slice 7과 병렬 가능*
   - 파일: `src/utils/parseTicket.ts`, `src/utils/detectChain.ts`, `src/utils/parseTicket.test.ts`.
   - 변경: API가 정규화된 JSON을 주므로 정규식 파서 제거. date/time 정규화 잔존 가치 판단(API가 이미 YYYY-MM-DD/HH:MM면 삭제). `detectChain` 미사용 확인 후 삭제. 삭제된 로직 테스트 제거, 잔존 유틸 테스트만 유지.
   - 완료 기준: typecheck 통과, dead import 0, `bun test` 통과.

7. **Slice 7 — Tesseract 에셋·의존성·빌드훅 정리** (이슈 #21) — *#19 검증 후. Slice 6과 병렬 가능*
   - 파일: `public/tesseract/`(삭제), `scripts/vendor-tesseract.ts`(삭제), `package.json`(predev/prebuild·deps·scripts), `next.config.js`, `.gitignore`.
   - 변경: `bun remove tesseract.js`. predev/prebuild에서 `&& bun scripts/vendor-tesseract.ts` 제거(`gen:assets`만 남김), `gen:tesseract` 스크립트 제거. **`next.config.js`의 `serverExternalPackages: ['tesseract.js']` 제거**(청크 개요엔 없던 항목 — 안 지우면 빌드 경고/혼선). `.gitignore`의 `/public/tesseract/*`·`kor.traineddata.gz`·스트레이 모델 줄 정리.
   - 완료 기준: `public/tesseract/` 없음, `bun run build` 성공, node_modules에 tesseract.js 없음, 번들 크기 감소.

## 5. 의존성 / 선행 조건

- **외부 서비스**: OpenAI API(또는 Vercel AI Gateway) 키 1개 — 실제 API 호출 검증(#16 curl, #19 E2E)에 필요. 키 없으면 graceful-error 경로만 검증 가능.
- **선택 서비스**: Upstash Redis(Vercel Marketplace) — #17 rate limit 실측 검증용. 없으면 skip 경로만 검증.
- **환경변수**: `OPENAI_API_KEY`(필수), `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`(선택). `KOBIS_API_KEY`는 기존 그대로 — title→KOBIS 흐름 유지에 필요.
- **다른 청크 의존**: 없음. 이 청크는 OCR 파이프라인 내부에서 자기완결적 — **독립**. (단 chain 자동선택이 `setComponents`로 티켓 컴포넌트에 연결되므로, 티켓 렌더 쪽은 기존 인터페이스만 유지하면 됨.)

## 6. E2E 자가 검증 방법 (에이전트가 스스로 수행)

### 게이트(모든 슬라이스 후 반복)
```
bun run typecheck   # 기대: 종료코드 0, 에러 0
bun test            # 기대: 종료코드 0, 잔존 테스트 전부 pass
bun run build       # 기대: 종료코드 0, build output에 tesseract 청크 없음
```

### Slice 1 (#15)
```
grep -c "OPENAI_API_KEY" .env.local.example   # ≥1
bun install --frozen-lockfile                 # 종료코드 0
grep -E '"ai"|"@ai-sdk/openai"' package.json  # 두 줄 출력
```

### Slice 2 (#16)
- `bun run dev` 기동 후:
```
# 정상 키 케이스 (OPENAI_API_KEY 설정 시)
curl -s -F image=@<실제_CGV_스크린샷.png> localhost:3000/api/ocr | jq .
#   기대: title/theater/watchDate 등 필드가 채워진 JSON, throw·500 아님
# 키 미설정 케이스
OPENAI_API_KEY= curl -s -o /dev/null -w "%{http_code}" -F image=@x.png localhost:3000/api/ocr
#   기대: 4xx/5xx + {error} (프로세스 크래시 없음)
# GET 거부
curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/ocr   # 기대: 405
```
- 수동: 반환 JSON의 `watchDate`가 `^\d{4}-\d{2}-\d{2}$`, `watchTime`이 `^\d{2}:\d{2}$`, `chain`이 cgv/lotte/megabox(/cineq) 중 하나인지 눈으로 확인.

### Slice 3 (#18)
- 임시 vitest(jsdom 환경, `package.json`에 jsdom 있음) 또는 dev 콘솔에서:
```
const blob = await preprocessForOcr(file_1170x2532);
// 기대: blob.type === 'image/jpeg', createImageBitmap(blob) → width 768, height 1363±2
```
- 수동: 출력 이미지에 하단 버튼/고지 영역이 잘려나갔고 판매번호·제목·날짜·관·좌석은 남아있는지 확인.

### Slice 4 (#17)
```
# rate limit (Upstash env 설정 시): 11회 연속 호출
for i in $(seq 1 11); do curl -s -o /dev/null -w "%{http_code}\n" -F image=@t.png localhost:3000/api/ocr; done
#   기대: 1~10 → 200, 11 → 429 (응답에 Retry-After 헤더)
# 크기 제한: 10MB 초과 파일
curl -s -o /dev/null -w "%{http_code}" -F image=@big_11mb.png localhost:3000/api/ocr   # 기대: 413
# MIME 거부
curl -s -o /dev/null -w "%{http_code}" -F image=@doc.pdf localhost:3000/api/ocr        # 기대: 415 또는 400
# env 미설정 graceful: Upstash 키 없이 dev → OCR 정상 동작(429 안 뜸)
```

### Slice 5 (#19) — UI E2E
- `bun run dev` → 앱 열기 → **Phase 1(포스터와 영화 정보)** 화면. Poster 섹션 우측 "티켓 스크린샷으로 자동 인식" 카드 클릭 → 실제 CGV 스크린샷 선택.
- 관찰(통과 기준):
  1. 업로드 직후 스캔 아이콘 스피너 표시, **progress bar 막대는 없음**.
  2. 수 초 내 Optional 아코디언의 Theater/Watched/Showtime/Screen/Seat/Booking No. 필드에 값 채워지고 OCR 칩 표시.
  3. 제목이 KOBIS로 조회돼 Film 섹션에 반영(또는 "제목 확인 후 검색" 토스트).
  4. 티켓 chain 로고가 CGV로 자동 선택(`setComponents({ chain: 'cgv' })`).
- Network 탭(통과 기준): 페이지 첫 로드~업로드 전까지 `/tesseract/*`, `worker.min.js`, `*.traineddata*`, `tesseract-core*` 요청 **0건**. 업로드 시 `POST /api/ocr` 1건만.
- 수동: 모바일 브라우저(또는 devtools 모바일 에뮬)에서 동일 흐름 1회.

### Slice 6 (#20)
```
bun test          # 잔존 테스트만 pass (삭제 로직 테스트 제거 후)
grep -rn "parseTicket\|detectChain" src/ --include=*.ts --include=*.tsx | grep -v "\.test\."
#   기대: OcrUploadCard 등에서 import·호출 0 (dead import 없음)
```

### Slice 7 (#21)
```
test ! -d public/tesseract && echo "tesseract dir gone"
test ! -f scripts/vendor-tesseract.ts && echo "vendor script gone"
grep -c "tesseract" package.json next.config.js   # 기대: 0
grep -rn "tesseract" node_modules/.package-lock.json 2>/dev/null | head   # 또는 bun pm ls | grep tesseract → 빈 출력
bun run build   # 종료코드 0
```

## 7. 리스크 / 롤백

### 회귀 위험
- **순서 위반 → OCR 완전 중단**: #21(에셋 삭제)이나 #20(파서 삭제)을 #19 검증 전에 하면 Tesseract 경로가 죽었는데 API 경로 미완성 → OCR 무동작. 완화: 슬라이스 순서 엄수, #19 E2E 통과를 #20·#21의 선행 게이트로.
- **multipart 파싱(#16)**: Pages Router 기본 `bodyParser`는 `multipart/form-data`를 안 파싱. `config.api.bodyParser=false` + 수동 파싱(formidable/Busboy) 또는 클라에서 base64 JSON 전송으로 우회 필요. 잘못 두면 빈 body로 모델 호출 → 항상 빈 결과. 완화: Slice 2 검증을 실제 `curl -F`로.
- **rate limit이 dev 막음(#17)**: env 미설정 graceful skip 누락 시 로컬 OCR 전체 차단 → 회귀로 오인. 완화: skip 분기 명시 테스트(#6 Slice 4 마지막 항목).
- **chain 자동선택 누락(쟁점 B)**: cineq를 스키마에서 빼면 씨네Q 티켓 로고 자동선택 사라짐(에셋은 존재). 완화: 스키마에 cineq 포함 권장.
- **title→KOBIS 흐름 단절(쟁점 C)**: #19에서 `parseTicket` 제거하며 title 분기까지 같이 지우면 KOBIS 자동조회가 죽음. 완화: `applyOcr(direct, title)` 분기 보존 확인.
- **`serverExternalPackages` 잔존(#21)**: 제거 안 하면 빌드 경고 + 죽은 설정. 빌드 실패는 아니지만 정리 미완.
- **이미지 토큰 비용 폭증**: 전처리(#18)가 #19보다 늦거나 누락되면 원본 고해상도가 그대로 모델로 가 비용↑. 완화: #18을 #19 선행으로(슬라이스 순서대로면 자동 충족).

### 롤백
- 각 슬라이스는 별도 커밋 권장 → 슬라이스 단위 `git revert`.
- 전면 롤백: #19~#21 revert 시 `package.json`·`next.config.js`의 tesseract 설정과 `public/tesseract/kor.traineddata.gz`(gitignore 예외로 커밋됨)가 복원돼야 Tesseract 경로 재가동. 따라서 #21 커밋에서 모델 파일 삭제는 별도 커밋으로 분리해 두면 롤백이 쉬움.
- env는 코드에 하드코딩 안 하므로 키 회수만으로 외부 호출 차단 가능(추가 비용 즉시 정지).
