import { useEffect, useRef, useState } from 'react';
import type { usePhototicket, HistorySnapshot } from './usePhototicket';

/**
 * 전역 undo/redo 히스토리(#356) — usePhototicket의 setState 위 레이어.
 *
 * - 스냅샷 = HistorySnapshot(movieInfo·components·fieldVisibility). 포스터 blob·테마·ghost 같은
 *   UI 취향은 밖(이슈 결정).
 * - 1스텝 = 350ms 디바운스: 입력이 멎으면 그 시점 상태를 JSON 직렬화해 push.
 * - 캡 80, 새 변경이 들어오면 redo 가지 절단.
 * - undo/redo 복원 직후엔 상태 JSON == stack[at]라 디바운스가 자연히 no-op — 별도
 *   restoring 플래그가 필요 없다(플래그 소비 방식은 StrictMode 이중 effect에서 깨진다).
 * - useOcrUndo(OCR 배너)와는 독립 — OCR 주입도 여기선 일반 변경 1스텝으로 잡힌다.
 */

export const HISTORY_CAP = 80;
const DEBOUNCE_MS = 350;

export interface HistoryStack {
  /** JSON 직렬화된 HistorySnapshot 배열. stack[at]이 현재 상태와 동기. */
  stack: string[];
  at: number;
}

/** 순수 코어 — no-op(동일 스냅샷)·redo 절단·캡 규칙. 유닛 테스트 대상. */
export function pushSnapshot(prev: HistoryStack, json: string, cap = HISTORY_CAP): HistoryStack {
  if (prev.stack[prev.at] === json) return prev;
  const stack = [...prev.stack.slice(0, prev.at + 1), json];
  if (stack.length > cap) stack.splice(0, stack.length - cap);
  return { stack, at: stack.length - 1 };
}

export function useEditHistory(photo: ReturnType<typeof usePhototicket>) {
  const { movieInfo, components, fieldVisibility } = photo.state;
  // 빈 스택으로 시작 — 베이스라인은 마운트 effect의 첫 디바운스 발화가 잡는다(pushSnapshot이
  // at:-1에서 자연히 [json]/0을 만든다). 렌더 시점 상태를 베이스라인으로 굳히면 usePhototicket의
  // 임시저장 복원(마운트 직후 setState)이 히스토리 1스텝으로 잡혀, 새로고침하자마자 undo가
  // 활성되고 누르면 빈 폼이 된다 — 복원은 문서 열기지 편집이 아니다.
  const [hist, setHist] = useState<HistoryStack>({ stack: [], at: -1 });
  // clear() 예약 — 초기화(clearDraft)처럼 "다음 상태를 새 베이스라인으로" 삼아야 하는 경우.
  // 즉시 리셋하면 clearDraft의 setState가 아직 반영 전이라 이전 상태가 베이스라인이 된다.
  const resetPendingRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      const json = JSON.stringify({ movieInfo, components, fieldVisibility });
      setHist((prev) => {
        if (resetPendingRef.current) {
          resetPendingRef.current = false;
          return { stack: [json], at: 0 };
        }
        return pushSnapshot(prev, json);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [movieInfo, components, fieldVisibility]);

  function goTo(at: number) {
    photo.restoreSnapshot(JSON.parse(hist.stack[at]) as HistorySnapshot);
    setHist({ stack: hist.stack, at });
  }
  function undo() {
    if (hist.at > 0) goTo(hist.at - 1);
  }
  function redo() {
    if (hist.at < hist.stack.length - 1) goTo(hist.at + 1);
  }
  /** 히스토리 파기 예약 — 초기화(clearDraft) 직후 호출. 다음 디바운스 스냅샷이 새 베이스라인. */
  function clear() {
    resetPendingRef.current = true;
  }

  return {
    canUndo: hist.at > 0,
    canRedo: hist.at < hist.stack.length - 1,
    // canUndo는 커밋된(디바운스가 이미 push한) 스텝 사이만 비교해서, 방금 만든 편집이 아직
    // 350ms 디바운스 창 안에 있으면 "이력 없음"으로 잘못 읽힌다(#578 리뷰에서 발견 — 포스터
    // 없이 mood/테마만 바꾸고 바로 워드마크를 탭하는 경우). 스택에 커밋된 베이스라인이 있는데
    // 지금 상태가 그것과 다르면(디바운스가 아직 안 밀어넣은 진행 중 편집) 실시간으로 잡는다.
    // 스택이 비어 있으면(마운트 직후 베이스라인 확정 전) 비교 기준이 아직 없어 false.
    isDirty: hist.stack.length > 0 && JSON.stringify({ movieInfo, components, fieldVisibility }) !== hist.stack[hist.at],
    undo,
    redo,
    clear,
  };
}
