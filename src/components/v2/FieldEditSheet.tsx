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

type Photo = ReturnType<typeof usePhototicket>;

interface FieldEditSheetProps {
  /** 열린 타깃(null이면 닫힘) — MovieInfo 필드 또는 스탬프(chain/format). */
  activeField: SheetTarget | null;
  onClose: () => void;
  photo: Photo;
}

/**
 * 필드 편집 하단시트(vaul, #215). 스크림·슬라이드·포커스 트랩·Escape·scroll lock은 vaul이 담당.
 * 본문은 FieldEditorBody(vaul-free, #226)에 위임하고 여기선 하단시트 하우징 + 헤더(표시여부 눈 토글)만.
 * index/셸에서 dynamic(ssr:false)로 로드해 vaul(+radix)을 초기 번들에서 뺀다.
 */
export function FieldEditSheet({ activeField, onClose, photo }: FieldEditSheetProps) {
  const label =
    activeField == null
      ? '편집'
      : isStampTarget(activeField)
        ? STAMP_LABELS[activeField]
        : FIELD_LABELS[activeField];
  // 헤더 눈 토글: 스탬프 + 모든 필드(제목·개봉일 포함 — 데스크톱과 표시여부 조작 parity).
  // rating만 본문 RatingPicker가 자체 토글을 렌더하므로 헤더에선 중복 방지로 생략.
  const showHeaderEye = activeField != null && activeField !== 'rating';

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
            maxHeight: '72vh',
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
