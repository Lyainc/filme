import { useCallback, useEffect, useRef, useState } from 'react';
import TicketRenderer from '@/components/TicketRenderer';
import { getLayout } from '@/utils/layouts';
import {
  canShareTicketFile,
  captureNodeToJpeg,
  downloadTicketAsJpeg,
  shareTicketAsJpeg,
} from '@/utils/captureToImage';
import { PreviewFilmCell } from './PreviewFilmCell';
import { PrimaryCta } from './PrimaryCta';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

type CtaState = 'idle' | 'loading' | 'success' | 'disabled';
// 퍼마링크는 발급 실패를 사용자에게 알려야 해 'error'를 추가로 갖는다. PrimaryCta가 받는
// CtaState와는 분리 — 'error'를 공유 타입에 넣으면 download/share CTA 타입과 충돌한다.
type PermaState = 'idle' | 'loading' | 'success' | 'error';

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
 * 결과물 단일 패널 — 캡처 대상 프리뷰 + 다운로드 / SNS 공유 / 퍼마링크.
 *
 * 데스크톱 rail과 모바일 바텀시트가 공유하는 유일한 결과 콘텐츠. 캡처 대상(ticketRef)과
 * 내보내기 상태/로직이 전부 이 컴포넌트 안에 닫혀 있어, 컨테이너는 배치·크기만 정한다.
 * SNS 공유는 Web Share API 파일 공유 지원 환경에서만 노출. 퍼마링크는 완성 티켓을 Blob에
 * 저장(/api/ticket)해 /t/<id> 공유 링크를 발급·복사한다 — og 미리보기로 유입되는 루프(#91).
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
  const [permaState, setPermaState] = useState<PermaState>('idle');
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

  // success/error 모두 잠시 노출 후 idle 복귀
  useEffect(() => {
    if (permaState !== 'success' && permaState !== 'error') return;
    const timer = setTimeout(() => setPermaState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [permaState]);

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

  // 완성 티켓을 캡처 → Blob 업로드(/api/ticket) → 발급된 /t/<id> 링크를 클립보드에 복사.
  // og:image가 붙은 퍼마링크라 수신자가 미리보기를 보고 "나도 만들기"로 유입되는 루프(#91).
  const handlePermalink = useCallback(async () => {
    const node = ticketRef.current;
    if (!node || !croppedImageUrl) return;
    setPermaState('loading');
    try {
      const dataUrl = await captureNodeToJpeg(node, {
        filename: `phototicket_${layout.id}.jpg`,
        width: layout.width,
        height: layout.height,
      });
      const base64 = dataUrl.split(',')[1] ?? '';
      const res = await fetch('/api/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, title: movieInfo.title, layout: layout.id }),
      });
      if (!res.ok) throw new Error(`ticket upload failed: ${res.status}`);
      const { id } = (await res.json()) as { id: string; url: string };
      const permalink = `${window.location.origin}/t/${id}`;
      await navigator.clipboard.writeText(permalink);
      setPermaState('success');
    } catch (err) {
      console.error('[permalink]', err);
      setPermaState('error');
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
        <PreviewFilmCell saving={ctaState === 'loading'} promoted label="이 상태 그대로 저장 · 공유돼요">
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
            onClick={handlePermalink}
            disabled={permaState === 'loading'}
            title="공유 링크를 만들어 클립보드에 복사해요"
            className={`text-mono inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-field-sm border border-line bg-surface-elevated text-[11px] uppercase tracking-widest text-fg transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:text-fg-faint disabled:hover:border-line ${canShareFile ? '' : 'col-span-2'}`}
          >
            {permaState === 'loading'
              ? '링크 만드는 중…'
              : permaState === 'success'
                ? '링크 복사됨!'
                : permaState === 'error'
                  ? '실패, 다시 시도'
                  : '링크 만들기'}
          </button>
        </div>
      </div>
    </div>
  );
}
