import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Phototicket Maker — Editorial Edition</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="description" content="영화 포스터로 시네마틱한 포토티켓을 만드세요." />
        <meta name="theme-color" content="#0E0E10" />
      </Head>
      <main className="font-sans bg-ink text-bone min-h-screen antialiased">
        <Component {...pageProps} />
      </main>
    </>
  );
}
