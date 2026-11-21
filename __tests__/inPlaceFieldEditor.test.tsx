/**
 * #354 → #826 S3 회귀 테스트 — 필드 입력 패널.
 *
 * 검증 축:
 *  1. 탭 → 패널 입력(16px)이 뜨고, 타이핑이 movieInfo에 반영된다(티켓이 텍스트를 렌더).
 *  2. ‹ › 순회는 현재 무드 DOM에 실제 존재하는 필드(data-field-tap 앵커)만 돈다 —
 *     minimal은 bookingNo 미렌더(MOOD_EXCLUDED_FIELDS)라 순회에 안 나온다.
 *  3. 완료 → 패널 닫힘. 표시는 패널이 아니라 정보 목록 눈으로만 바꾼다(inPlacePanelS3가 커버).
 *  4. 빈 항목(ghost, #826 S2 constraint-8): 정보 모드 자동 on · 사진/디자인 모드는 메뉴 '빈 항목 표시' 스위치 ·
 *     편집 중 강제 on — 스위치가 꺼져 있어도 편집에 들어가면 빈 필드 placeholder가 탭 타깃으로 남는다.
 *
 * happy-dom은 레이아웃이 없어 rect가 전부 0이지만, 측정 게이트는 "앵커 존재"라 오버레이가 뜬다
 * (위치 어서션은 하지 않는다 — 지오메트리는 브라우저 E2E 몫).
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { MIN_AA, targetPx } from './tapTargets';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <div data-testid="movie-title">{photo.state.movieInfo.title}</div>
      <div data-testid="movie-theater">{photo.state.movieInfo.theater}</div>
      <div data-testid="movie-actors">{photo.state.movieInfo.actors}</div>
      <div data-testid="vis-actors">{String(photo.state.fieldVisibility.actors)}</div>
      <div data-testid="signature-image">{photo.state.components.signatureImage}</div>
      <button
        type="button"
        onClick={() => {
          photo.handleImageUpload('blob:test-poster');
          photo.updateMovieInfo({ title: 'TITLE0', theater: 'CGV0' });
        }}
      >
        seed
      </button>
      <button type="button" onClick={() => photo.updateFieldVisibility({ actors: false })}>
        hide-actors
      </button>
      <button type="button" onClick={() => photo.updateComponents({ signatureImage: 'blob:seeded-signature' })}>
        seed-signature-image
      </button>
      <MobileEditorShell
        photo={photo}
        canExport
        theme="light"
        themePreference="light"
        onThemeChange={() => {}}
        onDone={() => {}}
        disabledReason=""
        previewMovieInfo={photo.state.movieInfo}
        previewComponents={photo.state.components}
        fieldVisibility={photo.state.fieldVisibility}
      />
    </>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('인플레이스 필드 에디터 (#354)', () => {
  test('필드 탭 → 인플레이스 input → 타이핑이 폼 상태에 반영', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    fireEvent.click(await screen.findByRole('button', { name: '극장 편집' }));
    const input = await screen.findByRole('textbox', { name: '극장' });
    fireEvent.change(input, { target: { value: 'CGV 용산아이파크몰' } });
    expect(screen.getByTestId('movie-theater').textContent).toBe('CGV 용산아이파크몰');
  });

  test('prev/next 순회 — 현재 무드에 실제 렌더되는 필드만 돈다(minimal: bookingNo 제외)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    // title에서 시작해 next로 전체 한 바퀴 — 도는 동안 bookingNo(예매 번호) input이 나오면 실패.
    fireEvent.click(await screen.findByRole('button', { name: '제목 편집' }));
    await screen.findByRole('textbox', { name: '제목' });

    const seen: string[] = [];
    for (let i = 0; i < 20; i++) {
      fireEvent.click(screen.getByRole('button', { name: '다음 항목' }));
      // 글자 입력 없는 필드(평점)도 패널은 항상 있으므로 패널의 존재로 순회를 관찰한다.
      expect(screen.getAllByRole('group', { name: / 입력$/ }).length).toBe(1);
      const input = screen.queryByRole('textbox');
      if (input) seen.push(input.getAttribute('aria-label') ?? '');
      if (screen.queryByRole('textbox', { name: '제목' })) break; // 한 바퀴 완료
    }
    expect(seen).not.toContain('예매 번호'); // minimal 미렌더 필드는 순회에 없다
    expect(seen).toContain('출연'); // 렌더되는 필드는 순회에 있다
    expect(screen.getByRole('textbox', { name: '제목' })).toBeTruthy(); // 순환 복귀
  });

  test('prev가 역방향으로 돈다 (제목 → 이전 = 마지막 렌더 필드)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    fireEvent.click(await screen.findByRole('button', { name: '제목 편집' }));
    await screen.findByRole('textbox', { name: '제목' });
    fireEvent.click(screen.getByRole('button', { name: '이전 항목' }));
    // 제목이 아닌 다른 필드로 이동했다(순환) — 정확한 타깃은 무드 구성에 따르므로 이탈만 확인.
    expect(screen.queryByRole('textbox', { name: '제목' }) === null).toBe(true);
  });

  test('완료 → 패널 닫힘', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    fireEvent.click(await screen.findByRole('button', { name: '극장 편집' }));
    await screen.findByRole('textbox', { name: '극장' });
    // 상단 줄에도 '완료'(문서 완성)가 있어 패널 안에서 찾는다.
    fireEvent.click(within(screen.getByRole('group', { name: '극장 입력' })).getByRole('button', { name: '완료' }));
    expect(screen.queryByRole('textbox', { name: '극장' }) === null).toBe(true);
    expect(screen.queryByRole('group', { name: '극장 입력' }) === null).toBe(true);
  });

  test('prev/next 순회 경유는 숨긴 필드 가시성을 켜지 않는다 (PR #359 리뷰 P1)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    fireEvent.click(screen.getByText('hide-actors'));
    expect(screen.getByTestId('vis-actors').textContent).toBe('false');

    // title에서 next를 눌러 actors를 경유·통과해도 actors 가시성은 그대로 꺼져 있어야 한다.
    // (자동 표시 on은 FieldTap 직접 탭(handleField) 전용 — 순회는 순수 탐색.)
    fireEvent.click(await screen.findByRole('button', { name: '제목 편집' }));
    await screen.findByRole('textbox', { name: '제목' });
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole('button', { name: '다음 항목' }));
    }
    expect(screen.getByTestId('vis-actors').textContent).toBe('false');
  });

  test('출연은 패널 입력 하나만 뜨고, 타이핑이 movieInfo.actors에 반영된다 (#447)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    // actors는 비어 있어 ghost off에선 탭 타깃이 없다 — 극장 편집으로 먼저 진입해 ghostEff를 켠다.
    fireEvent.click(await screen.findByRole('button', { name: '극장 편집' }));
    await screen.findByRole('textbox', { name: '극장' });
    fireEvent.click(await screen.findByRole('button', { name: '출연 편집' }));

    // 티켓 위 투명 입력은 없다 — 패널 입력 하나만 존재.
    const boxes = await screen.findAllByRole('textbox', { name: '출연' });
    expect(boxes).toHaveLength(1);

    fireEvent.change(boxes[0], { target: { value: '배우A, 배우B' } });
    expect(screen.getByTestId('movie-actors').textContent).toBe('배우A, 배우B');
  });

  test('편집 중 ghost 강제 on — "빈 항목 표시" off(디자인 모드)여도 빈 필드 탭 타깃이 남는다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    // 정보 모드는 빈 항목이 자동으로 켜진다 — 스위치가 정하는 디자인 모드로 옮긴다(스위치 기본 꺼짐, D03 A).
    fireEvent.click(screen.getByRole('tab', { name: '디자인' }));

    // 편집 진입 전: 빈 필드(출연)는 placeholder가 없어 탭 타깃 없음.
    expect(screen.queryByRole('button', { name: '출연 편집' }) === null).toBe(true);

    // 극장 편집 진입 → ghostEff 강제 on → 출연 탭 타깃 등장.
    fireEvent.click(await screen.findByRole('button', { name: '극장 편집' }));
    await screen.findByRole('textbox', { name: '극장' });
    expect(await screen.findByRole('button', { name: '출연 편집' })).toBeTruthy();
  });

  test('정보 모드는 빈 항목이 자동으로 켜지고, 사진·디자인 모드는 메뉴 "빈 항목 표시" 스위치를 따른다 (#826 S2)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('landing-skip-poster')); // 메뉴(⋯)는 랜딩을 떠난 뒤에 선다(#826 S2)
    fireEvent.click(screen.getByText('seed'));

    // 정보 모드(기본): 스위치와 무관하게 빈 필드 탭 타깃이 있다.
    expect(screen.getByRole('tab', { name: /^정보/ }).getAttribute('aria-selected')).toBe('true');
    expect(!!screen.queryByRole('button', { name: '출연 편집' })).toBe(true);

    // 디자인 모드 + 스위치 꺼짐: 없다.
    fireEvent.click(screen.getByRole('tab', { name: '디자인' }));
    expect(!!screen.queryByRole('button', { name: '출연 편집' })).toBe(false);

    // 스위치를 켜면 디자인 모드에서도 있다.
    fireEvent.click(screen.getByRole('button', { name: '편집 메뉴' }));
    fireEvent.click(screen.getByRole('switch', { name: '빈 항목 표시' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(!!screen.queryByRole('button', { name: '출연 편집' })).toBe(true);
  });

  // #484 c6 — signature는 StampTarget이 아니지만(c3) isImageField 플래그로 chain/format과
  // 동일한 이미지 업로드 UI 분기를 공유해야 한다.
  describe('서명 필드 isImageField 라우팅 (#484 c6)', () => {
    test('이미지 없을 때: 글자 입력 + 둘째 줄 "이미지로"(chain/format과 동일)', async () => {
      render(<Harness />);
      fireEvent.click(screen.getByText('seed'));

      fireEvent.click(await screen.findByRole('button', { name: '서명 편집' }));
      expect(await screen.findByRole('textbox', { name: '서명' })).toBeTruthy();
      expect(screen.getByRole('button', { name: '이미지로' })).toBeTruthy();
    });

    test('이미지 있을 때: 글자 입력 대신 이미지 행(제거 · 교체), 제거하면 글자 입력으로 복귀', async () => {
      render(<Harness />);
      fireEvent.click(screen.getByText('seed'));
      fireEvent.click(screen.getByText('seed-signature-image'));

      fireEvent.click(await screen.findByRole('button', { name: '서명 편집' }));
      expect(screen.queryByRole('textbox', { name: '서명' }) === null).toBe(true);
      const removeBtn = await screen.findByRole('button', { name: '제거' });
      expect(screen.getByRole('button', { name: '교체' })).toBeTruthy();
      expect(screen.getByAltText('서명 이미지')).toBeTruthy();

      fireEvent.click(removeBtn);
      expect(screen.getByTestId('signature-image').textContent).toBe('');
      expect(await screen.findByRole('textbox', { name: '서명' })).toBeTruthy();
    });
  });
});

// #553 → #826 S2 → S3 — 탭 타깃. 상단 줄 버튼과 입력 패널 첫 줄(‹ › · 완료) 둘 다 44px로 못박는다(SC 2.5.5 AAA). 판정기는 #508과 같은 것을 쓴다
// (__tests__/tapTargets.ts — 클래스 파싱 + variant·scale 우회 금지).
// 이 파일에 두는 이유: 패널은 실제 티켓의 data-field-tap 앵커를 탭해야 뜨는데,
// resultStageBack.test.tsx가 TicketRenderer를 전역 mock으로 스텁 치므로(bun mock.module은
// 파일 간 격리가 안 된다) 그 뒤에 도는 파일에서는 앵커가 사라진다.
describe('탭 타깃: 상단 줄 · 입력 패널 44 (#553 → #826 S3)', () => {
  test('상단 줄 아이콘 버튼과 입력 패널 첫 줄 버튼이 모두 44px다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('landing-skip-poster')); // 상단 줄은 랜딩을 떠난 뒤에 선다(#826 S2)
    fireEvent.click(screen.getByText('seed'));

    const topBtns = Array.from(document.querySelectorAll('header button'));
    expect(topBtns.length).toBeGreaterThanOrEqual(6); // ‹ · 실행 취소 · 다시 실행 · 전체 보기 · ⋯ · 완료
    for (const b of topBtns) {
      // 완료는 라벨 버튼이라 폭이 글자에 따른다 — 높이만 선언돼 있다.
      if (b.getAttribute('aria-label') === null) {
        expect(b.classList.contains('h-touch')).toBe(true);
        continue;
      }
      const { w, h } = targetPx(b, b.getAttribute('aria-label') ?? 'top-bar');
      expect([w, h]).toEqual([44, 44]);
    }

    // 필드 탭 → 입력 패널. 상단 줄은 그대로 화면에 있다.
    fireEvent.click(await screen.findByRole('button', { name: '극장 편집' }));
    const panel = await screen.findByRole('group', { name: '극장 입력' });

    for (const name of ['이전 항목', '다음 항목']) {
      const b = within(panel).getByRole('button', { name });
      const { w, h } = targetPx(b, name);
      expect([w, h]).toEqual([44, 44]);
      expect(Math.min(w, h)).toBeGreaterThanOrEqual(MIN_AA);
    }
    // 완료는 라벨 버튼이라 폭이 글자에 따른다 — 누르는 높이 44가 선언돼 있다.
    expect(within(panel).getByRole('button', { name: '완료' }).classList.contains('h-touch')).toBe(true);
  });
});
