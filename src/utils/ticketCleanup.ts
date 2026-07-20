/**
 * 티켓 Blob 정리(cleanup) 계획 — I/O 없는 순수 함수(#121 C3).
 *
 * `/api/cron/cleanup-tickets`가 @vercel/blob `list`로 받은 blob 목록을 받아, TTL 경과·orphan을
 * 판정해 "삭제할 pathname"만 돌려준다. 실제 list/del 호출은 라우트가 직접 하고(추상화 레이어
 * 신설 금지, #121), 이 함수는 결정 로직만 담아 단위 테스트한다 — 비가역 삭제의 위험은
 * "무엇을 지울지" 판정에 있으므로 그 부분만 떼어 검증한다.
 *
 * 나이 판정은 메타 JSON의 createdAt이 아니라 blob 자체의 `uploadedAt`을 쓴다:
 *  - uploadedAt은 put 시점에 Vercel이 찍는 권위 타임스탬프라 meta.createdAt(같은 put 순간의
 *    앱 시계값)과 사실상 동일하고, list 응답에 이미 들어 있어 .json을 따로 fetch할 필요가 없다.
 *  - orphan 이미지(.json 없는 .jpg)는 meta가 없어 createdAt을 못 읽지만 uploadedAt은 있으므로,
 *    정상 티켓과 orphan을 같은 기준으로 일관되게 만료시킬 수 있다.
 */

/**
 * 공유 링크 기본 유효기간(일). cleanup cron의 TTL 기본값이자 사용자 disclaimer 표기의 단일
 * 출처(#179) — 셋이 따로 박혀 어긋나지 않게 여기서만 정의한다. 30→7(#179)→3(#194)으로 줄여
 * 공유 블롭 누적 저장을 상쇄한다(자동 발급 폐기로 업로드는 공유자에 한정되지만, 저장 헤드룸을
 * 더 확보). cron은 TICKET_TTL_DAYS env로 덮을 수 있으나, disclaimer 표기는 기본값을 따른다
 * (env override의 UI 반영은 미사용 escape hatch라 생략).
 */
export const DEFAULT_TICKET_TTL_DAYS = 3;

/** 비공식·양도불가·정보 무보증 고지 문구 — 공유 패널·수신자 페이지·앱 footer(#327)가 공유하는
 *  단일 출처. 정보 정확성·분실 면책(#425)은 OCR·수동입력 오기재나 링크 만료 후 분실을 사용자
 *  귀책으로 떠넘기지 않되, 서비스가 내용을 보증하지 않는다는 점은 명시해 기대를 맞춘다. */
export const UNOFFICIAL_TICKET_NOTICE =
  '비공식 팬메이드 티켓이라 양도·재판매할 수 없고, 정보 정확성은 보장하지 않으며 분실·훼손에 책임지지 않아요.';

export interface CleanupBlob {
  pathname: string;
  uploadedAt: Date | string;
}

export interface CleanupPlan {
  /** 삭제 대상 pathname(만료된 정상 그룹 + 만료된 orphan). */
  deletePathnames: string[];
  /** 인식된 티켓 blob 수(t/<id>.{jpg,json,og.jpg}만 카운트, 그 외 경로는 제외). */
  scanned: number;
  /** .jpg+.json 짝이 모두 만료돼 삭제된 그룹 수. */
  expiredGroups: number;
  /** 짝 없는 단독 blob(orphan .jpg 또는 .json) 중 만료돼 삭제된 그룹 수. */
  orphanDeleted: number;
}

const TICKET_PREFIX = 't/';
const OG_JPG_SUFFIX = '.og.jpg';
const JPG_SUFFIX = '.jpg';
const JSON_SUFFIX = '.json';

/** `t/<id>.jpg` | `t/<id>.json` | `t/<id>.og.jpg`(#438 가로 OG 카드) → { id, kind }. 그 외
 * 경로는 null — 미인식은 절대 후보에 넣지 않는다. `.og.jpg`도 `.jpg`로 끝나므로 일반 jpg보다
 * 먼저 검사해야 한다 — 순서를 바꾸면 `t/<id>.og.jpg`가 `.jpg` 분기에 먼저 걸려 id가
 * `<id>.og`로 잘못 잘리고, 실제 티켓 그룹과 분리된 채 매번 orphan으로 오판된다. */
function parseTicketPath(pathname: string): { id: string; kind: 'jpg' | 'json' | 'og' } | null {
  if (!pathname.startsWith(TICKET_PREFIX)) return null;
  const rest = pathname.slice(TICKET_PREFIX.length);
  if (rest.endsWith(OG_JPG_SUFFIX)) {
    const id = rest.slice(0, -OG_JPG_SUFFIX.length);
    return id ? { id, kind: 'og' } : null;
  }
  if (rest.endsWith(JPG_SUFFIX)) {
    const id = rest.slice(0, -JPG_SUFFIX.length);
    return id ? { id, kind: 'jpg' } : null;
  }
  if (rest.endsWith(JSON_SUFFIX)) {
    const id = rest.slice(0, -JSON_SUFFIX.length);
    return id ? { id, kind: 'json' } : null;
  }
  return null;
}

export function planTicketCleanup(
  blobs: CleanupBlob[],
  opts: { now: number; ttlMs: number },
): CleanupPlan {
  const { now, ttlMs } = opts;

  // id별로 jpg/json/og(가로 OG 카드)를 모은다. 미인식 경로(t/ 밖, 확장자 불일치)는 후보에
  // 들어가지 않는다.
  const groups = new Map<string, { jpg?: CleanupBlob; json?: CleanupBlob; og?: CleanupBlob }>();
  let scanned = 0;
  for (const blob of blobs) {
    const parsed = parseTicketPath(blob.pathname);
    if (!parsed) continue;
    scanned += 1;
    const g = groups.get(parsed.id) ?? {};
    g[parsed.kind] = blob;
    groups.set(parsed.id, g);
  }

  const deletePathnames: string[] = [];
  let expiredGroups = 0;
  let orphanDeleted = 0;

  for (const g of Array.from(groups.values())) {
    const members = [g.jpg, g.json, g.og].filter(Boolean) as CleanupBlob[];
    // 그룹은 가장 최근 멤버가 TTL을 넘겼을 때만 만료시킨다(삭제 보수적 — 한쪽이라도 신선하면 유지).
    const newest = Math.max(...members.map((m) => new Date(m.uploadedAt).getTime()));
    if (now - newest <= ttlMs) continue; // 아직 유효 — 살아있는 공유 링크라 보존.

    // orphan 판정은 jpg+json 짝만 본다 — og.jpg는 발급 시점에 실패할 수 있는 부차 산출물이라
    // (t/[id].tsx가 없으면 원본으로 폴백) 있고 없음이 "이 티켓이 정상 그룹인가"를 바꾸지 않는다.
    const isOrphan = !(g.jpg && g.json);
    for (const m of members) deletePathnames.push(m.pathname);
    if (isOrphan) orphanDeleted += 1;
    else expiredGroups += 1;
  }

  return { deletePathnames, scanned, expiredGroups, orphanDeleted };
}
