import { useCallback, useEffect, useState } from 'react';
import TicketRenderer, { PREVIEW_MAX_HEIGHT } from '@/components/TicketRenderer';
import { getLayout } from '@/utils/layouts';
import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';
import { PreviewFilmCell } from './PreviewFilmCell';
import { RESULT_NOTICE_BLOCK_PX, ResultPanel } from './ResultPanel';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

interface ResultStageProps {
  theme: 'light' | 'dark';
  onBack: () => void;
  croppedImageUrl: string | null;
  movieInfo: MovieInfo;
  components: TicketComponents;
  fieldVisibility: Record<TicketField, boolean>;
}

/** 통보 글자가 머무는 시간(#826 S7 constraint-7, 약 2초). 통보 영역 자체는 남는다(constraint-17). */
const RESULT_NOTICE_MS = 2000;

// 세로 예산(#826 S7 constraint-4 · constraint-19). 티켓 위: 위 줄 44 + 간격 8. 티켓 아래: 간격 12 + 버튼 줄 44 +
// 고지 간격 8 + 고지 블록(만료 줄까지 예약) + 바닥 여백 12. 경고 · 대체 칸은 버튼 줄 위에 겹쳐 떠서 예산 밖이다.
const TOPBAR_PX = 44;
const HERO_GAP_TOP_PX = 8;
const HERO_GAP_BOTTOM_PX = 12;
const BOTTOM_PAD_PX = 12;
const BOTTOM_STACK_PX = HERO_GAP_BOTTOM_PX + 44 + 8 + RESULT_NOTICE_BLOCK_PX + BOTTOM_PAD_PX;

/**
 * 결과 화면(#258 → #826 S7, 마스터 R-01 · D11 A) — 편집 셸을 교체하는 전체화면 스테이지.
 * 위 줄 ‹ 하나 + 화면 폭을 거의 채우는 티켓(표시 전용 TicketRenderer) + [저장] [링크] [공유] 한 줄과 고지(ResultPanel).
 * 앱 테마를 따른다(D21-5 A): 다크일 때만 .chrome-dark 스코프, 라이트는 라이트 토큰(편집 셸과 같은 규칙, #415).
 */
