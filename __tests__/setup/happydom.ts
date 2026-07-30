import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

// testing-library의 `findBy*`/`waitFor` 기본 대기는 1000ms인데, 그건 로컬 머신 속도를
// 전제한 값이다. CI 러너에서 스위트가 5배 느려지면(#593 실측: 186.9s vs 로컬 36.2s)
// 렌더가 실제로 끝나는데도 1000ms에 걸려 `Unable to find role=...`로 떨어진다 — 첫
// ubuntu run에서 그렇게 깨진 게 24개였다. 5배 헤드룸을 준다. 상한을 무한정 올리지 않는
// 이유는 진짜로 안 나타나는 엘리먼트를 기다리는 비용이 그만큼 늘기 때문이다.
//
// **`import`가 아니라 `require`인 게 핵심이다.** ESM import는 호이스팅돼서 위
// `register()`보다 먼저 실행되고, 그러면 testing-library가 DOM 없는 전역을 붙잡아
// 스위트가 통째로 깨진다(실측 2026-07-30: 941 pass → 687 pass / 258 fail). CLAUDE.md의
// `mock.module` 후 `require` 규약과 같은 이유다 — 등록 **뒤에** 로드해야 한다.
// eslint-disable-next-line @typescript-eslint/no-var-requires
(require('@testing-library/react') as typeof import('@testing-library/react')).configure({ asyncUtilTimeout: 5000 });

// Lets React's `act()` run outside a test renderer (react-dom/client mounts).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// happy-dom doesn't implement Element.scrollIntoView. Components that nudge a
// freshly-revealed section into view (e.g. the OCR undo banner) call it
// from a timer that can fire mid-test, so stub it to a no-op to keep renders safe.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
