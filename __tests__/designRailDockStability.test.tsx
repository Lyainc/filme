/**
 * #563/#564/#565 회귀 — dock이 레일 탭 전환에 반응해 출렁이지 않는다.
 *
 * 세 증상 다 원인이 CSS라, happy-dom이 실렌더 px을 못 보는 이 하네스에서 검증 가능한 건
 * "선언이 남아있는가"다(`__tests__/tapTargets.ts`가 탭 타깃에 쓰는 것과 같은 처방 — 클래스
 * 선언이 곧 계약). 실제 px(전후 표)는 400×675 브라우저 실측이 이슈에 남아있다.
 *
 * 마지막 테스트만 동작 검증이다: #558이 남긴 열린 질문(appliesTo가 무드마다 아이콘 수를 바꿀 때
 * 캐러셀 중앙정렬이 어떻게 되는가)의 답 — 개수가 바뀌면 리센터를 다시 건다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';
import type { RailItem } from '@/components/v2/designRailItems';

function RailHarness({ items }: { items?: RailItem[] }) {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.updateComponents({ layout: 'criterion' })}>
        criterion으로 전환
      </button>
      <DesignRail photo={photo} items={items} />
    </>
  );
}

const railRow = () => screen.getByRole('button', { name: '무드' }).parentElement as HTMLElement;

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('DesignRail dock 안정성 (#563/#564/#565)', () => {
  test('#563 — 상세 패널은 항목과 무관한 고정 높이 슬롯 + 내부 스크롤이다', () => {
    render(<RailHarness />);
    const panel = document.getElementById('design-rail-panel')!;
    // 고정 높이라야 탭 전환에 dock이 안 움직인다. min-h/max-h로 바꾸면 낮은 항목이 다시 줄어
    // 출렁임이 돌아오므로 h-* 선언 자체를 못박는다.
    // #682 — svh 계수는 17.5→26으로 올랐다(레일 슬롯 예산 부족, 393×659에서 115px→171px).
    expect(panel.className).toMatch(/(^|\s)h-\[min\(214px,26svh\)\]/);
    // 넘치는 항목(#682 기준 크기·형압)은 dock을 밀지 않고 안에서 스크롤한다.
    expect(panel.className).toContain('overflow-y-auto');
    // #385 — range thumb가 트랙 아래로 8px 튀어나와 스크롤 박스 바닥에서 잘리는 것 방어.
    expect(panel.className).toContain('py-3');
  });

  test('#564/#565 — 아이콘 행은 스크롤바를 숨기고 세로 여유를 양쪽에 둔다', () => {
    render(<RailHarness />);
    const row = railRow();
    // 스와이프 캐러셀이라 스크롤바가 정보를 안 준다(#564).
    expect(row.className).toContain('no-scrollbar');
    expect(row.className).not.toContain('scrollbar-width:thin');
    // overflow-x:auto가 세로 클리핑 박스도 만들어서(#565) 선택 링(2px)·전역 :focus-visible
    // (outline 3px + offset 2px)이 잘렸다 — 위아래 6px. pb만 있던 비대칭으로 되돌리면 재발한다.
    expect(row.className).toContain('py-1.5');
    expect(row.className).not.toMatch(/(^|\s)pb-1(\s|$)/);
    // 양끝 패딩 = 아이콘 반지름(44/2). 이보다 크면 첫·마지막 아이콘이 scrollLeft 0/최대에서
    // 그 차이만큼 중앙을 못 맞춘다(#502는 28px이라 400×675에서 ±6px 어긋났다).
    expect(row.className).toContain('px-[calc(50%-22px)]');
  });

  test('#563 — 항목이 갈리면 슬롯 스크롤을 위로 되돌린다', async () => {
    // 고정 슬롯은 같은 DOM 노드에 콘텐츠만 갈아끼워서 scrollTop이 그대로 넘어간다 — 컬러를
    // 바닥까지 내리고 후보정으로 옮기면 새 항목이 중간부터 보였다. 짧은 항목은 브라우저가 0으로
    // 클램프해 저절로 맞지만 넘치는 항목끼리는 안 맞는다.
    const user = userEvent.setup();
    render(<RailHarness />);
    const panel = document.getElementById('design-rail-panel')!;

    await user.click(screen.getByRole('button', { name: '컬러' }));
    panel.scrollTop = 40;
    await user.click(screen.getByRole('button', { name: '후보정' }));
    expect(panel.scrollTop).toBe(0);
  });

  test('#558 열린 질문 — appliesTo로 아이콘 수가 바뀌면 활성 아이콘을 다시 중앙으로 당긴다', async () => {
    // criterion에서만 존재하는 항목을 하나 더 얹어, 무드 전환이 아이콘 수를 5→6으로 바꾸게 한다.
    const items: RailItem[] = [
      {
        id: 'mood',
        label: '무드',
        eyebrow: 'Mood',
        icon: <span />,
        render: () => <div>무드 패널</div>,
      },
      {
        id: 'custom',
        label: '커스텀',
        eyebrow: 'Custom',
        icon: <span />,
        appliesTo: ['criterion'],
        render: () => <div>커스텀 패널</div>,
      },
    ];
    const centered: string[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      const id = this.getAttribute('data-rail-id');
      if (id) centered.push(id);
    };

    try {
      const user = userEvent.setup();
      render(<RailHarness items={items} />);

      await user.click(screen.getByRole('button', { name: '무드' }));
      expect(centered).toEqual(['mood']);

      // 아이콘 수가 바뀌면 리센터를 다시 건다. 실사용 목록에선 숨김 대상이 목록 끝(커스텀)
      // 하나뿐이라 이걸 빼도 어긋남이 0px이지만(브라우저 실측), 가운데 항목에 appliesTo가 붙는
      // 순간 뒤 항목이 통째로 밀려 조용히 어긋난다 — 여기 합성 항목이 그 배치를 미리 세운다.
      await user.click(screen.getByRole('button', { name: 'criterion으로 전환' }));
      expect(screen.getByRole('button', { name: '커스텀' })).toBeTruthy();
      expect(centered).toEqual(['mood', 'mood']);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});
