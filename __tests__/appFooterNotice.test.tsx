/**
 * #327/#363 회귀 테스트 — 비공식 팬메이드 고지(AppFooter)의 노출 규칙.
 *
 * 모바일 셸에서 고지는 랜딩에 노출되고, 편집 화면에선 rail dock 위계 정리(#363)로 제거된다.
 * 컴플라이언스 성격의 문구라 리팩터링으로 조용히 사라지면 이 테스트가 잡는다(#190).
 *
 * **가르는 축은 포스터가 아니라 이탈이다**(#727) — 랜딩은 이제 draft·포스터 유무와 무관하게 뜨고
 * (D7 뒤집기), 사라지는 건 사용자가 실제로 랜딩을 떠났을 때뿐이다. 예전엔 croppedImageUrl이
 * 서기만 해도 랜딩이 걷혀 seed-poster 한 번으로 이 축이 재현됐는데, 그 파생 판정이 없어졌다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { UNOFFICIAL_TICKET_NOTICE } from '@/utils/ticketCleanup';
import { mobileShellProps } from './shellHarness';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed-poster
      </button>
      <MobileEditorShell {...mobileShellProps(photo)} />
    </>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(cleanup);

describe('AppFooter 고지 노출 (#327/#363)', () => {
  test('랜딩엔 고지가 있고, 랜딩을 떠난 편집 화면에선 사라진다', () => {
    render(<Harness />);
    expect(!!screen.queryByText(UNOFFICIAL_TICKET_NOTICE, { exact: false })).toBe(true);

    // 포스터가 도착해도 랜딩은 그대로다 — 고지도 그대로 있어야 한다(#727 c1).
    fireEvent.click(screen.getByText('seed-poster'));
    expect(!!screen.queryByText(UNOFFICIAL_TICKET_NOTICE, { exact: false })).toBe(true);

    // 이탈(직접 입력)로 랜딩이 hidden이 되면 AppFooter 자체가 안 그려진다.
    // received에 DOM 엘리먼트를 넣지 않는다(#693) — 실패 직렬화가 happy-dom 노드 그래프를 통째로 찍는다.
    fireEvent.click(screen.getByTestId('landing-skip-poster'));
    expect(!!screen.queryByText(UNOFFICIAL_TICKET_NOTICE, { exact: false })).toBe(false);
  });
});
