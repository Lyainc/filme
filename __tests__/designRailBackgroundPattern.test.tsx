/**
 * 티켓 스탬프(구 배경) 상호작용 테스트(#671 → #672 → #728).
 *
 * 레일 피커와 무드 렌더를 **같은 photo 상태**에 물려, 이미지를 올렸을 때 티켓의 스탬프 레이어에
 * 실제로 반영되는지를 끝까지 본다(designRailQuoteFont.test.tsx와 같은 모양).
 *
 * #728이 전면 cover 배경을 무드별 **고정 박스**로 재설계하면서 계약이 갈렸다: 레일 노출 →
 * 업로드 후 레이어 렌더 → componentOpacity 밖 → 무드별 고정 박스 좌표(구 clip-path) → 배율은
 * 박스 위치에 안 딸려간다 → 크기·투명도 컨트롤 노출 → 새 업로드는 반투명 write-time 커밋 →
 * 무드 왕복 시 크기·투명도 보존 → Stub 전용 둘(절취선·페이퍼 스텁이 배경을 안 덮는다).
 * 고정 박스가 무드 조판과 안 겹치는 걸 어기면 캔버스 전면 시절처럼 조판을 가리고,
 * Stub 둘을 어기면 스탬프가 통째로 안 보인다.
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
      {/* write-time 커밋(#728 c4) — BackgroundPatternPanel의 useLogoCrop onChange 래퍼와 같은
          모양(`backgroundPatternOpacity: 기존값 ?? 기본값 0.5`). 0.5는 designRailItems.tsx의
          BACKGROUND_OPACITY_DEFAULT와 값이 같아야 하는 테스트 전용 상수라 그쪽이 바뀌면 여기도
          같이 봐야 한다. */}
      <button
        type="button"
        onClick={() =>
          photo.updateComponents({
            backgroundPatternImage: 'blob:firstupload',
            backgroundPatternOpacity: photo.state.components.backgroundPatternOpacity ?? 0.5,
          })
        }
      >
        스탬프 첫 업로드 커밋
      </button>
      {/* 배율(#680) — 슬라이더는 드래그 중 커밋을 useDeferredValue로 미루는 구조라(#507) happy-dom
          에서 값 주입이 렌더 타이밍에 얽힌다. 여기서 보려는 건 "배율이 상태에 실린 뒤 무엇이
          변하는가"라 위 이미지 버튼과 같은 방식으로 상태만 직접 민다. 슬라이더 자체의 커밋 로직은
          shouldCommitSliderValue 단위 테스트가 이미 덮는다. */}
      <button type="button" onClick={() => photo.updateComponents({ backgroundPatternScale: 1.5 })}>
        배경 배율 적용
      </button>
      <button type="button" onClick={() => photo.updateComponents({ backgroundPatternOpacity: 0.6 })}>
        배경 투명도 적용
      </button>
      <div data-testid="background-pattern-image">{photo.state.components.backgroundPatternImage ?? '(미설정)'}</div>
      <div data-testid="background-pattern-scale">{photo.state.components.backgroundPatternScale ?? 1}</div>
      <div data-testid="background-pattern-opacity">{photo.state.components.backgroundPatternOpacity ?? 1}</div>
      <DesignRail photo={photo} />
      <Mood movieInfo={photo.state.movieInfo} components={photo.state.components} croppedImageUrl="blob:x" />
    </>
  );
}

/**
 * aria-hidden 스탬프 레이어(바깥 겹) — 이미지가 없으면 아예 안 그려진다.
 * 고정 박스 좌표·투명도·형제 순서 검사는 전부 이걸 본다.
 */
function backgroundLayer(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-bg-pattern="true"]');
}

/**
 * 스탬프 이미지를 실제로 칠하는 안쪽 겹(#680). 배율(transform)이 여기 걸린다 — 바깥에 걸면
 * 고정 박스 위치까지 같이 확대돼(#728 이전엔 clip-path까지) 포스터·조판 보호가 깨지기 때문이고,
 * 그 분리가 이 두 헬퍼가 갈리는 이유다.
 */
