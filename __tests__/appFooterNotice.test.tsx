/**
 * #327/#363 회귀 테스트 — 비공식 팬메이드 고지(AppFooter)의 노출 규칙.
 *
 * 모바일 셸에서 고지는 랜딩(포스터 없음)에 노출되고, 편집 화면(포스터 있음)에선
 * rail dock 위계 정리(#363)로 제거된다. 컴플라이언스 성격의 문구라 리팩터링으로
 * 조용히 사라지면 이 테스트가 잡는다(#190).
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
  test('랜딩(포스터 없음)엔 고지가 있고, 편집(포스터 있음)에선 사라진다', () => {
    render(<Harness />);
    expect(screen.getByText(UNOFFICIAL_TICKET_NOTICE, { exact: false })).toBeTruthy();

    fireEvent.click(screen.getByText('seed-poster'));
    expect(screen.queryByText(UNOFFICIAL_TICKET_NOTICE, { exact: false })).toBeNull();
  });
});
