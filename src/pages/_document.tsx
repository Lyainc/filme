import { Html, Head, Main, NextScript } from 'next/document';

const themeScript = `
(function(){try{
  const t=localStorage.getItem('phototicket:theme');
  const dark=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  if(dark)document.documentElement.classList.add('theme-dark');
  var m=document.querySelector('meta[name="theme-color"]');
  if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m);}
  m.setAttribute('content',dark?'#0E1012':'#F4F5F7');
}catch(e){}}());
`.trim();

export default function Document() {
  return (
    <Html lang="ko">
      <Head>
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
