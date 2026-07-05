/**
 * #213 회귀 테스트 — MobileEditorShell 완료(내보내기) 게이팅.
 *
 * 완료 버튼은 disabled 속성이 아니라 aria-disabled를 쓴다(눌리되 게이팅) — canExport가
 * false면 탭해도 onDone을 부르지 않고 사유 토스트만 띄우고, true면 onDone(결과 열기)을 부른다.
 * 게이팅이 깨지면(예: 비활성인데 결과가 열리거나, 활성인데 안 열리면) 이 테스트가 잡는다.
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';

const REASON = '포스터를 먼저 추가해주세요';

function Harness({ canExport, onDone }: { canExport: boolean; onDone: () => void }) {
  const photo = usePhototicket();
  return (
    <MobileEditorShell
      photo={photo}
      canExport={canExport}
      theme="light"
      onThemeChange={() => {}}
      onPendingFetchChange={() => {}}
      onDone={onDone}
      disabledReason={REASON}
      previewMovieInfo={photo.state.movieInfo}
      previewComponents={photo.state.components}
      fieldVisibility={photo.state.fieldVisibility}
    />
  );
}

afterEach(cleanup);

describe('MobileEditorShell 완료 게이팅 (#213)', () => {
  test('비활성(canExport=false): 완료 탭 → onDone 미호출 + 사유 토스트 노출', async () => {
    const user = userEvent.setup();
    let calls = 0;
    render(<Harness canExport={false} onDone={() => { calls++; }} />);

    await user.click(screen.getByRole('button', { name: '완료' }));

    expect(calls).toBe(0);
    // 텍스트는 항상-마운트 sr-only 라이브리전 + 시각 토스트 두 곳에 실린다(#199 패턴).
    const hits = await screen.findAllByText(REASON);
    expect(hits.length).toBeGreaterThan(0);
  });

  test('활성(canExport=true): 완료 탭 → onDone 1회 호출', async () => {
    const user = userEvent.setup();
    let calls = 0;
    render(<Harness canExport={true} onDone={() => { calls++; }} />);

    await user.click(screen.getByRole('button', { name: '완료' }));

    expect(calls).toBe(1);
  });
});
