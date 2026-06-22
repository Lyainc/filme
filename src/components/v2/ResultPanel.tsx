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
// CtaState와는 분리 — 'error'를 넣으면 '사진 저장' CTA가 받는 CtaState와 충돌한다.
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
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [ctaState, setCtaState] = useState<CtaState>('idle');
  const [permaState, setPermaState] = useState<PermaState>('idle');
  // 발급된 퍼마링크 — clipboard 성공 여부와 독립으로 보관해 읽기전용 인풋 + 복사 버튼으로
  // 노출한다. clipboard가 막혀도(인앱 웹뷰·포커스 이탈) 링크 자체는 확보·공유 가능(#138 항목1).
  const [permalink, setPermalink] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');

  const layout = getLayout(components.layout);

  // success → idle 자동 전환 (2000ms)
  useEffect(() => {
    if (ctaState !== 'success') return;
    const timer = setTimeout(() => setCtaState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [ctaState]);

  // success/error 모두 잠시 노출 후 idle 복귀 (버튼 라벨용 — permalink 인풋은 유지)
  useEffect(() => {
    if (permaState !== 'success' && permaState !== 'error') return;
    const timer = setTimeout(() => setPermaState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [permaState]);

  // '복사됨!' 라벨은 2초 후 '복사'로 복귀. 'manual'(수동 복사 안내)은 다음 액션까지 유지.
  useEffect(() => {
    if (copyState !== 'copied') return;
    const timer = setTimeout(() => setCopyState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [copyState]);

  // 티켓 내용이 바뀌면 기존 링크는 옛 스냅샷을 가리키므로 비운다 — 사용자가 다시 발급.
  // (movieInfo/components는 디바운스된 props라 편집이 멎고 ~280ms 뒤에만 참조가 바뀐다.)
  useEffect(() => {
    setPermalink(null);
    setCopyState('idle');
  }, [croppedImageUrl, movieInfo, components, fieldVisibility]);

  // "사진 저장" — 파일 공유 지원 환경(모바일)이면 OS 공유 시트로 보내 사진앱 저장을
  // 가능하게 하고, 미지원(데스크톱)이면 기존 a[download] 파일 저장으로 떨어진다. 웹은
  // 갤러리 무음 저장 API가 없어 iOS/Android 모두 공유 시트가 유일한 사진앱 저장 경로다(#138 항목5).
  const handleDownload = useCallback(async () => {
    const node = ticketRef.current;
    if (!node || !croppedImageUrl) return;
    const title = movieInfo.title || 'untitled';
    const filename = `phototicket_${layout.id}_${title}.jpg`;
    setCtaState('loading');
    try {
      if (canShareTicketFile()) {
        const result = await shareTicketAsJpeg(node, {
          filename,
          width: layout.width,
          height: layout.height,
          shareTitle: title,
        });
        // 시트를 닫으면(cancelled) 저장 안 한 것 — success 토스트 없이 idle 복귀.
        setCtaState(result === 'shared' ? 'success' : 'idle');
      } else {
        await downloadTicketAsJpeg(node, {
          filename,
          width: layout.width,
          height: layout.height,
        });
        setCtaState('success');
      }
    } catch (err) {
      console.error('[save]', err);
      setCtaState('idle');
    }
  }, [croppedImageUrl, layout.id, layout.width, layout.height, movieInfo.title]);

  // 완성 티켓을 캡처 → Blob 업로드(/api/ticket) → 발급된 /t/<id> 링크를 노출·복사.
  // og:image가 붙은 퍼마링크라 수신자가 미리보기를 보고 "나도 만들기"로 유입되는 루프(#91).
  const handlePermalink = useCallback(async () => {
    const node = ticketRef.current;
    if (!node || !croppedImageUrl) return;
    setPermaState('loading');
    let url: string;
    // 1단계: 캡처 → 업로드. URL 산출까지가 성공 판정 — 여기까지 실패해야 error다.
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
      url = `${window.location.origin}/t/${id}`;
    } catch (err) {
      console.error('[permalink]', err);
      setPermaState('error');
      return;
    }
    // URL 확보 = 성공. 인풋에 노출해 clipboard 실패와 무관하게 공유 가능하게 한다.
    setPermalink(url);
    setPermaState('success');
    // 2단계: 자동 복사는 best-effort. 인앱 웹뷰·포커스 이탈로 거부돼도(NotAllowedError)
    // 링크는 이미 노출돼 있으므로 '수동 복사'로 떨어질 뿐, 실패로 처리하지 않는다.
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch {
      setCopyState('manual');
    }
  }, [croppedImageUrl, layout.id, layout.width, layout.height, movieInfo.title]);

  const handleCopyLink = useCallback(async () => {
    if (!permalink) return;
    try {
      await navigator.clipboard.writeText(permalink);
      setCopyState('copied');
    } catch {
      // clipboard 거부 환경 — 인풋을 선택해 사용자가 직접 복사하도록 안내한다.
      linkInputRef.current?.select();
      setCopyState('manual');
    }
  }, [permalink]);

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
          label="사진 저장"
          successLabel="저장됨!"
          onClick={handleDownload}
        />
        {/* 내보내기 스펙 — 캡처는 natural px × pixelRatio 2 (captureToImage 참고) */}
        <p className="text-mono text-center text-[10px] uppercase tracking-widest text-fg-faint">
          {layout.width}×{layout.height} px ×2 · JPEG
        </p>

        <button
          type="button"
          onClick={handlePermalink}
          disabled={permaState === 'loading'}
          title="공유 링크를 만들어 클립보드에 복사해요"
          className="text-mono inline-flex w-full min-h-[44px] items-center justify-center gap-1.5 rounded-field-sm border border-line bg-surface-elevated text-[11px] uppercase tracking-widest text-fg transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:text-fg-faint disabled:hover:border-line"
        >
          {permaState === 'loading'
            ? '링크 만드는 중…'
            : permaState === 'success'
              ? '링크 생성됨!'
              : permaState === 'error'
                ? '실패, 다시 시도'
                : permalink
                  ? '링크 다시 만들기'
                  : '링크 만들기'}
        </button>

        {permalink && (
          <div className="space-y-1.5">
            <label
              htmlFor="permalink-input"
              className="text-mono block text-[10px] uppercase tracking-widest text-fg-muted"
            >
              공유 링크
            </label>
            <div className="flex items-stretch gap-2">
              <input
                ref={linkInputRef}
                id="permalink-input"
                type="text"
                readOnly
                value={permalink}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="공유 링크"
                className="text-mono min-w-0 flex-1 rounded-field-sm border border-line bg-surface px-3 py-2 text-[12px] text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-mono inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-field-sm border border-line bg-surface-elevated px-3.5 text-[11px] uppercase tracking-widest text-fg transition-colors hover:border-accent hover:text-accent"
              >
                {copyState === 'copied' ? '복사됨!' : '복사'}
              </button>
            </div>
            {copyState === 'manual' && (
              <p className="text-[12px] text-fg-muted">
                자동 복사가 막혔어요. 링크를 길게 눌러 직접 복사해 주세요.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
