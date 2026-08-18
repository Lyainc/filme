/**
 * #735 완료조건 — 하이라이트·형압은 마스크가 분리돼 있어(embossStamps/Paths vs reliefStamps/Paths)
 * "지우기"는 패널의 효과 축(embossEffect)이 가리키는 마스크만 지운다. 한쪽을 지워도 다른 쪽
 * 마스크는 남는지 검증한다 — embossPanelContentDiet.test.tsx의 "지우기" 배선 테스트와 같은 골격에
 * 효과 축만 추가.
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
      {/* pointer 드래그 좌표 계산은 happy-dom에 없어(getBoundingClientRect가 0) 실 브러시 스탬프를
          못 찍는다 — embossPanelContentDiet.test.tsx와 동일 우회: 훅 함수를 직접 부르는 버튼. */}
      <button data-testid="select-highlight" onClick={() => photo.setEmbossEffect('highlight')}>select-highlight</button>
      <button data-testid="select-relief" onClick={() => photo.setEmbossEffect('relief')}>select-relief</button>
      <button data-testid="seed-stamp" onClick={() => photo.addEmbossStamp({ x: 0.5, y: 0.5, r: 0.1 })}>seed-stamp</button>
      <div data-testid="highlight-count">{photo.state.embossStamps.length}</div>
      <div data-testid="relief-count">{photo.state.reliefStamps.length}</div>
      <DesignRail photo={photo} />
    </>
  );
}

async function seedBothMasks(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('select-highlight'));
  await user.click(screen.getByTestId('seed-stamp'));
  await user.click(screen.getByTestId('select-relief'));
  await user.click(screen.getByTestId('seed-stamp'));
  expect(screen.getByTestId('highlight-count').textContent).toBe('1');
  expect(screen.getByTestId('relief-count').textContent).toBe('1');
}

async function openEmbossPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '하이라이트' }));
}

/** 도구 칩을 두 번 탭해 진입→종료 — 편집을 끝내야 강도·지우기가 뜬다(#682). */
async function toggleBrushEditOnOff(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('radio', { name: '브러시' }));
  await user.click(screen.getByRole('radio', { name: '브러시' }));
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('하이라이트·형압 마스크 분리 지우기 (#735)', () => {
  test('하이라이트만 지워도 형압 마스크는 남는다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await seedBothMasks(user);

    await openEmbossPanel(user);
    // seedBothMasks 마지막이 select-relief라 패널이 지금 형압을 가리킨다 — 하이라이트로 되돌린다.
    await user.click(screen.getByRole('radio', { name: '하이라이트' }));
    await toggleBrushEditOnOff(user);
    await user.click(screen.getByText('지우기'));

    expect(screen.getByTestId('highlight-count').textContent).toBe('0');
    expect(screen.getByTestId('relief-count').textContent).toBe('1');
  });

  test('형압만 지워도 하이라이트 마스크는 남는다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await seedBothMasks(user);

    await openEmbossPanel(user);
    // seedBothMasks 마지막이 select-relief라 패널이 이미 형압을 가리킨다 — 추가 선택 불필요.
    await toggleBrushEditOnOff(user);
    await user.click(screen.getByText('지우기'));

    expect(screen.getByTestId('relief-count').textContent).toBe('0');
    expect(screen.getByTestId('highlight-count').textContent).toBe('1');
  });
});