export function ResultStage({
  theme,
  onBack,
  croppedImageUrl,
  movieInfo,
  components,
  fieldVisibility,
}: ResultStageProps) {
  const layout = getLayout(components.layout);
  const landscape = layout.width > layout.height;
  // 통보 — live region은 늘 마운트하고 글자만 바꾼다(SR이 삽입과 동시에 바뀐 글자를 놓친다, #199).
  // seq는 같은 문구가 연달아 와도 타이머를 다시 거는 용도다.
  const [notice, setNotice] = useState<{ msg: string; seq: number }>({ msg: '', seq: 0 });
  const pushNotice = useCallback((msg: string) => setNotice((prev) => ({ msg, seq: prev.seq + 1 })), []);
  useEffect(() => {
    if (!notice.msg) return;
    const timer = setTimeout(() => setNotice((prev) => ({ ...prev, msg: '' })), RESULT_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice.msg, notice.seq]);

  // 티켓 크기 — 가로 상한(프레임 폭 − 좌우 16px)과 세로 상한(위 줄 · 버튼 줄 · 고지를 빼고 남는 높이) 중 작은 쪽.
  // 단위는 뷰포트가 아니라 폰 프레임(cqw/cqh, #605 · #607)이다. 세로 상한은 가로로 눕힌 폰처럼 낮은 프레임에서도
  // 0으로 무너지지 않게 하한을 둔다(#380 리뷰의 hero 소멸 회귀). TicketRenderer가 자기 안에 거는 세로 상한
  // (PREVIEW_MAX_HEIGHT)도 같이 넣는다 — 빠지면 티켓이 hero 상자보다 작아져 상자 = 티켓이 깨진다.
  const heroMaxH = `min(${PREVIEW_MAX_HEIGHT}, max(120px, calc(100cqh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - ${TOPBAR_PX + HERO_GAP_TOP_PX + BOTTOM_STACK_PX}px)))`;
  const heroWidth = `min(calc(100cqw - 32px), calc(${heroMaxH} * ${layout.width} / ${layout.height}))`;

  return (
    <div
      data-testid="result-stage"
      data-theme={theme}
      className={cn('app-canvas', theme === 'dark' && 'chrome-dark')}
      // minHeight가 아니라 height다(#604 리뷰) — 프레임은 contain:paint라 넘치는 자식을 자르고 스스로 스크롤하지 않는다.
      style={{ position: 'relative', height: '100cqh', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* testid는 편집 셸의 chrome-ambient와 분리 — 결과 화면 동안 편집 셸이 hidden으로 같이 마운트돼 있다(PR #362 리뷰 P2).
          테마와 상관없이 루트의 직계 자식으로 둔다 — 하네스가 이걸로 결과 화면 루트를 찾는다. */}
      <div aria-hidden="true" data-testid="result-ambient" className="chrome-ambient pointer-events-none absolute inset-0" />

      <header data-testid="result-topbar" className="relative flex shrink-0 items-center" style={{ height: TOPBAR_PX }}>
        {/* 보이는 제목은 없지만(D11 A) 화면을 알리는 heading 랜드마크는 남긴다. */}
        <h1 className="sr-only">결과</h1>
        <button
          type="button"
          onClick={onBack}
          aria-label="편집으로 돌아가기"
          className={cn(pressableVariants(), 'flex h-touch w-touch items-center justify-center text-ink-2 transition-colors hover:text-ink')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      </header>

      {/* 통보 영역(constraint-17 · R-03) — 결과 화면은 아래가 전부 조작이라 위쪽(위 줄 아래, 티켓 위)에 띄운다. */}
      <div
        className="pointer-events-none absolute inset-x-4 z-20 flex justify-center"
        style={{ top: `calc(env(safe-area-inset-top, 0px) + ${TOPBAR_PX + HERO_GAP_TOP_PX}px)` }}
      >
        <div
          role="status"
          aria-live="polite"
          data-testid="result-toast"
          className={cn(
            'rounded-field-sm text-body text-ink',
            notice.msg && 'border border-hair bg-s2 px-4 py-2 animate-fade-in',
          )}
          style={notice.msg ? { boxShadow: 'var(--shadow-pop)' } : undefined}
        >
          {notice.msg}
        </div>
      </div>

      <div data-testid="result-scroll" className="relative min-h-0 flex-1 overflow-y-auto px-4" style={{ paddingTop: landscape ? 0 : HERO_GAP_TOP_PX, paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${BOTTOM_PAD_PX}px)` }}>
        {/* 가로 무드는 돌리지 않고 위 줄과 버튼 줄 사이 남는 높이의 가운데에 놓는다(constraint-4) — 슬롯이 위 줄
            바로 아래부터 버튼 줄 바로 위까지(위아래 간격 8 · 12 포함)를 차지해야 위아래 여백이 같아진다. */}
        <div
          data-testid="result-hero-slot"
          className="flex items-center justify-center"
          style={landscape ? { height: `calc(${heroMaxH} + ${HERO_GAP_TOP_PX + HERO_GAP_BOTTOM_PX}px)` } : undefined}
        >
          {/* 포스터가 없어도(#631 D3) hero는 그대로 선다. 바닥 그림자는 없다 — 이 상자가 곧 티켓 상자다. */}
          <div className="result-hero relative" style={{ width: heroWidth }}>
            <PreviewFilmCell promoted>
              <TicketRenderer
                croppedImageUrl={croppedImageUrl}
                movieInfo={movieInfo}
                components={components}
                fieldVisibility={fieldVisibility}
                // 저장 대상(ResultPanel)과 같은 렌더여야 hero가 저장본을 그대로 보여준다(#768).
                ghost={false}
              />
            </PreviewFilmCell>
          </div>
        </div>

        <div className="mx-auto" style={{ width: 'calc(100cqw - 32px)', maxWidth: '100%', paddingTop: landscape ? 0 : HERO_GAP_BOTTOM_PX }}>
          <ResultPanel
            croppedImageUrl={croppedImageUrl}
            movieInfo={movieInfo}
            components={components}
            fieldVisibility={fieldVisibility}
            onNotice={pushNotice}
          />
        </div>
      </div>
    </div>
  );
}
