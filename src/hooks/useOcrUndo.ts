import { useRef, useState } from 'react';
import type { OcrDirectField } from '@/components/v2/OcrUploadCard';
import type { MovieInfo, TicketComponents } from '@/types';
import type { usePhototicket } from '@/hooks/usePhototicket';

/**
 * OCR 낙관적 주입 + 되돌리기 로직의 단일 출처 — 스냅샷 상태·채워진 필드 집합·apply/cancel/confirm/
 * removeField 핸들러를 한 곳에 둔다. MobileEditorShell(모바일)과 DesktopStudioShell(데스크톱)이 이 훅만
 * 쓴다. 이전엔 두 컴포넌트가 동일 로직을 각자 복제했고, 그 drift가 #141-class 회귀(한쪽 고치면 다른
 * 쪽이 조용히 깨짐)를 낳는다. 배너·sr-only 표현은 OcrUndoBanner가, 로직은 여기가 소유한다.
 *
 * 표현 계층(스크롤·포커스 같은 사이트별 사이드이펙트)은 각 컴포넌트가
 * apply를 감싸서 소유한다 — 훅은 순수 상태·복원 로직만.
 */

export interface OcrApplyParams {
  keys: Set<OcrDirectField>;
  prevValues: Partial<MovieInfo>;
  // OCR이 chain을 인식하면 chainVisible/chainLabel을 바꾸는데, 라벨이 export에 반영되므로
  // undo가 이 변경도 되돌려야 한다(#141 리뷰 P1). 변경 직전 컴포넌트 값.
  prevComponents?: Partial<TicketComponents>;
}

export interface UseOcrUndo {
  /** OCR로 마지막 채워진 필드 집합 — 배너 카운트/OCR 칩용. 사용자 편집 시 필드별로 비운다. */
  filledFields: Set<OcrDirectField>;
  /** 되돌리기 스냅샷 — non-null이면 배너를 노출한다. */
  snapshot: Partial<MovieInfo> | null;
  /**
   * cancel(undo) 시 증가시켜 in-flight KOBIS fetch를 무효화 — revert 후 폼을 다시 채우지 못하게.
   * confirm에선 안 올린다: confirm은 주입을 수락하고, KOBIS 보강(title 자체를 나르는)은 계속 착지해야 한다.
   */
  epochRef: { current: number };
  /** OcrUploadCard.onOcrApply — 채워진 필드/이전 값 스냅샷을 받아 배너를 띄운다. */
  apply: (params: OcrApplyParams) => void;
  /** 되돌리기 — movieInfo + components를 OCR 적용 전으로 원자 복원(#141 P1). */
  cancel: () => void;
  /** 확인 — 스냅샷을 버려 배너를 닫는다(주입 유지). */
  confirm: () => void;
  /** 사용자가 필드를 직접 편집하면 그 필드를 OCR 집합에서 제거(칩 숨김). */
  removeField: (key: OcrDirectField) => void;
}

export function useOcrUndo(photo: ReturnType<typeof usePhototicket>): UseOcrUndo {
  const [filledFields, setFilledFields] = useState<Set<OcrDirectField>>(new Set());
  const [snapshot, setSnapshot] = useState<Partial<MovieInfo> | null>(null);
  const [componentSnapshot, setComponentSnapshot] = useState<Partial<TicketComponents> | null>(null);
  const epochRef = useRef(0);

  function apply({ keys, prevValues, prevComponents }: OcrApplyParams) {
    setFilledFields(keys);
    setSnapshot(prevValues);
    setComponentSnapshot(prevComponents ?? null);
  }

  function cancel() {
    epochRef.current++;
    if (snapshot) photo.updateMovieInfo(snapshot);
    // chain 라벨/노출도 OCR 적용 전으로 되돌린다(#141 리뷰 P1).
    if (componentSnapshot) photo.updateComponents(componentSnapshot);
    setFilledFields(new Set());
    setSnapshot(null);
    setComponentSnapshot(null);
  }

  function confirm() {
    setSnapshot(null);
    setComponentSnapshot(null);
  }

  function removeField(key: OcrDirectField) {
    setFilledFields((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  return { filledFields, snapshot, epochRef, apply, cancel, confirm, removeField };
}
