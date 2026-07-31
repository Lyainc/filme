import { describe, expect, it } from 'bun:test';
import {
  planTicketCleanup,
  ttlDaysFromEnv,
  DEFAULT_TICKET_TTL_DAYS,
  type CleanupBlob,
} from '../src/utils/ticketCleanup';

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

  it('og.jpg는 orphan 판정(jpg+json 짝)에 안 들어간다 — json 없는 그룹은 og가 있어도 orphan', () => {
    const plan = planTicketCleanup(
      [blob('t/solo.jpg', 40), blob('t/solo.og.jpg', 40)],
      { now: NOW, ttlMs: TTL },
    );
    expect(plan.deletePathnames.sort()).toEqual(['t/solo.jpg', 't/solo.og.jpg']);
    expect(plan.orphanDeleted).toBe(1);
    expect(plan.expiredGroups).toBe(0);
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

  it('og.jpg(#438 가로 OG 카드)를 정상 티켓 그룹의 일원으로 인식한다(id를 "<id>.og"로 잘못 자르지 않음)', () => {
    const plan = planTicketCleanup(
      [blob('t/abc.jpg', 1), blob('t/abc.json', 1), blob('t/abc.og.jpg', 1)],
      { now: NOW, ttlMs: TTL },
    );
    expect(plan.scanned).toBe(3);
    expect(plan.deletePathnames).toEqual([]); // 신선 — 셋 다 같은 그룹으로 보존
    expect(plan.expiredGroups).toBe(0);
    expect(plan.orphanDeleted).toBe(0);
  });

  it('만료된 3파일(jpg+json+og.jpg) 그룹은 정상 만료로 셋 다 삭제한다(orphan 오판 없음)', () => {
    const plan = planTicketCleanup(
      [blob('t/old.jpg', 40), blob('t/old.json', 40), blob('t/old.og.jpg', 40)],
      { now: NOW, ttlMs: TTL },
    );
    expect(plan.deletePathnames.sort()).toEqual(['t/old.jpg', 't/old.json', 't/old.og.jpg']);
    expect(plan.expiredGroups).toBe(1);
    expect(plan.orphanDeleted).toBe(0); // og.jpg 때문에 별도 orphan 그룹으로 잘못 잡히면 안 됨
  });

  it('og.jpg 생성 실패로 없는(jpg+json만 있는) 레거시 그룹도 정상 만료 처리한다', () => {
    const plan = planTicketCleanup(
      [blob('t/legacy.jpg', 40), blob('t/legacy.json', 40)],
      { now: NOW, ttlMs: TTL },
    );
    expect(plan.deletePathnames.sort()).toEqual(['t/legacy.jpg', 't/legacy.json']);
    expect(plan.expiredGroups).toBe(1);
    expect(plan.orphanDeleted).toBe(0);
  });

  it('Date 객체 uploadedAt도 처리한다', () => {
    const plan = planTicketCleanup(
      [{ pathname: 't/d.jpg', uploadedAt: new Date(NOW - 50 * DAY) }],
      { now: NOW, ttlMs: TTL },
    );
    expect(plan.deletePathnames).toEqual(['t/d.jpg']);
  });
});

describe('ttlDaysFromEnv', () => {
  it('env 미설정만 기본값으로 간다 — 이것만 폴백이고 나머지 거부는 null', () => {
    expect(ttlDaysFromEnv(undefined)).toBe(DEFAULT_TICKET_TTL_DAYS);
  });

  it('하한 이상의 유한 수는 그대로 채택한다', () => {
    expect(ttlDaysFromEnv('3')).toBe(3);
    expect(ttlDaysFromEnv('1')).toBe(1); // 하한 경계 포함
  });

  // #626: 하한이 없으면 "0.0001"(8.6초)이 통과해 다음 cron이 살아있는 공유 링크를 전부
  // 만료로 판정하고 비가역 삭제한다.
  it('하루 미만은 오설정이라 거부한다', () => {
    expect(ttlDaysFromEnv('0.0001')).toBeNull();
    expect(ttlDaysFromEnv('0.5')).toBeNull();
    expect(ttlDaysFromEnv('0')).toBeNull();
    expect(ttlDaysFromEnv('-1')).toBeNull();
  });

  // 반대 방향의 오타도 거부해야 한다: 보존을 늘리려던 "30d"가 기본값 3일로 폴백되면
  // 3~30일치가 소급 삭제된다 — 거부의 이유가 "너무 작아서"가 아니라 "의도를 모르겠어서"다.
  it('비수치·빈 문자열·Infinity도 거부한다', () => {
    expect(ttlDaysFromEnv('30d')).toBeNull(); // Number('30d') = NaN
    expect(ttlDaysFromEnv('3d')).toBeNull();
    expect(ttlDaysFromEnv('')).toBeNull(); // Number('') = 0
    expect(ttlDaysFromEnv('Infinity')).toBeNull();
  });
});