function backgroundImageLayer(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-bg-pattern-image="true"]');
}

async function openBackgroundPanel(user: ReturnType<typeof userEvent.setup>, mood: BackgroundMood = 'editorial') {
  await user.click(screen.getByRole('button', { name: `${mood}로 전환` }));
  await user.click(screen.getByRole('button', { name: '스탬프' }));
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('레일 스탬프 — 항목 노출 (#672→#728)', () => {
  test('스탬프를 실을 수 있는 세 무드에만 레일 항목이 뜬다', async () => {
    const user = userEvent.setup();
    render(<Harness mood="editorial" />);

    await user.click(screen.getByRole('button', { name: 'editorial로 전환' }));
    expect(screen.queryByRole('button', { name: '스탬프' })).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'minimal로 전환' }));
    expect(screen.queryByRole('button', { name: '스탬프' })).toBeNull();
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
 * 세 무드 전부에 같은 계약을 건다. box는 이 무드의 스탬프가 서는 고정 박스(캔버스 절대좌표,
 * BackgroundPatternLayer box prop과 같은 값) — MoodCriterion/MoodEditorial/MoodStub 소스의
 * BackgroundPatternLayer 호출부와 반드시 같이 움직인다.
 */
const MOOD_CASES = [
  // editorial의 box는 캔버스 절대좌표가 아니라 Main 컬럼(캔버스 x682에서 시작) 기준 로컬 좌표다
  // (MoodEditorial.tsx 주석 참고) — 오른쪽 패딩 거터(로컬 x587..639)에 세운다.
  { mood: 'editorial' as const, box: { left: 587, top: 44, width: 52, height: 880 } },
  { mood: 'criterion' as const, box: { left: 84, top: 262, width: 130, height: 750 } },
  { mood: 'stub' as const, box: { left: 604, top: 1060, width: 300, height: 42 } },
];

for (const { mood, box } of MOOD_CASES) {
  describe(`레일 스탬프 — ${mood} (#671 → #672 → #728)`, () => {
    test('업로드한 이미지가 스탬프 레이어에 그대로 실린다', async () => {
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

    test('스탬프 레이어는 componentOpacity 래퍼 밖에 선다', async () => {
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openBackgroundPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));

      // 조판 래퍼(inline opacity)의 자손이면 componentOpacity가 스탬프까지 페이드시킨다 — 스탬프는
      // "종이에 이미 인쇄된 바탕"이라 그 밖이어야 한다(#530 계약). 레이어 자신도 이제 투명도
      // 슬라이더 값을 자기 style.opacity로 갖고 있어(#728) closest는 레이어 자기 자신이 아니라
      // 부모부터 올라가야 componentOpacity 래퍼의 존재 여부만 정확히 잰다.
      expect(backgroundLayer(container)!.parentElement?.closest('[style*="opacity"]') ?? null).toBeNull();
    });

    test('무드가 정한 고정 박스에만 그려진다 (#728)', async () => {
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openBackgroundPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));

      // 캔버스 전면(inset:0)이 아니라 무드가 정한 고정 박스 하나에만 선다 — 사용자는 이 자리를
      // 고르지 않는다(#728 c3). 좌표가 바뀌면 이 테스트가 그 무드 소스의 BackgroundPatternLayer
      // box prop과 같이 갱신됐는지를 강제한다.
      const layer = backgroundLayer(container)!;
      expect(layer.style.left).toBe(`${box.left}px`);
      expect(layer.style.top).toBe(`${box.top}px`);
      expect(layer.style.width).toBe(`${box.width}px`);
      expect(layer.style.height).toBe(`${box.height}px`);
    });

    test('배율은 안쪽 겹에만 걸리고 박스 위치는 확대에 안 딸려간다 (#680→#728)', async () => {
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openBackgroundPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));

      const outer = backgroundLayer(container)!;
      const boxBefore = { left: outer.style.left, top: outer.style.top, width: outer.style.width, height: outer.style.height };

      await user.click(screen.getByRole('button', { name: '배경 배율 적용' }));

      // 배율이 이미지 겹에 실제로 걸린다.
      expect(backgroundImageLayer(container)!.style.transform).toContain('scale(1.5)');

      // **이게 이 테스트의 본체다.** #680 시절엔 clip-path가 이미지와 같은 요소에 걸리면 배율을
      // 따라 같이 확대돼 저장물에서 배경이 포스터 위에 인쇄됐다(#490/#495). #728로 clip 자체가
      // 없어졌지만 위험은 형태만 바뀌었다 — 박스(left/top/width/height)를 이미지 겹과 같은
      // 요소에 걸면 배율이 박스 자체를 확대해 무드 조판을 침범한다. 겹을 합치는 리팩터링이 이
      // 명제를 조용히 깨는 걸 막는 자리라, 배율 전후 박스가 **같은 값**인지까지 못 박는다.
      const outerAfter = backgroundLayer(container)!;
      expect({ left: outerAfter.style.left, top: outerAfter.style.top, width: outerAfter.style.width, height: outerAfter.style.height }).toEqual(boxBefore);
      expect(outerAfter.style.transform).toBe('');
    });

    test('크기·투명도 슬라이더는 이미지가 있을 때만 뜬다 (#680→#728)', async () => {
      const user = userEvent.setup();
      render(<Harness mood={mood} />);
      await openBackgroundPanel(user, mood);

      // 조절할 대상이 없으면 죽은 컨트롤이라 아예 안 그린다.
      expect(screen.queryByLabelText('스탬프 크기')).toBeNull();
      expect(screen.queryByLabelText('스탬프 투명도')).toBeNull();

      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));
      expect(screen.getByLabelText('스탬프 크기')).not.toBeNull();
      expect(screen.getByLabelText('스탬프 투명도')).not.toBeNull();
    });

    test('무드를 왕복해도 스탬프 이미지·크기·투명도가 보존된다', async () => {
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openBackgroundPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));
      // 배율·투명도도 같이 실어 왕복시킨다(#680 ac2 · #728 ac4) — 이미지만 살아남고 나머지가
      // 기본값으로 되돌아가면 사용자가 보기엔 "무드 한 번 훑었더니 스탬프가 도로 작아지고
      // 진해졌다"라 이미지 유실과 같은 증상이다.
      await user.click(screen.getByRole('button', { name: '배경 배율 적용' }));
      await user.click(screen.getByRole('button', { name: '배경 투명도 적용' }));

      await user.click(screen.getByRole('button', { name: 'minimal로 전환' }));
      expect(screen.queryByRole('button', { name: '스탬프' })).toBeNull();
      expect(screen.getByTestId('background-pattern-image').textContent).toBe('blob:bgimg');
      expect(screen.getByTestId('background-pattern-scale').textContent).toBe('1.5');
      expect(screen.getByTestId('background-pattern-opacity').textContent).toBe('0.6');

      await user.click(screen.getByRole('button', { name: `${mood}로 전환` }));
      await user.click(screen.getByRole('button', { name: '스탬프' }));
      expect(screen.getByRole('button', { name: '이미지 교체' })).not.toBeNull();
      expect(backgroundImageLayer(container)!.style.backgroundImage).toContain('blob:bgimg');
      expect(backgroundImageLayer(container)!.style.transform).toContain('scale(1.5)');
      expect(backgroundLayer(container)!.style.opacity).toBe('0.6');
      // 슬라이더도 복원된 값을 들고 다시 뜬다 — 상태만 살고 컨트롤이 기본값을 보이면 다음 조작이
      // 그 기본값을 커밋해 값이 조용히 되돌아간다.
      expect((screen.getByLabelText('스탬프 크기') as HTMLInputElement).value).toBe('1.5');
      expect((screen.getByLabelText('스탬프 투명도') as HTMLInputElement).value).toBe('0.6');
    });

    test('절취선은 위치지정 형제라 불투명 스탬프에 안 덮인다 (stub 전용)', async () => {
      if (mood !== 'stub') return;
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openBackgroundPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));

      // 절취선이 static이면 absolute인 스탬프 레이어 **아래**로 가서, 불투명한 이미지가 점선을
      // 통째로 덮는다. 덮고 덮이는 걸 정하는 건 트리 순서가 아니라 position이다(#728로 박스가
      // 작아져도 이 페인팅 규칙 자체는 그대로 유효하다 — MoodStub.tsx 주석 참고).
      const perforation = container.querySelector('div[style*="dashed"], div:has(> span[style*="dashed"])');
      const dashed = Array.from(container.querySelectorAll('span')).find((el) =>
        (el as HTMLElement).style.borderTop.includes('dashed'),
      );
      expect(dashed).not.toBeUndefined();
      expect((dashed!.parentElement as HTMLElement).style.position).toBe('relative');
      expect(perforation).not.toBeNull();
    });

    test('페이퍼 스텁은 스탬프를 다시 칠하지 않는다 (stub 전용)', async () => {
      if (mood !== 'stub') return;
      const user = userEvent.setup();
      const { container } = render(<Harness mood={mood} />);
      await openBackgroundPanel(user, mood);
      await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));

      // 하단 페이퍼 스텁은 스탬프 레이어보다 뒤에 오는 **포지셔닝된** 형제라 paint 순서상 위다.
      // 여기에 background를 다시 두면 종이 아래쪽 전체에서 스탬프가 안 보인다(루트가 이미 PAPER를
      // 칠하므로 색은 어차피 같다). #728로 스탬프 박스가 space-evenly 간격 하나로 작아졌어도
      // 이 페인팅 규칙 자체는 그대로 유효하다 — 다른 테스트는 레이어 자기 스타일만 봐서 이걸 못 잡는다.
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

