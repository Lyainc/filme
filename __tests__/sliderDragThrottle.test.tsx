/**
 * #507 — BrightnessSlider 드래그 커밋 저빈도화 회귀.
 *
 * 재질/코팅 강도·포스터/컴포넌트 투명도·체인/포맷 로고 크기 슬라이더는 전부 BrightnessSlider를
 * 재사용한다(DesignRail.tsx, DesktopDesignPanel.tsx, FieldEditorBody.tsx). 기존 구현은 네이티브
 * <input type="range">의 onChange 틱마다 부모의 onChange(=usePhototicket.updateComponents)를
 * 직접 호출해, 드래그 한 번에 수십 번씩 TicketRenderer(960×1534 자연픽셀 DOM)를 통째로 리렌더·
 * 리스케일시켰다. 이 테스트는 (1) 한 프레임(=한 act 배치) 안에 여러 틱이 몰리면 다운스트림 커밋이
 * 최종값 1회로 합쳐지는지, (2) 마운트만으로는 커밋이 발생하지 않는지(브랜치 touched-ref 오탐 방지)
 * 검증한다.
 */
import { describe, expect, mock, test, afterEach } from 'bun:test';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BrightnessSlider from '../src/components/wizard/BrightnessSlider';
import { DesignRail } from '../src/components/v2/DesignRail';
import { usePhototicket } from '../src/hooks/usePhototicket';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('#507 BrightnessSlider — 드래그 커밋 저빈도화', () => {
  test('마운트만으로는 onChange가 호출되지 않는다(touched-ref 오탐 방지)', () => {
    const onChange = mock(() => {});
    render(<BrightnessSlider value={0.5} onChange={onChange} label="Test" id="mount-test" />);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('한 배치 안의 연속 틱은 다운스트림 커밋 1회 + 최종값으로 합쳐진다', () => {
    const onChange = mock(() => {});
    render(<BrightnessSlider value={0.5} onChange={onChange} label="Test" id="batch-test" />);
    const input = screen.getByLabelText('Test');

    // 실제 드래그는 pointer 이동마다 change를 쏘는데, 같은 프레임에 도착한 여러 틱은 React가
    // 하나의 렌더로 합친다 — 그 경계를 한 act() 블록으로 흉내낸다.
    act(() => {
      fireEvent.change(input, { target: { value: '0.55' } });
      fireEvent.change(input, { target: { value: '0.6' } });
      fireEvent.change(input, { target: { value: '0.7' } });
      fireEvent.change(input, { target: { value: '0.8' } });
      fireEvent.change(input, { target: { value: '0.9' } });
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(0.9);
  });

  test('thumb·% 라벨은 배치 중에도 최종 로컬값을 즉시 반영한다', () => {
    const onChange = mock(() => {});
    render(<BrightnessSlider value={0.5} onChange={onChange} label="Test" id="visual-test" />);
    const input = screen.getByLabelText('Test') as HTMLInputElement;

    act(() => {
      fireEvent.change(input, { target: { value: '0.6' } });
      fireEvent.change(input, { target: { value: '0.77' } });
    });

    expect(input.value).toBe('0.77');
    expect(screen.getByText('77%')).toBeTruthy();
  });
});

function RailRenderCountHarness() {
  const photo = usePhototicket();
  renderCount += 1;
  return (
    <>
      <div data-testid="materialIntensity">{photo.state.components.materialIntensity}</div>
      <DesignRail photo={photo} />
    </>
  );
}

let renderCount = 0;

describe('#507 DesignRail 통합 — 재질 강도 슬라이더 드래그가 다운스트림 리렌더를 몰아 낸다', () => {
  test('탭 열고 연속 드래그해도 커밋 렌더 수는 틱 수보다 훨씬 적다', async () => {
    renderCount = 0;
    const user = userEvent.setup();
    render(<RailRenderCountHarness />);
    await user.click(screen.getByRole('button', { name: '후보정' }));
    // 기본 재질(원본)은 레시피가 없어 강도 슬라이더가 안 뜬다 — 레시피 있는 재질로 전환.
    await user.click(screen.getByRole('radio', { name: /미술용지/ }));

    const input = screen.getByLabelText('재질 강도') as HTMLInputElement;
    const baseline = renderCount;

    act(() => {
      for (let tick = 1; tick <= 20; tick += 1) {
        fireEvent.change(input, { target: { value: String(tick / 20) } });
      }
    });

    expect(screen.getByTestId('materialIntensity').textContent).toBe('1');
    // 20틱이 배치 하나로 합쳐지므로 이 구간의 리렌더는 한 자릿수 — 틱 수(20)보다 훨씬 적다.
    expect(renderCount - baseline).toBeLessThan(20);
  });
});
