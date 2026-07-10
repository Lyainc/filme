import { GithubLink } from './AppHeader';
import { UNOFFICIAL_TICKET_NOTICE } from '@/utils/ticketCleanup';

/** 앱 chrome 공통 footer(#327) — 비공식 고지 + copyright + GitHub. 데스크톱·모바일 셸이 공유한다. */
export function AppFooter() {
  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-4 py-2.5 text-[10.5px] leading-snug text-fg-faint">
      <p>{UNOFFICIAL_TICKET_NOTICE} © FILME</p>
      <GithubLink />
    </footer>
  );
}
