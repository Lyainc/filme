import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { list } from '@vercel/blob';
import { Sprocket } from '@/components/v2/Sprocket';
import { DEFAULT_TICKET_TTL_DAYS } from '@/utils/ticketCleanup';
import { getLayout } from '@/utils/layouts';
import type { LayoutId } from '@/types';

interface TicketLandingProps {
  imageUrl: string;
  title: string;
  pageUrl: string;
  /** 히어로 img 고유 치수 — 비율 예약으로 CLS 방지(meta의 layout에서 도출, #199). */
  width: number;
  height: number;
}

/**
 * 공유 퍼마링크 랜딩(#91 C2) — 레포 최초 SSR 페이지.
 *
 * 수신자가 링크를 열면 og:image가 붙은 미리보기를 보고 "나도 만들기"로 유입된다.
 * og는 SSR로만 채울 수 있어(크롤러는 JS 미실행) getServerSideProps가 필수다.
 * Blob public URL은 store suffix 때문에 id만으로 구성할 수 없어 list로 조회한다.
 */
export const getServerSideProps: GetServerSideProps<TicketLandingProps> = async ({
  params,
  req,
  res,
}) => {
  const id = typeof params?.id === 'string' ? params.id : '';
  if (!id) return { notFound: true };

  let imageUrl = '';
  let title = '';
  // 기본은 portrait(무드 4개 중 3개) — meta에 layout이 있으면 그 비율로 덮어쓴다.
  let { width, height } = getLayout('minimal');
  try {
    const { blobs } = await list({ prefix: `t/${id}`, limit: 2 });
    const jpg = blobs.find((b) => b.pathname === `t/${id}.jpg`);
    if (!jpg) return { notFound: true };
    imageUrl = jpg.url;

    const json = blobs.find((b) => b.pathname === `t/${id}.json`);
    if (json) {
      try {
        const meta = (await fetch(json.url).then((r) => r.json())) as {
          title?: unknown;
          layout?: unknown;
        };
        if (typeof meta?.title === 'string') title = meta.title;
        if (typeof meta?.layout === 'string') {
          ({ width, height } = getLayout(meta.layout as LayoutId));
        }
      } catch {
        // 메타 조회 실패는 치명적이지 않다 — 이미지로 링크는 동작하고 og:title만 기본값으로.
      }
    }
  } catch {
    // Blob 조회 실패(토큰 미설정·네트워크)는 404로 숨긴다 — throw해서 500을 띄우지 않는다.
    return { notFound: true };
  }

  // og:url·og:image는 절대 URL이어야 크롤러가 해석한다. imageUrl(blob)은 이미 절대 URL.
  // host 헤더가 비면(드물지만) 'https:///t/id' 같은 기형 URL이 나오므로 VERCEL_URL로 막는다.
  const hostHeader = req.headers.host ?? process.env.VERCEL_URL ?? 'localhost:3000';
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader)
    ? protoHeader[0]
    : protoHeader ?? (hostHeader.startsWith('localhost') ? 'http' : 'https');
  const pageUrl = `${proto}://${hostHeader}/t/${id}`;

  // 티켓은 발급 후 불변이라 SSR 결과를 엣지에 캐시한다(#194) — 같은 링크 반복 열람·크롤러
  // 언프롤이 CDN HIT로 빠져 per-view 함수 invocation과 list() advanced op를 없앤다. 성공
  // 경로에만 건다(404·일시 조회 실패는 캐시 안 함). s-maxage(1h) + SWR(1h)로, 만료 삭제된
  // 티켓이 캐시로 남는 최대 창을 ~2h로 제한한다(SWR 동안 스테일 서빙 후 revalidate가 404로
  // 갱신). SWR을 길게 두면 삭제 티켓이 그만큼 더 노출되므로 s-maxage와 같은 1h로 맞춘다.
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=3600, stale-while-revalidate=3600',
  );

  return { props: { imageUrl, title, pageUrl, width, height } };
};

export default function TicketLanding({ imageUrl, title, pageUrl, width, height }: TicketLandingProps) {
  const ogTitle = title ? `${title} · 포토티켓` : '포토티켓';
  // 메타 카피는 둘로 갈린다 — <title>·헤더는 정적이지만, og description은 수신자를
  // 후킹하는 바이럴 카피라 제목이 있으면 이름을 넣어 "너도 만들어봐"로 끌어당긴다(#138 2-1).
  const ogDescription = title
    ? `${title}, FILME로 만든 포토티켓이에요. 너도 만들어봐.`
    : 'FILME로 만든 포토티켓이에요. 너도 만들어봐.';

  return (
    <>
      <Head>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:url" content={pageUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        <meta name="twitter:image" content={imageUrl} />
      </Head>

      {/* 메인 앱과 같은 브랜드 정체성 — app-canvas 노이즈 배경 + Sprocket·FILME 워드마크.
          단색 bg-surface 한 장이던 랜딩을 헤더·배경·티켓 위계로 끌어올려 "같은 서비스"
          인상을 만든다(#138 브랜딩). 라이트·다크는 _document themeScript가 html에 건
          .theme-dark를 그대로 상속하므로 토큰만 쓰면 양쪽에서 동작한다. */}
      <div className="app-canvas flex min-h-[100dvh] flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-line bg-surface px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="FILME 홈">
            <Sprocket size={20} className="text-accent" />
            <span
              className="font-sans text-fg"
              style={{ fontSize: 19, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}
            >
              FILME
            </span>
          </Link>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-10 px-5 py-12">
          {/* heading 랜드마크 — 시각 워드마크는 홈 링크(nav)라 별도 sr-only h1로 페이지 주제를 노출(#199). */}
          <h1 className="sr-only">{ogTitle}</h1>
          {/* 미세 기울임 + 깊은 그림자로 "프리미엄 티켓 한 장" 느낌을 강조한다(평평한 img 탈피). */}
          <div className="w-full max-w-sm" style={{ perspective: '1200px' }}>
            <div
              className="rounded-card transition-transform duration-500 will-change-transform"
              style={{ transform: 'rotate(-1.4deg)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element — Blob 원격 도메인이라 일반 img 사용 */}
              <img
                src={imageUrl}
                alt={ogTitle}
                width={width}
                height={height}
                fetchPriority="high"
                className="h-auto w-full rounded-card border border-line shadow-pop"
              />
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-mono text-[10px] uppercase tracking-widest text-fg-faint">
              FILME · Photoplay Premium Ticket
            </p>
            <p className="text-[14px] text-fg-muted">
              영화 포스터로 시네마틱한 포토티켓을, 너도 만들어봐.
            </p>
            <Link
              href="/"
              className="text-mono mt-1 inline-flex min-h-[48px] items-center justify-center rounded-field-sm bg-accent px-8 text-[12px] uppercase tracking-widest text-white transition-colors hover:bg-accent-hover"
            >
              나도 티켓 만들기 →
            </Link>
            {/* disclaimer(#179) — 공유 링크 수신자에게 만료·비공식·양도불가 고지(만료일 단일 출처). */}
            <p className="mt-2 max-w-xs text-[11px] leading-snug text-fg-faint">
              이 링크는 {DEFAULT_TICKET_TTL_DAYS}일 후 만료돼요. 비공식 팬메이드 티켓이라 양도·재판매할 수 없어요.
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
