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
import { Eyebrow } from './Eyebrow';
import { PreviewFilmCell } from './PreviewFilmCell';
import { PrimaryCta } from './PrimaryCta';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

type CtaState = 'idle' | 'loading' | 'success' | 'disabled';
// 퍼마링크는 발급 실패를 사용자에게 알려야 해 'error'를 추가로 갖는다. PrimaryCta가 받는
// CtaState와는 분리 — 'error'를 넣으면 '사진에 저장' CTA가 받는 CtaState와 충돌한다.
type PermaState = 'idle' | 'loading' | 'success' | 'error';

interface ResultPanelProps {
  croppedImageUrl: string | null;
  movieInfo: MovieInfo;
  components: TicketComponents;
  fieldVisibility: Record<TicketField, boolean>;
  /**
   * 데스크톱 done(#233)·모바일 ResultStage(#258) 둘 다 켠다 — hero 티켓(캔버스/스테이지 상단)과
   * 인스펙터/액션 블록의 이중 노출을 없앤다. true면 캡처 타깃 프리뷰는 DOM에 유지하되 화면
   * 밖(off-screen)으로 빼 시각적으로만 숨기고, 액션만 남긴다.
   * display:none이 아니라 off-screen인 이유: html-to-image가 캡처하려면 레이아웃이 있어야 한다.
   */
  hidePreview?: boolean;
}

/**
 * 결과물 단일 패널 — 캡처 대상 프리뷰 + 다운로드 / SNS 공유 / 퍼마링크.
 *
 * 데스크톱 rail과 모바일 ResultStage가 공유하는 유일한 결과 콘텐츠. 캡처 대상(ticketRef)과
 * 내보내기 상태/로직이 전부 이 컴포넌트 안에 닫혀 있어, 컨테이너는 배치·크기만 정한다.
 * "사진에 저장"은 파일 공유 지원 환경에서 OS 시트(사진앱 저장), 미지원 시 파일 다운로드로 떨어진다.
 * 퍼마링크는 완성 티켓을 Blob에 저장(/api/ticket)해 /t/<id> 공유 링크를 발급한다 — og 미리보기로
 * 유입되는 루프(#91). 카톡·메신저(navigator.share) 채널 공유는 그 링크를 단일 소스
 * 문구(buildShareMessage)에 실어 보내며, 링크가 없으면 핸들러가 먼저 발급한다.
 */
