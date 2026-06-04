# Goal: Phase 1/2 입력·디자인 화면 UX 정리

> Phase1Canvas/Phase2Canvas 중심의 입력·디자인 화면 UX를 한 번에 다듬는다. 포함 이슈: #23, #25, #26, #29, #24

## 1. 배경 / 왜 이 단위인가

- **공유 파일 충돌 회피가 핵심 묶음 근거예요.** #23·#25·#26은 모두 `Phase1Canvas.tsx` 또는 `Phase2Canvas.tsx`를 건드려요. 특히:
  - #25는 `Phase1Canvas.tsx`의 Poster 그리드(70~85줄)를 수정.
  - #26은 `Phase1Canvas.tsx`의 `OptionalDetailsAccordion`(96~273줄) 하단에 섹션을 **추가**하고, `Phase2Canvas.tsx`의 Display Fields 섹션(119~164줄)을 **삭제**.
  - #23은 `Phase2Canvas.tsx`의 Format 섹션(87~94줄)을 조건부 렌더로 바꾸고 `chain` onChange(81~84줄)에 format 초기화를 추가.
  - 즉 #25·#26이 같은 `Phase1Canvas.tsx`를, #23·#26이 같은 `Phase2Canvas.tsx`를 건드려요. 병렬 슬라이스로 돌리면 머지 충돌이 확정적이라 **순차 진행**이 안전해요.
- **#29(`MovieInfoForm.tsx`)와 #24(`AppHeader.tsx`)는 파일 독립**이에요. 다른 슬라이스와 겹치는 라인이 없어서 끼워넣기 가능하고, 검증 부담도 작아요.
- **순서 근거**: 구조 이동이 가장 큰 #26을 먼저 확정해 Phase1/Phase2의 섹션 경계를 고정한 뒤, 그 위에서 #25(Phase1 그리드)·#23(Phase2 Format)을 얹어요. 같은 파일을 나중에 또 건드리는 일을 줄여요. (3절에서 "먼저 vs 마지막" 트레이드오프 분석.)

## 2. 완료 조건 (Definition of Done)

- [ ] **#23-a**: Theater chain이 `''`(선택 안함) 또는 `'cineq'`일 때 Phase2의 Format 섹션(헤더 `Format` 포함)이 화면에 렌더되지 않는다.
- [ ] **#23-b**: chain을 format을 가진 체인(cgv/lotte/megabox)에서 cineq 또는 선택 안함으로 바꾸면 `components.format`이 `''`로 초기화된다 (티켓 미리보기에 잔존 포맷 스탬프 없음).
- [ ] **#23-c**: cgv↔lotte처럼 둘 다 format을 가진 체인 간 전환 시 기존 FormatPicker의 호환성 자동 초기화(incompatible value clear)가 그대로 동작한다 (회귀 없음).
- [ ] **#25-a**: Phase1의 Poster 그리드에서 `ImageUploader`와 `OcrUploadCard`의 박스 높이가 동일하다 (상단·하단 라인이 정렬됨).
- [ ] **#25-b**: 포스터 업로드 박스 내부 콘텐츠가 세로 중앙 정렬되어 빈 공간이 위아래로 균등하다.
- [ ] **#26-a**: Display Fields 토글 섹션이 Phase2에서 사라지고 Phase1의 `OptionalDetailsAccordion` 최하단(RatingPicker 아래)에 나타난다. 기존 "전체 선택/전체 해제", `selectedCount/total`, 칩 토글 동작이 그대로 유지된다.
- [ ] **#26-b**: Display Fields에서 특정 키 체크를 해제하면, 그 키에 대응하는 Phase1 입력 필드가 `disabled`되고 시각적으로 dim(`opacity-40 pointer-events-none`) 처리된다. 매핑은 4절 Slice 1 표를 따른다.
- [ ] **#29-a**: 제목 입력창에 타이핑하는 동안(2자 이상) 자동완성 드롭다운이 닫혔다 다시 열리는 flicker가 발생하지 않는다.
- [ ] **#29-b**: 2자 미만이거나 빈 문자열로 지우면 드롭다운이 닫힌다. IME 한글 조합 중에는 드롭다운 상태가 깜빡이지 않고, 조합 종료(`onCompositionEnd`) 후 검색이 트리거된다.
- [ ] **#24-a**: `AppHeader`에서 `ThemeToggle` 왼쪽에 GitHub 링크 아이콘 버튼이 보이고, `https://github.com/Lyainc/PhototicketMaker`로 `target="_blank" rel="noopener noreferrer"`로 새 탭 열림. 색상은 `text-fg-muted hover:text-fg`.
- [ ] **게이트**: `bun run typecheck` 통과(종료코드 0), `bun test` 통과, `bun run build` 성공.

