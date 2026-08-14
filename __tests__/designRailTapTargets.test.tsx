/**
 * DESIGN dock 탭 타깃 크기 회귀(#500) — 후보정 패널을 축 전환으로 재설계하면서 칩·세그먼트가
 * WCAG 2.2 SC 2.5.8(AA, 24×24) 아래로 못 내려가게 못박는다.
 *
 * #508이 플로팅 툴바에 세운 형태(__tests__/tapTargets.ts의 클래스 파싱 + variant·scale 우회
 * 금지)를 그대로 재사용한다. 같은 판정기를 쓰는 #553의 툴바 위계(32 vs 44)는 인플레이스
 * 편집 바가 필요해 __tests__/inPlaceFieldEditor.test.tsx에 있다.
 *
 * 실제 렌더 px는 브라우저 실측 몫이다(#500: 400×675 뷰포트에서 후보정 dock 413→312px,
 * 같은 자리 프리뷰 티켓 114×182→177×283px).
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';
import { assertNoShrink, expectMeetsAA } from './tapTargets';

function RailHarness({ onRecropPoster }: { onRecropPoster?: () => void } = {}) {
  const photo = usePhototicket();
  return <DesignRail photo={photo} onRecropPoster={onRecropPoster} />;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('DESIGN dock 탭 타깃 (#500, WCAG 2.2 SC 2.5.8 AA)', () => {
  test('후보정 축 세그먼트(재질·코팅)가 24px 하한을 넘는다', async () => {
    const user = userEvent.setup();
    render(<RailHarness />);
    await user.click(screen.getByRole('button', { name: '후보정' }));

    const seg = screen.getByRole('radiogroup', { name: '후보정 축' });
    const tabs = Array.from(seg.querySelectorAll('[role=radio]'));
    // 셀렉터가 조용히 비면 통과 못하게 + 라벨이 "축 · 현재값"을 다 들고 있는지(안 열린 축의
    // 상태가 보여야 한 축만 그리는 배치가 성립한다).
    expect(tabs.map((t) => t.textContent)).toEqual(['재질 · 원본', '코팅 · 유광']);
    for (const t of tabs) {
      const { h } = expectMeetsAA(t, `축 세그먼트 ${t.textContent}`);
      expect(h).toBe(36); // h-9 — 하한(24)이 아니라 실제 선언값을 고정해 조용한 축소를 잡는다
    }
  });

  test('후보정 칩(TexturePicker 46×46)이 24px 하한을 넘고, 한 번에 한 축만 그린다', async () => {
    const user = userEvent.setup();
    render(<RailHarness />);
    await user.click(screen.getByRole('button', { name: '후보정' }));

    // 세로 예산 회수의 근거 — 두 축이 동시에 서면 dock이 다시 자란다(#500).
    expect(screen.queryByRole('radiogroup', { name: '재질' })).not.toBeNull();
    expect(screen.queryByRole('radiogroup', { name: '코팅' })).toBeNull();

    const chips = Array.from(screen.getByRole('radiogroup', { name: '재질' }).querySelectorAll('[role=radio]'));
    expect(chips.length).toBeGreaterThan(1);
    for (const chip of chips) {
      // 칩 자체는 콘텐츠 크기(스와치+라벨)라, 크기 선언을 든 스와치를 재고 축소 우회 금지는
      // 칩 서브트리 전체에 건다(활성 칩의 border span이 인라인 transform을 들고 있다).
      for (const el of [chip, ...Array.from(chip.querySelectorAll('*'))]) assertNoShrink(el, '후보정 칩 서브트리');
      const swatch = chip.querySelector('[style*="width"]');
      expect(swatch).not.toBeNull();
      const { w, h } = expectMeetsAA(swatch!, `후보정 칩 ${chip.textContent}`);
      expect([w, h]).toEqual([46, 46]);
    }

    // 코팅으로 전환하면 그 축의 칩으로 갈린다(축 전환이 죽은 컨트롤이 아님).
    await user.click(screen.getByRole('radio', { name: /^코팅 ·/ }));
    expect(screen.queryByRole('radiogroup', { name: '재질' })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: '코팅' })).not.toBeNull();
  });
});

/**
 * 크기 dock 탭 타깃(#554) — 같은 축 전환 처방을 크기 탭(포스터↔로고)에 적용하면서 새로 서거나
 * 자리를 옮긴 타깃 전부를 같은 판정기로 못박는다.
 *
 * 재크롭 버튼·채우기 라디오는 이전에 `py-2.5`로만 높이가 결정돼(=실렌더 40px) 파서가 못 읽었고
 * `data-touch`는 44라고 적혀 있었다. 선언을 실렌더에 맞춰 `h-10`(40px)으로 내려 둘을 일치시켰다 —
 * 반대로 44로 올리면 세로 예산을 회수하는 이 변경이 스스로 8px을 도로 먹는다.
 *
 * #682 다이어트가 40→36(h-9)으로 한 번 더 내렸다 — 위 크기 축 세그먼트(h-9)와 높이를 맞추면서
 * 4px씩 아낀다. 36은 AA 하한(24)의 1.5배라 여전히 여유 있다.
 *
 * 실제 렌더 px는 브라우저 실측 몫이다(#554: 400×675에서 크기 dock 361.5→303.5px,
 * 같은 자리 프리뷰 티켓 146×234→196×314px. #682: 393×659에서 크기 패널 199→?px, 아래 실측 참고).
 */
