import type { RefObject } from 'react';
import TicketRenderer from '@/components/TicketRenderer';
import { getLayout } from '@/utils/layouts';
import { PreviewFilmCell } from './PreviewFilmCell';
import { PrimaryCta } from './PrimaryCta';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

type CtaState = 'idle' | 'loading' | 'success' | 'disabled';

interface DoneCanvasProps {
  croppedImageUrl: string | null;
  movieInfo: MovieInfo;
  components: TicketComponents;
  fieldVisibility: Record<TicketField, boolean>;
  /** 내보내기 캡처 대상 — 여기 달린 TicketRenderer가 캡처 원본이다. */
  ticketRef: RefObject<HTMLDivElement | null>;
  ctaState: CtaState;
  onDownload: () => void;
  /** Web Share API Level 2(파일 공유) 지원 여부 — false면 공유 버튼 숨김(다운로드가 주 액션) */
  canShare: boolean;
  shareState: CtaState;
  onShare: () => void;
  onBack: () => void;
}

/**
 * 완료 화면 — 결과물 액션 전용 (다운로드 / 공유 / 퍼마링크).
 * SNS 공유는 Web Share API 파일 공유 지원 환경에서만 노출.
 * 퍼마링크는 백엔드 저장이 필요해 자리만 잡는다(disabled, 2차 범위).
 */
export function DoneCanvas({
  croppedImageUrl,
  movieInfo,
  components,
  fieldVisibility,
  ticketRef,
  ctaState,
  onDownload,
  canShare,
  shareState,
  onShare,
  onBack,
}: DoneCanvasProps) {
  const layout = getLayout(components.layout);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-mono inline-flex min-h-[44px] items-center gap-1.5 text-[11px] uppercase tracking-widest text-fg-muted transition-colors hover:text-fg"
        >
          ← 에디터로 돌아가기
        </button>
      </div>

      <header className="space-y-1.5">
        <h2 className="font-display text-2xl font-medium tracking-tight text-fg">
          티켓이 완성됐어요!
        </h2>
        <p className="max-w-[42ch] text-[13px] leading-relaxed text-fg-muted">
          {canShare
            ? 'JPEG로 저장하거나 SNS로 바로 공유해 보세요.'
            : 'JPEG로 저장해 SNS에 자유롭게 올려 보세요.'}
        </p>
      </header>

      {croppedImageUrl ? (
        <div className="mx-auto w-full max-w-md">
          <PreviewFilmCell saving={ctaState === 'loading'}>
            <TicketRenderer
              ref={ticketRef}
              croppedImageUrl={croppedImageUrl}
              movieInfo={movieInfo}
              components={components}
              fieldVisibility={fieldVisibility}
            />
          </PreviewFilmCell>
        </div>
      ) : (
        <p className="text-[13px] text-fg-muted">
          포스터가 없어요. 에디터로 돌아가 포스터를 추가해 주세요.
        </p>
      )}

      <div className="mx-auto w-full max-w-md space-y-3">
        <PrimaryCta
          state={croppedImageUrl ? ctaState : 'disabled'}
          label="JPEG 다운로드"
          successLabel="저장됨!"
          onClick={onDownload}
        />
        {/* 내보내기 스펙 — 캡처는 natural px × pixelRatio 2 (captureToImage 참고) */}
        <p className="text-mono text-center text-[10px] uppercase tracking-widest text-fg-faint">
          {layout.width}×{layout.height} px ×2 · JPEG
        </p>

        <div className="grid grid-cols-2 gap-3">
          {canShare && (
            <button
              type="button"
              onClick={onShare}
              disabled={!croppedImageUrl || shareState === 'loading'}
              className="text-mono inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-field-sm border border-line bg-surface-elevated text-[11px] uppercase tracking-widest text-fg transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:text-fg-faint disabled:hover:border-line"
            >
              {shareState === 'loading'
                ? '공유 준비 중…'
                : shareState === 'success'
                  ? '공유됨!'
                  : 'SNS 공유'}
            </button>
          )}
          <button
            type="button"
            disabled
            title="준비 중인 기능이에요"
            className={`text-mono inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-field-sm border border-line bg-surface-elevated text-[11px] uppercase tracking-widest text-fg-faint cursor-not-allowed ${canShare ? '' : 'col-span-2'}`}
          >
            퍼마링크
            <span className="rounded-chip bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent">준비 중</span>
          </button>
        </div>
      </div>
    </div>
  );
}
