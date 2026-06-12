import { useCallback, useEffect, useRef, useState } from 'react';
import TicketRenderer from '@/components/TicketRenderer';
import { getLayout } from '@/utils/layouts';
import {
  canShareTicketFile,
  downloadTicketAsJpeg,
  shareTicketAsJpeg,
} from '@/utils/captureToImage';
import { PreviewFilmCell } from './PreviewFilmCell';
import { PrimaryCta } from './PrimaryCta';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

type CtaState = 'idle' | 'loading' | 'success' | 'disabled';

interface ResultPanelProps {
  croppedImageUrl: string | null;
  movieInfo: MovieInfo;
  components: TicketComponents;
  fieldVisibility: Record<TicketField, boolean>;
  /**
   * 프리뷰 래퍼의 너비 제약(컨테이너가 결정). 데스크톱 rail은 자연 너비,
   * 모바일 시트는 half(작게)↔full(크게)로 이 클래스만 바꿔 확대를 연출한다.
   * 콘텐츠/캡처 로직은 동일 — 컨테이너가 크기만 분기한다.
   */
  previewClassName?: string;
}

/**
 * 결과물 단일 패널 — 캡처 대상 프리뷰 + 다운로드 / SNS 공유 / 퍼마링크(자리).
 *
 * 데스크톱 rail과 모바일 바텀시트가 공유하는 유일한 결과 콘텐츠. 캡처 대상(ticketRef)과
 * 내보내기 상태/로직이 전부 이 컴포넌트 안에 닫혀 있어, 컨테이너는 배치·크기만 정한다.
 * SNS 공유는 Web Share API 파일 공유 지원 환경에서만 노출. 퍼마링크는 백엔드 저장이
 * 필요해 자리만 잡는다(#91 2차 범위).
 */
export function ResultPanel({
  croppedImageUrl,
  movieInfo,
  components,
  fieldVisibility,
  previewClassName,
}: ResultPanelProps) {
  // 캡처 원본 — 여기 달린 TicketRenderer의 (스케일 전) 내부 DOM이 내보내기 대상이다.
  const ticketRef = useRef<HTMLDivElement>(null);
  const [ctaState, setCtaState] = useState<CtaState>('idle');
  const [shareState, setShareState] = useState<CtaState>('idle');
  // SSR safe: navigator는 mount 후에만 — 미지원 환경(데스크톱 등)에선 공유 버튼 숨김.
  const [canShareFile, setCanShareFile] = useState(false);

  const layout = getLayout(components.layout);

  useEffect(() => {
    setCanShareFile(canShareTicketFile());
  }, []);

  // success → idle 자동 전환 (2000ms)
  useEffect(() => {
    if (ctaState !== 'success') return;
    const timer = setTimeout(() => setCtaState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [ctaState]);

  useEffect(() => {
    if (shareState !== 'success') return;
    const timer = setTimeout(() => setShareState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [shareState]);

  const handleDownload = useCallback(async () => {
    const node = ticketRef.current;
    if (!node || !croppedImageUrl) return;
    const filename = `phototicket_${layout.id}_${movieInfo.title || 'untitled'}.jpg`;
    setCtaState('loading');
    try {
      await downloadTicketAsJpeg(node, {
        filename,
        width: layout.width,
        height: layout.height,
      });
      setCtaState('success');
    } catch (err) {
      console.error('[export]', err);
      setCtaState('idle');
    }
  }, [croppedImageUrl, layout.id, layout.width, layout.height, movieInfo.title]);

  const handleShare = useCallback(async () => {
    const node = ticketRef.current;
    if (!node || !croppedImageUrl) return;
    const title = movieInfo.title || 'untitled';
    setShareState('loading');
    try {
      const result = await shareTicketAsJpeg(node, {
        filename: `phototicket_${layout.id}_${title}.jpg`,
        width: layout.width,
        height: layout.height,
        shareTitle: title,
      });
      setShareState(result === 'shared' ? 'success' : 'idle');
    } catch (err) {
      console.error('[share]', err);
      setShareState('idle');
    }
  }, [croppedImageUrl, layout.id, layout.width, layout.height, movieInfo.title]);

  if (!croppedImageUrl) {
    return (
      <p className="text-[13px] text-fg-muted">
        포스터가 없어요. 편집 화면에서 포스터를 추가해 주세요.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`mx-auto w-full transition-[max-width] duration-300 ${previewClassName ?? 'max-w-md'}`}>
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

      <div className="space-y-3">
        <PrimaryCta
          state={ctaState}
          label="JPEG 다운로드"
          successLabel="저장됨!"
          onClick={handleDownload}
        />
        {/* 내보내기 스펙 — 캡처는 natural px × pixelRatio 2 (captureToImage 참고) */}
        <p className="text-mono text-center text-[10px] uppercase tracking-widest text-fg-faint">
          {layout.width}×{layout.height} px ×2 · JPEG
        </p>

        <div className="grid grid-cols-2 gap-3">
          {canShareFile && (
            <button
              type="button"
              onClick={handleShare}
              disabled={shareState === 'loading'}
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
            className={`text-mono inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-field-sm border border-line bg-surface-elevated text-[11px] uppercase tracking-widest text-fg-faint cursor-not-allowed ${canShareFile ? '' : 'col-span-2'}`}
          >
            퍼마링크
            <span className="rounded-chip bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent">준비 중</span>
          </button>
        </div>
      </div>
    </div>
  );
}
