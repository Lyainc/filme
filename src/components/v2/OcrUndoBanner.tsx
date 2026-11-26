import { KOBIS_MATCH_FIELDS, OCR_KOBIS_SHOWN_FIELDS, type OcrDirectField } from './OcrUploadCard';
import type { MovieInfo } from '@/types';
import { cn } from '@/utils/cn';
import { dockAnchoredBottom } from './dock/EditorDock';
import { pressableVariants } from '@/components/ui/variants';

interface OcrUndoBannerProps {
  /** non-null이면 배너를 노출한다 — useOcrUndo.snapshot을 그대로 넘긴다. */
  snapshot: Partial<MovieInfo> | null;
  filledFields: Set<OcrDirectField>;
  /** useOcrUndo.stampCount — 되돌릴 체인·포맷 스탬프 수. */
  stampCount: number;
  onCancel: () => void;
  onConfirm: () => void;
  /** 도크 윗면에서 몇 px 위에 얹을지(E-05: 티켓과 도크 사이). 없으면 도크가 없는 화면의 기본 자리(bottom-6)다. */
  dockOffsetPx?: number;
}

/** 배너 한 장의 높이 — p-3 위아래 24 + min-h-touch 44 + 테두리 2. 그 위로 쌓는 토스트의 좌표가 이 값에서 나온다. */
export const OCR_BANNER_HEIGHT_PX = 70;

/**
 * OCR 낙관적 주입 되돌리기 배너 + sr-only 라이브리전 — MobileEditorShell(모바일)과
 * 셸이 쓰는 표현 계층(#141-class drift 방지). 로직은 useOcrUndo.
 * 화면 하단 중앙 고정(fixed) — 도크가 있으면 도크 바로 위(dockOffsetPx prop), 없으면 bottom-6. 라이브리전은 콘텐츠 변경 *전부터* DOM에 있어야 SR이 mutation을
 * 잡으므로(배너와 동시 삽입되면 무시됨, #199 리뷰 P1) 항상 마운트하고 텍스트만 바꾼다.
 */
export function OcrUndoBanner({ snapshot, filledFields, stampCount, onCancel, onConfirm, dockOffsetPx }: OcrUndoBannerProps) {
  // 영화 정보 문구는 영화를 찾았다는 키(원제·출연)가 남았을 때만이다(#814·#855) — 무매칭 안내와 같은 판정이라
  // '영화 정보를 찾지 못했어요' 옆에서 불러왔다고 하지 않는다. 조회 중에는 스냅샷이 KOBIS 키를 전부 쥐고 있어
  // 이 문구다(마스터 E-05 '로딩'). 못 찾았거나 보강이 버려졌으면 남은 제목·스탬프 같은 항목 수를 센다.
  const hasKobis = !!snapshot && KOBIS_MATCH_FIELDS.some((key) => key in snapshot);
  const kobisCount = snapshot ? OCR_KOBIS_SHOWN_FIELDS.filter((key) => key in snapshot).length : 0;
  const itemCount = kobisCount + stampCount;
  const message =
    filledFields.size > 0
      ? `${filledFields.size}개 항목이 자동 입력되었어요.`
      : hasKobis || itemCount === 0
        ? '영화 정보를 자동으로 불러왔어요.'
        : `${itemCount}개 항목이 자동 입력되었어요.`;

  return (
    <>
      {snapshot && (
        <div
          data-testid="ocr-undo-banner"
          className={cn(
            'fixed left-1/2 z-50 flex w-[90%] max-w-sm -translate-x-1/2 animate-slide-up items-center gap-4 rounded-[6px] border border-accent bg-s2 p-3 shadow-lg',
            dockOffsetPx === undefined && 'bottom-6',
          )}
          // happy-dom은 env()가 든 값을 버리므로 테스트는 이 data 속성으로 앵커를 읽는다.
          data-dock-offset={dockOffsetPx}
          style={dockOffsetPx === undefined ? undefined : { bottom: dockAnchoredBottom(dockOffsetPx) }}
        >
          <p className="flex-1 text-body text-ink">{message}</p>
          {/* WCAG 2.5.8(AA) 최소 24×24 미달 → min-h-touch(44px)로 채운다(#646). cancel()은 확인 없이
              바로 스냅샷으로 되돌려 방금 채운 값을 지우는 쪽이라(useOcrUndo.ts) 되돌리기가 더 작으면
              안 된다 — 두 버튼을 동일 높이로 맞춘다. */}
          <div className="flex shrink-0 items-stretch gap-2">
            <button
              type="button"
              onClick={onCancel}
              className={cn(pressableVariants(), 'min-h-touch inline-flex items-center px-2 text-caption font-medium text-ink-2 transition-colors hover:text-ink')}
            >
              되돌리기
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={cn(pressableVariants(), 'min-h-touch inline-flex items-center rounded-[6px] bg-accent px-3 text-caption font-medium text-accent-ink transition-colors hover:bg-accent-hover')}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* OCR announce — 라이브리전은 항상 마운트하고 텍스트만 바꾼다(#199). */}
      <div role="status" aria-live="polite" className="sr-only">
        {snapshot ? message : ''}
      </div>
    </>
  );
}
