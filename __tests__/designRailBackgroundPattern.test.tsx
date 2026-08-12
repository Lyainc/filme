/**
 * 디자인 레일 '배경' 항목(티켓 배경 이미지) 상호작용 테스트(#671 → #672).
 *
 * 레일 피커와 무드 렌더를 **같은 photo 상태**에 물려, 이미지를 올렸을 때 티켓의 배경 레이어에
 * 실제로 반영되는지를 끝까지 본다(designRailQuoteFont.test.tsx와 같은 모양).
 *
 * #530이 넣었던 기하 프리셋 3종은 #672에서 걷어냈고, 그 describe 3개도 같이 지웠다 — 남은 축은
 * 사용자가 올린 이미지 하나뿐이라 id 필드(`backgroundPattern`) 자체가 사라졌다. 여기서 지키는
 * 계약은 넷이다: 레일 노출 → 업로드 후 레이어 렌더 → componentOpacity 밖 → 무드별 clip-path.
 * 뒤 둘이 핵심으로, 어기면 저장물에서 배경이 포스터 **위에** 인쇄된다(#490/#495 z-order).
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
type BackgroundMood = keyof typeof MOOD_COMPONENTS;

function Harness({ mood = 'editorial' }: { mood?: BackgroundMood }) {
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
      {/* BackgroundPatternPanel이 크롭 완료(useLogoCrop onChange)에서 하는 것과 **똑같은**
          updateComponents 호출. 여기서 실제 크롭(canvas)까지 태우려면 `@/utils/imageCrop`을
          mock.module해야 하는데, 그건 프로세스 전역이라 다른 파일로 샌다(#611) — 그 실물 경로는
          이미 logoCropFreeAspect.test.tsx가 자기 harness 안에서 검증하므로, 여기서는 크롭이 뱉은
          URL이 상태에 실린 뒤를 본다. */}
      <button type="button" onClick={() => photo.updateComponents({ backgroundPatternImage: 'blob:bgimg' })}>
        배경 이미지 적용
      </button>
      <div data-testid="background-pattern-image">{photo.state.components.backgroundPatternImage ?? '(미설정)'}</div>
      <DesignRail photo={photo} />
      <Mood movieInfo={photo.state.movieInfo} components={photo.state.components} croppedImageUrl="blob:x" />
    </>
  );
}

/** aria-hidden 배경 레이어 — 이미지가 없으면 아예 안 그려진다. */
function backgroundLayer(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-bg-pattern="true"]');
}

async function openBackgroundPanel(user: ReturnType<typeof userEvent.setup>, mood: BackgroundMood = 'editorial') {
  await user.click(screen.getByRole('button', { name: `${mood}로 전환` }));
  await user.click(screen.getByRole('button', { name: '배경' }));
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('레일 배경 — 항목 노출 (#672)', () => {
  test('배경을 실을 수 있는 세 무드에만 레일 항목이 뜬다', async () => {
    const user = userEvent.setup();
    render(<Harness mood="editorial" />);

    await user.click(screen.getByRole('button', { name: 'editorial로 전환' }));
    expect(screen.queryByRole('button', { name: '배경' })).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'minimal로 전환' }));
    expect(screen.queryByRole('button', { name: '배경' })).toBeNull();
  });

  test('패널에 프리셋 칩이 없고 업로드 컨트롤만 뜬다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await openBackgroundPanel(user);

    // #672 — 프리셋 3종(도트·사선·그리드)과 '없음'/'내 이미지' 2택이 통째로 사라졌다.
    for (const label of ['없음', '도트', '사선', '그리드', '내 이미지']) {
      expect(screen.queryByRole('radio', { name: label })).toBeNull();
    }
    expect(screen.getByRole('button', { name: '이미지 업로드' })).not.toBeNull();
    // 아직 이미지가 없으니 레이어도 없다 — 빈 div를 안 남긴다.
    expect(backgroundLayer(container)).toBeNull();
  });
});

