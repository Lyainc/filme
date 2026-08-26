import '@/styles/globals.css';
import 'react-image-crop/dist/ReactCrop.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import localFont from 'next/font/local';
import { JetBrains_Mono, Instrument_Serif, Nunito, Share_Tech_Mono, Nanum_Brush_Script } from 'next/font/google';

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
// #439 실기기 진단용 — ?debug=1 없으면 렌더 자체가 no-op(DebugConsole 내부 가드).
const DebugConsole = dynamic(() => import('@/components/DebugConsole'), { ssr: false });

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

// Criterion 한줄평(#391) 한글 입력 전용 손글씨 폰트 → --font-quote-kr. "아이스자람체"(인천교육서체,
// 눈누 noonnu.cc) — 상업적 이용 무료, 웹폰트 임베딩 명시적 허용. Shin Manager에서 교체(#423).
// CDN @import 대신 자체 호스팅(레포 컨벤션, Pretendard와 동일 패턴). 전체 완성형 한글(11172자) 커버라
// 3.6MB — 서명·한줄평은 유저 자유 입력이라 글리프 누락 위험 없이 서브셋하기 어렵다(claude-review PR
// #427 P1). 대신 preload:false — Criterion 무드에서 한글 입력이 실제로 있을 때만 지연 로드되고,
// _app.tsx 루트 선언이어도 다른 무드·페이지에서는 강제 preload로 매 로드마다 injection되지 않는다.
const iceJaram = localFont({
  src: '../../public/fonts/IceJaram-Rg.woff2',
  variable: '--font-quote-kr',
  display: 'swap',
  weight: '400',
  preload: false,
});

// ── 한줄평·서명 사용자 선택 폰트 6종(#437) ──────────────────────────────────────
// QuoteFont 9택 중 batang·ink·eunyoung·brush·coolguy·flower가 여기서 온다(나머지 셋은
// auto 자동분기 + gothic=pretendard + hand=iceJaram으로 이미 위에 있다). 라이선스·출처·
// 지켜야 할 조항은 public/fonts/LICENSES.md — 특히 KCC은영체는 CCL 저작자표시라 AppFooter가
// 크레딧을 상시 표기하고, 잉크립퀴드체는 장평·기울기 변형이 금지다.
//
// 전부 preload:false — 6종을 다 preload하면 첫 로드가 4MB 넘게 불어난다. iceJaram(#427 P1)과
// 같은 처방으로, 사용자가 그 폰트를 실제로 고를 때만 지연 로드된다. 완성형 한글 전체를 담아
// 서브셋이 불가능한 부류라(서명·한줄평은 자유 입력이라 글리프 누락 위험이 있다) 파일이 큰 건
// 구조적이고, 대신 안 고른 사용자는 한 바이트도 안 받는다.
const gyeonggiBatang = localFont({
  src: '../../public/fonts/GyeonggiBatang-Regular.woff',
  variable: '--font-batang',
  display: 'swap',
  weight: '400',
  preload: false,
});

const inkLipquid = localFont({
  src: '../../public/fonts/InkLipquid.woff',
  variable: '--font-ink',
  display: 'swap',
  weight: '400',
  preload: false,
});

const kccEunyoung = localFont({
  src: '../../public/fonts/KCC-eunyoung-Regular.woff',
  variable: '--font-eunyoung',
  display: 'swap',
  weight: '400',
  preload: false,
});

const coolGuy = localFont({
  src: '../../public/fonts/CoolGuy-Medium.woff2',
  variable: '--font-coolguy',
  display: 'swap',
  weight: '400',
  preload: false,
});

// 꽃길만 완성형 전체(11172자)가 아니라 KS X 1001 상용 2352자다 — `뷁`·`쀓` 같은 비상용
// 음절엔 글리프가 없다. 그래서 _shared.tsx의 FONT_FLOWER 스택이 FONT_KR을 뒤에 붙여
// 없는 글자만 브라우저가 자동으로 폴백하게 한다(글리프 단위 폴백은 CSS 기본 동작).
const sangSangFlowerRoad = localFont({
  src: '../../public/fonts/SangSangFlowerRoad.woff',
  variable: '--font-flower',
  display: 'swap',
  weight: '400',
  preload: false,
});

// 나눔손글씨붓(네이버, 눈누 43)만 파일을 안 받는다 — Google Fonts에 있고 한글이 unicode-range
// 92슬라이스로 쪼개져 있어, next/font가 자체 호스팅하되 브라우저는 실제로 쓰는 슬라이스만
// 받는다(3MB 통짜 파일보다 나은 유일한 경우). subsets를 안 주는 건 preload:false라 preload할
// 대상이 없어서고, 한글은 subsets와 무관하게 unicode-range로 딸려온다.
const nanumBrush = Nanum_Brush_Script({
  variable: '--font-brush',
  display: 'swap',
  weight: '400',
  preload: false,
});

// 35mm 필름 스트립 엣지 텍스트(#443) 기술 모노 폰트 → --font-lcd. 이전 DSEG7-Classic-Bold(7-세그먼트
// LCD/전자시계 디스플레이 폰트)는 아날로그 필름 엣지 인쇄 톤과 맞지 않아(#443) Share Tech Mono(OFL,
// Google Fonts)로 교체 — weight 400 단일. 한글 글리프가 없어 유저 입력이 섞인 코드는 containsHangul로
// 감지해 FONT_KR로 개별 폴백한다(`_shared.tsx` FONT_LCD·FilmStripBand 참고).
const shareTechMono = Share_Tech_Mono({
  subsets: ['latin'],
  variable: '--font-lcd',
  display: 'swap',
  weight: '400',
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>FILME</title>
        <meta name="description" content="영화 포스터로 시네마틱한 포토티켓을 만드세요." />
      </Head>
      <main
        className={`${pretendard.variable} ${jetBrainsMono.variable} ${instrumentSerif.variable} ${nunito.variable} ${iceJaram.variable} ${shareTechMono.variable} ${gyeonggiBatang.variable} ${inkLipquid.variable} ${kccEunyoung.variable} ${coolGuy.variable} ${sangSangFlowerRoad.variable} ${nanumBrush.variable} font-sans bg-bg text-fg min-h-dvh antialiased`}
      >
        <Component {...pageProps} />
      </main>
      <Analytics />
      <SpeedInsights />
      <DebugConsole />
    </>
  );
}
