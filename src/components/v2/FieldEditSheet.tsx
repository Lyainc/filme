import { Drawer } from 'vaul';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { TicketField } from '@/types';

// #213은 제목만 배선한다. 타입별 콘텐츠(원제/날짜/평점/스탬프)와 개별 티켓 필드 탭은 #215.
const SHEET_LABELS: Partial<Record<TicketField, string>> = { title: '제목' };

interface FieldEditSheetProps {
  /** 열린 필드(null이면 닫힘) */
  activeField: TicketField | null;
  onClose: () => void;
  photo: ReturnType<typeof usePhototicket>;
}

/**
 * 필드 편집 하단시트(vaul). 스크림·슬라이드·포커스 트랩·Escape·scroll lock은 vaul이 담당.
 * index/셸에서 dynamic(ssr:false)로 로드해 vaul(+radix)을 초기 번들에서 뺀다 — 데스크톱·모바일
 * 첫 페인트 모두 필드 탭 전엔 vaul을 안 받는다(삭제된 PreviewSheet의 코드 스플리팅 의도 계승).
 */
export function FieldEditSheet({ activeField, onClose, photo }: FieldEditSheetProps) {
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
            <Drawer.Title className="text-[15px] font-bold text-fg">
              {activeField ? SHEET_LABELS[activeField] ?? '편집' : '편집'}
            </Drawer.Title>
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
            {activeField === 'title' && (
              <input
                autoFocus
                value={photo.state.movieInfo.title}
                onChange={(e) => photo.updateMovieInfo({ title: e.target.value })}
                placeholder="영화 제목"
                className="w-full rounded-field border border-line bg-surface-elevated px-3.5 py-3 text-[15px] text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
