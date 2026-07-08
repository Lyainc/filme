/**
 * #224 — DesktopStudioShell 3-pane 셸 상호작용 테스트.
 *
 * - 아이콘 내비 3탭(POSTER/INFO/DESIGN) 클릭 시 인스펙터 콘텐츠가 스왑되는지.
 * - 편집 모드 CTA("티켓 완성") 게이팅: canExport=false면 disabled, true면 클릭 시 onDone 1회.
 * - resultOpen=true면 인스펙터가 ResultPanel(완성)로 바뀌고 캔버스에 "편집으로" pill이 뜨는지.
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesktopStudioShell } from '@/components/v2/DesktopStudioShell';

function Harness({
  canExport = false,
  resultOpen = false,
  onDone = () => {},
  onBackToEdit = () => {},
}: {
  canExport?: boolean;
  resultOpen?: boolean;
  onDone?: () => void;
  onBackToEdit?: () => void;
}) {
  const photo = usePhototicket();
  return (
    <DesktopStudioShell
      photo={photo}
      theme="light"
      onThemeChange={() => {}}
      canExport={canExport}
      disabledReason="포스터를 먼저 추가해주세요"
      resultOpen={resultOpen}
      onDone={onDone}
      onBackToEdit={onBackToEdit}
      previewMovieInfo={photo.state.movieInfo}
      previewComponents={photo.state.components}
      fieldVisibility={photo.state.fieldVisibility}
    />
  );
}

afterEach(cleanup);

describe('DesktopStudioShell (#224)', () => {
  test('탭 클릭 시 인스펙터 콘텐츠가 poster↔info↔design으로 스왑된다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 기본 탭 = poster → ImageUploader 드롭존.
    expect(screen.getByText('포스터 업로드')).toBeDefined();

    // INFO → FieldLauncher(그룹 'Film'). poster 콘텐츠는 사라진다.
    await user.click(screen.getByRole('button', { name: 'INFO' }));
    expect(screen.getByText('Film')).toBeDefined();
    expect(screen.queryByText('포스터 업로드')).toBeNull();

    // DESIGN → DesignRail(레일 아이콘 '무드').
    await user.click(screen.getByRole('button', { name: 'DESIGN' }));
    expect(screen.getByText('무드')).toBeDefined();
    expect(screen.queryByText('Film')).toBeNull();

    // POSTER 복귀.
    await user.click(screen.getByRole('button', { name: 'POSTER' }));
    expect(screen.getByText('포스터 업로드')).toBeDefined();
  });

  test('canExport=false면 CTA disabled, true면 클릭 시 onDone 1회', async () => {
    const user = userEvent.setup();

    const { unmount } = render(<Harness canExport={false} />);
    const disabledCta = screen.getByRole('button', { name: '티켓 완성' }) as HTMLButtonElement;
    expect(disabledCta.disabled).toBe(true);
    unmount();

    let calls = 0;
    render(<Harness canExport onDone={() => { calls++; }} />);
    const enabledCta = screen.getByRole('button', { name: '티켓 완성' }) as HTMLButtonElement;
    expect(enabledCta.disabled).toBe(false);
    await user.click(enabledCta);
    expect(calls).toBe(1);
  });

  test('resultOpen=true면 인스펙터가 ResultPanel(완성)로 바뀌고 "편집으로" pill이 뜬다', () => {
    render(<Harness resultOpen />);

    // 포스터 없는 상태의 ResultPanel 폴백 문구 = 완성 패널이 마운트된 증거.
    expect(screen.getByText(/포스터가 없어요/)).toBeDefined();
    // 캔버스 좌상단 "← 편집으로" 복귀 pill.
    expect(screen.getByRole('button', { name: /편집으로/ })).toBeDefined();
    // 편집 전용 footer CTA는 완성 모드에서 사라진다.
    expect(screen.queryByRole('button', { name: '티켓 완성' })).toBeNull();
  });
});

describe('DesktopStudioShell — 전체 표시/숨김 토글 (#227)', () => {
  test('전체 숨김 → 제목(필수) 제외 모든 필드 eye off + 라벨 전환, 재클릭 시 복귀', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'INFO' }));

    const seatEye = () => screen.getByRole('checkbox', { name: '좌석 티켓에 표시' }) as HTMLInputElement;

    // 필수 필드(제목)는 애초에 행 eye 토글이 없어 일괄토글 대상이 아니다(#260).
    expect(screen.queryByRole('checkbox', { name: '제목 티켓에 표시' })).toBeNull();

    // 초기: 모두 표시(ALL_FIELDS_ON) → 버튼 라벨 '전체 숨김', 좌석 eye 켜짐.
    expect(seatEye().checked).toBe(true);

    await user.click(screen.getByRole('button', { name: '전체 숨김' }));

    // 좌석은 꺼지고 — 라벨은 '전체 표시'로.
    expect(seatEye().checked).toBe(false);

    // 재클릭 → 전체 표시 복귀.
    await user.click(screen.getByRole('button', { name: '전체 표시' }));
    expect(seatEye().checked).toBe(true);
  });
});
