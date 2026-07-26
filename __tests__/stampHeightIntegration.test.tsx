import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { ChainStamp, FormatStamp } from '../src/components/moods/_shared';
import { stubImgNaturalBySrc, trapImageProbe } from './setup/posterStubs';

// 로고 스탬프 높이 소폭 동적화(#392) 통합 회귀 — claude-review PR #408 P1: stampHeightDelta 순수
// 함수 테스트만으로는 실제 종횡비 → <img> height 배선이 검증되지 않는다는 지적 반영.
//
// 스텁은 `globalThis.Image` 목업이 아니라 렌더된 `<img>`의 자연 치수다(#539) — 스탬프가 같은 src를
// new Image()로 또 디코드하지 않고 자기가 그리는 <img>에서 읽으므로, 프로브가 되살아나면 이
// 스텁만으론 aspect가 안 잡혀 아래 높이 단언이 전부 base height로 떨어진다.

/** 테스트마다 새로 뜬다 — 로드 도중 치수가 도착하는 상황을 이 객체에 키를 더해 재현한다. */
let dims: Record<string, [number, number]>;
let restore: () => void;
let probe: ReturnType<typeof trapImageProbe>;

beforeEach(() => {
  dims = {
    'blob:tall': [60, 240], // aspect 0.25 — delta +14 → 48+14=62
    'blob:wide': [400, 60], // aspect 6.67 — delta clamp -16 → 64-16=48
  };
  restore = stubImgNaturalBySrc(dims);
  probe = trapImageProbe();
});

afterEach(() => {
  probe.restore();
  restore();
  cleanup();
});

describe('ChainStamp/FormatStamp 높이 보정 통합 (#392)', () => {
  test('세로로 긴 로고는 높이가 +14px 커진다', () => {
    const { container } = render(<ChainStamp chain="blob:tall" visible height={48} />);
    expect(container.querySelector('img')?.style.height).toBe('62px');
  });

  test('가로로 긴 로고는 높이가 -16px cap까지 줄어든다', () => {
    const { container } = render(<FormatStamp format="blob:wide" visible />);
    expect(container.querySelector('img')?.style.height).toBe('48px');
  });

  test('미로드/치수 없음(aspect=null)은 첫 페인트부터 기존 고정 높이', () => {
    const { container } = render(<ChainStamp chain="blob:unmapped" visible height={48} />);
    expect(container.querySelector('img')?.style.height).toBe('48px');
  });

  // claude-review PR #408 P1(2차): delta가 size로 스케일 안 되면 Stub/Editorial처럼 size<1인
  // 무드에서 ±16px가 base height 대비 훨씬 큰 상대 변화를 만든다. (height+delta)*size로 고정.
  test('size<1(예: Stub/Editorial의 0.5)에서도 delta가 함께 스케일된다', () => {
    const { container } = render(<ChainStamp chain="blob:tall" visible height={48} size={0.5} />);
    // (48 + 14) * 0.5 = 31 — delta가 스케일 안 됐다면 24 + 14 = 38이 됐을 것.
    expect(container.querySelector('img')?.style.height).toBe('31px');
  });

  // claude-review PR #410 P1: 낭비 로드 없음·즉시 리셋(#190 nit)에 회귀 테스트가 없다는 지적 반영.
  // 로드하는 <img>가 곧 렌더되는 <img>라(#539), "로드 생략"은 곧 "<img>를 안 그린다"와 같은 말이다.
  test('완전 비노출(visible=false, ghost=false)이면 로고 <img>를 아예 안 그린다', () => {
    const { container } = render(<ChainStamp chain="blob:tall" visible={false} ghost={false} height={48} />);
    expect(container.querySelector('img')).toBeNull();
  });

  test('src 교체 시 이전 aspect를 물고 가지 않는다(미로드 src → 즉시 기본 높이)', () => {
    const { container, rerender } = render(<ChainStamp chain="blob:tall" visible height={48} />);
    expect(container.querySelector('img')?.style.height).toBe('62px');

    // 매핑 밖 src = 아직 로드 전(complete=false) — 이전 62px이 남아 있으면 리셋이 안 된 것.
    rerender(<ChainStamp chain="blob:loading" visible height={48} />);
    expect(container.querySelector('img')?.style.height).toBe('48px');

    // 로드된 다른 src로 갈면 그쪽 보정으로 갱신된다.
    rerender(<ChainStamp chain="blob:wide" visible height={48} />);
    expect(container.querySelector('img')?.style.height).toBe('32px'); // 48 - 16px cap
  });

  // #539의 본체 — 같은 src를 new Image()로 또 디코드하지 않는다. 위 높이 단언들은 프로브를
  // 되살려도 (그 프로브가 로드되기만 하면) 통과할 수 있으니, 중복 디코드는 여기서 따로 막는다.
  test('로고 src를 new Image()로 다시 디코드하지 않는다', () => {
    const { container } = render(<ChainStamp chain="blob:tall" visible height={48} />);
    expect(container.querySelector('img')?.style.height).toBe('62px');
    expect(probe.decoded).toEqual([]);
  });

  // 실브라우저에선 ref 부착 시점의 complete가 거의 항상 false다(막 심은 src) — 보정은 load
  // 이벤트가 와야 걸린다. 스텁이 complete를 즉시 true로 주는 탓에 이 경로만 비면, onLoad를
  // 통째로 지워도 테스트가 초록이라 실브라우저에서만 보정이 죽는다.
  test('로드 전엔 기본 높이, load 이벤트가 와야 보정된다(onLoad 경로)', async () => {
    const { container } = render(<ChainStamp chain="blob:late" visible height={48} />);
    const img = container.querySelector('img')!;
    expect(img.style.height).toBe('48px'); // 매핑 밖 = 아직 미로드

    dims['blob:late'] = [60, 240]; // 이제 도착 — aspect 0.25 → delta +14
    await act(async () => {
      fireEvent.load(img);
    });
    expect(container.querySelector('img')?.style.height).toBe('62px');
  });

  // #539 판정 — 로고를 숨긴 dim placeholder는 이전 로고의 종횡비 보정을 물고 있지 않다(로고가
  // 안 보이는 박스에 ±16px 보정은 두 고스트 박스 높이만 어긋나게 할 뿐 정보가 없다).
  test('노출 off로 넘어간 dim placeholder는 보정 없는 고정 높이', () => {
    const { container, rerender } = render(<ChainStamp chain="blob:tall" visible height={48} ghost />);
    expect(container.querySelector('img')?.style.height).toBe('62px');

    rerender(<ChainStamp chain="blob:tall" visible={false} height={48} ghost />);
    const dim = container.querySelector<HTMLDivElement>('[data-ghost-dim]');
    expect(dim?.style.height).toBe('48px');
  });
});