export function ResultPanel({
  croppedImageUrl,
  movieInfo,
  components,
  fieldVisibility,
  hidePreview = false,
}: ResultPanelProps) {
  // 캡처 원본 — 여기 달린 TicketRenderer의 (스케일 전) 내부 DOM이 내보내기 대상이다.
  const ticketRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const linkPanelRef = useRef<HTMLDivElement>(null);
  // 인-플라이트 handlePermalink의 세대 — 업로드 중 티켓 내용이 바뀌면(아래 reset effect가
  // 증가) 완료된 URL은 옛 스냅샷이므로 폐기해 스테일 링크 노출을 막는다.
  const permaGenRef = useRef(0);
  // 캡처 in-flight 가드 — 다운로드·permalink가 같은 ticketRef 노드에 html-to-image를
  // 동시에 돌리면 산출물이 깨진다. 노드 캡처 구간을 직렬화한다(#167).
  const capturingRef = useRef(false);
  const [ctaState, setCtaState] = useState<CtaState>('idle');
  // 다운로드 실패 노출(#414 1단계) — PrimaryCta의 CtaState는 다른 소비자(DesktopStudioShell
  // 임시저장 CTA)와 공유라 'error' variant를 얹지 않고, 별도 배너 + 재시도 버튼으로 분리한다.
  const [downloadError, setDownloadError] = useState(false);
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

  // 링크 발급 성공 시 패널로 스크롤 — 액션 버튼 아래 조건부로 붙는 패널이라, 스크롤 없이는
  // 화면 밖일 수 있어 생성됐는지 확인할 방법이 없었다(#326).
  useEffect(() => {
    if (!permalink) return;
    linkPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [permalink]);

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

  // "사진에 저장" — 파일 공유 지원 환경(모바일)이면 OS 공유 시트로 보내 사진앱 저장을
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
    setDownloadError(false);
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
      // 무음 실패 제거(#414 1단계) — 사용자 눈엔 "그냥 안 됨"이던 걸 배너 + 재시도로 노출해
      // 실기기 재현 로그(console.error) 수집 경로를 연다. blob revoke 등 순간적 실패는
      // 재시도 한 번으로 넘어갈 수 있어 탈출 경로도 같이 제공한다(2단계 근본 수정 전 임시 조치).
      console.error('[save]', err);
      setCtaState('idle');
      setDownloadError(true);
    } finally {
      capturingRef.current = false;
    }
  }, [croppedImageUrl, layout.id, layout.width, layout.height, movieInfo.title]);

  // 완성 티켓을 캡처 → Blob 업로드(/api/ticket) → 발급된 /t/<id> URL을 반환·상태 갱신.
  // og:image가 붙은 퍼마링크라 수신자가 미리보기를 보고 "나도 만들기"로 유입되는 루프(#91).
  // 발급 성공 시 URL 문자열을, 실패·스테일 시 null을 돌려준다 — 링크/메신저 공유가 공통으로
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
        // 공유용 블롭은 다운로드(pixelRatio 2·q0.95)보다 작게 캡처한다(#194). 이 JPEG은 OG
        // 카드·랜딩 썸네일로만 쓰여 작게 표시되므로 1920×2954 풀해상도가 불필요 — pixelRatio 1
        // (960×1534) + q0.82로 ~2MB→~0.5MB. Blob 저장·Fast Origin Transfer·데이터 전송이 그만큼
        // 줄어 Hobby 한도 헤드룸을 ~3~4배 늘린다. 다운로드/네이티브 공유 경로는 풀해상도 유지.
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

  // "공유"(채널 공유) — 발급된 링크가 있으면 재사용, 없으면 먼저 발급한다(호출부 책임).
  // navigator.share 지원 시 OS 공유 시트(카톡·메신저 등), 미지원·실패 시 링크 클립보드 폴백.
  const handleShareLink = useCallback(async () => {
    const url = permalink ?? (await issuePermalink()) ?? '';
    const message = buildShareMessage(movieInfo, url);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(toNativeSharePayload(message));
        return;
      } catch (err) {
        // 사용자가 시트를 닫으면(AbortError) 조용히 종료. 그 외 실패만 클립보드 폴백으로.
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    // 데스크톱·share 미지원·share 실패 → 링크(없으면 문구) 클립보드 복사로 폴백.
    await copyToClipboard(url || message.text);
  }, [permalink, issuePermalink, movieInfo, copyToClipboard]);

  // 퍼마링크 셀 라벨 — permaState/permalink에서 계산해 텍스트 자체를 key로 써서, 값이 실제로
  // 바뀔 때만 크로스페이드가 재생되게 한다(#201 모션 정합: 하드 텍스트 스왑 대신 fade-in).
  // settle(카드용 box-shadow+translateY(-10px)+scale, PreviewFilmCell 참고)은 60px 버튼 안
  // 작은 텍스트엔 부적합해 리뷰(PR #303 P1)에 따라 이미 정의된 opacity-only fade-in으로 대체.
  const permaLabel =
    permaState === 'loading'
      ? '링크 만드는 중…'
      : permaState === 'success'
        ? '링크 생성됨!'
        : permaState === 'error'
          ? '실패, 다시 시도'
          : permalink
            ? '링크 다시 만들기'
            : '링크 만들기';
  const copyLabel = copyState === 'copied' ? '복사됨!' : '복사';

  if (!croppedImageUrl) {
    return (
      <p className="text-[13px] text-fg-muted">
        포스터가 없어요. 편집 화면에서 포스터를 추가해 주세요.
      </p>
    );
  }

  return (
    <div className="space-y-group">
      {/* hidePreview(데스크톱 done): 캡처 타깃은 DOM에 유지하되 인스펙터 flow 밖으로 뺀다.
          display:none이면 html-to-image가 레이아웃을 못 잡으니 off-screen 고정으로만 숨긴다
          (캔버스 hero 티켓이 이미 프리뷰 역할이라 인스펙터는 액션만 — #233 이중 노출 제거). */}
      <div
        className={hidePreview ? undefined : 'mx-auto w-full max-w-md transition-[max-width] duration-300'}
        style={hidePreview ? { position: 'fixed', left: -99999, top: 0, width: layout.width } : undefined}
        aria-hidden={hidePreview || undefined}
      >
        <PreviewFilmCell saving={ctaState === 'loading'} promoted>
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
        {/* 1차 액션 = 사진에 저장(accent, ~52px, 다운로드 아이콘). 성공 시 체크 + '사진에 저장됨'. */}
        <PrimaryCta
          state={ctaState}
          label="사진에 저장"
          successLabel="사진에 저장됨"
          onClick={handleDownload}
          icon={<DownloadIcon />}
          className="!min-h-[52px]"
        />

        {downloadError && (
          <p role="alert" className="flex items-center justify-between gap-2 text-[12px] text-danger">
            <span>저장에 실패했어요.</span>
            <button
              type="button"
              onClick={handleDownload}
              className="text-mono shrink-0 rounded-chip border border-danger px-2.5 py-1 text-[11px] uppercase tracking-widest text-danger transition-colors hover:bg-danger hover:text-white"
            >
              다시 시도
            </button>
          </p>
        )}

        {/* D7 공유 위계: save→link→channels 시퀀스를 디바이더로 시각 분리. */}
        <div aria-hidden="true" className="h-px w-full bg-neutral-2" />

        {/* 2차 액션 = 링크 만들기(퍼마링크 발급, 바이럴 루프 진입점 #91). elevated secondary —
            accent-soft 그라운드 + accent 아이콘/텍스트로 저장(accent fill)과 채널(quiet outline)
            사이 중간 무게를 준다. v8 사이징(높이 50px·아이콘 16px, #357)은 모바일 ResultStage의
            .chrome-dark 스코프 안에서만 — 이 컴포넌트는 데스크톱 인스펙터와 공유라 기본값을
            바꾸면 데스크톱 픽셀이 바뀐다. */}
        <button
          type="button"
          onClick={handlePermalink}
          disabled={isBusy}
          title="공유 링크를 만들어 클립보드에 복사해요"
          className="text-mono flex min-h-[48px] w-full items-center justify-center gap-2 rounded-field-sm bg-accent-soft px-4 text-[11px] uppercase tracking-widest text-accent transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:opacity-50 [.chrome-dark_&]:min-h-[50px]"
        >
          <LinkIcon />
          <span key={permaLabel} className="inline-block animate-fade-in">
            {permaLabel}
          </span>
        </button>

        {/* 3차 액션 = 채널(카톡 등 OS 공유 시트). mockup의 '카카오톡' 셀은 더미라 SDK를 붙이지
            않고, OS 공유 시트(카톡 포함)를 여는 '공유' 버튼이 그 의도를 실제로 수행한다. D7: quiet
            outline, 빨강 없음. X 제거 후 단일 열이라 링크 버튼과 같은 가로 배치로 통일(#325). */}
        <button
          type="button"
          onClick={handleShareLink}
          disabled={isBusy}
          title="카톡·메신저 등으로 공유해요"
          className="text-mono flex min-h-[48px] w-full items-center justify-center gap-2 rounded-field-sm border border-line bg-surface-elevated px-4 text-[11px] uppercase tracking-widest text-fg transition-colors hover:bg-accent-soft hover:text-accent disabled:cursor-not-allowed disabled:text-fg-faint disabled:hover:bg-transparent disabled:hover:text-fg-faint [.chrome-dark_&]:min-h-[50px]"
        >
          <ShareIcon />
          <span>공유</span>
        </button>

        {/* 공유 링크 패널 — '링크' 셀을 탭해 퍼마링크가 발급되면(permalink set) 펼쳐진다. */}
        {permalink && (
          <div ref={linkPanelRef} className="space-y-1.5 rounded-field-sm border border-line bg-surface p-3 animate-rise-in">
            {/* 모바일에선 rail(숨김)+시트로 ResultPanel이 둘 동시 렌더되므로 전역 id는
                중복된다 — 라벨은 span + 인풋 aria-label로 연결해 id 충돌을 피한다. */}
            <Eyebrow className="block">공유 링크</Eyebrow>
            <div className="flex items-stretch gap-2">
              <input
                ref={linkInputRef}
                type="text"
                readOnly
                value={permalink}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="공유 링크"
                className="text-mono min-w-0 flex-1 rounded-field-sm border border-line bg-surface-elevated px-3 py-2 text-[12px] text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-mono inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-field-sm border border-line bg-surface-elevated px-3.5 text-[11px] uppercase tracking-widest text-fg transition-colors hover:border-accent hover:text-accent"
              >
                <span key={copyLabel} className="inline-block animate-fade-in">
                  {copyLabel}
                </span>
              </button>
            </div>
            {/* 공유 링크 disclaimer(#179) — 만료·비공식·양도불가 고지. 만료일은 cleanup과 같은
                단일 출처(DEFAULT_TICKET_TTL_DAYS)에서 가져와 표기와 실제 정책이 어긋나지 않게 한다. */}
            <p className="break-keep text-[11px] leading-snug text-fg-faint">
              이 링크는 {DEFAULT_TICKET_TTL_DAYS}일 후 만료돼요. {UNOFFICIAL_TICKET_NOTICE}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

// 보조 버튼 아이콘은 v8에서 16px(#357) — .chrome-dark(모바일 ResultStage) 스코프에서만 클래스로
// 줄이고, 속성 크기(18)는 데스크톱 인스펙터 픽셀 불변을 위해 유지한다.
function LinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="[.chrome-dark_&]:h-4 [.chrome-dark_&]:w-4">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="[.chrome-dark_&]:h-4 [.chrome-dark_&]:w-4">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.59 13.51 6.83 3.98M15.41 6.51 8.59 10.49" />
    </svg>
  );
}
