import { useRef, useState } from 'react';
import { OCR_KOBIS_FIELDS, type OcrDirectField } from '@/components/v2/OcrUploadCard';
import type { MovieInfo, TicketComponents } from '@/types';
import { capSeatTokens, type usePhototicket } from '@/hooks/usePhototicket';

/**
 * OCR 낙관적 주입 + 되돌리기 로직의 단일 출처 — 스냅샷 상태·채워진 필드 집합·apply/cancel/confirm/
 * dropKobisFields 핸들러를 한 곳에 둔다. 셸과 그 하위 OCR 카드들이 이 훅만 쓴다. 이전엔 두 컴포넌트가 동일 로직을 각자 복제했고, 그 drift가 #141-class 회귀(한쪽 고치면 다른
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
  /**
   * OCR이 직접 필드에 쓴 값(#807). 되돌리기 때 지금 값이 이것과 다르면 사용자가 그 사이 고친
   * 필드라 되돌리지 않는다. 없으면 예전처럼 스냅샷의 필드를 전부 되돌린다.
   */
  nextValues?: Partial<MovieInfo>;
  /** OCR이 컴포넌트에 쓴 값 — nextValues의 스탬프 라벨·노출 판(#807). */
  nextComponents?: Partial<TicketComponents>;
}

export interface UseOcrUndo {
  /** OCR로 마지막 채워진 필드 중 사용자가 아직 안 고친 것 — 배너 카운트용(#810). */
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
  /**
   * 되돌리기 — movieInfo + components를 OCR 적용 전으로 원자 복원(#141 P1). 단 OCR이 쓴 뒤 사용자가
   * 고친 직접 필드는 그대로 둔다(#807).
   */
  cancel: () => void;
  /** 확인 — 스냅샷을 버려 배너를 닫는다(주입 유지). */
  confirm: () => void;
  /**
   * OCR의 KOBIS 보강이 버려졌을 때(#801) — 스냅샷에서 KOBIS 키만 뺀다. OCR이 그 키들을 한 번도 안
   * 썼으니 되돌리기가 그 사이 사용자가 고른 영화를 OCR 전 값으로 되돌리면 안 된다. 되돌릴 게 하나도
   * 안 남으면(직접 필드·컴포넌트 둘 다 없음) 배너를 닫는다. 호출부가 epoch 비교를 통과한 뒤에만 부른다.
   */
  dropKobisFields: () => void;
  /**
   * OCR의 KOBIS 보강이 실제로 쓰였을 때(#807) — 그 값을 되돌리기 비교 기준에 더한다. 안 그러면 보강 뒤
   * 사용자가 고친 원제·개봉일 같은 보강 필드를 되돌리기가 OCR 전 값으로 덮는다.
   */
  recordKobisApplied: (info: Partial<MovieInfo>) => void;
}

// OCR이 쓴 값과 지금 값이 달라진 키(= 사용자가 그 뒤 고친 것)인가(#807). 되돌리기와 배너 카운트(#810)가 같이 쓴다.
function isEdited<T extends object>(k: keyof T, applied: Partial<T>, current: T): boolean {
  return k in applied && current[k] !== applied[k];
}

// 스냅샷에서 사용자가 고친 키를 뺀다(#807).
function withoutEdited<T extends object>(prev: Partial<T>, applied: Partial<T>, current: T): Partial<T> {
  return Object.fromEntries(Object.entries(prev).filter(([key]) => !isEdited(key as keyof T, applied, current))) as Partial<T>;
}

export function useOcrUndo(photo: ReturnType<typeof usePhototicket>): UseOcrUndo {
  const [filledFields, setFilledFields] = useState<Set<OcrDirectField>>(new Set());
  // movieInfo·components 스냅샷을 한 state로 묶는다 — dropKobisFields는 늦은 비동기 콜백에서 불려
  // 클로저의 값이 낡았으므로 함수형 갱신 하나 안에서 둘을 같이 봐야 "남는 게 없다"를 판정할 수 있다.
  const [undo, setUndo] = useState<{
    info: Partial<MovieInfo>;
    components: Partial<TicketComponents> | null;
    applied: Partial<MovieInfo>;
    appliedComponents: Partial<TicketComponents>;
  } | null>(null);
  const epochRef = useRef(0);

  function apply({ keys, prevValues, prevComponents, nextValues = {}, nextComponents = {} }: OcrApplyParams) {
    setFilledFields(keys);
    // updateMovieInfo가 좌석을 capSeatTokens로 다듬어 저장하므로 비교 기준도 같이 다듬는다 — 안 그러면
    // 좌석이 긴 티켓에서 사용자가 안 고쳤는데도 고친 걸로 오판한다.
    // ponytail: 저장 시 정규화가 늘면 여기도 같이 맞춰야 한다. 어긋나면 그 필드는 안 되돌아가는(사용자 값 쪽) 방향으로 틀린다.
    const applied = typeof nextValues.seat === 'string' ? { ...nextValues, seat: capSeatTokens(nextValues.seat) } : nextValues;
    setUndo({ info: prevValues, components: prevComponents ?? null, applied, appliedComponents: nextComponents });
  }

  function cancel() {
    epochRef.current++;
    if (undo) {
      // OCR이 쓴 뒤 사용자가 고친 필드는 빼고 되돌린다(#807). 비교 기준이 없으면(state를 안 읽어도 되면)
      // 예전처럼 통째로 되돌린다.
      const { applied, appliedComponents } = undo;
      photo.updateMovieInfo(
        Object.keys(applied).length > 0 ? withoutEdited(undo.info, applied, photo.state.movieInfo) : undo.info,
      );
      // chain 라벨/노출도 OCR 적용 전으로 되돌린다(#141 리뷰 P1).
      if (undo.components) {
        photo.updateComponents(
          Object.keys(appliedComponents).length > 0
            ? withoutEdited(undo.components, appliedComponents, photo.state.components)
            : undo.components,
        );
      }
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

  function recordKobisApplied(info: Partial<MovieInfo>) {
    setUndo((prev) => {
      if (!prev) return prev;
      const applied = { ...prev.applied };
      for (const key of OCR_KOBIS_FIELDS) {
        if (key in info) (applied as Record<string, unknown>)[key] = info[key];
      }
      return { ...prev, applied };
    });
  }

  return {
    // 배너 카운트는 되돌리기가 실제로 되돌릴 필드만 센다(#810) — cancel과 같은 isEdited 판정이다.
    filledFields: undo
      ? new Set(Array.from(filledFields).filter((k) => !isEdited(k, undo.applied, photo.state.movieInfo)))
      : filledFields,
    snapshot: undo?.info ?? null,
    epochRef,
    apply,
    cancel,
    confirm,
    dropKobisFields,
    recordKobisApplied,
  };
}
