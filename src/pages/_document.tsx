import { Html, Head, Main, NextScript } from 'next/document';
import { STORAGE_KEY } from '@/hooks/usePhototicket';

/**
 * 첫 페인트 전에 서야 하는 판정 둘 — 테마(FOUC)와 draft 유무(#675).
 *
 * draft 축(#675 → #727 c9로 의미가 뒤집혔다): 이 스탬프가 예전엔 "랜딩 오버레이를 숨긴다"였는데,
 * #727이 "draft가 있으면 랜딩을 생략한다"는 D7 자체를 뒤집었으므로 지금은 **복원 진입점
 * ("이어서 만들기")을 첫 페인트에 드러낸다**. 행의 표시 근거인 draft 복원은 SSR 하이드레이션
 * 불일치를 피하려 일부러 effect로 미룬 것이라, React로 그리면 재방문자는 행이 없는 랜딩을 먼저
 * 보고 299ms 뒤 행이 끼어들며 주 CTA가 아래로 밀린다(실측) — 그만큼이면 이미 탭할 수 있는
 * 시간이라 오탭이 난다. 서버 HTML에 행을 담아두고 이 클래스로 드러내면 자리 이동이 0이다.
 * 클래스를 거두는 건 그 명제가 실제로 뒤집힐 때뿐이다(usePhototicket: 저장분이 없거나 손상, 초기화).
 */
export const themeScript = `
(function(){try{
  const t=localStorage.getItem('phototicket:theme');
  const dark=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  if(dark)document.documentElement.classList.add('theme-dark');
  var m=document.querySelector('meta[name="theme-color"]');
  if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m);}
  m.setAttribute('content',dark?'#0E1012':'#F4F5F7');
  if(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}))document.documentElement.classList.add('has-draft');
}catch(e){}}());
`.trim();

export default function Document() {
  return (
    <Html lang="ko">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#F4F5F7" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
