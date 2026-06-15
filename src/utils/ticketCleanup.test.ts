import { describe, expect, it } from 'bun:test';
import { planTicketCleanup, type CleanupBlob } from './ticketCleanup';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 5, 14, 3, 0, 0); // 고정 기준 시각.
const TTL = 30 * DAY;

/** NOW 기준 n일 전 ISO 문자열. */
function daysAgo(n: number): string {
  return new Date(NOW - n * DAY).toISOString();
}

function blob(pathname: string, ageDays: number): CleanupBlob {
  return { pathname, uploadedAt: daysAgo(ageDays) };
}

describe('planTicketCleanup', () => {
  it('빈 입력은 아무것도 삭제하지 않는다', () => {
    const plan = planTicketCleanup([], { now: NOW, ttlMs: TTL });
    expect(plan).toEqual({
      deletePathnames: [],
      scanned: 0,
      expiredGroups: 0,
      orphanDeleted: 0,
    });
  });

  it('TTL 안의 신선한 짝은 보존한다', () => {
    const plan = planTicketCleanup(
      [blob('t/a.jpg', 1), blob('t/a.json', 1)],
      { now: NOW, ttlMs: TTL },
    );
    expect(plan.deletePathnames).toEqual([]);
    expect(plan.scanned).toBe(2);
    expect(plan.expiredGroups).toBe(0);
  });

  it('TTL을 넘긴 짝은 jpg+json 모두 삭제한다', () => {
    const plan = planTicketCleanup(
      [blob('t/old.jpg', 31), blob('t/old.json', 31)],
      { now: NOW, ttlMs: TTL },
    );
    expect(plan.deletePathnames.sort()).toEqual(['t/old.jpg', 't/old.json']);
    expect(plan.expiredGroups).toBe(1);
    expect(plan.orphanDeleted).toBe(0);
  });

  it('만료된 orphan 이미지(.json 없는 .jpg)를 흡수한다', () => {
    const plan = planTicketCleanup([blob('t/orphan.jpg', 40)], { now: NOW, ttlMs: TTL });
    expect(plan.deletePathnames).toEqual(['t/orphan.jpg']);
    expect(plan.orphanDeleted).toBe(1);
    expect(plan.expiredGroups).toBe(0);
  });

  it('만료된 orphan 메타(.jpg 없는 .json)도 흡수한다', () => {
    const plan = planTicketCleanup([blob('t/lonely.json', 40)], { now: NOW, ttlMs: TTL });
    expect(plan.deletePathnames).toEqual(['t/lonely.json']);
    expect(plan.orphanDeleted).toBe(1);
  });

  it('신선/만료가 섞이면 만료만 삭제한다', () => {
    const plan = planTicketCleanup(
      [
        blob('t/fresh.jpg', 2),
        blob('t/fresh.json', 2),
        blob('t/stale.jpg', 45),
        blob('t/stale.json', 45),
      ],
      { now: NOW, ttlMs: TTL },
    );
    expect(plan.deletePathnames.sort()).toEqual(['t/stale.jpg', 't/stale.json']);
    expect(plan.expiredGroups).toBe(1);
  });

  it('티켓이 아닌 경로(prefix/확장자 불일치)는 무시한다', () => {
    const plan = planTicketCleanup(
      [
        blob('t/keep.jpg', 99), // 만료지만 짝 없는 정상 orphan → 삭제 대상
        blob('other/x.jpg', 99), // t/ prefix 아님 → 무시
        blob('t/note.txt', 99), // 확장자 불일치 → 무시
        blob('t/.jpg', 99), // id 비어있음 → 무시
      ],
      { now: NOW, ttlMs: TTL },
    );
    expect(plan.deletePathnames).toEqual(['t/keep.jpg']);
    expect(plan.scanned).toBe(1); // t/keep.jpg만 인식
  });

  it('TTL 경계: 정확히 TTL이면 보존, 1ms 넘으면 삭제', () => {
    const atBoundary = planTicketCleanup(
      [{ pathname: 't/edge.jpg', uploadedAt: new Date(NOW - TTL).toISOString() }],
      { now: NOW, ttlMs: TTL },
    );
    expect(atBoundary.deletePathnames).toEqual([]);

    const justOver = planTicketCleanup(
      [{ pathname: 't/edge.jpg', uploadedAt: new Date(NOW - TTL - 1).toISOString() }],
      { now: NOW, ttlMs: TTL },
    );
    expect(justOver.deletePathnames).toEqual(['t/edge.jpg']);
  });

  it('보수적 보존: 한쪽이 신선하면(json 오래됨, jpg 신선) 그룹을 유지한다', () => {
    const plan = planTicketCleanup(
      [blob('t/mix.json', 45), blob('t/mix.jpg', 2)],
      { now: NOW, ttlMs: TTL },
    );
    expect(plan.deletePathnames).toEqual([]);
    expect(plan.expiredGroups).toBe(0);
  });

  it('Date 객체 uploadedAt도 처리한다', () => {
    const plan = planTicketCleanup(
      [{ pathname: 't/d.jpg', uploadedAt: new Date(NOW - 50 * DAY) }],
      { now: NOW, ttlMs: TTL },
    );
    expect(plan.deletePathnames).toEqual(['t/d.jpg']);
  });
});
