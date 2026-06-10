import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

// Lets React's `act()` run outside a test renderer (react-dom/client mounts).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
