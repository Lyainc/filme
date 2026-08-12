/**
 * #530 PR 1 — 디자인 레일 '패턴' 항목(배경 기하 패턴) 상호작용 테스트.
 *
 * 레일 피커와 Editorial 렌더를 **같은 photo 상태**에 물려, 칩을 눌렀을 때 티켓의 패턴 레이어에
 * 실제로 반영되는지를 끝까지 본다(designRailQuoteFont.test.tsx와 같은 모양). appliesTo 무드
 * 필터·기본값·무드 왕복 값 보존을 검증한다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';
import { MoodEditorial } from '@/components/moods/MoodEditorial';
import { MoodCriterion } from '@/components/moods/MoodCriterion';
import { MoodStub } from '@/components/moods/MoodStub';

const MOOD_COMPONENTS = { editorial: MoodEditorial, criterion: MoodCriterion, stub: MoodStub } as const;
type PatternMood = keyof typeof MOOD_COMPONENTS;

function Harness({ mood = 'editorial' }: { mood?: PatternMood }) {
  const photo = usePhototicket();
  const Mood = MOOD_COMPONENTS[mood];
  return (
    <>
      <button type="button" onClick={() => photo.updateComponents({ layout: mood })}>
        {mood}로 전환
      </button>
      <button type="button" onClick={() => photo.updateComponents({ layout: 'minimal' })}>
        minimal로 전환
      </button>
      {/* #671 — BackgroundPatternPanel이 크롭 완료(useLogoCrop onChange)에서 하는 것과 **똑같은**
          updateComponents 호출. 여기서 실제 크롭(canvas)까지 태우려면 `@/utils/imageCrop`을
          mock.module해야 하는데, 그건 프로세스 전역이라 다른 파일로 샌다(#611) — 그 실물 경로는
          이미 logoCropFreeAspect.test.tsx가 자기 harness 안에서 검증하므로, 여기서는 크롭이 뱉은
          URL이 상태에 실린 뒤를 본다. */}
      <button
        type="button"
        onClick={() => photo.updateComponents({ backgroundPattern: 'custom', backgroundPatternImage: 'blob:bgimg' })}
      >
        배경 이미지 적용
      </button>
      <div data-testid="background-pattern-image">{photo.state.components.backgroundPatternImage ?? '(미설정)'}</div>
      <div data-testid="background-pattern">{photo.state.components.backgroundPattern ?? '(미설정)'}</div>
      <DesignRail photo={photo} />
      <Mood
        movieInfo={photo.state.movieInfo}
        components={photo.state.components}
        croppedImageUrl="blob:x"
      />
    </>
  );
}

/** aria-hidden 패턴 레이어 — 'none'이면 아예 안 그려진다. */
function patternLayer(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-bg-pattern="true"]');
}

