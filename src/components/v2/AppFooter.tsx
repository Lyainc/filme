import { UNOFFICIAL_TICKET_NOTICE } from '@/utils/ticketCleanup';

/** GitHub 저장소 링크 — 데스크톱 AppHeader와 공유하던 단일 정의였고, 그 헤더가 #607에서
 *  삭제되며 유일한 소비자인 이 파일로 내려왔다. */
export function GithubLink({ className }: { className?: string }) {
  return (
    <a
      href="https://github.com/Lyainc/filme"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="GitHub 저장소"
      className={className ?? 'inline-flex items-center text-fg-muted hover:text-fg transition-colors'}
    >
      <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
    </a>
  );
}

/**
 * 폰트 출처 고지(#437) — 한줄평·서명 9택이 쓰는 8종 중 **KCC은영체만 CCL 저작자표시**라
 * 저작자·제목·출처 표기가 라이선스 의무다. 나머지 7종은 고지 없이 써도 되는 조건이라 여기
 * 안 싣는다(전체 목록·조항은 `public/fonts/LICENSES.md`) — 의무인 것만 적어야 이 줄이
 * "지워도 되는 장식"으로 보이지 않는다.
 *
 * 그 폰트를 실제로 고른 사용자에게만 띄우지 않고 상시 표기하는 건, 저장본을 나중에 열거나
 * 공유 페이지로 볼 때도 고지가 따라가야 하는데 그 경로마다 선택값을 읽는 것보다 한 줄을
 * 늘 두는 게 확실해서다.
 */
function FontCredit() {
  return (
    <p className="break-keep">
      글꼴{' '}
      <a
        href="https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13072022&menuNo=200133"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-fg transition-colors"
      >
        KCC은영체
      </a>{' '}
      한국저작권위원회 (CC BY)
    </p>
  );
}

/** 앱 chrome 공통 footer(#327) — 비공식 고지 + copyright + 폰트 크레딧 + GitHub.
 *  ambient(#363): 상시 앰비언트 다크가 깔린 모바일 셸용 — 바(배경·상단 보더) 없이 중앙 정렬로
 *  조용히 얹힌다. 기본형(바)은 데스크톱 셸이 쓰던 형태로, #607 이후 소비자는 ambient뿐이다. */
export function AppFooter({ ambient = false }: { ambient?: boolean }) {
  return (
    <footer
      className={`flex shrink-0 flex-wrap items-center gap-2 px-4 py-2.5 text-micro leading-snug text-fg-muted ${
        ambient ? 'justify-center text-center' : 'justify-between border-t border-line bg-surface'
      }`}
    >
      <p className="break-keep">{UNOFFICIAL_TICKET_NOTICE} © FILME</p>
      <FontCredit />
      <GithubLink />
    </footer>
  );
}
