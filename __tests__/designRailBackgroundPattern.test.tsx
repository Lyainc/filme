/**
 * 디자인 레일 '배경' 항목(티켓 배경 이미지) 상호작용 테스트(#671 → #672).
 *
 * 레일 피커와 무드 렌더를 **같은 photo 상태**에 물려, 이미지를 올렸을 때 티켓의 배경 레이어에
 * 실제로 반영되는지를 끝까지 본다(designRailQuoteFont.test.tsx와 같은 모양).
 *
 * #530이 넣었던 기하 프리셋 3종은 #672에서 걷어냈고, 그 describe 3개도 같이 지웠다 — 남은 축은
 * 사용자가 올린 이미지 하나뿐이라 id 필드(`backgroundPattern`) 자체가 사라졌다. 여기서 지키는
 * 계약은 다섯이다: 레일 노출 → 업로드 후 레이어 렌더 → componentOpacity 밖 → 무드별 clip-path →
 * 그리고 Stub 전용 둘(절취선·페이퍼 스텁이 배경을 안 덮는다). clip-path를 어기면 저장물에서
 * 배경이 포스터 **위에** 인쇄되고(#490/#495 z-order), Stub 둘을 어기면 배경이 통째로 안 보인다.
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
      {/* 배율(#680) — 슬라이더는 드래그 중 커밋을 useDeferredValue로 미루는 구조라(#507) happy-dom
          에서 값 주입이 렌더 타이밍에 얽힌다. 여기서 보려는 건 "배율이 상태에 실린 뒤 무엇이
          변하는가"라 위 이미지 버튼과 같은 방식으로 상태만 직접 민다. 슬라이더 자체의 커밋 로직은
          shouldCommitSliderValue 단위 테스트가 이미 덮는다. */}
      <button type="button" onClick={() => photo.updateComponents({ backgroundPatternScale: 1.5 })}>
        배경 배율 적용
      </button>
      <div data-testid="background-pattern-image">{photo.state.components.backgroundPatternImage ?? '(미설정)'}</div>
      <div data-testid="background-pattern-scale">{photo.state.components.backgroundPatternScale ?? 1}</div>
      <DesignRail photo={photo} />
      <Mood movieInfo={photo.state.movieInfo} components={photo.state.components} croppedImageUrl="blob:x" />
    </>
  );
}

/**
 * aria-hidden 배경 레이어(바깥 겹) — 이미지가 없으면 아예 안 그려진다.
 * clip·레이어 배치를 쥐는 쪽이라 clipPath·componentOpacity·형제 순서 검사는 전부 이걸 본다.
 */
function backgroundLayer(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-bg-pattern="true"]');
}

/**
 * 배경 이미지를 실제로 칠하는 안쪽 겹(#680). 배율(transform)이 여기 걸린다 — 바깥에 걸면
 * clip-path가 같이 확대돼 포스터 보호가 깨지기 때문이고, 그 분리가 이 두 헬퍼가 갈리는 이유다.
 */
function backgroundImageLayer(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-bg-pattern-image="true"]');
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

      expect(backgroundLayer(container)).not.toBeNull();
      const layer = backgroundImageLayer(container)!;
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

    test('배율은 안쪽 겹에만 걸리고 clip은 확대에 안 딸려간다 (#680)', async () => {
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openBackgroundPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));

      const outer = backgroundLayer(container)!;
      const clipBefore = outer.style.clipPath;

      await user.click(screen.getByRole('button', { name: '배경 배율 적용' }));

      // 배율이 이미지 겹에 실제로 걸린다.
      expect(backgroundImageLayer(container)!.style.transform).toContain('scale(1.5)');

      // **이게 이 테스트의 본체다.** clip-path는 요소의 로컬 좌표계에서 정의된 뒤 요소 전체가
      // transform되므로, 배율을 clip과 같은 요소에 걸면 포스터를 지키는 구멍까지 1.5배로 커져
      // 저장물에서 배경이 포스터 위에 인쇄된다(#490/#495). 겹을 합치는 리팩터링이 이 명제를
      // 조용히 깨는 걸 막는 자리라, 배율 전후 clip이 **같은 값**인지까지 못 박는다.
      const outerAfter = backgroundLayer(container)!;
      expect(outerAfter.style.clipPath).toBe(clipBefore);
      expect(outerAfter.style.transform).toBe('');
    });

    test('배율 슬라이더는 이미지가 있을 때만 뜬다 (#680)', async () => {
      const user = userEvent.setup();
      render(<Harness mood={mood} />);
      await openBackgroundPanel(user, mood);

      // 조절할 대상이 없으면 죽은 컨트롤이라 아예 안 그린다.
      expect(screen.queryByLabelText('배경 크기')).toBeNull();

      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));
      expect(screen.getByLabelText('배경 크기')).not.toBeNull();
    });

    test('무드를 왕복해도 배경 이미지가 보존된다', async () => {
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openBackgroundPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));
      // 배율도 같이 실어 왕복시킨다(#680 ac2) — 이미지만 살아남고 배율이 기본값으로 되돌아가면
      // 사용자가 보기엔 "무드 한 번 훑었더니 배경이 도로 작아졌다"라 이미지 유실과 같은 증상이다.
      await user.click(screen.getByRole('button', { name: '배경 배율 적용' }));

      await user.click(screen.getByRole('button', { name: 'minimal로 전환' }));
      expect(screen.queryByRole('button', { name: '배경' })).toBeNull();
      expect(screen.getByTestId('background-pattern-image').textContent).toBe('blob:bgimg');
      expect(screen.getByTestId('background-pattern-scale').textContent).toBe('1.5');

      await user.click(screen.getByRole('button', { name: `${mood}로 전환` }));
      await user.click(screen.getByRole('button', { name: '배경' }));
      expect(screen.getByRole('button', { name: '이미지 교체' })).not.toBeNull();
      expect(backgroundImageLayer(container)!.style.backgroundImage).toContain('blob:bgimg');
      expect(backgroundImageLayer(container)!.style.transform).toContain('scale(1.5)');
      // 슬라이더도 복원된 값을 들고 다시 뜬다 — 상태만 살고 컨트롤이 1.0을 보이면 다음 조작이
      // 그 1.0을 커밋해 값이 조용히 되돌아간다.
      expect((screen.getByLabelText('배경 크기') as HTMLInputElement).value).toBe('1.5');
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

    test('페이퍼 스텁은 배경을 다시 칠하지 않는다 (stub 전용)', async () => {
      if (mood !== 'stub') return;
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openBackgroundPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));

      // 하단 페이퍼 스텁은 배경 레이어보다 뒤에 오는 **포지셔닝된** 형제라 paint 순서상 위다.
      // 여기에 background를 다시 두면 종이 아래쪽 전체에서 배경이 안 보인다(루트가 이미 PAPER를
      // 칠하므로 색은 어차피 같다). 그리고 상단 640 밴드는 PATTERN_CLIP이 파내고 절취선 띠는
      // PAPER를 다시 칠하므로, 그 아래가 Stub에서 배경이 보이는 **유일한** 자리다 — 여기가
      // 덮이면 배경이 100% 안 보인다. 다른 테스트는 레이어 자기 스타일만 봐서 이걸 못 잡는다.
      const stub = backgroundLayer(container)!.parentElement!.lastElementChild as HTMLElement;
      expect(stub.style.opacity).toBe('1'); // componentOpacity 래퍼를 제대로 집었는지 확인
      expect(stub.style.background).toBe('');
      expect(stub.style.backgroundColor).toBe('');
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
