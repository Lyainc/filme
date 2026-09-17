# 랜딩 히어로 에셋

랜딩(#612 → #613 → #615)에서 쓰는 이미지 자산 폴더.

## 현재 상태

전경 무드 5장(`hero-{minimal,criterion,35mm,editorial,stub}.webp`)이 있다(#613, 2026-09-05,
콘택트 시트 검토 완료본을 그대로 저장) — `Landing.tsx`의 `MoodCarousel`이 이 자산을 쓰고, 라이브
`TicketRenderer` 렌더는 걷혔다. `hero-35mm-wide.webp`도 같이 저장돼 있지만 갤러리는 안 쓴다 —
같은 필름 계열인 `35mm`가 이미 줄에 있어 빼도 표현이 안 사라진다는 `GALLERY_LAYOUTS`의 제외
사유가 정적 자산으로 바뀐 뒤에도 그대로 적용된다.

`og.jpg`는 홈 링크 공유용 1200×630 JPEG(70,739 bytes, 예산 150 KiB)다. 기존 창작 포스터의
`hero-35mm-wide.webp`를 참고해 AI로 만든 FILME 소개 카드이며, 실제 export를 캡처한 파일은
아니다. `src/pages/index.tsx`의 OG·Twitter 메타데이터가 사용한다. 홈 방문 시 이미지 본문을
로드하지 않으므로 히어로 초기 전송량에는 더해지지 않는다.

배경 타일 그리드는 자산이 아니라 라이브 렌더다 — `Landing.tsx`의 `LandingBackdropTiles`가
`MOOD_BACKDROP_BG` 색면을 회전 타일 15장으로 그린다(원본 포스터가 아닌 색면이라 D5 원본 식별
불가를 그 자체로 만족). 자산이 오기를 기다리는 placeholder가 아니라 이게 완성형이다.
`scripts/measure-chrome.mjs`의 `backdrop` 축이 그 레이어의 프레임 봉쇄(레이어가 프레임 사각형과
같고, 오버사이즈 그리드를 `overflow:hidden`으로 자른다)를 매 실행 대조한다.

**한때 이 폴더에 `backdrop-tiles.webp`(같은 그리드를 `scripts/bake-landing-backdrop.mjs`로 구운
정적 시트)가 있었지만 뺐다** — 소비처가 0인 채로 번들에만 남아 있었고(코드는 계속 라이브 div를
그렸다), 수동 번들이라 `LAYOUTS`/`MOOD_BACKDROP_BG`가 바뀌면 조용히 stale해지는데, 정작 대체
대상인 타일 div는 전부 CSS 그라디언트라 아낄 비용이 없었다. 원리적으로 못 쓸 자산이어서가 아니라
값어치가 없어서 뺀 것이다 — **다시 구워 번들하자는 제안이 오면 소비처가 생기는지부터 볼 것.**

되살릴 거면: `MOOD_BACKDROP_BG`는 하드코딩 색이라 테마와 무관하고, 그 레이어의 유일한 테마
의존은 `opacity-[0.09]`가 아래 `bg-bg`와 합성되는 것뿐이다. 옛 스크립트는 그 합성을 이미 마친
불투명 스크린샷을 떠서 한 테마에 굳었던 거라, `omitBackground`로 알파를 살려 구우면 브라우저가
같은 합성을 테마별로 해준다 — 한 장으로도 된다.

## 갱신 조건

**무드 조판·색·스탬프를 바꾸는 PR에서 `hero-*.webp` 6장을 같이 다시 구워 갱신한다.** 수동
번들이라 자산이 코드(`LAYOUTS`·무드 컴포넌트)와 어긋나도 아무도 안 잡아준다 — 라이브 렌더였던
예전과 달리 이 파일들은 무드가 바뀌어도 조용히 옛 렌더를 그린 채 남는다.

35mm Wide의 조판·포스터 또는 브랜드 표현을 바꾸면 `og.jpg`도 갱신한다. 새 카드도 1200×630,
JPEG, 150 KiB 이하를 유지한다(`landingOgMetadata.test.ts`가 치수·포맷·용량을 확인한다).