async function openPatternPanel(user: ReturnType<typeof userEvent.setup>, mood: PatternMood = 'editorial') {
  await user.click(screen.getByRole('button', { name: `${mood}로 전환` }));
  await user.click(screen.getByRole('button', { name: '패턴' }));
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('레일 패턴 — 배경 기하 패턴 3택 (#530)', () => {
  test('패턴 항목은 editorial에서 레일에 뜨고, minimal에서는 안 뜬다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 초기 무드는 minimal — appliesTo(['editorial','criterion','stub'])에서 탈락.
    expect(screen.queryByRole('button', { name: '패턴' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'editorial로 전환' }));
    expect(screen.getByRole('button', { name: '패턴' })).not.toBeNull();
  });

  test('기본값은 none이고 패턴 레이어가 렌더되지 않는다', () => {
    const { container } = render(<Harness />);
    expect(screen.getByTestId('background-pattern').textContent).toBe('none');
    expect(patternLayer(container)).toBeNull();
  });

  test('3택 각각이 상태에 반영되고 패턴 레이어가 렌더된다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await openPatternPanel(user);

    await user.click(screen.getByRole('radio', { name: '도트' }));
    expect(screen.getByTestId('background-pattern').textContent).toBe('dots');
    expect(patternLayer(container)!.style.backgroundImage).toContain('radial-gradient');

    await user.click(screen.getByRole('radio', { name: '사선' }));
    expect(screen.getByTestId('background-pattern').textContent).toBe('diagonal');
    expect(patternLayer(container)!.style.backgroundImage).toContain('repeating-linear-gradient');

    await user.click(screen.getByRole('radio', { name: '그리드' }));
    expect(screen.getByTestId('background-pattern').textContent).toBe('grid');
    // 그리드는 두 겹(가로+세로) repeating-linear-gradient.
    expect(patternLayer(container)!.style.backgroundImage.split('repeating-linear-gradient').length - 1).toBe(2);

    // 되돌리면 레이어 자체가 사라진다.
    await user.click(screen.getByRole('radio', { name: '없음' }));
    expect(screen.getByTestId('background-pattern').textContent).toBe('none');
    expect(patternLayer(container)).toBeNull();
  });

  test('무드를 왕복해도 고른 패턴이 보존된다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await openPatternPanel(user);

    await user.click(screen.getByRole('radio', { name: '사선' }));
    // 다른 무드로 나가면 패턴 항목 자체가 사라진다(#523 자동 닫힘).
    await user.click(screen.getByRole('button', { name: 'minimal로 전환' }));
    expect(screen.queryByRole('button', { name: '패턴' })).toBeNull();
    expect(screen.getByTestId('background-pattern').textContent).toBe('diagonal');

    await user.click(screen.getByRole('button', { name: 'editorial로 전환' }));
    await user.click(screen.getByRole('button', { name: '패턴' }));
    expect((screen.getByRole('radio', { name: '사선' }) as HTMLButtonElement).getAttribute('aria-checked')).toBe('true');
    expect(patternLayer(container)!.style.backgroundImage).toContain('repeating-linear-gradient');
  });
});

describe('레일 패턴 — Criterion (#530 PR 2)', () => {
  test('패턴 항목이 criterion에서도 레일에 뜬다', async () => {
    const user = userEvent.setup();
    render(<Harness mood="criterion" />);

    expect(screen.queryByRole('button', { name: '패턴' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'criterion로 전환' }));
    expect(screen.getByRole('button', { name: '패턴' })).not.toBeNull();
  });

  test('기본값은 none이고 패턴 레이어가 렌더되지 않는다', () => {
    const { container } = render(<Harness mood="criterion" />);
    expect(screen.getByTestId('background-pattern').textContent).toBe('none');
    expect(patternLayer(container)).toBeNull();
  });

  test('3택 각각이 Criterion 렌더에 반영된다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness mood="criterion" />);
    await openPatternPanel(user, 'criterion');

    await user.click(screen.getByRole('radio', { name: '도트' }));
    expect(screen.getByTestId('background-pattern').textContent).toBe('dots');
    expect(patternLayer(container)!.style.backgroundImage).toContain('radial-gradient');

    await user.click(screen.getByRole('radio', { name: '사선' }));
    expect(patternLayer(container)!.style.backgroundImage).toContain('repeating-linear-gradient');

    await user.click(screen.getByRole('radio', { name: '그리드' }));
    expect(patternLayer(container)!.style.backgroundImage.split('repeating-linear-gradient').length - 1).toBe(2);

    // 색은 Criterion INK(#14120f = rgb(20,18,15)) 하드코딩 — themeColor 파생이 아니다.
    expect(patternLayer(container)!.style.backgroundImage).toContain('rgba(20, 18, 15');

    await user.click(screen.getByRole('radio', { name: '없음' }));
    expect(patternLayer(container)).toBeNull();
  });

  test('패턴 레이어는 도판 사각형을 구멍으로 판다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness mood="criterion" />);
    await openPatternPanel(user, 'criterion');
    await user.click(screen.getByRole('radio', { name: '그리드' }));

    // 이 클립이 없으면 저장물에서 패턴이 포스터 **위에** 인쇄된다 — captureToImage가 포스터를
    // 먼저 깔고 base PNG를 위에 얹는데, 도판의 불투명 배경은 base에서 빠져 있기 때문(#490/#495).
    // 도판 사각형(230,262 ~ 730,1012)이 evenodd 두 번째 서브패스로 뚫려 있어야 한다.
    const clip = patternLayer(container)!.style.clipPath;
    expect(clip).toContain('evenodd');
    expect(clip).toContain('M230 262H730V1012H230Z');
  });

  test('패턴 레이어는 componentOpacity 래퍼 밖에 선다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness mood="criterion" />);
    await openPatternPanel(user, 'criterion');
    await user.click(screen.getByRole('radio', { name: '도트' }));

    // 조판 래퍼(inline opacity)의 자손이면 componentOpacity가 패턴까지 페이드시킨다.
    expect(patternLayer(container)!.closest('[style*="opacity"]')).toBeNull();
  });

  test('무드를 왕복해도 고른 패턴이 보존된다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness mood="criterion" />);
    await openPatternPanel(user, 'criterion');

    await user.click(screen.getByRole('radio', { name: '사선' }));
    await user.click(screen.getByRole('button', { name: 'minimal로 전환' }));
    expect(screen.queryByRole('button', { name: '패턴' })).toBeNull();
    expect(screen.getByTestId('background-pattern').textContent).toBe('diagonal');

    await user.click(screen.getByRole('button', { name: 'criterion로 전환' }));
    await user.click(screen.getByRole('button', { name: '패턴' }));
    expect((screen.getByRole('radio', { name: '사선' }) as HTMLButtonElement).getAttribute('aria-checked')).toBe('true');
    expect(patternLayer(container)!.style.backgroundImage).toContain('repeating-linear-gradient');
  });
});

