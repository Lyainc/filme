/**
 * #682 다이어트 — 형압 패널 컨트롤 4종(도구 칩·브러시 크기·형압 강도·지우기)이 상태에 따라
 * 조건부로만 뜨는지, 그리고 "지우기"가 전폭 버튼 대신 형압 강도 라벨 줄에 인라인으로 접힌 뒤에도
 * 실제로 마스크를 지우는지 검증한다. happy-dom은 실 px를 못 재 슬롯 넘침 자체(scrollHeight vs
 * clientHeight)는 못 잡는다 — 그건 puppeteer 실측(#682 PR 코멘트) 몫이고, 여기선 조건부 렌더
 * 로직과 "지우기" 배선만 잠근다.
 *
 * fresh-context 리뷰(#682 diff)가 "지우기" 버튼이 h-7(28px)로 명시적 높이를 못박기 전엔 line-
 * height만으로 AA 24px 하한과 마진이 1px 미만이었다고 지적했다 — 클래스 자체가 남아 있는지도
 * 같이 잠근다(폭은 텍스트 길이를 따라가는 인라인 텍스트 액션이라 WCAG 2.5.8 문장 내 예외 대상,
 * 폭 하한은 대상이 아니다).
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      {/* pointer 드래그 좌표 계산은 happy-dom에 없어(getBoundingClientRect가 0) 실 브러시
          스탬프를 못 찍는다 — 마스크 유무만 필요하므로 직접 addEmbossStamp를 부르는 버튼으로
          대신한다. */}
      <button data-testid="seed-mask" onClick={() => photo.addEmbossStamp({ x: 0.5, y: 0.5, r: 0.1 })}>
        seed
      </button>
      <div data-testid="stamp-count">{photo.state.embossStamps.length}</div>
      <DesignRail photo={photo} />
    </>
  );
}

async function openEmbossPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '하이라이트' }));
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('형압 패널 콘텐츠 조건부 렌더 (#682)', () => {
  test('마스크 없고 편집 중도 아니면 브러시 크기·강도·지우기 전부 안 뜬다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openEmbossPanel(user);

    expect(screen.queryByLabelText('브러시 크기')).toBeNull();
    expect(screen.queryByLabelText('하이라이트 강도')).toBeNull();
    expect(screen.queryByText('지우기')).toBeNull();
    expect(screen.getByText('도구를 탭하면 바로 편집을 시작해요.')).not.toBeNull();
  });

  test('편집 중이면 브러시 크기는 뜨고 강도·지우기는 안 뜬다(마스크 有여도)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId('seed-mask'));
    await openEmbossPanel(user);
    await user.click(screen.getByRole('radio', { name: '브러시' }));

    expect(screen.getByLabelText('브러시 크기')).not.toBeNull();
    expect(screen.queryByLabelText('하이라이트 강도')).toBeNull();
    expect(screen.queryByText('지우기')).toBeNull();
  });

  test('편집 종료 + 마스크 有면 강도·지우기가 뜨고 브러시 크기·안내문은 사라진다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId('seed-mask'));
    await openEmbossPanel(user);
    await user.click(screen.getByRole('radio', { name: '브러시' })); // 진입
    await user.click(screen.getByRole('radio', { name: '브러시' })); // 종료

    expect(screen.queryByLabelText('브러시 크기')).toBeNull();
    expect(screen.getByLabelText('하이라이트 강도')).not.toBeNull();
    const clearBtn = screen.getByText('지우기');
    expect(clearBtn).not.toBeNull();
    // h-7(28px, AA 24px 하한보다 4px 여유) — fresh-context 리뷰가 잡은 마진 부족을 못박는다.
    expect(clearBtn.className).toContain('h-7');
    expect(screen.queryByText('도구를 탭하면 바로 편집을 시작해요.')).toBeNull();
  });

  // 올가미 안내문 정보 손실 회귀 (claude-review PR #692 P1) — #682 다이어트로 줄이면서 "손을 떼면
  // 선택이 닫혀요"가 통째로 빠졌었다. EmbossBrushLayer.tsx의 onPointerUp이 실제로 그 순간
  // 다각형을 커밋하고 미리보기 선을 지우는데(닫혔다는 시각 피드백이 따로 없다), 안내문이 유일한
  // 전달 수단이라 다시 잠근다.
  test('올가미 편집 중 안내문에 "손을 떼면 닫혀요"가 남아 있다(#692 P1)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openEmbossPanel(user);
    await user.click(screen.getByRole('radio', { name: '올가미' }));

    expect(screen.getByText('윤곽을 따라 드래그하면 자동으로 붙고, 손을 떼면 닫혀요. 다시 탭하면 끝나요.')).not.toBeNull();
  });

  test('"지우기"를 누르면 마스크가 실제로 비워지고 강도·지우기가 사라진다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId('seed-mask'));
    expect(screen.getByTestId('stamp-count').textContent).toBe('1');

    await openEmbossPanel(user);
    await user.click(screen.getByRole('radio', { name: '브러시' }));
    await user.click(screen.getByRole('radio', { name: '브러시' }));

    await user.click(screen.getByText('지우기'));

    expect(screen.getByTestId('stamp-count').textContent).toBe('0');
    expect(screen.queryByLabelText('하이라이트 강도')).toBeNull();
    expect(screen.queryByText('지우기')).toBeNull();
  });
});
