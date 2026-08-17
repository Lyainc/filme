/**
 * #523 AC3 — filterItemsForMood 유닛 테스트. 합성(가짜) 항목으로 필터 함수를 직접 호출한다.
 * appliesTo 없으면 전 무드에서 노출, 있으면 해당 무드에서만 노출·그 밖은 숨김.
 */
import { describe, expect, test } from 'bun:test';
import { filterItemsForMood, type RailItem } from '@/components/v2/designRailItems';

function fakeItem(overrides: Partial<RailItem> = {}): RailItem {
  return {
    id: 'size',
    label: 'fake',
    icon: null,
    render: () => null,
    ...overrides,
  };
}

describe('filterItemsForMood (#523 AC3)', () => {
  test('appliesTo 없는 항목은 모든 무드에서 노출', () => {
    const item = fakeItem();
    expect(filterItemsForMood([item], 'minimal')).toEqual([item]);
    expect(filterItemsForMood([item], 'criterion')).toEqual([item]);
    expect(filterItemsForMood([item], '35mm')).toEqual([item]);
  });

  test('appliesTo 있는 항목은 그 무드에서만 노출, 그 밖은 숨김', () => {
    const restricted = fakeItem({ appliesTo: ['35mm', '35mm-landscape'] });

    expect(filterItemsForMood([restricted], '35mm')).toEqual([restricted]);
    expect(filterItemsForMood([restricted], '35mm-landscape')).toEqual([restricted]);
    expect(filterItemsForMood([restricted], 'minimal')).toEqual([]);
    expect(filterItemsForMood([restricted], 'criterion')).toEqual([]);
  });

  test('혼합 목록 — 무제한 항목은 남고 제한 항목만 무드에 따라 갈린다', () => {
    const always = fakeItem({ id: 'mood' });
    const onlyMinimal = fakeItem({ appliesTo: ['minimal'] });

    expect(filterItemsForMood([always, onlyMinimal], 'minimal')).toEqual([always, onlyMinimal]);
    expect(filterItemsForMood([always, onlyMinimal], 'stub')).toEqual([always]);
  });
});