## 3. 쟁점과 트레이드오프

### #26 "Phase1 먼저 vs 마지막" 순서 결정
- **선택지 A — #26 먼저(권장)**: 가장 큰 구조 변경(섹션 이동)을 먼저 끝내 Phase1/Phase2의 섹션 레이아웃을 확정. 이후 #25는 Phase1 상단 Poster 그리드만, #23은 Phase2 Format 섹션만 손대므로 #26이 만든 경계와 겹치지 않아요.
  - 비용: #26이 가장 무거워 첫 슬라이스가 길어짐.
  - 이득: #25·#23이 안정된 토대 위에서 진행. 같은 파일 재방문 최소화.
- **선택지 B — #26 마지막**: 작은 변경(#25·#23)을 먼저 쳐내고 마지막에 구조 이동.
  - 비용: #26이 Phase2 Display Fields 섹션을 **삭제**하는데, 그 전에 #23이 Phase2 Format 섹션을 이미 수정해둔 상태라 Phase2 diff가 두 번 겹쳐요. Phase1도 #25(그리드)+#26(아코디언 하단 추가)이 같은 파일에 순차로 쌓여요.
  - 이득: 초반 슬라이스가 가벼워 빠른 체감 진행.
- **권장: A (Strong)**. #26은 두 파일 모두의 섹션 구조를 바꾸는 유일한 슬라이스라 토대로 먼저 깔아야 #25·#23의 충돌 라인이 명확해져요. 반박 검토: B가 "작은 것부터"라는 심리적 이점은 있지만, Phase2 파일을 #23→#26 순서로 두 번 크게 건드리는 비용이 더 커요.

### #23 조건부 렌더 위치: Phase2Canvas vs FormatPicker
- **선택지 A — Phase2Canvas에서 `<section>` 통째로 조건부 렌더(권장)**: `Format` 헤더까지 함께 숨어 빈 헤더가 안 남아요. 이슈 본문 1순위 제안과 일치.
- **선택지 B — FormatPicker 내부 early return**: 헤더 `<h3>Format</h3>`는 Phase2Canvas에 있어 그대로 남아 빈 섹션 헤더가 노출돼요. 비권장.
- **권장: A (Strong)**. 단, 숨김 조건은 "format 매핑이 없는 chain"으로 일반화하는 게 더 견고해요. `allowedFormatsForChain(chain)`이 `null`이면 숨기는 방식 — 이러면 빈값/cineq를 하드코딩으로 나열하지 않고, 향후 `CHAIN_FORMAT_MAP`에 `[]`로 추가되는 체인도 자동 처리돼요. (이슈 본문은 `chain !== '' && chain !== 'cineq'` 하드코딩을 예시로 들지만, `chainFormatMap`이 단일 진실원이므로 그쪽 함수 재사용을 권장.)

