import type { NextApiRequest, NextApiResponse } from 'next';
import { list, del } from '@vercel/blob';
import { planTicketCleanup, type CleanupBlob } from '@/utils/ticketCleanup';

/**
 * 만료·orphan 티켓 Blob 정리 cron(#121 C3).
 *
 * Vercel Cron이 매일 GET으로 호출한다(vercel.json crons). uploadedAt(=메타 createdAt과 같은 put
 * 순간 값)이 TTL을 지난 `t/<id>.{jpg,json}`을 일괄 삭제하고, 메타 없는 orphan 이미지도 같은 TTL
 * 기준으로 흡수한다. @vercel/blob `list`/`del`을 직접 쓴다(추상화 레이어 신설 금지, #121).
 *
 * 보안: CRON_SECRET 필수. Vercel Cron은 `Authorization: Bearer <CRON_SECRET>`를 자동 첨부하고,
 * 외부 임의 호출은 이 헤더가 없어 401로 막힌다. CRON_SECRET 미설정 시엔 엔드포인트를 열어두지
 * 않고 503으로 닫는다(fail-closed). **절대 throw하지 않는다** — 모든 실패를 status + { error }로.
 *
 * 검증: `?dryRun=1`이면 삭제하지 않고 대상만 집계해 돌려준다(비가역 삭제 전 prod blob 확인용).
 */
export const config = { maxDuration: 60 };

const DEFAULT_TTL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEL_BATCH = 1000; // @vercel/blob del 1회 호출 상한.

/** TTL(ms). TICKET_TTL_DAYS env override, 기본 30일. 양수 유한값이 아니면 기본값으로 폴백. */
function ttlMs(): number {
  const raw = Number(process.env.TICKET_TTL_DAYS);
  const days = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_DAYS;
  return days * DAY_MS;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 인증: CRON_SECRET 미설정이면 열어두지 않고 닫는다(fail-closed).
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'Cron is not configured' });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Blob storage is not configured' });
  }

  // dryRun은 비가역 삭제 전 안전 점검용이라, 모호하면(배열 쿼리 등) dry-run 쪽으로 기운다.
  const dryRunRaw = Array.isArray(req.query.dryRun) ? req.query.dryRun[0] : req.query.dryRun;
  const dryRun = dryRunRaw === '1' || dryRunRaw === 'true';

  try {
    // 1) t/ prefix 전수 조회(cursor 페이지네이션). uploadedAt까지 list 한 번으로 확보.
    const all: CleanupBlob[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: 't/', cursor, limit: 1000 });
      for (const b of page.blobs) {
        all.push({ pathname: b.pathname, uploadedAt: b.uploadedAt });
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    // 2) TTL·orphan 판정(순수 함수). now는 라우트에서 한 번만 찍어 일관 비교.
    const plan = planTicketCleanup(all, { now: Date.now(), ttlMs: ttlMs() });

    // 3) del은 pathname을 직접 받는다(ticket.ts가 addRandomSuffix:false라 pathname이 결정적) —
    //    url 역참조 없이 바로 삭제. @vercel/blob del 1회 상한(1000)에 맞춰 배치.
    const pathnames = plan.deletePathnames;
    if (!dryRun && pathnames.length > 0) {
      for (let i = 0; i < pathnames.length; i += DEL_BATCH) {
        await del(pathnames.slice(i, i + DEL_BATCH));
      }
    }

    return res.status(200).json({
      dryRun,
      scanned: plan.scanned,
      expiredGroups: plan.expiredGroups,
      orphanDeleted: plan.orphanDeleted,
      candidates: pathnames.length,
      deleted: dryRun ? 0 : pathnames.length,
    });
  } catch (err) {
    console.error('[api/cron/cleanup-tickets] failed:', err);
    return res.status(500).json({ error: 'Cleanup failed' });
  }
}