describe('레일 패턴 — Stub (#530 PR 3)', () => {
  test('패턴 항목이 stub에서도 레일에 뜬다', async () => {
    const user = userEvent.setup();
    render(<Harness mood="stub" />);

    expect(screen.queryByRole('button', { name: '패턴' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'stub로 전환' }));
    expect(screen.getByRole('button', { name: '패턴' })).not.toBeNull();
  });

  test('기본값은 none이고 패턴 레이어가 렌더되지 않는다', () => {
    const { container } = render(<Harness mood="stub" />);
    expect(screen.getByTestId('background-pattern').textContent).toBe('none');
    expect(patternLayer(container)).toBeNull();
  });

  test('3택 각각이 Stub 렌더에 반영된다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness mood="stub" />);
    await openPatternPanel(user, 'stub');

    await user.click(screen.getByRole('radio', { name: '도트' }));
    expect(screen.getByTestId('background-pattern').textContent).toBe('dots');
    expect(patternLayer(container)!.style.backgroundImage).toContain('radial-gradient');

    await user.click(screen.getByRole('radio', { name: '사선' }));
    expect(patternLayer(container)!.style.backgroundImage).toContain('repeating-linear-gradient');

    await user.click(screen.getByRole('radio', { name: '그리드' }));
    expect(patternLayer(container)!.style.backgroundImage.split('repeating-linear-gradient').length - 1).toBe(2);

    // 색은 Stub INK(#1a1612 = rgb(26,22,18)) 하드코딩 — themeColor 파생이 아니다.
    expect(patternLayer(container)!.style.backgroundImage).toContain('rgba(26, 22, 18');

    await user.click(screen.getByRole('radio', { name: '없음' }));
    expect(patternLayer(container)).toBeNull();
  });

  test('패턴 레이어는 포스터 밴드 사각형을 구멍으로 판다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness mood="stub" />);
    await openPatternPanel(user, 'stub');
    await user.click(screen.getByRole('radio', { name: '그리드' }));

    // 이 클립이 없으면 저장물에서 패턴이 포스터 **위에** 인쇄된다 — captureToImage가 포스터를
    // 먼저 깔고 base PNG를 위에 얹는데, 포스터 조상의 불투명 배경은 base에서 빠져 있기 때문
    // (#490/#495). 밴드 사각형(960×640, #527)이 evenodd 두 번째 서브패스로 뚫려 있어야 한다.
    const clip = patternLayer(container)!.style.clipPath;
    expect(clip).toContain('evenodd');
    expect(clip).toContain('M0 0H960V640H0Z');
  });

  test('패턴 레이어는 componentOpacity 래퍼 밖에 선다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness mood="stub" />);
    await openPatternPanel(user, 'stub');
    await user.click(screen.getByRole('radio', { name: '도트' }));

    // 조판 래퍼(inline opacity)의 자손이면 componentOpacity가 패턴까지 페이드시킨다.
    expect(patternLayer(container)!.closest('[style*="opacity"]')).toBeNull();
  });

  test('페이퍼 스텁은 배경을 다시 칠하지 않는다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness mood="stub" />);
    await openPatternPanel(user, 'stub');
    await user.click(screen.getByRole('radio', { name: '도트' }));

    // 하단 페이퍼 스텁은 패턴 레이어보다 뒤에 오는 **포지셔닝된** 형제라 paint 순서상 위다.
    // 여기에 background를 다시 두면 종이 아래쪽 전체에서 패턴이 안 보인다(루트가 이미 PAPER를
    // 칠하므로 색은 어차피 같다). 위 세 테스트는 레이어 자기 스타일만 봐서 이 회귀를 못 잡는다.
    const stub = patternLayer(container)!.parentElement!.lastElementChild as HTMLElement;
    expect(stub.style.opacity).toBe('1'); // componentOpacity 래퍼를 제대로 집었는지 확인
    expect(stub.style.background).toBe('');
    expect(stub.style.backgroundColor).toBe('');
  });

  test('무드를 왕복해도 고른 패턴이 보존된다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness mood="stub" />);
    await openPatternPanel(user, 'stub');

    await user.click(screen.getByRole('radio', { name: '사선' }));
    await user.click(screen.getByRole('button', { name: 'minimal로 전환' }));
    expect(screen.queryByRole('button', { name: '패턴' })).toBeNull();
    expect(screen.getByTestId('background-pattern').textContent).toBe('diagonal');

    await user.click(screen.getByRole('button', { name: 'stub로 전환' }));
    await user.click(screen.getByRole('button', { name: '패턴' }));
    expect((screen.getByRole('radio', { name: '사선' }) as HTMLButtonElement).getAttribute('aria-checked')).toBe('true');
    expect(patternLayer(container)!.style.backgroundImage).toContain('repeating-linear-gradient');
  });
});

