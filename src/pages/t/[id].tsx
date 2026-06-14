import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { list } from '@vercel/blob';

interface TicketLandingProps {
  imageUrl: string;
  title: string;
  pageUrl: string;
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
}) => {
  const id = typeof params?.id === 'string' ? params.id : '';
  if (!id) return { notFound: true };

  let imageUrl = '';
  let title = '';
  try {
    const { blobs } = await list({ prefix: `t/${id}`, limit: 2 });
    const jpg = blobs.find((b) => b.pathname === `t/${id}.jpg`);
    if (!jpg) return { notFound: true };
    imageUrl = jpg.url;

    const json = blobs.find((b) => b.pathname === `t/${id}.json`);
    if (json) {
      try {
        const meta = (await fetch(json.url).then((r) => r.json())) as { title?: unknown };
        if (typeof meta?.title === 'string') title = meta.title;
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

  return { props: { imageUrl, title, pageUrl } };
};

export default function TicketLanding({ imageUrl, title, pageUrl }: TicketLandingProps) {
  const ogTitle = title ? `${title} · 포토티켓` : '포토티켓';
  const description = '나만의 CGV Photoplay 프리미엄 티켓을 만들어보세요.';

  return (
    <>
      <Head>
        <title>{ogTitle}</title>
        <meta name="description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:url" content={pageUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={imageUrl} />
      </Head>

      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-surface px-5 py-12">
        <div className="w-full max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element — Blob 원격 도메인이라 일반 img 사용 */}
          <img
            src={imageUrl}
            alt={ogTitle}
            className="w-full rounded-card border border-line shadow-card"
          />
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-[13px] text-fg-muted">마음에 드나요? 직접 만들 수도 있어요.</p>
          <Link
            href="/"
            className="text-mono inline-flex min-h-[48px] items-center justify-center rounded-field-sm bg-accent px-8 text-[12px] uppercase tracking-widest text-white transition-colors hover:bg-accent-hover"
          >
            나도 만들기
          </Link>
        </div>
      </main>
    </>
  );
}