### #23 format 초기화를 어디서 할까: Phase2Canvas onChange vs FormatPicker useEffect
- 현재 `FormatPicker`의 useEffect(19~26줄)는 `allowed && value && !allowed.includes(value)`일 때만 초기화해요. cineq/빈값은 `allowed === null`이라 이 분기를 **타지 않아** format이 잔존해요. 게다가 #23 적용 후 Format 섹션 자체가 언마운트되면 FormatPicker가 사라져 useEffect가 영영 안 돌아요.
- **권장(Strong)**: format 초기화를 **Phase2Canvas의 chain onChange로 끌어올려요**. chain 변경 시점에 새 chain의 allowed를 계산해 현재 format이 호환되지 않으면(`null`이거나 미포함) `setComp({ chain, format: '' })`로 한 번에 처리. FormatPicker 언마운트 타이밍에 의존하지 않아 견고해요. FormatPicker의 기존 self-correction useEffect는 cgv↔lotte 같은 마운트 유지 전환을 위해 **남겨둬요**(이중 안전망, 회귀 위험 없음).

### #26 disabled 적용 지점과 dim 래퍼
- `Field` 컴포넌트(`src/components/ui/Field.tsx`)는 `...props`를 input에 spread하므로 `disabled`는 자동 전달돼요. 하지만 dim(`opacity-40 pointer-events-none`)은 Field 내부 래퍼가 아니라 **호출부에서 감싸는 `<div>` 또는 Field가 들어있는 기존 `space-y-1` 래퍼**에 클래스로 줘야 해요.
- Watched 블록(113~141줄)은 Field가 아닌 raw `<input type="date">` + 포맷 토큰 버튼 묶음이라, `watchDate` 해제 시 그 블록 전체 래퍼에 dim+pointer-events-none을 줘야 토큰 버튼까지 비활성화돼요. `watchTime`은 Showtime Field만 대상.
- **권장(Leaning)**: 각 입력을 감싸는 래퍼 div에 `fieldVisibility[key]` 기반 조건부 클래스를 주고, raw input/Field엔 `disabled={!visible}`를 전달. 헬퍼로 `const dim = (on:boolean) => on ? '' : 'opacity-40 pointer-events-none'` 같은 작은 함수를 Phase1Canvas 안에 두면 반복이 줄어요.

### #26 fieldVisibility 키 ↔ Phase1 입력 필드 매핑의 불완전성 (중요)
- `TicketField` 키(usePhototicket의 `ALL_FIELDS_ON`)는 14개: `title, titleOg, actors, watchDate, watchTime, theater, screen, seat, runtime, rating, releaseDate, reissue, bookingNo, edition`.
- **`MovieInfo`/Phase1 필드명과 일부 불일치**: 예매번호는 fieldVisibility 키 `bookingNo` ↔ MovieInfo 필드 `bookingNumber`. Phase1의 입력 id는 `p1-bookingNumber`예요. 매핑 시 키/필드명을 혼동하지 마세요.
- **Phase1에 대응 입력이 없는 키**: `title/titleOg/releaseDate/reissue/rating`은 `MovieInfoForm`(Title/Original Title/Released/Reissue)과 `RatingPicker`에 있고, `edition`은 Phase1에 입력 UI 자체가 없어요. 이슈 본문이 명시한 disabled 대상은 8개뿐(`actors/watchDate/watchTime/theater/screen/seat/runtime/bookingNo`)이에요.
- **권장 결정(Strong)**: #26-b의 disabled/dim은 **이슈가 명시한 8개 키만** OptionalDetailsAccordion 내부 필드에 적용해요. `title/titleOg/releaseDate/reissue/rating`은 필수·핵심이라 토글로 입력을 막으면 UX가 망가지니 disabled 대상에서 제외(토글 칩 자체는 Display Fields에 그대로 표시되되, 입력 필드 비활성화는 안 함). `edition`은 입력 필드가 없어 대상 없음. 이 범위 결정을 슬라이스에 명시하고, 확대하려면 별도 합의 필요.

## 4. 슬라이스 순서 (goal 내부 실행 순서)

> #26 → #25 → #23 은 같은 두 파일을 공유하므로 **반드시 순차**. #29·#24는 파일 독립이라 언제든 끼워넣기/병렬 가능(아래 [병렬 가능] 표시).

