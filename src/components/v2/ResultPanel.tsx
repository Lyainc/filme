import { useCallback, useEffect, useRef, useState } from 'react';
import TicketRenderer from '@/components/TicketRenderer';
import { getLayout } from '@/utils/layouts';
import {
  canShareTicketFile,
  captureNodeToJpeg,
  downloadTicketAsJpeg,
  shareTicketAsJpeg,
} from '@/utils/captureToImage';
import { buildShareMessage, toNativeSharePayload } from '@/utils/shareMessage';
import { DEFAULT_TICKET_TTL_DAYS, UNOFFICIAL_TICKET_NOTICE } from '@/utils/ticketCleanup';
import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';
import { PreviewFilmCell } from './PreviewFilmCell';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

type SaveState = 'idle' | 'loading' | 'success';
// 결과 화면 경고는 한 번에 하나다(#826 S7 constraint-6). 다시 시도는 그 버튼 자체라 경고 안에 버튼이 없다.
type ResultAlert = 'save' | 'link' | null;

/** 저장 성공 체크가 머무는 시간(#826 S7 constraint-5, 약 1.5초). */
export const SAVE_CHECK_MS = 1500;

const ALERT_COPY: Record<'save' | 'link', string> = {
  save: '저장하지 못했어요',
  link: '링크를 만들지 못했어요',
};

export const RESULT_NOTICE_SAVED = '저장했어요';
export const RESULT_NOTICE_COPIED = '링크를 복사했어요';

interface ResultPanelProps {
  croppedImageUrl: string | null;
  movieInfo: MovieInfo;
  components: TicketComponents;
  fieldVisibility: Record<TicketField, boolean>;
  /**
   * 성공 통보('저장했어요' · '링크를 복사했어요')를 결과 화면 위쪽 통보 영역으로 올린다(#826 S7
   * constraint-17). 통보 영역은 ResultStage가 쥔다 — 결과 화면에선 편집 셸이 hidden이라 셸의 토스트 ·
   * ErrorToastHost가 보이지 않고, 이 패널은 showError를 부르지 않는다.
   */
  onNotice?: (message: string) => void;
}

/**
 * 결과 화면의 조작 블록(#826 S7, 마스터 R-01~R-03 · D11 A) — 화면 밖 캡처 대상 + [저장] [링크] [공유] 한 줄 +
 * 비공식 고지. 경고 상자와 대체 링크 칸은 버튼 줄 위에 겹쳐 떠서 티켓 크기를 바꾸지 않는다(constraint-19).
 *
 * 저장 · 링크 · 공유의 동작 로직은 그대로다: 저장은 파일 공유 가능 환경이면 OS 공유 시트, 아니면 파일
 * 다운로드(#138 항목5). 링크는 캡처 → /api/ticket 업로드로 /t/<id>를 발급하고(#91), 공유 의도(버튼)일 때만
 * 발급한다(#194, 비용 포스처). [공유]는 링크가 없으면 먼저 발급한다.
 */
