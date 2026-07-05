import { useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import { ResultPanel } from './ResultPanel';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

interface ResultSheetProps {
  open: boolean;
  onClose: () => void;
  croppedImageUrl: string | null;
  movieInfo: MovieInfo;
  components: TicketComponents;
  fieldVisibility: Record<TicketField, boolean>;
}

/**
 * 모바일 결과 바텀시트 — 편집 컨텍스트 위에 떠서 결과(다운로드·공유·링크자리)를 담는다.
 * half(썸네일+액션) ↔ full(세로 티켓 확대) 두 단계. grabber를 탭하면 전환된다.
 * 셸은 형제 FieldEditSheet와 동일한 vaul Drawer — 포커스 트랩·복원·Escape·scroll lock을
 * 공짜로 가져온다(#197). half/full 높이 토글만 자체 state로 제어한다.
 * (snapPoints 미사용: grabber 탭 토글 UX를 그대로 유지하고 드래그-snap과 싸우지 않으려고.)
 */
export function ResultSheet({
  open,
  onClose,
  croppedImageUrl,
  movieInfo,
  components,
  fieldVisibility,
}: ResultSheetProps) {
  const [expanded, setExpanded] = useState(false);

  // 닫혔다 다시 열릴 때는 항상 half부터 시작.
  useEffect(() => {
    if (open) setExpanded(false);
  }, [open]);

  return (
    // dismissible(드래그-다운 닫기)은 vaul 기본 true를 그대로 둔다 — grabber 달린 모바일
    // 바텀시트의 표준 동작이고 FieldEditSheet와 통일된다. 닫혀도 결과 상태는 유지돼 비가역이
    // 아니라, 실수 닫힘 비용보다 표준 제스처 기대치가 크다(#197 리뷰).
    <Drawer.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }} dismissible>
      <Drawer.Portal>
        <Drawer.Overlay
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }}
        />
        <Drawer.Content
          className="bg-surface"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            height: expanded ? '92svh' : '58svh',
            transition: 'height 320ms cubic-bezier(0.32, 0.72, 0, 1)',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            boxShadow: '0 -8px 40px -12px rgba(0,0,0,0.45)',
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: 'env(safe-area-inset-bottom)',
            outline: 'none',
          }}
        >
          {/* grabber — 탭하면 half↔full 전환(드래그-다운 닫기는 vaul 기본 제공) */}
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? '티켓 축소' : '티켓 확대'}
            aria-expanded={expanded}
            className="flex w-full shrink-0 items-center justify-center pt-3 pb-2"
          >
            <span
              aria-hidden="true"
              style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)' }}
            />
          </button>

          <div className="flex shrink-0 items-center justify-between px-5 pb-1">
            <div>
              <Drawer.Title className="font-sans text-lg font-semibold tracking-tight text-fg">
                티켓이 완성됐어요!
              </Drawer.Title>
              <Drawer.Description className="sr-only">
                완성된 티켓을 저장하거나 공유할 수 있어요.
              </Drawer.Description>
            </div>
            <Drawer.Close
              aria-label="닫기"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-fg-muted transition-colors hover:text-fg"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </Drawer.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2">
            <ResultPanel
              croppedImageUrl={croppedImageUrl}
              movieInfo={movieInfo}
              components={components}
              fieldVisibility={fieldVisibility}
              previewClassName={expanded ? 'max-w-[320px]' : 'max-w-[200px]'}
            />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
