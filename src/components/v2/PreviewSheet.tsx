import { type ReactNode } from 'react';
import { Drawer } from 'vaul';

interface PreviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

/**
 * 모바일 실시간 프리뷰 풀업 시트(#117, 방향1 미니뷰어 풀업).
 * dock 썸네일 탭 또는 위로 스와이프하면 올라오고, vaul Handle을 아래로 드래그하면 닫힌다.
 * 기존 PreviewLightbox(전체 검정 오버레이)를 대체한다 — 동일하게 modal 동작(보는 동안은 편집 멈춤).
 * 캡처 대상은 ResultPanel 쪽 별도 트리라 이 시트의 vaul transform과 무관하다.
 */
export function PreviewSheet({ open, onOpenChange, children }: PreviewSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }}
        />
        <Drawer.Content
          aria-label="티켓 미리보기"
          className="bg-surface"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            // 명시적 height 필수 — 안의 TicketRenderer는 ResizeObserver로 부모에 맞춰
            // 스케일하는 구조라 intrinsic height가 0이다. height를 안 주면 flex-1
            // 콘텐츠 영역이 붕괴해 grabber 높이만 남는다(ResultSheet와 동일한 이유로 svh 고정).
            height: '88svh',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            boxShadow: '0 -8px 40px -12px rgba(0,0,0,0.45)',
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: 'env(safe-area-inset-bottom)',
            outline: 'none',
          }}
        >
          <div className="flex shrink-0 w-full items-center justify-center pt-3 pb-2">
            <Drawer.Handle style={{ background: 'var(--border-strong)' }} />
          </div>
          <Drawer.Title className="sr-only">티켓 미리보기</Drawer.Title>
          {/* TicketRenderer는 w-full로 부모 너비를 받아 스케일을 계산한다. flex-row 가운데
              정렬에 그냥 두면 너비를 못 받아 스케일이 0이 되므로, 명시적 폭의 세로 컨테이너로 감싼다. */}
          <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 pb-5 pt-1">
            <div className="w-full max-w-[360px]">{children}</div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