1. **Slice 1 — #26 Display Fields를 Phase1로 이동 + 입력 비활성화** (이슈 #26)
   - 파일: `src/components/v2/Phase1Canvas.tsx`(추가), `src/components/v2/Phase2Canvas.tsx`(삭제).
   - 변경 요지:
     - `Phase2Canvas.tsx`: Display Fields 섹션(119~164줄) 통째 제거. 그에 딸린 `FIELD_LABELS`/`FIELD_ORDER` 상수와 `allOn/allOff/selectedCount`, `setField`도 Phase2에서 더 안 쓰면 정리(혹은 공유 위치로 이동). `fieldVisibility`/`updateFieldVisibility` 구조분해도 Phase2에서 미사용 시 제거.
     - `Phase1Canvas.tsx`: `OptionalDetailsAccordion`의 자식 `<div className="space-y-5">` 최하단(RatingPicker 아래, 271줄 다음)에 Display Fields 섹션을 추가. `photo.state.fieldVisibility`와 `photo.updateFieldVisibility` 사용(prop drilling 불필요 — 이미 `photo` 보유).
     - `FIELD_LABELS`/`FIELD_ORDER`를 Phase2에서 Phase1으로 옮기거나, 두 곳에서 쓸 일 없으면 Phase1 안에 둠.
     - 8개 키 disabled/dim 매핑(아래 표). dim 헬퍼 도입.
   - **disabled/dim 매핑표** (fieldVisibility 키 → Phase1 대상):
     | 키 (TicketField) | Phase1 대상 | 적용 지점 |
     |---|---|---|
     | `actors` | Cast (`p1-actors` Field, 161~168줄) | Field `disabled` + 래퍼 dim |
     | `watchDate` | Watched 블록 (raw date input + 포맷 토큰, 98~142줄) | 블록 전체 래퍼 dim + input·버튼 disabled |
     | `watchTime` | Showtime (`p1-watchTime` Field, 175~185줄) | Field `disabled` + 래퍼 dim |
     | `theater` | Theater (`p1-theater` Field, 148~158줄) | Field `disabled` + 래퍼 dim |
     | `screen` | Screen (`p1-screen` Field, 202~212줄) | Field `disabled` + 래퍼 dim |
     | `seat` | Seat (`p1-seat` Field, 218~228줄) | Field `disabled` + 래퍼 dim |
     | `runtime` | Runtime (`p1-runtime` Field, 187~194줄) | Field `disabled` + 래퍼 dim |
     | `bookingNo` | Booking No. (`p1-bookingNumber` Field, 236~246줄) — **키는 bookingNo, MovieInfo 필드는 bookingNumber** | Field `disabled` + 래퍼 dim |
   - 비대상(disabled 적용 안 함, 3절 근거): `title/titleOg/releaseDate/reissue/rating`(필수·핵심), `edition`(Phase1 입력 없음), `serialNo/collectionNo`(fieldVisibility 키 아님).
   - 슬라이스 완료 기준: DoD #26-a, #26-b 충족. typecheck 통과(특히 Phase2에서 미사용 import/변수 제거로 인한 unused 오류 0).