/**
 * #671 — 배경 패턴에 사용자 이미지 축 추가. 세 무드 전부에 같은 계약을 건다:
 * 레일 노출 → 업로드 후 레이어 렌더 → componentOpacity 밖 → 무드별 clip-path 유지 → 무드 왕복 보존.
 *
 * 핵심은 커스텀 이미지가 **프리셋과 같은 레이어**에 실린다는 것이다. 다른 레이어로 새로 그리면
 * 저장물에서 포스터 위에 인쇄된다(#490/#495 z-order) — 그래서 클립 검증을 프리셋과 똑같이 건다.
 */
const CUSTOM_CASES = [
  // clip: 이 무드의 패턴 레이어가 들고 있어야 하는 구멍(없으면 '' — Editorial은 패턴 열과 포스터
  // 열이 안 겹쳐 클립이 필요 없다).
  { mood: 'editorial' as const, clip: '' },
  { mood: 'criterion' as const, clip: 'M230 262H730V1012H230Z' },
  { mood: 'stub' as const, clip: 'M0 0H960V640H0Z' },
];

for (const { mood, clip } of CUSTOM_CASES) {
  describe(`레일 패턴 — 커스텀 이미지 · ${mood} (#671)`, () => {
    test("'내 이미지' 칩이 레일 패턴 패널에 뜬다", async () => {
      const user = userEvent.setup();
      render(<Harness mood={mood} />);
      await openPatternPanel(user, mood);

      expect(screen.getByRole('radio', { name: '내 이미지' })).not.toBeNull();
    });

    test('이미지를 올리기 전에는 레이어를 안 그리고 업로드 컨트롤만 뜬다', async () => {
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openPatternPanel(user, mood);

      // 다른 프리셋에선 업로드 컨트롤이 없다(죽은 컨트롤 금지).
      expect(screen.queryByRole('button', { name: '이미지 업로드' })).toBeNull();

      await user.click(screen.getByRole('radio', { name: '내 이미지' }));
      expect(screen.getByTestId('background-pattern').textContent).toBe('custom');
      // id는 'custom'인데 그릴 이미지가 없다 — 예전의 `!== 'none'` 판정이면 여기서 빈 div가 남는다.
      expect(patternLayer(container)).toBeNull();
      expect(screen.getByRole('button', { name: '이미지 업로드' })).not.toBeNull();
    });

    test('업로드한 이미지가 패턴 레이어에 그대로 실린다', async () => {
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openPatternPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));

      const layer = patternLayer(container)!;
      expect(layer).not.toBeNull();
      expect(layer.style.backgroundImage).toContain('blob:bgimg');
      // 임의의 사진이라 타일링하지 않는다 — 이음매가 그대로 보인다.
      expect(layer.style.backgroundSize).toBe('cover');
      expect(layer.style.backgroundRepeat).toBe('no-repeat');
      // 프리셋 잉크 그라디언트는 같이 실리지 않는다(이미지 하나로 대체).
      expect(layer.style.backgroundImage).not.toContain('gradient');
    });

    test('커스텀 레이어도 componentOpacity 래퍼 밖에 선다', async () => {
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openPatternPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));

      // 조판 래퍼(inline opacity)의 자손이면 componentOpacity가 배경까지 페이드시킨다 —
      // 패턴은 "종이에 이미 인쇄된 바탕"이라 그 밖이어야 한다(#530 계약).
      expect(patternLayer(container)!.closest('[style*="opacity"]')).toBeNull();
    });

    test(`커스텀 레이어도 프리셋과 같은 clip-path를 유지한다${clip ? '' : ' (이 무드는 클립 없음)'}`, async () => {
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openPatternPanel(user, mood);

      // 프리셋(그리드)에서 먼저 읽고, 커스텀으로 바꿔도 같은 값인지 본다 — 커스텀이 별도 레이어로
      // 새로 그려지면 여기서 갈린다(그리고 저장물에서 포스터 위에 인쇄된다).
      await user.click(screen.getByRole('radio', { name: '그리드' }));
      const presetClip = patternLayer(container)!.style.clipPath;

      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));
      const customClip = patternLayer(container)!.style.clipPath;

      expect(customClip).toBe(presetClip);
      if (clip) {
        expect(customClip).toContain('evenodd');
        expect(customClip).toContain(clip);
      } else {
        expect(customClip).toBe('');
      }
    });

    test('무드를 왕복해도 커스텀 이미지가 보존된다', async () => {
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openPatternPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));

      await user.click(screen.getByRole('button', { name: 'minimal로 전환' }));
      expect(screen.queryByRole('button', { name: '패턴' })).toBeNull();
      expect(screen.getByTestId('background-pattern').textContent).toBe('custom');
      expect(screen.getByTestId('background-pattern-image').textContent).toBe('blob:bgimg');

      await user.click(screen.getByRole('button', { name: `${mood}로 전환` }));
      await user.click(screen.getByRole('button', { name: '패턴' }));
      expect((screen.getByRole('radio', { name: '내 이미지' }) as HTMLButtonElement).getAttribute('aria-checked')).toBe(
        'true',
      );
      expect(patternLayer(container)!.style.backgroundImage).toContain('blob:bgimg');
    });

    test('절취선은 위치지정 형제라 불투명 배경에 안 덮인다 (stub 전용)', async () => {
      if (mood !== 'stub') return;
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openPatternPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));

      // 절취선이 static이면 absolute인 패턴 레이어 **아래**로 가서, 불투명한 커스텀 이미지가 점선을
      // 통째로 덮는다(프리셋 3종은 6~12% 잉크라 이 축이 안 보였다). 덮고 덮이는 걸 정하는 건 트리
      // 순서가 아니라 position이다.
      const perforation = container.querySelector('div[style*="dashed"], div:has(> span[style*="dashed"])');
      const dashed = Array.from(container.querySelectorAll('span')).find((el) =>
        (el as HTMLElement).style.borderTop.includes('dashed'),
      );
      expect(dashed).not.toBeUndefined();
      expect((dashed!.parentElement as HTMLElement).style.position).toBe('relative');
      expect(perforation).not.toBeNull();
    });

    test('이미지를 제거하면 레이어가 사라지고 다시 업로드를 유도한다', async () => {
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openPatternPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));
      expect(patternLayer(container)).not.toBeNull();

      await user.click(screen.getByRole('button', { name: '이미지 제거' }));
      // id는 'custom'으로 남고 레이어만 사라진다 — 로고 dashed placeholder와 같은 재업로드 유도.
      expect(screen.getByTestId('background-pattern').textContent).toBe('custom');
      expect(patternLayer(container)).toBeNull();
      expect(screen.getByRole('button', { name: '이미지 업로드' })).not.toBeNull();
    });
  });
}
