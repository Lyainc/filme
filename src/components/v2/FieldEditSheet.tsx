import { useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { TicketComponents } from '@/types';
import VisibilityCheckbox from '@/components/ui/VisibilityCheckbox';
import { FieldEditorBody } from './FieldEditorBody';
import {
  FIELD_LABELS,
  STAMP_KEYS,
  STAMP_LABELS,
  isStampTarget,
  type SheetTarget,
} from '@/constants/fields';
import { isRequiredField } from '@/constants/fieldVisibility';

type Photo = ReturnType<typeof usePhototicket>;

interface FieldEditSheetProps {
  /** 열린 타깃(null이면 닫힘) — MovieInfo 필드 또는 스탬프(chain/format). */
  activeField: SheetTarget | null;
  onClose: () => void;
  photo: Photo;
}

// 키보드가 열리면 필드마다 다른 콘텐츠 높이(빈 텍스트 필드는 짧고, 제목+KOBIS 검색 결과는 김)에
// 시트 크기가 휘둘려 필드마다 들쭉날쭉하고, 좁은 vvHeight 아래서 제목 입력·KOBIS 목록이 비좁게
// 렌더된다(#314). 키보드가 열렸을 때만 콘텐츠 높이와 무관하게 height를 고정해 (a) 필드 간 시트
// 높이를 통일하고 (b) 헤더가 보일 자리를 위쪽에 남기고 (c) 그 안에서 제목/KOBIS 같은 긴 콘텐츠도
// 안정적으로 넉넉한 영역을 받게 한다. 키보드가 닫혀 있으면(vv≈전체 높이) 기존 content-intrinsic
// 사이징(짧은 필드는 짧은 시트)을 그대로 유지 — 그 경우는 문제로 보고된 적이 없다.
const HEADER_RESERVE_PX = 72; // 셸 헤더(h-14=56px) + 여유
const MIN_SHEET_HEIGHT_PX = 200; // ponytail: 작은 화면에서도 입력칸 하나는 항상 보이게 하는 하한
const KEYBOARD_OPEN_THRESHOLD_PX = 100; // iOS 키보드는 항상 이보다 훨씬 크게 화면을 가림

export function computeSheetSizing(vvHeight: number | null, fullHeight: number) {
  if (vvHeight == null) return { maxHeight: '72dvh', height: undefined as string | undefined };
  const keyboardOpen = fullHeight - vvHeight > KEYBOARD_OPEN_THRESHOLD_PX;
  if (keyboardOpen) {
    // height로 이미 고정 크기라 maxHeight는 값 자체로는 중복이지만, 닫힘 분기와 형태를 맞춰
    // 두 필드를 항상 함께 세팅하는 이 함수의 계약을 유지한다(호출부가 분기별로 다른 필드
    // 조합을 신경 쓰지 않아도 되게).
    // MIN_SHEET_HEIGHT_PX 하한을 그대로 적용하면 vvHeight 자체가 그보다 작은 극단(가로모드+
    // 키보드 등, vvHeight<200)에서 하한이 vvHeight를 넘어 다시 키보드에 잘린다(#314가 고치려던
    // 증상 재발) — vvHeight를 최종 상한으로 한 번 더 클램프한다.
    const fixed = `${Math.min(Math.max(vvHeight - HEADER_RESERVE_PX, MIN_SHEET_HEIGHT_PX), vvHeight)}px`;
    return { maxHeight: fixed, height: fixed };
  }
  return { maxHeight: `min(72dvh, ${vvHeight - 24}px)`, height: undefined };
}

/**
 * 필드 편집 하단시트(vaul, #215). 스크림·슬라이드·포커스 트랩·Escape·scroll lock은 vaul이 담당.
 * 본문은 FieldEditorBody(vaul-free, #226)에 위임하고 여기선 하단시트 하우징 + 헤더(표시여부 눈 토글)만.
 * index/셸에서 dynamic(ssr:false)로 로드해 vaul(+radix)을 초기 번들에서 뺀다.
 */
export function FieldEditSheet({ activeField, onClose, photo }: FieldEditSheetProps) {
  // iOS에서 키보드가 떠도 vh/dvh는 안 줄어들어 시트 하단(입력칸·KOBIS 결과)이 가려진다(#274).
  // visualViewport 높이를 추적해 시트 크기를 실제 보이는 영역 안으로 캡한다 —
  // vaul(repositionInputs)이 키보드 위로 시트를 올려주는 것과 별개로, 키보드가 열린 뒤
  // 콘텐츠가 늘어나는 경우(검색 결과 도착)까지 막으려면 캡 자체가 키보드를 알아야 한다.
  const [vvHeight, setVvHeight] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVvHeight(Math.round(vv.height));
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);
  const sizing = computeSheetSizing(vvHeight, typeof window === 'undefined' ? 0 : window.innerHeight);

  const label =
    activeField == null
      ? '편집'
      : isStampTarget(activeField)
        ? STAMP_LABELS[activeField]
        : FIELD_LABELS[activeField];
  // 헤더 눈 토글: 스탬프 + 숨김가능 필드. rating은 본문 RatingPicker가 자체 토글을 렌더하므로 중복 방지로,
  // 필수 필드(title)는 숨기면 제목 없는 티켓이 되므로 생략(#260, 데스크톱 일괄토글과 동일 규칙).
  const showHeaderEye =
    activeField != null &&
    activeField !== 'rating' &&
    !(!isStampTarget(activeField) && isRequiredField(activeField));

  return (
    <Drawer.Root open={activeField != null} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }} />
        <Drawer.Content
          className="bg-surface"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            maxHeight: sizing.maxHeight,
            height: sizing.height,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            boxShadow: '0 -8px 40px -12px rgba(0,0,0,0.45)',
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: 'env(safe-area-inset-bottom)',
            outline: 'none',
          }}
        >
          <div className="flex w-full shrink-0 items-center justify-center pt-3 pb-2">
            <Drawer.Handle style={{ background: 'var(--border-strong)' }} />
          </div>
          <div className="flex items-center justify-between px-5 pb-3">
            <span className="flex items-center gap-2">
              <Drawer.Title className="text-[15px] font-bold text-fg">{label}</Drawer.Title>
              {showHeaderEye && activeField && (isStampTarget(activeField) ? (
                <VisibilityCheckbox
                  checked={!!photo.state.components[STAMP_KEYS[activeField].visible]}
                  onChange={(v) =>
                    photo.updateComponents({ [STAMP_KEYS[activeField].visible]: v } as Partial<TicketComponents>)
                  }
                  label={label}
                />
              ) : (
                <VisibilityCheckbox
                  checked={photo.state.fieldVisibility[activeField]}
                  onChange={(v) => photo.updateFieldVisibility({ [activeField]: v })}
                  label={label}
                />
              ))}
            </span>
            <Drawer.Close
              aria-label="닫기"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fg-muted transition-colors hover:text-fg"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </Drawer.Close>
          </div>
          <Drawer.Description className="sr-only">티켓 필드를 편집하는 시트예요.</Drawer.Description>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            {activeField && <FieldEditorBody target={activeField} photo={photo} />}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
