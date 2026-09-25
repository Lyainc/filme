import { useRef, useState } from 'react';
import { OCR_KOBIS_FIELDS, type OcrDirectField } from '@/components/v2/OcrUploadCard';
import type { MovieInfo, TicketComponents } from '@/types';
import type { usePhototicket } from '@/hooks/usePhototicket';

/**
 * OCR 낙관적 주입 + 되돌리기 로직의 단일 출처 — 스냅샷 상태·채워진 필드 집합·apply/cancel/confirm/
 * removeField 핸들러를 한 곳에 둔다. 셸과 그 하위 OCR 카드들이 이 훅만
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
   *
   * MobileEditorShell은 이 훅을 한 번만 호출해 랜딩·드로어 등 여러
   * OcrUploadCard 인스턴스에 같은 ref 객체를 넘긴다(#388) — OcrUploadCard도 새 OCR 실행 시작 시
   * 이 값을 직접 증가시켜(OcrUploadCard.tsx applyOcr) "가장 최신 실행"임을 표시한다. 인스턴스별
   * mountedRef 대신 이 셸 레벨 카운터로 최신성을 판단하므로, 실행을 시작한 인스턴스가 나중에
   * unmount돼도(드로어를 닫는 경우 등) 아직 최신인 응답은 정상적으로 반영된다.
   */
  epochRef: { current: number };
  /** OcrUploadCard.onOcrApply — 채워진 필드/이전 값 스냅샷을 받아 배너를 띄운다. */
  apply: (params: OcrApplyParams) => void;
  /** 되돌리기 — movieInfo + components를 OCR 적용 전으로 원자 복원(#141 P1). */
  cancel: () => void;
  /** 확인 — 스냅샷을 버려 배너를 닫는다(주입 유지). */
  confirm: () => void;
  /**
   * OCR의 KOBIS 보강이 버려졌을 때(#801) — 스냅샷에서 KOBIS 키만 뺀다. OCR이 그 키들을 한 번도 안
   * 썼으니 되돌리기가 그 사이 사용자가 고른 영화를 OCR 전 값으로 되돌리면 안 된다. 되돌릴 게 하나도
   * 안 남으면(직접 필드·컴포넌트 둘 다 없음) 배너를 닫는다. 호출부가 epoch 비교를 통과한 뒤에만 부른다.
   */
  dropKobisFields: () => void;
  /** 사용자가 필드를 직접 편집하면 그 필드를 OCR 집합에서 제거(칩 숨김). */
  removeField: (key: OcrDirectField) => void;
}

export function useOcrUndo(photo: ReturnType<typeof usePhototicket>): UseOcrUndo {
  const [filledFields, setFilledFields] = useState<Set<OcrDirectField>>(new Set());
  // movieInfo·components 스냅샷을 한 state로 묶는다 — dropKobisFields는 늦은 비동기 콜백에서 불려
  // 클로저의 값이 낡았으므로 함수형 갱신 하나 안에서 둘을 같이 봐야 "남는 게 없다"를 판정할 수 있다.
  const [undo, setUndo] = useState<{
    info: Partial<MovieInfo>;
    components: Partial<TicketComponents> | null;
  } | null>(null);
  const epochRef = useRef(0);

  function apply({ keys, prevValues, prevComponents }: OcrApplyParams) {
    setFilledFields(keys);
    setUndo({ info: prevValues, components: prevComponents ?? null });
  }

  function cancel() {
    epochRef.current++;
    if (undo) {
      photo.updateMovieInfo(undo.info);
      // chain 라벨/노출도 OCR 적용 전으로 되돌린다(#141 리뷰 P1).
      if (undo.components) photo.updateComponents(undo.components);
    }
    setFilledFields(new Set());
    setUndo(null);
  }

  function confirm() {
    setUndo(null);
  }

  function dropKobisFields() {
    setUndo((prev) => {
      if (!prev) return prev;
      const info = { ...prev.info };
      for (const key of OCR_KOBIS_FIELDS) delete info[key];
      if (Object.keys(info).length === 0 && !prev.components) return null;
      return { ...prev, info };
    });
  }

  function removeField(key: OcrDirectField) {
    setFilledFields((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  return {
    filledFields,
    snapshot: undo?.info ?? null,
    epochRef,
    apply,
    cancel,
    confirm,
    dropKobisFields,
    removeField,
  };
}
