import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import localFont from 'next/font/local';
import { JetBrains_Mono, Oswald } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const pretendard = localFont({
  src: '../../public/fonts/PretendardVariable.woff2',
  variable: '--font-sans',
  display: 'swap',
  weight: '45 920', // Pretendard Variable wght axis range
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
});

// 디스플레이 폰트 — 워드마크/헤딩 전용(라틴). 한글은 Tailwind fontFamily.display
// 스택의 Pretendard 폴백으로 per-glyph 렌더되므로 토푸 없음. self-host(next/font).
const oswald = Oswald({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['500', '600', '700'],
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Phototicket Maker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="description" content="영화 포스터로 시네마틱한 포토티켓을 만드세요." />
      </Head>
      <main
        className={`${pretendard.variable} ${jetBrainsMono.variable} ${oswald.variable} font-sans bg-bg text-fg min-h-screen antialiased`}
      >
        <Component {...pageProps} />
      </main>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
