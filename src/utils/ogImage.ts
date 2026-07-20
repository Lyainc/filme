/** 카카오톡/SNS 가로 OG 카드 치수(#438) — 세로 티켓을 크롭 없이 담는 letterbox 캔버스.
 *
 * 이 파일은 `t/[id].tsx`(페이지 컴포넌트, 클라이언트 번들에도 포함됨)가 import한다 — 실제
 * 생성 로직(`ogImageBuild.ts`)은 Node 전용 `sharp`를 쓰므로 여기 같이 두면 안 된다. sharp가
 * `detect-libc` → `child_process`를 요구해 브라우저 번들링이 "Module not found"로 깨진다
 * (2026-07-21 실측). 상수만 이 파일에, 생성 함수는 API 라우트만 import하는 별도 파일에.
 */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
