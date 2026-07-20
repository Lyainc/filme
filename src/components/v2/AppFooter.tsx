import { GithubLink } from './AppHeader';
import { UNOFFICIAL_TICKET_NOTICE } from '@/utils/ticketCleanup';

/** 앱 chrome 공통 footer(#327) — 비공식 고지 + copyright + GitHub. 데스크톱·모바일 셸이 공유한다.
 *  ambient(#363): 상시 앰비언트 다크가 깔린 모바일 셸용 — 바(배경·상단 보더) 없이 중앙 정렬로
 *  조용히 얹힌다. 기본형은 데스크톱 surface 바 그대로. */
export function AppFooter({ ambient = false }: { ambient?: boolean }) {
  return (
    <footer
      className={`flex shrink-0 flex-wrap items-center gap-2 px-4 py-2.5 text-[9.5px] leading-snug text-fg-faint ${
        ambient ? 'justify-center text-center' : 'justify-between border-t border-line bg-surface'
      }`}
    >
      <p className="break-keep">{UNOFFICIAL_TICKET_NOTICE} © FILME</p>
      <GithubLink />
    </footer>
  );
}
