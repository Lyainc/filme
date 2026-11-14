# 테스트 — 규칙의 근거와 실측

`CLAUDE.md`의 "🧪 Testing" 절은 **규칙만** 쥔다. 그 규칙이 어디서 나왔는지(실측 숫자, 오진 이력, 이슈 번호)는 여기에 있다. 규칙을 바꾸거나 "왜 이렇게 쓰나"가 의심될 때 읽는다.

목차

1. 러너와 CI 문턱 일치 (#714)
2. 테스트별 명시 timeout이 CLI `--timeout`을 이긴다
3. 두 부류와 DOM 환경 (#163)
4. 모듈 mock과 hoisting
5. mock.module 복원은 스프레드 스냅샷으로 (#611)
6. 실패가 macOS/Linux로 갈리면 실행 순서를 먼저 의심 (#611)
7. 모듈 스코프 메모는 리셋 함수로 (#611)
8. 단언의 `received`에 DOM 엘리먼트를 넣지 않는다 (#693·#811)
9. 회귀 테스트 예 (#141)

---

## 1. 러너와 CI 문턱 일치 (#714)

**Runner**: `bun run test`(= `bun test --timeout 30000`). Tests live in `__tests__/` (not co-located).

**맨 `bun test`로 재지 않는다 — CI와 다른 문턱을 잰다.** CI는 `bun test --timeout 30000`으로 도는데 bun 기본은 5000ms라, 맨 `bun test`는 게이트보다 6배 엄한 걸 재고 부하가 걸리면 **CI가 원리적으로 못 내는 실패**를 로컬에서만 낸다.

2026-08-16 실측: dev 서버 3대 + 헤드리스 Chrome과 함께 돌린 전 스위트 1172개에서 최댓값 4.976초 — 기본 5000ms까지 여유 **24ms**. 부하 배수는 중앙 1.42× · p90 1.88×인데 개별로는 33×까지 튄다.

`package.json`의 `test`/`test:watch`가 CI와 같은 값을 들고 있고, 한쪽만 바뀌면 `__tests__/ciLocalTimeoutParity.test.ts`가 깨진다.

## 2. 테스트별 명시 timeout이 CLI `--timeout`을 이긴다

bun 1.3.14 실측 — `--timeout 100`에서 명시값 없는 6개는 죽고 명시 35000을 가진 6개는 산다. 예전 주석은 이걸 정반대로 적어놨었다. 그래서 호출 방법에 안 기대는 유일한 방어는 **파일에 명시값을 거는 것**이고, `captureDualRendererPixelDiff.test.ts`가 그 예다. 무드 캔버스를 통째로 합성하는 부류라 파일 전체가 같은 값을 쓴다 — @1x/@2x로 보호를 가르면 부하 순간 안 가른 쪽만 죽고, 실제로 그렇게 됐다.

## 3. 두 부류와 DOM 환경 (#163)

- **두 부류**: (1) 순수 유닛·static-markup(`renderToStaticMarkup`), (2) **상호작용 테스트** — happy-dom + `@testing-library/react` + `user-event`로 사용자 동작→상태→결과를 검증(#163).
- **DOM 환경**: `bunfig.toml`의 `[test] preload = ["./__tests__/setup/happydom.ts"]`가 happy-dom 글로벌 + `IS_REACT_ACT_ENVIRONMENT`를 등록. happy-dom 미구현 API(예: `scrollIntoView`)는 그 setup에 no-op 폴리필로 추가.
## 4. 모듈 mock과 hoisting

bun `mock.module`은 hoisting 안 됨 — mock 등록 **후** `require(...)`로 대상(예: `runOcr`)을 import해야 가로채진다. top-level `await import`는 tsconfig `target:es5`에서 막히니 `require`를 쓴다.

## 5. mock.module 복원은 스프레드 스냅샷으로 (#611)

`mock.module`은 프로세스 전역이고 파일이 끝나도 안 풀린다. `const real = require(p)`로 **살아있는 네임스페이스**를 붙들면 뒤이은 `mock.module(p, ...)`이 그 객체를 제자리에서 갈아끼우므로, `afterAll`의 `mock.module(p, () => real)`은 이미 스텁이 된 자기 자신을 다시 설치하는 **no-op**이다. 반드시 `const real = { ...require(p) }`로 복사해 두고 그걸로 되돌린다 — 안 그러면 스텁이 프로세스 끝까지 남아 뒤에 도는 파일이 깨진다.

## 6. 실패가 macOS/Linux로 갈리면 실행 순서를 먼저 의심 (#611)

`bun test`의 파일 실행 순서는 플랫폼마다 다르고, **인자로 준 순서를 따르지도 않는다** — 그래서 "CI 순서를 로컬에서 재생했는데 통과했다"는 순서 의존을 배제하지 못한다. 대신 **깨진 파일을 단독 실행**해 본다(단독은 통과 = 전역 누수, 단독도 실패 = 진짜 환경 결합). #611의 42개는 전부 전자였다.

## 7. 모듈 스코프 메모는 리셋 함수로 (#611)

테스트가 모듈 스코프 메모를 비워야 하면 `delete require.cache[...]` 말고 리셋 함수를 연다. 그 모듈이 어딘가에서 한 번이라도 `mock.module`되면 캐시를 지워도 mock 레지스트리가 먼저 잡아 같은 인스턴스를 돌려줘 우회가 조용히 무력화된다 (`captureToImage.resetCtxFilterProbeForTest` 참고).

## 8. 단언의 `received`에 DOM 엘리먼트를 넣지 않는다 (#693·#811)

실패할 수 있는 단언의 `received`에 DOM 엘리먼트를 그대로 넣지 말고 `!!el`/`el === null`로 강제 변환한다. bun의 실패 직렬화가 happy-dom 노드의 그래프 전체를 찍는다: `expect(<HTMLButtonElement>).toBeNull()` 한 번 실패에 **697MB · 4.6초**, 같은 명제를 `expect(!!el).toBe(false)`로 쓰면 64자 · 0ms(실측).

**`waitFor` 안이 제일 위험하다.** 첫 즉시 검사가 실패하는 건 재시도 루프의 정상 동작인데, 그 정상 실패 한 번에 4.6초가 날아가 두 번이면 bun의 5초 per-test 타임아웃을 넘긴다. #693이 정확히 그거였고, 증상이 "타임아웃"으로 보여서 타이밍·act·폴링 문제로 오진하기 쉽다. 그 오진을 한 번 했다 — `waitFor`는 promise 콜백의 상태 변화를 8ms에 잡는다. RTL의 `asyncWrapper`가 act 환경을 오히려 끄기 때문에 act와도 무관하다. 조건이 첫 검사에서 이미 참인 `waitFor`는 멀쩡히 통과하므로, **다른 `waitFor`가 다 통과한다는 건 안전의 근거가 못 된다.**

이제 `bun run lint`가 강제한다(#811) — `eslint.config.mjs`의 `__tests__` 블록이 `queryBy*`·`querySelector`·`closest`·`getElementById` 결과를 받은 `toBeNull()`을 `no-restricted-syntax`로 막는다. 이름만 보고 판정하니 변수나 헬퍼(`cropDialog()` 류)로 한 번 감싸면 lint가 못 잡는다 — 그 자리는 손으로 `=== null`로 쓴다.

## 9. 회귀 테스트 예 (#141)

`__tests__/ocrUndoRestore.test.tsx` — OCR undo가 chainVisible/chainLabel + 폼 필드를 원자 복원하는지(#141 P1) 검증. 새 상호작용 테스트는 testing-library로 통일 권장.
