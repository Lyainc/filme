import { useCallback, useEffect, useRef, useState } from 'react';
import TicketRenderer from '@/components/TicketRenderer';
import { getLayout } from '@/utils/layouts';
import {
  canShareTicketFile,
  captureNodeToJpeg,
  downloadTicketAsJpeg,
  shareTicketAsJpeg,
} from '@/utils/captureToImage';
import { buildShareMessage } from '@/utils/shareMessage';
import { DEFAULT_TICKET_TTL_DAYS } from '@/utils/ticketCleanup';
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
  /**
   * 결과 뷰가 열려 이 패널이 마운트되면 permalink를 1회 자동 발급한다(#179, 공유 진입장벽 제거).
   * 모바일은 rail(숨김)+시트로 ResultPanel이 둘 동시 마운트되므로(아래 인풋 id 코멘트 참고)
   * **보이는 인스턴스에만** true를 줘 업로드 중복을 막는다.
   */
  autoIssue?: boolean;
}

/**
 * 결과물 단일 패널 — 캡처 대상 프리뷰 + 다운로드 / SNS 공유 / 퍼마링크.
 *
 * 데스크톱 rail과 모바일 바텀시트가 공유하는 유일한 결과 콘텐츠. 캡처 대상(ticketRef)과
 * 내보내기 상태/로직이 전부 이 컴포넌트 안에 닫혀 있어, 컨테이너는 배치·크기만 정한다.
 * "사진 저장"은 파일 공유 지원 환경에서 OS 시트(사진앱 저장), 미지원 시 파일 다운로드로 떨어진다.
 * 퍼마링크는 완성 티켓을 Blob에 저장(/api/ticket)해 /t/<id> 공유 링크를 발급한다 — og 미리보기로
 * 유입되는 루프(#91). 카톡·메신저(navigator.share)·X(인텐트) 채널 공유는 그 링크를 단일 소스
 * 문구(buildShareMessage)에 실어 보내며, 링크가 없으면 핸들러가 먼저 발급한다.
 */
