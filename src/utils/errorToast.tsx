import { useSyncExternalStore } from 'react';

export interface ShowErrorOptions {
  /** true면 사용자가 닫기 전까지 남는다. 기본(false)은 4초 후 자동으로 사라진다. */
  persistent?: boolean;
}

interface ErrorToastState {
  message: string;
  persistent: boolean;
}

const EPHEMERAL_MS = 4000;

let state: ErrorToastState | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function armDismiss() {
  clearTimeout(dismissTimer);
  dismissTimer = setTimeout(dismissError, EPHEMERAL_MS);
}

/**
 * 실패 알림 단일 진입점(#645) — 셸 컴포넌트의 로컬 state가 아니라 모듈 싱글턴이 상태를 쥔다.
 * usePosterCrop·usePhototicket처럼 셸 트리 밖(훅)에서도 prop 없이 바로 호출할 수 있고,
 * <ErrorToastHost/> 하나가 구독해 렌더한다. OcrUploadCard의 트리거-바로-아래 토스트는
 * 별개 UX 의도(#645 논의)라 이 진입점을 타지 않고 자기 로컬 토스트를 그대로 쓴다.
 */
export function showError(message: string, opts: ShowErrorOptions = {}): void {
  const persistent = !!opts.persistent;
  // 같은 실패가 반복 호출돼도(예: 자동저장이 매 tick 실패) 배너를 다시 마운트하지 않는다 —
  // 텍스트가 같으면 재생 애니메이션도 없고, ephemeral 타이머만 다시 늘어난다.
  if (state && state.message === message && state.persistent === persistent) {
    if (!persistent) armDismiss();
    return;
  }
  // 우선순위(#731 code-review 발견) — persistent 경고는 사용자가 직접 닫기 전까지 남아야
  // 하는데, 그 사이 다른 곳에서 온 ephemeral 호출이 무조건 덮어쓰면 4초 뒤 자동으로 사라져
  // 더 중요한 경고를 조용히 지운다. persistent가 떠 있는 동안 ephemeral 호출은 무시한다.
  if (state?.persistent && !persistent) return;
  state = { message, persistent };
  emit();
  if (persistent) clearTimeout(dismissTimer);
  else armDismiss();
}

export function dismissError(): void {
  clearTimeout(dismissTimer);
  state = null;
  emit();
}

// 모듈 싱글턴이라 프로세스(=bun test 전체 실행) 내내 남는다 — ErrorToastHost를 한 번도 안 마운트하는
// renderHook 테스트(usePhototicket을 직접 부르는 draftImageRestore.test.tsx 등)가 persistent
// showError를 남기면, 그걸 마운트하는 아무 관계 없는 뒤 테스트가 그 잔여물을 그대로 받는다
// (captureToImage.resetCtxFilterProbeForTest와 같은 클래스, #611). __tests__/setup/happydom.ts의
// 전역 afterEach가 매 테스트 뒤 이걸 부른다.
export function resetErrorToastForTest(): void {
  clearTimeout(dismissTimer);
  state = null;
  emit(); // 이 테스트에서 아직 마운트된 host가 있으면 즉시 비운다 — listeners 자체는 안 건드려,
  // 구독 해제는 평소처럼 컴포넌트 unmount(React)가 처리하게 둔다.
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return null;
}

function useErrorToastState(): ErrorToastState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** PhoneFrame 안(MobileEditorShell 트리)에 한 번만 마운트한다 — fixed 좌표가 프레임의
 * contain:paint에 갇혀야 데스크톱에서도 400px 프레임 밖으로 안 샌다(#609). */
export function ErrorToastHost() {
  const err = useErrorToastState();
  if (!err) return null;
  return (
    <div
      role="alert"
      className="fixed top-4 left-1/2 z-[70] flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 rounded-field-sm border border-danger bg-surface-elevated px-4 py-2.5 text-body text-danger animate-fade-in"
      style={{ boxShadow: 'var(--shadow-pop)' }}
    >
      <span>{err.message}</span>
      {err.persistent && (
        <button
          type="button"
          onClick={dismissError}
          aria-label="닫기"
          className="shrink-0 text-danger/70 transition-colors hover:text-danger"
        >
          ✕
        </button>
      )}
    </div>
  );
}
