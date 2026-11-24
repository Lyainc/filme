import { NoticeContent } from './AppFooter';
import { LandingSheetFrame } from './LandingSheetFrame';

/**
 * 랜딩 이용 고지 시트(#826 S9 constraint-12, 소유자 결정 2026-11-24 '작은 시트로 열기') — 워드마크 줄의 '이용 고지'가
 * 여는 작은 아래 시트. 본문은 고지 문구 · 크레딧 · GitHub 그대로(NoticeContent)이고 처음 포커스는 닫기 버튼이다.
 */
export function LandingNoticeSheet({ onClose }: { onClose: () => void }) {
  return (
    <LandingSheetFrame
      title="이용 고지"
      testId="landing-notice-sheet"
      catcherTestId="landing-notice-catcher"
      catcherClassName="z-[19]"
      className="absolute inset-x-0 bottom-0 z-20"
      style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' }}
      onClose={onClose}
    >
      <NoticeContent />
    </LandingSheetFrame>
  );
}