2. **Slice 2 — #25 Poster/OCR 박스 높이 통일** (이슈 #25) — Slice 1과 **순차**(같은 `Phase1Canvas.tsx`)
   - 파일: `src/components/v2/Phase1Canvas.tsx`(72줄 grid), `src/components/ImageUploader.tsx`(70~119줄 section/label/내부 div).
   - 충돌 라인: Slice 1이 Phase1Canvas 하단(아코디언)을 건드리고, 이 슬라이스는 상단 Poster 그리드(70~85줄)를 건드려요. 라인 영역은 다르지만 같은 파일이라 **순차로** 진행해 머지 충돌을 피해요.
   - 변경 요지:
     - `Phase1Canvas.tsx` 72줄 `grid grid-cols-2 gap-4` → `items-stretch` 추가.
     - `ImageUploader.tsx`: 최상위 `<section>`(70줄)과 내부 `<label>`(71줄)에 `h-full` 추가. label 내부 콘텐츠 컨테이너(83줄 `flex items-start justify-between`)를 세로 중앙 정렬되도록 `flex flex-col justify-center` 구조로 조정(현재 가로 배치 유지가 필요하면 바깥 래퍼에 `flex flex-col justify-center h-full`로 감싸고 기존 가로 row는 안쪽에 둠).
   - 주의: `OcrUploadCard`는 `paddingBottom:'150%'` aspect-ratio trick(223줄)으로 높이를 만들어요. `items-stretch`는 ImageUploader를 OCR 카드 높이에 맞춰 늘려요. OCR 카드 자체 구조는 건드리지 않는 게 안전(이슈 범위는 ImageUploader 정렬).
   - 완료 기준: DoD #25-a, #25-b.

3. **Slice 3 — #23 cineq·선택 안함 시 Format 칩 숨김 + chain 변경 시 format 초기화** (이슈 #23) — Slice 1과 **순차**(같은 `Phase2Canvas.tsx`)
   - 파일: `src/components/v2/Phase2Canvas.tsx`(81~94줄), 선택적으로 `src/components/wizard/FormatPicker.tsx`(미수정 권장), `src/utils/chainFormatMap.ts`(미수정, `allowedFormatsForChain` 재사용).
   - 충돌 라인: Slice 1이 Phase2의 Display Fields 섹션(119~164줄)을 삭제하고, 이 슬라이스는 Theater(79~85줄)·Format(87~94줄) 섹션을 수정해요. 영역은 다르지만 같은 파일이라 Slice 1 **이후** 순차 진행.
   - 변경 요지:
     - Theater chain onChange(83줄): `onChange={(chain) => setComp({ chain })}` → chain 변경 시 새 chain 기준으로 format 호환성 판단해 비호환이면 함께 초기화. 예: `import { allowedFormatsForChain } from '@/utils/chainFormatMap'` 후 `(chain) => { const allowed = allowedFormatsForChain(chain); const keepFormat = allowed ? allowed.includes(components.format) : false; setComp({ chain, ...(keepFormat ? {} : { format: '' }) }); }` (allowed가 null=숨김 대상이면 format 무조건 클리어).
     - Format 섹션(87~94줄): `allowedFormatsForChain(components.chain) !== null`일 때만 `<section>…</section>` 렌더(헤더 포함 조건부). 즉 cgv/lotte/megabox에서만 노출, cineq/선택 안함에선 숨김.
   - 완료 기준: DoD #23-a/b/c.

4. **Slice 4 — #29 제목 자동완성 드롭다운 flicker 제거** (이슈 #29) — **[병렬 가능]** (`MovieInfoForm.tsx` 단독)
   - 파일: `src/components/MovieInfoForm.tsx`(185~192줄 onChange).
   - 현재 상태: onChange에 **이미** IME 가드(`if (isComposingRef.current || value.trim().length < 2) return;`, 190줄)와 `onCompositionStart/End` 처리(179~184줄)가 있어요. **남은 버그는 188줄 `setShowResults(false)` 단 하나** — 타이핑마다 드롭다운을 닫아 flicker를 만들어요.
   - 변경 요지:
     - 188줄 `setShowResults(false);` **제거**. 대신 "2자 미만/빈 문자열일 때만 닫기"를 명시적으로 처리: 예) `if (value.trim().length < 2) setShowResults(false);`를 가드 앞에 둬서 짧은 입력일 때만 닫고, 2자 이상이면 기존 결과를 유지한 채 debounce 검색이 갱신하도록.
     - IME 조합 중에도 드롭다운을 강제로 닫지 않음(이미 가드가 검색만 막고 있으므로, `setShowResults(false)` 제거로 충족).
     - (선택, 이슈의 추가 개선) `searchCacheRef`를 모듈 스코프 `Map`으로 격상해 리마운트 시 세션 내 캐시 영속 — **선택 항목이라 기본 범위에서 제외**, 시간 여유 시만.
   - 완료 기준: DoD #29-a/b.

