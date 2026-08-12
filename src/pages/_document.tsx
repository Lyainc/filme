import { Html, Head, Main, NextScript } from 'next/document';
import { STORAGE_KEY } from '@/hooks/usePhototicket';

/**
 * 첫 페인트 전에 서야 하는 판정 둘 — 테마(FOUC)와 draft 유무(#675).
 *
 * draft 축: 랜딩 표시 판정(`showLanding`)이 읽는 `photo.draftRestored`는 localStorage 복원
 * effect에서 서는데, 그 복원은 SSR 하이드레이션 불일치를 피하려 일부러 effect로 미룬 것이다.
 * 그래서 **서버 HTML은 항상 랜딩 오버레이를 담고**, 재방문자도 그게 페인트된 뒤 effect가 돌 때까지
 * 오버레이를 본다(실측 299ms). React 쪽을 앞당겨도 이미 그려진 SSR HTML은 못 막으므로, 판정을
 * 스크립트로 내려 `has-draft` 클래스로 표시하고 globals.css가 그 동안만 오버레이를 숨긴다.
 * 클래스를 거두는 건 그 명제가 실제로 뒤집힐 때뿐이다(usePhototicket: 저장분이 없거나 초기화).
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