/**
 * 세 무드 전부에 같은 계약을 건다. clip은 이 무드의 배경 레이어가 들고 있어야 하는 구멍이다
 * (없으면 '' — Editorial은 배경 열과 포스터 열이 안 겹쳐 클립이 필요 없다).
 */
const MOOD_CASES = [
  { mood: 'editorial' as const, clip: '' },
  { mood: 'criterion' as const, clip: 'M230 262H730V1012H230Z' },
  { mood: 'stub' as const, clip: 'M0 0H960V640H0Z' },
];

for (const { mood, clip } of MOOD_CASES) {
  describe(`레일 배경 — ${mood} (#671 → #672)`, () => {
    test('업로드한 이미지가 배경 레이어에 그대로 실린다', async () => {
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openBackgroundPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));

      const layer = backgroundLayer(container)!;
      expect(layer).not.toBeNull();
      expect(layer.style.backgroundImage).toContain('blob:bgimg');
      // 임의의 사진이라 타일링하지 않는다 — 이음매가 그대로 보인다.
      expect(layer.style.backgroundSize).toBe('cover');
      expect(layer.style.backgroundRepeat).toBe('no-repeat');
      // 프리셋 잉크 그라디언트는 같이 실리지 않는다(#672로 아예 사라졌다).
      expect(layer.style.backgroundImage).not.toContain('gradient');
    });

    test('배경 레이어는 componentOpacity 래퍼 밖에 선다', async () => {
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openBackgroundPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));

      // 조판 래퍼(inline opacity)의 자손이면 componentOpacity가 배경까지 페이드시킨다 —
      // 배경은 "종이에 이미 인쇄된 바탕"이라 그 밖이어야 한다(#530 계약).
      expect(backgroundLayer(container)!.closest('[style*="opacity"]')).toBeNull();
    });

    test(`포스터를 지키는 clip-path를 유지한다${clip ? '' : ' (이 무드는 클립 없음)'}`, async () => {
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openBackgroundPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));

      // PATTERN_CLIP이 빠지면 저장물에서 배경이 포스터 위에 인쇄된다(#490/#495) — 프리셋을
      // 걷어내는 과정에서 조용히 사라지기 쉬운 자리라 값까지 못 박는다.
      const layerClip = backgroundLayer(container)!.style.clipPath;
      if (clip) {
        expect(layerClip).toContain('evenodd');
        expect(layerClip).toContain(clip);
      } else {
        expect(layerClip).toBe('');
      }
    });

    test('무드를 왕복해도 배경 이미지가 보존된다', async () => {
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openBackgroundPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));

      await user.click(screen.getByRole('button', { name: 'minimal로 전환' }));
      expect(screen.queryByRole('button', { name: '배경' })).toBeNull();
      expect(screen.getByTestId('background-pattern-image').textContent).toBe('blob:bgimg');

      await user.click(screen.getByRole('button', { name: `${mood}로 전환` }));
      await user.click(screen.getByRole('button', { name: '배경' }));
      expect(screen.getByRole('button', { name: '이미지 교체' })).not.toBeNull();
      expect(backgroundLayer(container)!.style.backgroundImage).toContain('blob:bgimg');
    });

    test('절취선은 위치지정 형제라 불투명 배경에 안 덮인다 (stub 전용)', async () => {
      if (mood !== 'stub') return;
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openBackgroundPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));

      // 절취선이 static이면 absolute인 배경 레이어 **아래**로 가서, 불투명한 이미지가 점선을
      // 통째로 덮는다(프리셋 3종은 6~12% 잉크라 안 보였던 축이다). 덮고 덮이는 걸 정하는 건
      // 트리 순서가 아니라 position이다.
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
      await openBackgroundPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));
      expect(backgroundLayer(container)).not.toBeNull();

      await user.click(screen.getByRole('button', { name: '이미지 제거' }));
      expect(backgroundLayer(container)).toBeNull();
      expect(screen.getByRole('button', { name: '이미지 업로드' })).not.toBeNull();
    });
  });
}
