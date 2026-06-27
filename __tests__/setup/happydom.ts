import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

// Lets React's `act()` run outside a test renderer (react-dom/client mounts).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// happy-dom doesn't implement Element.scrollIntoView. Components that nudge a
// freshly-revealed section into view (e.g. EditorCanvas's OCR banner) call it
// from a timer that can fire mid-test, so stub it to a no-op to keep renders safe.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