describe('레일 스탬프 — write-time 투명도 커밋 (#728 c4·ac2·ac3)', () => {
  test('기존 저장본(투명도 없이 이미지만)은 1.0 그대로 읽힌다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness mood="editorial" />);
    await openBackgroundPanel(user, 'editorial');
    // "배경 이미지 적용"은 이미지만 쓴다 — 투명도 필드 없는 기존 저장본을 흉내낸다.
    await user.click(screen.getByRole('button', { name: '배경 이미지 적용' }));

    expect(screen.getByTestId('background-pattern-opacity').textContent).toBe('1');
    expect(backgroundLayer(container)!.style.opacity).toBe('1');
  });

  test('새로 업로드하면 반투명 기본값으로 시작하고, 값을 고친 뒤 교체해도 그 값이 유지된다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness mood="editorial" />);
    await openBackgroundPanel(user, 'editorial');

    // 첫 업로드 — BackgroundPatternPanel의 useLogoCrop onChange와 같은 모양(이미지 + `?? 기본값`).
    await user.click(screen.getByRole('button', { name: '스탬프 첫 업로드 커밋' }));
    expect(screen.getByTestId('background-pattern-opacity').textContent).toBe('0.5');
    expect(backgroundLayer(container)!.style.opacity).toBe('0.5');

    // 사용자가 값을 고친다.
    await user.click(screen.getByRole('button', { name: '배경 투명도 적용' }));
    expect(screen.getByTestId('background-pattern-opacity').textContent).toBe('0.6');

    // 이미지를 교체해도(같은 write-time 커밋 경로) 사용자가 고른 값이 유지된다 — 반투명 기본값
    // 0.5로 되돌아가지 않는다. c4의 "쓰기 시점 확정"이 실제로 그렇게 도는지 잠그는 유일한 케이스다.
    await user.click(screen.getByRole('button', { name: '스탬프 첫 업로드 커밋' }));
    expect(screen.getByTestId('background-pattern-image').textContent).toBe('blob:firstupload');
    expect(screen.getByTestId('background-pattern-opacity').textContent).toBe('0.6');
    expect(backgroundLayer(container)!.style.opacity).toBe('0.6');
  });
});