export function ResultPanel({
  croppedImageUrl,
  movieInfo,
  components,
  fieldVisibility,
  previewClassName,
  autoIssue = false,
}: ResultPanelProps) {
  // 캡처 원본 — 여기 달린 TicketRenderer의 (스케일 전) 내부 DOM이 내보내기 대상이다.
  const ticketRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  // 인-플라이트 handlePermalink의 세대 — 업로드 중 티켓 내용이 바뀌면(아래 reset effect가
  // 증가) 완료된 URL은 옛 스냅샷이므로 폐기해 스테일 링크 노출을 막는다.
  const permaGenRef = useRef(0);
  // 캡처 in-flight 가드 — 다운로드·permalink가 같은 ticketRef 노드에 html-to-image를
  // 동시에 돌리면 산출물이 깨진다. 노드 캡처 구간을 직렬화한다(#167).
  const capturingRef = useRef(false);
  const [ctaState, setCtaState] = useState<CtaState>('idle');
  const [permaState, setPermaState] = useState<PermaState>('idle');
  // 발급된 퍼마링크 — clipboard 성공 여부와 독립으로 보관해 읽기전용 인풋 + 복사 버튼으로
  // 노출한다. clipboard가 막혀도(인앱 웹뷰·포커스 이탈) 링크 자체는 확보·공유 가능(#138 항목1).
  const [permalink, setPermalink] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');

  const layout = getLayout(components.layout);

  // 캡처/발급 진행 중 = 액션 버튼 비활성. ctaState(다운로드)·permaState(발급) 중 하나라도
  // loading이면 다른 액션 진입을 막는다 — 안 그러면 다운로드 캡처 중 공유 탭이 가드로 null을
  // 받아 빈 URL 트윗/공유로 새어나간다(#167 가드가 만든 edge case, PR #168 리뷰 P1).
  const isBusy = ctaState === 'loading' || permaState === 'loading';

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
    permaGenRef.current += 1; // 진행 중인 발급을 스테일로 표시
    setPermalink(null);
    setCopyState('idle');
    // 진행 중이던 발급은 이미 스테일이므로 버튼을 즉시 재활성화한다 — 안 그러면 느린
    // 네트워크에서 permaState가 'loading'에 묶여, 백그라운드 업로드가 끝날 때까지
    // 재발급을 못 한다(스테일 발급의 idle 복귀가 그 완료 시점에야 일어나므로).
    setPermaState('idle');
  }, [croppedImageUrl, movieInfo, components, fieldVisibility]);

  // "사진 저장" — 파일 공유 지원 환경(모바일)이면 OS 공유 시트로 보내 사진앱 저장을
  // 가능하게 하고, 미지원(데스크톱)이면 기존 a[download] 파일 저장으로 떨어진다. 웹은
  // 갤러리 무음 저장 API가 없어 iOS/Android 모두 공유 시트가 유일한 사진앱 저장 경로다(#138 항목5).
  const handleDownload = useCallback(async () => {
    const node = ticketRef.current;
    // 다른 캡처가 진행 중이면(연타·동시 공유) 무시 — 같은 노드 toJpeg 중복을 막는다(#167).
    if (!node || !croppedImageUrl || capturingRef.current) return;
    const title = movieInfo.title || 'untitled';
    const filename = `phototicket_${layout.id}_${title}.jpg`;
    capturingRef.current = true;
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
    } finally {
      capturingRef.current = false;
    }
  }, [croppedImageUrl, layout.id, layout.width, layout.height, movieInfo.title]);

  // 완성 티켓을 캡처 → Blob 업로드(/api/ticket) → 발급된 /t/<id> URL을 반환·상태 갱신.
  // og:image가 붙은 퍼마링크라 수신자가 미리보기를 보고 "나도 만들기"로 유입되는 루프(#91).
  // 발급 성공 시 URL 문자열을, 실패·스테일 시 null을 돌려준다 — 링크/X/메신저 공유가 공통으로
  // 호출해 "필요하면 먼저 발급, 있으면 재사용"하는 단일 진입점이다(절대 throw 안 함).
  const issuePermalink = useCallback(async (): Promise<string | null> => {
    const node = ticketRef.current;
    // 다른 캡처가 진행 중이면 무시 — 같은 노드 toJpeg 중복을 막는다(#167).
    if (!node || !croppedImageUrl || capturingRef.current) return null;
    capturingRef.current = true;
    setPermaState('loading');
    const gen = permaGenRef.current; // 이 발급의 세대 — 업로드 중 내용이 바뀌면 reset effect가 증가시킨다
    let url: string;
    // 1단계: 캡처 → 업로드. URL 산출까지가 성공 판정 — 여기까지 실패해야 error다.
    try {
      let dataUrl: string;
      // 가드는 노드 캡처 구간만 — 업로드(fetch)는 노드를 안 건드리므로 그동안 해제해
      // 다운로드 dead-tap을 막는다. 캡처 성공·실패 어느 쪽이든 finally로 해제(#167).
      try {
        dataUrl = await captureNodeToJpeg(node, {
          filename: `phototicket_${layout.id}.jpg`,
          width: layout.width,
          height: layout.height,
        });
      } finally {
        capturingRef.current = false;
      }
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
      return null;
    }
    // 업로드 중 티켓 내용이 바뀌었으면(reset effect가 gen 증가) 이 URL은 옛 스냅샷이다 —
    // 스테일 링크를 노출하지 않도록 폐기하고 idle로 되돌린다(사용자가 다시 발급).
    if (gen !== permaGenRef.current) {
      setPermaState('idle');
      return null;
    }
    // URL 확보 = 성공. 인풋에 노출해 clipboard 실패와 무관하게 공유 가능하게 한다.
    setPermalink(url);
    setPermaState('success');
    return url;
  }, [croppedImageUrl, layout.id, layout.width, layout.height, movieInfo.title]);

  // 결과 뷰 열림 = 마운트 시점에 permalink 1회 자동 발급(#179). 마운트 1회라서, 열린 채
  // 편집해도 remount가 없어 매-편집 업로드 storm이 안 생긴다 — 내용이 바뀌면 위 reset effect가
  // 링크를 비우고 사용자가 '링크 다시 만들기'로 재발급한다. ponytail: 닫았다 같은 내용으로
  // 재오픈 시 재업로드(새 blob)되지만 수동 재오픈이라 storm 아님, rate limit + 7일 cleanup이
  // 회수한다. dup 볼륨이 문제되면 permalink state를 부모로 올려 open/close 간 보존한다.
  // 전제: autoIssue=true로 마운트될 땐 croppedImageUrl이 이미 있어야 한다(데스크톱·모바일 모두
  // canExport가 null 포스터 상태의 openView를 막으므로 보장됨). null인 채 마운트되면 deps:[]라
  // 재발화가 없어 auto-issue가 영구 스킵된다 — 이 패널을 그 조합으로 독립 렌더하지 말 것(#179 리뷰 P2).
  const autoIssuedRef = useRef(false);
  useEffect(() => {
    if (!autoIssue || autoIssuedRef.current || !croppedImageUrl) return;
    autoIssuedRef.current = true;
    void issuePermalink();
    // 마운트 1회 — croppedImageUrl/issuePermalink 변동으로 재발화하지 않게 deps를 비운다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 공통 클립보드 복사 — 성공/거부에 따라 copyState 라벨을 갱신한다(기존 피드백 패턴 재사용).
  const copyToClipboard = useCallback(async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyState('copied');
    } catch {
      // clipboard 거부 환경(인앱 웹뷰·포커스 이탈) — 인풋을 선택해 직접 복사하도록 안내한다.
      linkInputRef.current?.select();
      setCopyState('manual');
    }
  }, []);

  // "링크 만들기" — 발급 후 자동 복사는 best-effort. 거부돼도(NotAllowedError) 링크는 이미
  // 인풋에 노출돼 있으므로 '수동 복사'로 떨어질 뿐, 실패로 처리하지 않는다.
  const handlePermalink = useCallback(async () => {
    const url = await issuePermalink();
    if (!url) return;
    await copyToClipboard(url);
  }, [issuePermalink, copyToClipboard]);

  const handleCopyLink = useCallback(async () => {
    if (!permalink) return;
    await copyToClipboard(permalink);
  }, [permalink, copyToClipboard]);

  // "카톡·메신저로 공유" — 발급된 링크가 있으면 재사용, 없으면 먼저 발급한다(호출부 책임).
  // navigator.share 지원 시 OS 공유 시트(카톡·메신저 등), 미지원·실패 시 링크 클립보드 폴백.
  const handleShareLink = useCallback(async () => {
    const url = permalink ?? (await issuePermalink()) ?? '';
    const message = buildShareMessage(movieInfo, url);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: message.title,
          text: message.text,
          url: message.url || undefined,
        });
        return;
      } catch (err) {
        // 사용자가 시트를 닫으면(AbortError) 조용히 종료. 그 외 실패만 클립보드 폴백으로.
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    // 데스크톱·share 미지원·share 실패 → 링크(없으면 문구) 클립보드 복사로 폴백.
    await copyToClipboard(url || message.text);
  }, [permalink, issuePermalink, movieInfo, copyToClipboard]);

  // "X로 공유" — 링크가 있으면 함께 싣고 없으면 먼저 발급. 링크 발급이 실패하면 문구만으로 연다.
  const composeTweetUrl = useCallback((url: string) => {
    const { text } = buildShareMessage(movieInfo, url);
    const parts = [`text=${encodeURIComponent(text)}`];
    if (url) parts.push(`url=${encodeURIComponent(url)}`);
    return `https://twitter.com/intent/tweet?${parts.join('&')}`;
  }, [movieInfo]);

  const handleShareTwitter = useCallback(async () => {
    // 링크가 이미 있으면 클릭 제스처 직후 동기로 연다(정상 동작).
    if (permalink) {
      window.open(composeTweetUrl(permalink), '_blank', 'noopener,noreferrer');
      return;
    }
    // 링크 미발급: window.open을 issuePermalink() await 뒤에 호출하면 user-activation이
    // 만료돼 브라우저가 팝업을 차단한다(#149 리뷰). 그래서 클릭 제스처에서 먼저 빈 창을 열어
    // 활성화를 유지하고, 링크 발급 후 그 창을 redirect한다. (noopener를 쓰면 window.open이
    // null을 반환해 참조를 못 잡으므로 빼고, 대신 win.opener=null로 tabnabbing을 막는다.)
    const win = window.open('', '_blank');
    if (win) win.opener = null;
    const url = (await issuePermalink()) ?? '';
    const intent = composeTweetUrl(url);
    if (win) {
      win.location.href = intent;
    } else {
      // 빈 창마저 차단된 드문 경우 — 동기 재시도, 그래도 막히면 링크/문구를 클립보드로 폴백.
      const opened = window.open(intent, '_blank', 'noopener,noreferrer');
      if (!opened) await copyToClipboard(url || buildShareMessage(movieInfo, url).text);
    }
  }, [permalink, issuePermalink, movieInfo, composeTweetUrl, copyToClipboard]);

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
          disabled={isBusy}
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
            {/* 모바일에선 rail(숨김)+시트로 ResultPanel이 둘 동시 렌더되므로 전역 id는
                중복된다 — 라벨은 span + 인풋 aria-label로 연결해 id 충돌을 피한다. */}
            <span className="text-mono block text-[10px] uppercase tracking-widest text-fg-muted">
              공유 링크
            </span>
            <div className="flex items-stretch gap-2">
              <input
                ref={linkInputRef}
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
            {/* 공유 링크 disclaimer(#179) — 만료·비공식·양도불가 고지. 만료일은 cleanup과 같은
                단일 출처(DEFAULT_TICKET_TTL_DAYS)에서 가져와 표기와 실제 정책이 어긋나지 않게 한다. */}
            <p className="text-[11px] leading-snug text-fg-faint">
              이 링크는 {DEFAULT_TICKET_TTL_DAYS}일 후 만료돼요. 비공식 팬메이드 티켓이라 양도·재판매할 수 없어요.
            </p>
          </div>
        )}

        {/* 채널별 공유 — 링크가 없으면 핸들러가 먼저 발급하고, 발급 중엔 비활성화한다.
            navigator.share(카톡·메신저 OS 시트)와 X 인텐트는 같은 buildShareMessage 문구를 쓴다. */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleShareLink}
            disabled={isBusy}
            title="카톡·메신저 등으로 공유해요"
            className="text-mono inline-flex min-h-[44px] items-center justify-center rounded-field-sm border border-line bg-surface-elevated px-3 text-center text-[11px] uppercase tracking-widest text-fg transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:text-fg-faint disabled:hover:border-line"
          >
            카톡·메신저로 공유
          </button>
          <button
            type="button"
            onClick={handleShareTwitter}
            disabled={isBusy}
            title="X(트위터)에 공유해요"
            className="text-mono inline-flex min-h-[44px] items-center justify-center rounded-field-sm border border-line bg-surface-elevated px-3 text-center text-[11px] uppercase tracking-widest text-fg transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:text-fg-faint disabled:hover:border-line"
          >
            X로 공유
          </button>
        </div>
      </div>
    </div>
  );
}