describe('크기 dock 탭 타깃 (#554, WCAG 2.2 SC 2.5.8 AA)', () => {
  test('크기 축 세그먼트(포스터·로고)가 24px 하한을 넘고, 한 번에 한 축만 그린다', async () => {
    const user = userEvent.setup();
    render(<RailHarness onRecropPoster={() => {}} />);
    await user.click(screen.getByRole('button', { name: '크기' }));

    const seg = screen.getByRole('radiogroup', { name: '크기 축' });
    const tabs = Array.from(seg.querySelectorAll('[role=radio]'));
    expect(tabs.map((t) => t.textContent)).toEqual(['포스터', '로고']);
    for (const t of tabs) {
      const { h } = expectMeetsAA(t, `크기 축 세그먼트 ${t.textContent}`);
      expect(h).toBe(36); // 후보정 축과 같은 h-9 — 실제 선언값을 고정해 조용한 축소를 잡는다
    }

    // 세로 예산 회수의 근거 — 두 묶음이 동시에 서면 dock이 다시 361px로 자란다.
    expect(screen.queryByRole('button', { name: '포스터 다시 크롭' })).not.toBeNull();
    expect(screen.queryByLabelText('체인 로고 크기')).toBeNull();

    await user.click(screen.getByRole('radio', { name: '로고' }));
    expect(screen.queryByRole('button', { name: '포스터 다시 크롭' })).toBeNull();
    expect(screen.queryByLabelText('체인 로고 크기')).not.toBeNull();
  });

  test('포스터 축 컨트롤(재크롭 버튼·채우기 라디오)이 40px 선언을 유지한다', async () => {
    const user = userEvent.setup();
    render(<RailHarness onRecropPoster={() => {}} />);
    await user.click(screen.getByRole('button', { name: '크기' }));

    const recrop = screen.getByRole('button', { name: '포스터 다시 크롭' });
    expect(expectMeetsAA(recrop, '재크롭 버튼').h).toBe(36);

    // 기본 무드 minimal이 POSTER_FILL_MOODS 안이라 채우기 토글도 같이 선다.
    const fit = Array.from(
      screen.getByRole('radiogroup', { name: '포스터 채우기' }).querySelectorAll('[role=radio]'),
    );
    expect(fit.map((t) => t.textContent)).toEqual(['원본 비율', '꽉 채우기']);
    for (const t of fit) {
      for (const el of [t, ...Array.from(t.querySelectorAll('*'))]) assertNoShrink(el, '채우기 라디오 서브트리');
      expect(expectMeetsAA(t, `채우기 라디오 ${t.textContent}`).h).toBe(36);
    }
  });

  test('포스터 축이 통째로 비면 세그먼트 없이 로고 슬라이더만 선다(죽은 축 방지)', async () => {
    const user = userEvent.setup();
    // onRecropPoster 없음(원본 없음) + POSTER_FILL_MOODS 밖 무드 → 포스터 축에 그릴 게 없다.
    render(<RailHarness />);
    await user.click(screen.getByRole('button', { name: '무드' }));
    await user.click(screen.getByRole('radio', { name: /크라이테리언/ }));
    await user.click(screen.getByRole('button', { name: '무드' }));
    await user.click(screen.getByRole('button', { name: '크기' }));

    expect(screen.queryByRole('radiogroup', { name: '크기 축' })).toBeNull();
    expect(screen.queryByLabelText('체인 로고 크기')).not.toBeNull();
  });
});