export function ResultPanel({
  croppedImageUrl,
  movieInfo,
  components,
  fieldVisibility,
  onNotice,
}: ResultPanelProps) {
  // 캡처 원본 — 여기 달린 TicketRenderer의 (스케일 전) 내부 DOM이 내보내기 대상이다.
  const ticketRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  // 인-플라이트 발급의 세대 — 업로드 중 티켓 내용이 바뀌면(아래 reset effect가 증가) 완료된 URL은
  // 옛 스냅샷이므로 폐기해 스테일 링크 노출을 막는다.
  const permaGenRef = useRef(0);
  // 캡처 in-flight 가드 — 저장·링크가 같은 ticketRef 노드에 html-to-image를 동시에 돌리면 산출물이
  // 깨진다. 노드 캡처 구간을 직렬화한다(#167).
  const capturingRef = useRef(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [permaLoading, setPermaLoading] = useState(false);
  const [permalink, setPermalink] = useState<string | null>(null);
  const [alert, setAlert] = useState<ResultAlert>(null);
  // 클립보드가 거부됐을 때만 보이는 대체 링크 칸(#138 항목1 · constraint-7). 값이 바뀔 때마다 마운트 뒤
  // 포커스 · 전체 선택을 다시 건다(constraint-18) — 마운트 전 ref에 select()를 부르면 no-op이다.
  const [fallbackNonce, setFallbackNonce] = useState(0);
  const showFallback = fallbackNonce > 0 && permalink !== null;

  const layout = getLayout(components.layout);

  // 캡처/발급 진행 중 = 다른 액션 비활성(PR #168 리뷰 P1, #167 가드가 만든 edge case).
  const isBusy = saveState === 'loading' || permaLoading;

  useEffect(() => {
    if (saveState !== 'success') return;
    const timer = setTimeout(() => setSaveState('idle'), SAVE_CHECK_MS);
    return () => clearTimeout(timer);
  }, [saveState]);

  useEffect(() => {
    if (fallbackNonce === 0) return;
    const input = linkInputRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(0, input.value.length);
  }, [fallbackNonce]);

  // 티켓 내용이 바뀌면 기존 링크는 옛 스냅샷을 가리키므로 비운다 — 사용자가 다시 발급.
  useEffect(() => {
    permaGenRef.current += 1; // 진행 중인 발급을 스테일로 표시
    setPermalink(null);
    setFallbackNonce(0);
    // 진행 중이던 발급은 이미 스테일이므로 버튼을 즉시 재활성화한다(느린 네트워크에서 묶이지 않게).
    setPermaLoading(false);
  }, [croppedImageUrl, movieInfo, components, fieldVisibility]);

  const handleSave = useCallback(async () => {
    const node = ticketRef.current;
    // 다른 캡처가 진행 중이면(연타·동시 공유) 무시 — 같은 노드 toJpeg 중복을 막는다(#167).
    if (!node || capturingRef.current) return;
    setAlert(null);
    const title = movieInfo.title || 'untitled';
    const filename = `phototicket_${layout.id}_${title}.jpg`;
    capturingRef.current = true;
    setSaveState('loading');
    try {
      if (canShareTicketFile()) {
        const result = await shareTicketAsJpeg(node, {
          filename,
          width: layout.width,
          height: layout.height,
          shareTitle: title,
        });
        // 시트를 닫으면(cancelled) 저장 안 한 것 — 통보 없이 원래대로.
        if (result === 'shared') {
          setSaveState('success');
          onNotice?.(RESULT_NOTICE_SAVED);
        } else {
          setSaveState('idle');
        }
      } else {
        await downloadTicketAsJpeg(node, {
          filename,
          width: layout.width,
          height: layout.height,
        });
        setSaveState('success');
        onNotice?.(RESULT_NOTICE_SAVED);
      }
    } catch (err) {
      // 무음 실패 제거(#414) — 실기기 재현 로그(console.error) 수집 경로는 그대로 둔다.
      console.error('[save]', err);
      setSaveState('idle');
      setAlert('save');
    } finally {
      capturingRef.current = false;
    }
  }, [layout.id, layout.width, layout.height, movieInfo.title, onNotice]);

  // 완성 티켓을 캡처 → Blob 업로드(/api/ticket) → /t/<id> URL. 성공이면 URL, 실패·스테일이면 null(throw 안 함).
  const issuePermalink = useCallback(async (): Promise<string | null> => {
    const node = ticketRef.current;
    if (!node || capturingRef.current) return null;
    capturingRef.current = true;
    setPermaLoading(true);
    const gen = permaGenRef.current;
    let url: string;
    try {
      let dataUrl: string;
      try {
        // 공유용 블롭은 다운로드(pixelRatio 2·q0.95)보다 작게 캡처한다(#194) — OG 카드·랜딩 썸네일용.
        dataUrl = await captureNodeToJpeg(node, {
          filename: `phototicket_${layout.id}.jpg`,
          width: layout.width,
          height: layout.height,
          pixelRatio: 1,
          quality: 0.82,
        });
      } finally {
        capturingRef.current = false;
      }
      const base64 = dataUrl.split(',')[1] ?? '';
      const res = await fetch('/api/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          title: movieInfo.title,
          titleOg: movieInfo.titleOg,
          releaseDate: movieInfo.releaseDate,
          layout: layout.id,
        }),
      });
      if (!res.ok) throw new Error(`ticket upload failed: ${res.status}`);
      const { id } = (await res.json()) as { id: string; url: string };
      url = `${window.location.origin}/t/${id}`;
    } catch (err) {
      console.error('[permalink]', err);
      if (gen === permaGenRef.current) {
        setPermaLoading(false);
        setAlert('link');
      }
      return null;
    }
    // 업로드 중 티켓 내용이 바뀌었으면 이 URL은 옛 스냅샷이다 — 폐기한다(사용자가 다시 발급).
    if (gen !== permaGenRef.current) return null;
    setPermalink(url);
    setPermaLoading(false);
    return url;
  }, [layout.id, layout.width, layout.height, movieInfo.title, movieInfo.titleOg, movieInfo.releaseDate]);

  // 복사 성공이면 통보, 거부(인앱 웹뷰·포커스 이탈)면 그 자리에 대체 링크 칸을 띄운다.
  const copyLink = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setFallbackNonce(0);
      onNotice?.(RESULT_NOTICE_COPIED);
    } catch {
      setFallbackNonce((n) => n + 1);
    }
  }, [onNotice]);

  // [링크] — 링크가 없으면 발급하고, 있으면 지금 링크를 다시 복사한다.
  const handleLink = useCallback(async () => {
    setAlert(null);
    const url = permalink ?? (await issuePermalink());
    if (!url) return;
    await copyLink(url);
  }, [permalink, issuePermalink, copyLink]);

  // [공유] — 링크가 없으면 먼저 발급(공유 의도). 발급이 실패하면 시트도 복사도 없이 경고만 남는다.
  const handleShare = useCallback(async () => {
    setAlert(null);
    const url = permalink ?? (await issuePermalink());
    if (!url) return;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(toNativeSharePayload(buildShareMessage(movieInfo, url)));
        return;
      } catch (err) {
        // 사용자가 시트를 닫으면(AbortError) 조용히 끝. 그 외 실패만 링크 복사로 대체.
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    await copyLink(url);
  }, [permalink, issuePermalink, movieInfo, copyLink]);

  return (
    <div>
      {/* 캡처 대상 — DOM에 두되 화면 밖으로 뺀다. display:none이면 html-to-image가 레이아웃을 못 잡는다.
          보이는 hero(ResultStage)와 같은 props · ghost={false}여야 저장물 = 보이는 티켓이다(#768, 요구 6). */}
      <div style={{ position: 'fixed', left: -99999, top: 0, width: layout.width }} aria-hidden>
        <PreviewFilmCell saving={saveState === 'loading'} promoted>
          <TicketRenderer
            ref={ticketRef}
            croppedImageUrl={croppedImageUrl}
            movieInfo={movieInfo}
            components={components}
            fieldVisibility={fieldVisibility}
            ghost={false}
          />
        </PreviewFilmCell>
      </div>

      <div className="relative">
        {/* 경고 · 대체 칸은 버튼 줄 위에 겹쳐 뜬다(constraint-19) — 세로 예산 밖이라 티켓 크기가 안 튄다. */}
        {(alert || showFallback) && (
          <div className="absolute inset-x-0 bottom-full z-10 mb-2 flex flex-col gap-2">
            {showFallback && permalink && (
              <div
                data-testid="result-link-fallback"
                className="flex items-stretch gap-2 rounded-field-sm border border-hair bg-s2 p-2"
                style={{ boxShadow: 'var(--shadow-pop)' }}
              >
                <input
                  ref={linkInputRef}
                  type="text"
                  readOnly
                  value={permalink}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="공유 링크"
                  className="min-w-0 flex-1 rounded-field-sm border border-hair bg-s1 px-3 text-[16px] text-ink outline-none focus-visible:border-accent"
                />
                <button
                  type="button"
                  onClick={() => void copyLink(permalink)}
                  className={cn(pressableVariants(), 'inline-flex min-h-touch shrink-0 items-center justify-center rounded-field-sm border border-hair bg-s1 px-3.5 text-body font-medium text-ink')}
                >
                  복사
                </button>
              </div>
            )}
            {alert && (
              <p
                role="alert"
                data-testid="result-alert"
                className="rounded-field-sm border border-warn bg-s2 px-3 py-2.5 text-body text-warn"
                style={{ boxShadow: 'var(--shadow-pop)' }}
              >
                {ALERT_COPY[alert]}
              </p>
            )}
          </div>
        )}

        <div data-testid="result-actions" className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
          <button
            type="button"
            data-testid="result-save"
            onClick={handleSave}
            disabled={permaLoading}
            aria-busy={saveState === 'loading' || undefined}
            className={cn(pressableVariants(), 'flex min-h-touch items-center justify-center gap-1.5 rounded-field-sm bg-accent px-3 text-body font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50')}
          >
            {saveState === 'loading' ? <Spinner /> : saveState === 'success' ? <CheckIcon /> : <DownloadIcon />}
            <span>저장</span>
          </button>
          <button
            type="button"
            data-testid="result-link"
            onClick={handleLink}
            disabled={isBusy}
            aria-busy={permaLoading || undefined}
            className={cn(pressableVariants(), 'flex min-h-touch items-center justify-center gap-1.5 rounded-field-sm border border-hair bg-s2 px-2 text-body font-medium text-ink transition-colors disabled:cursor-not-allowed disabled:text-ink-3')}
          >
            {permaLoading ? <Spinner /> : <LinkIcon />}
            <span className="truncate">{permaLoading ? '링크 만드는 중…' : '링크'}</span>
          </button>
          <button
            type="button"
            data-testid="result-share"
            onClick={handleShare}
            disabled={isBusy}
            className={cn(pressableVariants(), 'flex min-h-touch items-center justify-center gap-1.5 rounded-field-sm border border-hair bg-s2 px-2 text-body font-medium text-ink transition-colors disabled:cursor-not-allowed disabled:text-ink-3')}
          >
            <ShareIcon />
            <span>공유</span>
          </button>
        </div>

        {/* 고지 자리는 만료 줄까지 미리 잡아 둔다 — 링크를 만든 뒤 만료 문장이 붙어도 티켓 크기가 안 바뀐다
            (constraint-4). 만료 일 수는 cleanup과 같은 단일 출처(DEFAULT_TICKET_TTL_DAYS, #179). */}
        <div
          className="mt-2 flex flex-col justify-end text-center text-micro text-ink-2"
          style={{ height: RESULT_NOTICE_BLOCK_PX, lineHeight: '16px' }}
        >
          {permalink && (
            <p data-testid="result-expiry" className="break-keep">
              이 링크는 {DEFAULT_TICKET_TTL_DAYS}일 후 만료돼요.
            </p>
          )}
          <p data-testid="result-notice" className="break-keep">
            {UNOFFICIAL_TICKET_NOTICE}
          </p>
        </div>
      </div>
    </div>
  );
}

/** 고지 블록 높이 — 만료 한 줄 + 고지 두 줄(16px 줄높이). ResultStage의 세로 예산이 이 값을 뺀다. */
export const RESULT_NOTICE_BLOCK_PX = 48;

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg data-testid="result-save-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.59 13.51 6.83 3.98M15.41 6.51 8.59 10.49" />
    </svg>
  );
}
