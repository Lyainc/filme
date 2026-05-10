import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import localFont from 'next/font/local';
import { JetBrains_Mono } from 'next/font/google';

const pretendard = localFont({
  src: '../../public/fonts/PretendardVariable.woff2',
  variable: '--font-sans',
  display: 'swap',
  weight: '45 920',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Phototicket Maker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="description" content="영화 포스터로 시네마틱한 포토티켓을 만드세요." />
        <meta name="theme-color" content="#F8F5EE" />
      </Head>
      <main
        className={`${pretendard.variable} ${jetBrainsMono.variable} font-sans bg-bg text-fg min-h-screen antialiased`}
      >
        <Component {...pageProps} />
      </main>
    </>
  );
}
