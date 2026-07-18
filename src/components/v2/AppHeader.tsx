import { useEffect, useRef, useState } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { Wordmark } from './Wordmark';

interface AppHeaderProps {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  /** #310: 명시적 임시저장/초기화 — usePhototicket이 소유, 이 헤더가 데스크톱의 유일한 진입점. */
  saveDraft: () => void;
  clearDraft: () => void;
}

/** 초기화 확인 문구(#310) — 데스크톱 AppHeader·모바일 MobileEditorShell 서브메뉴가 공유하는 단일 출처. */
export const CLEAR_DRAFT_CONFIRM_MESSAGE = '입력한 모든 티켓 정보를 지우고 초기화할까요? 되돌릴 수 없어요.';

/** GitHub 저장소 링크 — 헤더(데스크톱)·AppFooter(#327)가 공유하는 단일 정의. */
export function GithubLink({ className }: { className?: string }) {
  return (
    <a
      href="https://github.com/Lyainc/filme"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="GitHub 저장소"
      className={className ?? 'inline-flex items-center text-fg-muted hover:text-fg transition-colors'}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
    </a>
  );
}

/** 임시저장 아이콘 버튼 — 클릭 시 저장 즉시 실행 + 체크 아이콘으로 잠깐 피드백
 * (ResultPanel의 copyLabel 패턴 참고 — 새 토스트 인프라 없이 버튼 자체 상태로 충분). */
function SaveDraftButton({ onClick }: { onClick: () => void }) {
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  return (
    <button
      type="button"
      onClick={() => {
        onClick();
        setSaved(true);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setSaved(false), 1600);
      }}
      aria-label={saved ? '임시저장됨' : '임시저장'}
      title="임시저장"
      className="inline-flex items-center text-fg-muted hover:text-fg transition-colors"
    >
      {saved ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
          <path d="M17 21v-8H7v8" />
          <path d="M7 3v5h8" />
        </svg>
      )}
    </button>
  );
}

/** 초기화 아이콘 버튼 — 파괴적 액션(모든 입력값 소실)이라 네이티브 confirm으로 한 번 확인한다
 * (이 코드베이스엔 아직 확인 모달/토스트 인프라가 없어 새로 만들지 않고 가장 가벼운 방법을 쓴다). */
function ClearDraftButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm(CLEAR_DRAFT_CONFIRM_MESSAGE)) {
          onClick();
        }
      }}
      aria-label="초기화"
      title="초기화 (입력값 전체 삭제)"
      className="inline-flex items-center text-fg-muted hover:text-fg transition-colors"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    </button>
  );
}

export function AppHeader({ theme, onThemeChange, saveDraft, clearDraft }: AppHeaderProps) {
  return (
    // rail(1024) 미만은 CSS로 숨긴다(#418) — mount 전 SSR/첫 페인트가 데스크톱을 기본 렌더해도
    // 실제 뷰포트가 모바일이면 이 헤더가 하이드레이션을 기다리지 않고 즉시 숨어, "데스크톱 헤더
    // 노출 후 모바일 셸로 교체" FOUC가 사라진다. index.tsx의 JS 분기(mounted && isMobile)는 셸
    // 전체 교체를 계속 담당 — 이 헤더는 그 전 창(pre-mount)의 잔여 증상만 CSS로 선제 차단한다.
    <header className="hidden h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4 rail:flex">
      <div className="flex items-center gap-2">
        <Wordmark as="h1" />
      </div>

      <div className="flex items-center gap-3">
        <SaveDraftButton onClick={saveDraft} />
        <ClearDraftButton onClick={clearDraft} />
        <GithubLink />
        <ThemeToggle theme={theme} onChange={onThemeChange} />
      </div>
    </header>
  );
}
