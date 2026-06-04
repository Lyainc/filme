# Goal: 티켓 카드 렌더링 표시 개선 (Cast 축약 + FormatStamp 시인성)

> 티켓 카드의 배우 목록을 3명 초과 시 축약 표시하고, 상영 포맷 로고의 캡처 결과물 내 시인성을 개선한다. 포함 이슈: #27, #28

## 1. 배경 / 왜 이 단위인가

**공유 파일 기반 묶음.**
두 이슈 모두 `_shared.tsx`(공통 primitive 정의)와 4개 mood 컴포넌트(`MoodMinimal`, `MoodCriterion`, `Mood35mm`, `MoodEditorial`) 전체를 동시에 건드린다. 별도 청크로 나누면 `_shared.tsx` 에서 충돌이 발생하거나, 한 쪽의 변경이 다른 쪽의 캡처 검증을 오염시킬 위험이 있다.

**도메인 근접성.**
두 변경 모두 "캡처 결과물에서의 시각 품질"을 다루며, 검증 방법이 동일하다(mood별 캡처 후 육안 확인). 함께 처리하면 검증 라운드를 1회로 통합할 수 있다.

**실행 순서 근거.**
Slice 1(#27 `truncateActors` helper 추가)은 `_shared.tsx`에 새 export를 추가하는 것으로 시작한다. Slice 2(#27 각 mood 적용)는 Slice 1 완료 후 진행해야 한다. Slice 3(#28 FormatStamp 크기 조정)은 Slice 1/2와 건드리는 코드 영역이 다르므로(actors 렌더 라인 vs FormatStamp size prop 라인) 이론상 병렬 가능하나, 같은 파일을 수정하므로 충돌 회피를 위해 순차 처리를 권장한다.

## 2. 완료 조건 (Definition of Done)

- [ ] `_shared.tsx`에 `truncateActors(actors: string, max?: number): string` helper가 export되어 있다
- [ ] `truncateActors` 동작: 입력 문자열을 쉼표로 split → max(기본 3) 이하이면 원본 반환, 초과이면 "A, B, C 외 N명" 형태로 반환
- [ ] `MoodMinimal`의 `actorsVal` 렌더에 `truncateActors` 적용되어 있다
- [ ] `MoodCriterion`의 `actorsVal` 렌더에 `truncateActors` 적용되어 있다
- [ ] `Mood35mm`의 actors 렌더에 `truncateActors` 적용되어 있다
- [ ] `MoodEditorial`의 actors 렌더에 `truncateActors` 적용되어 있다
- [ ] 입력 폼(Phase1) 원본 actors 문자열은 수정되지 않는다 — `truncateActors`는 렌더 레이어에서만 호출된다
- [ ] 각 mood에서 `FormatStamp`에 전달하는 `size` 또는 base 높이 조정이 완료되어, 96×2 = 192px 이상의 실효 높이를 갖거나 mood별 검토 기준을 만족한다
- [ ] `bun run typecheck` 통과 (tsc --noEmit 오류 없음)
- [ ] `bun run build` 통과 (빌드 오류 없음)
- [ ] 4개 mood 각각의 캡처 결과물에서 배우 축약 표기 육안 확인 완료
- [ ] 4개 mood 각각의 캡처 결과물에서 포맷 로고 가독성 육안 확인 완료

## 3. 쟁점과 트레이드오프

### #27 — truncateActors 구현 방식

**쟁점: 쉼표 split 기준**
현재 `actors` 필드는 자유 텍스트 문자열(`"매튜 맥커너히, 앤 해서웨이, ..."`)로 저장된다. 쉼표(`, `)로 split 하면 이름 자체에 쉼표가 포함된 경우 오작동할 수 있다. 하지만 KOBIS/TMDB 배우 이름 데이터는 실질적으로 쉼표를 이름 안에 포함하지 않으므로 쉼표 split이 안전하다. 권장: `actors.split(',').map(s => s.trim())` 사용.

**쟁점: helper 위치**
이슈 #27 명세대로 `_shared.tsx`에 추가. mood 내부에 inline 구현하면 4곳에 중복이 생기므로 shared가 올바른 위치다.

**쟁점: 현재 mood에는 이미 CSS `-webkit-line-clamp: 2` 처리가 있음**
`MoodMinimal`, `MoodCriterion`, `MoodEditorial`은 이미 `WebkitLineClamp: 2`, `overflow: hidden`으로 긴 텍스트를 CSS 차원에서 잘라낸다. `Mood35mm`도 동일한 처리가 있다. 그럼에도 `truncateActors`를 JS 레이어에서 적용하는 이유: CSS clamp는 줄바꿈 단위로 자르지만 의미 단위(몇 명인지)를 사용자에게 알려주지 않는다. "외 N명" 표기는 CSS로는 구현 불가하다. 양쪽을 함께 유지하되, `truncateActors`가 이미 "A, B, C 외 N명"으로 줄인 문자열을 clamp가 추가 보호하는 구조가 적절하다.

### #28 — FormatStamp 크기 조정 전략

현재 각 mood의 `size` prop 값:

| mood | size prop | 실효 높이 (64 × size) |
|------|-----------|----------------------|
| MoodMinimal | 0.9 | 57.6 px |
| MoodCriterion | 0.78 | 49.9 px |
| Mood35mm | 0.8 | 51.2 px |
| MoodEditorial | 0.85 | 54.4 px |

모두 50~58 px 수준으로 캡처(pixelRatio: 2) 후 실물 100~116 px에 해당한다. IMAX/4DX 같은 가로 비율 로고는 등고 대비 가로가 매우 길어 시각적으로 작아 보인다.

**선택지 A — base 높이 일괄 상향 (64 → 96)**
- 장점: 단일 지점 수정, 일관성 유지
- 단점: 각 mood의 레이아웃 여백/정렬 상황이 달라 일부 mood에서 공간을 초과할 수 있음. Criterion의 top-right stamp 패널(`padding: '10px 16px'`)은 ChainStamp(size 1.05 → 48×1.05 = ~50px)와 높이를 맞추는데, base 상향 시 FormatStamp가 더 커져 패널 높이 불균형이 생길 수 있음.

**선택지 B — mood별 size prop 개별 상향 (권장)**
- 장점: 각 mood의 레이아웃 맥락에서 최적값 선택 가능, 회귀 범위가 mood 단위로 격리됨
- 단점: 4곳 수정 필요

권장 결정: **선택지 B**. mood별 권장 상향값(초안):
- MoodMinimal: `0.9 → 1.4` (실효 ~90 px). 우하단 독립 배치, 공간 여유 있음.
- MoodCriterion: `0.78 → 1.0` (실효 64 px). ChainStamp와 같은 패널 내 배치, ChainStamp height 48×1.05 ≈ 50 px와 균형 고려해 소폭만 올림. 패널 높이는 `padding: '10px 16px'`으로 자동 조절됨.
- Mood35mm: `0.8 → 1.2` (실효 ~77 px). 우상단 독립 배치, `-3deg` 회전 적용 위치라 공간 여유 있음.
- MoodEditorial: `0.85 → 1.2` (실효 ~77 px). header row 내 inline-flex, ChainStamp height 48×1.0 ≈ 48 px보다 더 커지므로 row 높이가 늘어남. 허용 범위 내이나 캡처 확인 필요.

최종값은 캡처 후 육안 확인으로 fine-tune 한다.

## 4. 슬라이스 순서 (goal 내부 실행 순서)

1. **Slice 1 — `truncateActors` helper 추가** (이슈 #27)
   - 건드리는 파일: `src/components/moods/_shared.tsx`
   - 변경 요지: 파일 말미에 `export function truncateActors(actors: string, max = 3): string` 추가. 로직: 빈 문자열 guard → `split(',').map(trim)` → length ≤ max이면 `join(', ')` 반환, 초과이면 앞 max개 join + ` 외 ${length - max}명` append.
   - 완료 기준: export 확인, 타입체크 통과.
   - 참고: 이 슬라이스는 다른 파일에 영향 없음 — 안전하게 단독 커밋 가능.

2. **Slice 2 — 4개 mood에 `truncateActors` 적용** (이슈 #27)
   - Slice 1 완료 후 진행 (import 의존).
   - 건드리는 파일: `MoodMinimal.tsx`, `MoodCriterion.tsx`, `Mood35mm.tsx`, `MoodEditorial.tsx` (4파일 병렬 수정 가능)
   - 변경 요지 (mood별):
     - **MoodMinimal** (L63, L176-206): `_shared` import에 `truncateActors` 추가. `actorsVal`을 `gate(fv?.actors, d.actors)`로 gate한 뒤 렌더 시점에 `truncateActors(actorsVal)`로 래핑. 또는 `actorsVal` 초기화 시점에 `truncateActors(gate(...))` 적용.
     - **MoodCriterion** (L45, L214-231): 동일 패턴. `actorsVal` 렌더(`with {actorsVal}`) 부분에서 `truncateActors` 호출.
     - **Mood35mm** (L210-228): `gate(fv?.actors, d.actors)` 인라인 호출 2곳을 변수로 추출 후 `truncateActors` 적용.
     - **MoodEditorial** (L224, L252): `gate(fv?.actors, d.actors)` 인라인 호출을 변수화 후 `truncateActors` 적용.
   - 완료 기준: 각 mood에서 배우 4명 이상 입력 시 "A, B, C 외 N명" 표시 확인.

3. **Slice 3 — `FormatStamp` size prop 상향** (이슈 #28)
   - Slice 2 완료 후 진행 (같은 파일 수정, 충돌 회피).
   - 건드리는 파일: `MoodMinimal.tsx`(L296), `MoodCriterion.tsx`(L150), `Mood35mm.tsx`(L134), `MoodEditorial.tsx`(L116)
   - 변경 요지: 각 mood의 `<FormatStamp ... size={X} />` 에서 size 값을 섹션 3 권장값으로 상향. Criterion은 ChainStamp와 같은 패널 내이므로 패널 overflow 여부 시각 확인 필수.
   - 완료 기준: 4개 mood 캡처에서 포맷 로고가 충분히 식별 가능한 크기로 렌더됨.

## 5. 의존성 / 선행 조건

독립. 외부 청크, 환경변수, 외부 서비스 의존 없음.

- `_shared.tsx`의 현재 exports(`gate`, `FormatStamp` 등)가 안정적이며 이 청크에서 breaking 변경하지 않음.
- `actors` 필드가 쉼표 구분 문자열로 저장되는 현행 규약이 유지된다는 전제 하에 `truncateActors` 구현.

## 6. E2E 자가 검증 방법 (에이전트가 스스로 수행)

### 정적 검증

```bash
cd /Users/Lyainc/dev/prj/PhototicketMaker

# 타입체크
bun run typecheck
# 기대: 종료코드 0, 오류 없음

# 빌드
bun run build
# 기대: 종료코드 0, "Route (pages)" 테이블 출력
```

### truncateActors 단위 로직 검증

타입체크 통과 후 아래 시나리오를 `_shared.tsx` 소스에서 추적 확인:
- 입력 `"A, B"` (2명) → 원본 반환 `"A, B"`
- 입력 `"A, B, C"` (3명) → 원본 반환 `"A, B, C"`
- 입력 `"A, B, C, D"` (4명) → `"A, B, C 외 1명"`
- 입력 `"A, B, C, D, E, F"` (6명) → `"A, B, C 외 3명"`
- 입력 `""` (빈 문자열) → `""` (guard 처리)

### UI 시각 검증

```bash
bun run dev
# 브라우저에서 http://localhost:3000 접근
```

**배우 축약 확인 절차:**
1. Phase 1(입력 폼)에서 배우 필드에 4명 이상 입력: `"매튜 맥커너히, 앤 해서웨이, 제시카 차스테인, 마이클 케인, 케이시 애플렉"`
2. Phase 2/3에서 티켓 미리보기로 이동
3. LayoutPicker에서 4개 mood를 각각 선택
4. 각 mood 미리보기에서 배우 표시가 "매튜 맥커너히, 앤 해서웨이, 제시카 차스테인 외 2명"으로 렌더되는지 확인
5. 다운로드(Export) 실행 → 저장된 JPEG에서 동일 표기 확인

**FormatStamp 크기 확인 절차:**
1. 컴포넌트 선택 패널에서 상영 포맷을 IMAX 또는 4DX로 설정
2. 4개 mood 각각에서 미리보기 확인
3. 다운로드(Export) 실행 → 저장된 JPEG를 100% 줌으로 열어 포맷 로고가 명확히 읽히는지 확인
4. 통과 기준: 로고 텍스트/아이콘이 육안으로 식별 가능하고, 주변 요소(ChainStamp, Barcode)와 시각적 균형이 맞음

**폼 원본 보존 확인:**
1. 다운로드 후 Phase 1로 돌아가서 배우 필드 값이 원본 전체 문자열임을 확인

### 자동 테스트로 못 잡는 수동 체크

- [ ] Criterion mood: FormatStamp size 상향 후 top-right stamp 패널(`padding: '10px 16px'`) 내 ChainStamp/FormatStamp 높이 균형 — 패널이 과도하게 커지거나 잘리지 않는지
- [ ] Editorial mood: header row 내 FormatStamp size 상향 후 `runtime` 텍스트와 정렬이 어긋나지 않는지
- [ ] 35mm mood: FormatStamp `rotate(-3deg)` 회전 시 로고 경계가 포스터 이미지 영역을 과도하게 침범하지 않는지

## 7. 리스크 / 롤백

### 리스크

**레이아웃 회귀 (높음 — FormatStamp 크기 변경)**
`size` 상향 시 ChainStamp와 같은 컨테이너에 있는 mood(Criterion, Editorial)는 컨테이너 높이가 늘어날 수 있다. Criterion의 top-right stamp 패널과 Editorial의 header row가 주요 위험 지점이다. 캡처 결과물에서 인접 요소 겹침 또는 overflow 발생 가능.

**truncateActors 오작동 — 이름에 쉼표 포함 시**
현재 규약에서는 발생하지 않지만, 미래에 쉼표 포함 이름이 입력되면 잘못 분리된다. 이슈 #27 명세는 쉼표 기준을 명시하므로 현재는 허용 범위 내.

**CSS clamp와 JS truncate 중복 적용**
`WebkitLineClamp: 2` + `truncateActors`가 동시 적용된다. JS truncate가 항상 1줄로 맞지 않을 수 있어(이름 자체가 길면) CSS clamp가 2줄로 추가 표시할 수 있다. 이는 기능상 문제 아니나, 시각 검증에서 1줄 vs 2줄 케이스를 확인해야 한다.

### 회귀 위험 완화

- Slice 3에서 size 값을 조금씩 올리며 캡처 확인 후 확정 (일괄 상향 후 확인보다 점진적 접근 권장)
- Editorial mood의 header row는 flex 레이아웃이라 높이 자동 조정되므로 캡처에서 다른 row와의 간격만 확인하면 됨

### 롤백 방법

- `_shared.tsx`에서 `truncateActors` export 제거 → 각 mood에서 호출 제거: git revert 또는 수동으로 삭제
- FormatStamp size 값 원복: 각 mood별 원래 size 값으로 되돌림
  - MoodMinimal: `0.9`
  - MoodCriterion: `0.78`
  - Mood35mm: `0.8`
  - MoodEditorial: `0.85`
