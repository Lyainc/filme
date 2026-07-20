import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { list } from '@vercel/blob';
import { Wordmark } from '@/components/v2/Wordmark';
import { Eyebrow } from '@/components/v2/Eyebrow';
import { DEFAULT_TICKET_TTL_DAYS, UNOFFICIAL_TICKET_NOTICE } from '@/utils/ticketCleanup';
import { getLayout, LAYOUTS } from '@/utils/layouts';
import { buildShareMessage } from '@/utils/shareMessage';
import { OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '@/utils/ogImage';

interface TicketLandingProps {
  imageUrl: string;
  title: string;
  pageUrl: string;
  /** 히어로 img 고유 치수 — 비율 예약으로 CLS 방지(meta의 layout에서 도출, #199). */
  width: number;
  height: number;
  /** 카카오톡/SNS 카드용 가로 OG 이미지(#438, 발급 시점 정적 생성 t/{id}.og.jpg) — 없으면(레거시
   * 티켓) 세로 원본(imageUrl)으로 폴백하고 og:image:width/height도 그때만 싣는다. */
  ogImageUrl: string;
  ogDescription: string;
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
  let ogImageUrl = '';
  let title = '';
  let titleOg = '';
  let releaseDate = '';
  // 기본은 portrait(무드 4개 중 3개) — meta에 layout이 있으면 그 비율로 덮어쓴다.
  let { width, height } = getLayout('minimal');
  try {
    // jpg(원본) + json(메타) + og.jpg(가로 OG 카드, #438) 최대 3개.
    const { blobs } = await list({ prefix: `t/${id}`, limit: 3 });
    const jpg = blobs.find((b) => b.pathname === `t/${id}.jpg`);
    if (!jpg) return { notFound: true };
    imageUrl = jpg.url;
    // og.jpg는 발급 시점에 실패했을 수 있는 부차 산출물(t/[id] 랜딩은 항상 원본으로 폴백) —
    // 없는 레거시/실패 티켓도 여기서 그냥 imageUrl(세로)로 떨어진다.
    ogImageUrl = blobs.find((b) => b.pathname === `t/${id}.og.jpg`)?.url ?? jpg.url;

    const json = blobs.find((b) => b.pathname === `t/${id}.json`);
    if (json) {
      try {
        const meta = (await fetch(json.url).then((r) => r.json())) as {
          title?: unknown;
          titleOg?: unknown;
          releaseDate?: unknown;
          layout?: unknown;
        };
        if (typeof meta?.title === 'string') title = meta.title;
        if (typeof meta?.titleOg === 'string') titleOg = meta.titleOg;
        if (typeof meta?.releaseDate === 'string') releaseDate = meta.releaseDate;
        // 알 수 없는/이름이 바뀐 layout 값은 무시하고 portrait 기본값 유지 — getLayout은
        // 미지의 id를 minimal로 흡수하지만, 그건 landscape 티켓에 잘못된 비율을 줄 수 있다.
        const spec = LAYOUTS.find((l) => l.id === meta?.layout);
        if (spec) ({ width, height } = spec);
      } catch {
        // 메타 조회 실패는 치명적이지 않다 — 이미지로 링크는 동작하고 og:title만 기본값으로.
      }
    }
  } catch {
    // Blob 조회 실패(토큰 미설정·네트워크)는 404로 숨긴다 — throw해서 500을 띄우지 않는다.
    return { notFound: true };
  }

  // 공유 시트 문구와 같은 소스(buildShareMessage) — 제목·원제·연도를 한 목소리로 묶는다(#438).
  // 레거시 메타(titleOg·releaseDate 없음)엔 no-op이라 하위호환 안전.
  const ogDescription = buildShareMessage({ title, titleOg, releaseDate }).text;

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

  return { props: { imageUrl, title, pageUrl, width, height, ogImageUrl, ogDescription } };
};

export default function TicketLanding({ imageUrl, title, pageUrl, width, height, ogImageUrl, ogDescription }: TicketLandingProps) {
  const ogTitle = title ? `${title} · 포토티켓` : '포토티켓';
  // 가로 OG 카드(#438)가 있으면 1200×630, 없으면(레거시 티켓 og.jpg 미생성) 원본 세로 치수로
  // 폴백 — og:image가 실제로 가리키는 이미지와 항상 일치해야 크롤러 프리뷰가 안 어긋난다.
  const usingOgCard = ogImageUrl !== imageUrl;
  const ogImageWidth = usingOgCard ? OG_IMAGE_WIDTH : width;
  const ogImageHeight = usingOgCard ? OG_IMAGE_HEIGHT : height;

  return (
    <>
      <Head>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content={String(ogImageWidth)} />
        <meta property="og:image:height" content={String(ogImageHeight)} />
        <meta property="og:url" content={pageUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        <meta name="twitter:image" content={ogImageUrl} />
      </Head>

      {/* 메인 앱과 같은 브랜드 정체성 — app-canvas 노이즈 배경 + Sprocket·FILME 워드마크.
          단색 bg-surface 한 장이던 랜딩을 헤더·배경·티켓 위계로 끌어올려 "같은 서비스"
          인상을 만든다(#138 브랜딩). 라이트·다크는 _document themeScript가 html에 건
          .theme-dark를 그대로 상속하므로 토큰만 쓰면 양쪽에서 동작한다. */}
      <div className="app-canvas flex min-h-[100dvh] flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-line bg-surface px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="FILME 홈">
            <Wordmark />
          </Link>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-10 px-5 py-12">
          {/* heading 랜드마크 — 시각 워드마크는 홈 링크(nav)라 별도 sr-only h1로 페이지 주제를 노출(#199). */}
          <h1 className="sr-only">{ogTitle}</h1>
          {/* 그림자·perspective만으로 "프리미엄 티켓 한 장"의 물성을 표현한다(#389 — 기울임은
              브랜드 보이스인 정밀함과 불일치해 제거). */}
          <div className="w-full max-w-sm" style={{ perspective: '1200px' }}>
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

          <div className="flex flex-col items-center gap-3 text-center">
            <Eyebrow as="p" tone="faint">
              FILME · Photoplay Premium Ticket
            </Eyebrow>
            <p className="text-[14px] text-fg-muted">
              영화 포스터로 시네마틱한 포토티켓을, 너도 만들어봐.
            </p>
            <Link
              href="/"
              className="text-mono mt-1 inline-flex min-h-[48px] items-center justify-center rounded-field-sm bg-accent px-8 text-[12px] uppercase tracking-widest text-accent-ink transition-colors hover:bg-accent-hover"
            >
              나도 티켓 만들기 →
            </Link>
          </div>
        </main>

        {/* disclaimer(#179) — 공유 링크 수신자에게 만료·비공식·양도불가 고지(만료일 단일 출처).
            CTA 바로 아래의 눈에 띄는 위치는 긴급함을 만들어 브랜드 톤과 안 맞으므로 페이지
            최하단 저대비 캡션으로 내린다(#389). */}
        <footer className="shrink-0 px-5 pb-4 text-center">
          <p className="break-keep text-[11px] leading-snug text-fg-faint">
            이 링크는 {DEFAULT_TICKET_TTL_DAYS}일 후 만료돼요. {UNOFFICIAL_TICKET_NOTICE}
          </p>
        </footer>
      </div>
    </>
  );
}
