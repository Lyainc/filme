import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import localFont from 'next/font/local';
import { JetBrains_Mono, Instrument_Serif, Nunito } from 'next/font/google';

// 애널리틱스/텔레메트리는 사용자 인터랙션을 막지 않으므로 하이드레이션 후 로드한다.
// 정적 import 시 초기 번들을 블로킹하므로 next/dynamic({ ssr: false })로 지연(#153 ①).
const Analytics = dynamic(
  () => import('@vercel/analytics/next').then((m) => m.Analytics),
  { ssr: false },
);
const SpeedInsights = dynamic(
  () => import('@vercel/speed-insights/next').then((m) => m.SpeedInsights),
  { ssr: false },
);

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

// 티켓 장식 라벨용 디스플레이 세리프(#205). 자체 호스팅(next/font) → --font-display 노출.
// Instrument Serif는 weight 400만 존재. 한글 글리프 없음(장식 문구 전용, _shared FONT_DISPLAY 참고).
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: '400',
  style: ['normal', 'italic'],
});

// BI 마스터 v2 로고타입 전용 브랜드 타입(Nunito 900, TYPE 스펙) → --font-brand.
// 워드마크("fılme") 외 UI 텍스트에 쓰지 말 것 — 브랜드 아이덴티티 폰트다.
const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-brand',
  display: 'swap',
  weight: '900',
});

// Criterion 한줄평(#391) 한글 입력 전용 손글씨 폰트 → --font-quote-kr. "Shin Manager"(눈누,
// noonnu.cc/en/font_page/93) — 상업적 이용 무료, 웹폰트 임베딩 명시적 허용(재배포는 허용, 상업
// 재판매·폰트 파일 수정은 금지). CDN @import 대신 자체 호스팅(레포 컨벤션, Pretendard와 동일 패턴).
const shinManager = localFont({
  src: '../../public/fonts/ShinManager.woff',
  variable: '--font-quote-kr',
  display: 'swap',
  weight: '400',
});

// 35mm 필름 스트립 엣지 텍스트(#393) LCD/디지털 폰트 → --font-lcd. dafont.com digital-7은 상업
// 라이선스가 유료($24.95)라 배제하고, SIL Open Font License 1.1(상업 이용 무료)인 DSEG7-Classic-Bold
// (keshikan, github.com/keshikan/DSEG)로 자체 호스팅. 한글 글리프가 없어 유저 입력이 섞인 코드는
// containsHangul로 감지해 FONT_KR로 개별 폴백한다(`_shared.tsx` FONT_LCD·FilmStripBand 참고).
const dseg7 = localFont({
  src: '../../public/fonts/DSEG7Classic-Bold.woff2',
  variable: '--font-lcd',
  display: 'swap',
  weight: '700',
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>FILME</title>
        <meta name="description" content="영화 포스터로 시네마틱한 포토티켓을 만드세요." />
      </Head>
      <main
        className={`${pretendard.variable} ${jetBrainsMono.variable} ${instrumentSerif.variable} ${nunito.variable} ${shinManager.variable} ${dseg7.variable} font-sans bg-bg text-fg min-h-dvh antialiased`}
      >
        <Component {...pageProps} />
      </main>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