5. **Slice 5 — #24 헤더 GitHub 링크 아이콘** (이슈 #24) — **[병렬 가능]** (`AppHeader.tsx` 단독)
   - 파일: `src/components/v2/AppHeader.tsx`(47줄 `<ThemeToggle/>` 앞).
   - 변경 요지: 47줄 `<ThemeToggle>`를 `<div className="flex items-center gap-2">`로 감싸고 그 안에서 ThemeToggle 왼쪽에 GitHub `<a>` 추가. 인라인 SVG(GitHub mark), `href="https://github.com/Lyainc/PhototicketMaker"`, `target="_blank" rel="noopener noreferrer"`, 색상 `text-fg-muted hover:text-fg`, `aria-label="GitHub 저장소"`. 외부 이미지/라이브러리 없이 인라인 path만 사용. ThemeToggle 아이콘이 14px이므로 크기를 맞춰 `width/height` 18~20px 내에서 시각 균형 조정.
   - 완료 기준: DoD #24-a.

## 5. 의존성 / 선행 조건

- **청크 내부 순서 의존**: Slice 1(#26) → Slice 2(#25) → Slice 3(#23)은 공유 파일 때문에 순차. Slice 4(#29)·Slice 5(#24)는 독립이라 어느 시점에든 병렬 가능.
- **청크 외부 의존**: 없음. **독립**. 환경변수·외부 서비스·다른 청크 산출물에 의존하지 않아요. (#29의 KOBIS 검색은 기존 `/api/kobis/search`를 그대로 쓰고 이 청크에서 API는 안 건드려요.)
- 참고 상수: `SCREENING_FORMATS`(`src/utils/constants.ts` 26줄 = `[NONE, ...FORMAT_ASSETS]`), `CHAIN_FORMAT_MAP`/`allowedFormatsForChain`(`src/utils/chainFormatMap.ts`)은 읽기만 하고 수정하지 않아요.

## 6. E2E 자가 검증 방법 (에이전트가 스스로 수행)

### 정적 게이트 (모든 슬라이스 후 공통)
- 명령: `bun run typecheck` → 종료코드 0, 출력에 error 없음. (Slice 1에서 Phase2 미사용 import/변수 제거 누락 시 TS6133/unused 경고가 잡힘 — 0이어야 통과.)
- 명령: `bun test` → 모든 테스트 pass.
- 명령: `bun run build` → `Compiled successfully`, 종료코드 0.

### 슬라이스별 수동/시각 검증 (`bun run dev` 후 브라우저)
- **#23**: Phase2 진입 → Theater에서 `cgv` 선택 → Format 칩 노출 확인 → 임의 포맷(예 IMAX) 선택 → Theater를 `씨네큐(cineq)`로 변경 → **Format 섹션(헤더 포함)이 사라지고** 미리보기 티켓에서 IMAX 스탬프가 없어졌는지 확인. → Theater를 `선택 안함`으로 변경 → 동일하게 Format 섹션 없음. → 다시 `lotte` 선택 후 lotte 전용 포맷 선택 → `megabox`로 변경 시 비호환 포맷이 자동 해제되는지(기존 동작 회귀 없음) 확인.
- **#25**: Phase1 상단 Poster 섹션에서 좌(포스터 업로드)·우(OCR) 두 박스의 **상단·하단 모서리가 같은 높이**인지 육안 확인. 포스터 박스 내부 텍스트가 세로 중앙에 오는지 확인. (정렬 어긋나면 실패.)
- **#26**: Phase1 → Optional details 아코디언 펼침 → 최하단에 Display Fields 섹션이 보이는지 확인. Phase2로 이동해 Display Fields가 **없는지** 확인. Phase1으로 돌아와 예: `Seat` 토글 해제 → Seat 입력 필드가 흐려지고(`opacity-40`) 클릭/입력 불가(`pointer-events-none`)인지 확인. `Watched` 해제 시 date input과 포맷 토큰 버튼 4개가 모두 비활성화되는지 확인. `Booking No.` 토글 해제가 `p1-bookingNumber` 입력을 막는지 확인(키 bookingNo ↔ 필드 bookingNumber 매핑 정확성). 전체 선택/전체 해제 버튼과 `n/14 selected` 카운트가 정상인지 확인.
- **#29**: Phase1 Title 입력창에 한글로 "인터스텔라"를 한 글자씩 타이핑 → 2자 이상부터 드롭다운이 뜬 뒤 **타이핑 중 닫혔다 열리는 깜빡임이 없는지** 관찰(통과 기준: 한 번 열리면 결과 갱신만 되고 사라지지 않음). 입력을 1자로 지우면 드롭다운이 닫히는지 확인. IME 조합 중간(받침 입력 중)에도 깜빡이지 않는지 확인.
- **#24**: 헤더 우측에서 ThemeToggle 왼쪽에 GitHub 아이콘이 보이는지, 클릭 시 새 탭으로 `github.com/Lyainc/PhototicketMaker`가 열리는지, hover 시 색이 `text-fg`로 진해지는지 확인. 라이트/다크 모드 모두에서 아이콘 대비가 적절한지 확인.

### 자동 테스트로 못 잡는 부분 (수동 체크 명시)
- 박스 높이 정렬(#25), 드롭다운 flicker(#29), dim 시각 처리(#26), 새 탭 링크(#24)는 단위 테스트로 검증이 어려워 위 브라우저 절차로 수동 확인.

## 7. 리스크 / 롤백

- **#26 (가장 큰 리스크)**: Phase2에서 Display Fields 섹션을 제거할 때 `FIELD_LABELS`/`FIELD_ORDER`/`setField`/`fieldVisibility` 등 미사용 심볼을 덜 정리하면 typecheck/lint 실패. 또 `title/releaseDate/rating` 등 필수 필드를 실수로 disabled 대상에 넣으면 입력 자체가 막혀 UX 회귀. → 매핑은 8개 키로 한정(3절·4절 표). 롤백: `git revert` 또는 해당 슬라이스 커밋 되돌리기.
- **#23**: chain onChange에서 format 초기화 로직을 잘못 짜면 cgv↔lotte 전환 시 정상 포맷까지 날아갈 수 있어요. `allowed.includes(components.format)` 판정을 정확히. FormatPicker의 기존 self-correction useEffect는 **남겨둬** 이중 안전망. 롤백: onChange 한 줄과 Format 섹션 조건부만 되돌리면 됨(국소적).
- **#25**: `items-stretch` + `h-full`로 ImageUploader를 OCR 카드 높이(150% padding)에 맞춰 늘릴 때 내부 콘텐츠 레이아웃이 깨질 수 있어요(특히 `busy` Processing 표시). 세로 중앙 정렬 래퍼만 추가하고 기존 가로 row 구조는 보존. 롤백: 클래스 추가분만 제거.
- **#29**: `setShowResults(false)` 제거 후 "짧은 입력 시 닫기" 가드를 빠뜨리면 1자/빈 입력에서도 빈 드롭다운이 떠 있을 수 있어요. 명시적 `if (length < 2) setShowResults(false)` 추가로 방어. 롤백: 한 줄 복원.
- **#24**: 마크업 추가뿐이라 리스크 최소. 헤더 `justify-between` 레이아웃에서 우측 그룹이 두 요소가 되므로 래퍼 div로 묶어 정렬 깨짐 방지. 롤백: 추가한 `<a>`/래퍼 제거.
- **공통 회귀 안전망**: 각 슬라이스 후 `bun run typecheck && bun test && bun run build`를 돌려 게이트 통과를 확인하고 다음 슬라이스로 진행.
