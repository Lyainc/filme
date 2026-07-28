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
import BrightnessSlider, {
  parsePercentInput,
  shouldCommitSliderValue,
  snapToStep,
  stepFrom,
} from '../src/components/wizard/BrightnessSlider';
import { DesignRail } from '../src/components/v2/DesignRail';
import { usePhototicket } from '../src/hooks/usePhototicket';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// claude-review PR #516 P1(3차) — "deferredValue가 localValue에 수렴했을 때만 커밋" 가드의
// 실제 대상 시나리오(드래그로 localValue≠deferredValue인 과도기에 부모가 value를 외부에서 바꾸는
// 경우)는 happy-dom act()가 React 트랜지션을 동기적으로 다 flush해버려 렌더 타이밍으로는 결정론적
// 재현이 안 된다(리뷰도 인정). 판정 로직을 순수 함수로 뽑아 타이밍과 분리해 직접 검증한다 —
// 가드를 실수로 제거·완화해도 이 스위트가 즉시 실패하도록.
describe('#507 shouldCommitSliderValue — 수렴 가드', () => {
  test('과도기(deferredValue가 아직 localValue를 못 따라잡음)에는 커밋하지 않는다', () => {
    // 드래그로 localValue=0.9가 됐지만 deferredValue는 아직 이전 값(0.5)에 머무른 상태.
    expect(shouldCommitSliderValue(0.5, 0.9, 0.5)).toBe(false);
  });

  test('수렴 완료 + 부모 value와 다르면 커밋한다', () => {
    expect(shouldCommitSliderValue(0.9, 0.9, 0.5)).toBe(true);
  });

  test('수렴 완료했지만 이미 부모 value와 같으면(라운드트립) 커밋하지 않는다', () => {
    expect(shouldCommitSliderValue(0.8, 0.8, 0.8)).toBe(false);
  });
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

    // #562 — 드래그는 10%p 격자에 스냅하므로 0.77은 0.8로 선다.
    expect(input.value).toBe('0.8');
    // %는 이제 읽기 전용 텍스트가 아니라 입력 필드다(#562).
    expect((screen.getByLabelText('Test 퍼센트') as HTMLInputElement).value).toBe('80');
  });

  // claude-review PR #516 P1 — 마운트된 채로 부모가 value를 외부에서 바꾸는 경로(재질/코팅
  // 전환 시 기본 강도 재적용, undo/redo 복원)에서 thumb·%가 구값을 계속 보여주면 안 된다.
  test('마운트된 채로 부모가 value를 외부에서 바꾸면 thumb·%가 그 값을 즉시 반영한다', () => {
    const onChange = mock(() => {});
    const { rerender } = render(
      <BrightnessSlider value={0.5} onChange={onChange} label="Test" id="external-test" />
    );
    rerender(<BrightnessSlider value={0.8} onChange={onChange} label="Test" id="external-test" />);

    const input = screen.getByLabelText('Test') as HTMLInputElement;
    expect(input.value).toBe('0.8');
    expect((screen.getByLabelText('Test 퍼센트') as HTMLInputElement).value).toBe('80');
    // 외부에서 온 value는 이미 커밋된 값이므로 되돌려 부를 필요 없음.
    expect(onChange).not.toHaveBeenCalled();
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

/**
 * #562 — 드래그·화살표 스텝 10% 고정 + 자연수 % 직접 입력.
 *
 * 둘은 같이 가야 한다: 10% 스텝이 세밀 조정 경로를 없애고 % 입력이 그 대체다. 그리고 % 입력은
 * #507의 지연 커밋(useDeferredValue)을 우회하면 안 된다 — 우회하면 매 타건마다 티켓이 리렌더된다.
 */
describe('#562 parsePercentInput — 자연수 % → 값 축', () => {
  test('범위 밖은 클램프한다(로고 크기 0.6..1.3)', () => {
    expect(parsePercentInput('40', 0.6, 1.3)).toBe(0.6);
    expect(parsePercentInput('200', 0.6, 1.3)).toBe(1.3);
    expect(parsePercentInput('90', 0.6, 1.3)).toBe(0.9);
  });

  test('빈 문자열·비숫자는 커밋 대상이 아니다(null)', () => {
    expect(parsePercentInput('', 0, 1)).toBeNull();
    expect(parsePercentInput('abc', 0, 1)).toBeNull();
  });

  test('min·max는 부동소수 오차 없이 딱 떨어진다', () => {
    // 0.6 * 100 === 60.00000000000001 — 반올림 없이 클램프하면 하한이 격자에서 미끄러진다.
    expect(parsePercentInput('60', 0.6, 1.3)).toBe(0.6);
  });
});

describe('#562 BrightnessSlider — 10% 스텝 + % 입력', () => {
  // step 속성은 상호작용 단위가 아니라 값의 제약이라, 0.1로 잠그면 % 입력의 37%가 40%로 잘린다
  // (브라우저 실측). "any"로 열어 두고 스냅을 코드가 맡는 게 두 요구사항이 공존하는 유일한 배치다.
  test('range는 step="any" — 격자 밖 값(37%)을 요소가 잘라내지 않는다', () => {
    render(<BrightnessSlider value={0.37} onChange={mock(() => {})} label="Test" id="step-test" />);
    const range = screen.getByLabelText('Test') as HTMLInputElement;
    expect(range.step).toBe('any');
    expect(range.value).toBe('0.37');
  });

  test('드래그는 10%p 격자에 스냅한다', () => {
    const onChange = mock(() => {});
    render(<BrightnessSlider value={0.5} onChange={onChange} label="Test" id="snap-test" />);
    const range = screen.getByLabelText('Test') as HTMLInputElement;
    act(() => {
      fireEvent.change(range, { target: { value: '0.73' } });
    });
    expect(range.value).toBe('0.7');
  });

  test('화살표 한 틱이 10%p — 격자 밖 값에서도 다음 눈금으로 간다', () => {
    expect(stepFrom(0.37, 1, 0, 1)).toBe(0.4);
    expect(stepFrom(0.37, -1, 0, 1)).toBe(0.3);
    expect(stepFrom(0.4, 1, 0, 1)).toBe(0.5);
    expect(stepFrom(0.4, -1, 0, 1)).toBe(0.3);
    // 범위 끝에서는 클램프 — 로고 크기축(0.6..1.3).
    expect(stepFrom(0.6, -1, 0.6, 1.3)).toBe(0.6);
    expect(stepFrom(1.3, 1, 0.6, 1.3)).toBe(1.3);
    expect(snapToStep(0.73, 0, 1)).toBe(0.7);
    // 격자 밖 하한이 생겨도 그 아래로 안 내려간다.
    expect(snapToStep(0.66, 0.65, 1)).toBe(0.7);
    expect(snapToStep(0.66, 0.7, 1)).toBe(0.7);
  });

  test('키보드 화살표가 range에서 실제로 10%p 움직인다', async () => {
    const user = userEvent.setup();
    const onChange = mock(() => {});
    render(<BrightnessSlider value={0.37} onChange={onChange} label="Test" id="kb-test" />);
    const range = screen.getByLabelText('Test') as HTMLInputElement;
    range.focus();
    await user.keyboard('{ArrowRight}');
    expect(range.value).toBe('0.4');
    await user.keyboard('{ArrowRight}');
    expect(range.value).toBe('0.5');
    // PageUp/Down도 같은 10%p — step="any"의 네이티브 페이지 이동((max-min)/10)에 맡기면
    // 로고 크기축(0.6..1.3)에서 0.07씩 격자 밖으로 나간다.
    await user.keyboard('{PageDown}');
    expect(range.value).toBe('0.4');
  });

  test('% 입력에 자연수를 넣고 Enter를 치면 그 값이 커밋된다', async () => {
    const user = userEvent.setup();
    const onChange = mock(() => {});
    render(<BrightnessSlider value={0.5} onChange={onChange} label="Test" id="pct-test" />);
    const pct = screen.getByLabelText('Test 퍼센트') as HTMLInputElement;

    await user.click(pct);
    await user.keyboard('{Control>}a{/Control}35{Enter}');

    expect(onChange).toHaveBeenCalledWith(0.35);
    expect((screen.getByLabelText('Test') as HTMLInputElement).value).toBe('0.35');
  });

  test('타이핑 중간 상태는 커밋하지 않는다 — blur/Enter에서 한 번만', async () => {
    const user = userEvent.setup();
    const onChange = mock(() => {});
    render(<BrightnessSlider value={0.5} onChange={onChange} label="Test" id="pct-batch" />);
    const pct = screen.getByLabelText('Test 퍼센트') as HTMLInputElement;

    await user.click(pct);
    await user.keyboard('{Control>}a{/Control}80');
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(0.8);
  });
});
