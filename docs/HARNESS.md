# 크롬 측정 하네스 (400×675) — 사용법·실측·근거

`CLAUDE.md`의 "📏 크롬 측정 하네스" 절이 들고 있던 **실측 기록과 근거**를 옮겨 온 문서다. CLAUDE.md는 "언제 돌리고 어떤 불변식이 게이트인가"만 규칙으로 쥐고, 숫자·파괴 실험·삽질 이력은 여기에 산다. 하네스 숫자나 축을 건드리기 전에 읽는다.

> 이 문서는 **헤드리스 Chrome 하네스**(`scripts/measure-*.mjs`, `scripts/capture-export.mjs`)의 문서다. 사람 눈·실기기 축(Aside, iOS Simulator)은 `docs/user-testing/README.md`의 "검증 도구" 절을 본다. Aside는 이 하네스를 대체하지 않는다.

목차

1. 스크립트 3종과 역할
2. `capture-export.mjs` — 저장물 픽셀 측정 (#506)
3. `measure-font-metrics.mjs` — 폰트 체감 크기 (#437)
4. `measure-chrome.mjs` — dock·프리뷰·모달·레일 슬롯
5. 기준선과 레일 슬롯 높이의 종속 (#707·#714)
6. 러너(`chrome-harness.yml`)와 로컬의 일치
7. 대조 기준은 `#phone-frame` rect (#609)
8. stale 서버 함정 (#601)
9. 워크트리에서 dev 띄우기 (#708)
10. 프레임 봉쇄 축과 `backdrop` (#609·#786)
11. `landingShownOnDraft`·`posterless` 축과 파괴 실험 (#727·#674)

---

## 1. 스크립트 3종과 역할

| 스크립트 | 무엇을 재나 |
|---|---|
| `scripts/capture-export.mjs` | export JPEG(저장물)의 픽셀. 후가공(재질·코팅·강도) 전/후 비교 |
| `scripts/measure-font-metrics.mjs` | 한줄평·서명 폰트 9택의 체감 크기(캔버스 잉크 박스) |
| `scripts/measure-chrome.mjs` | dock·프리뷰 rect, 레일 슬롯 넘침, 항목별 WCAG 대비, 모달 포커스/닫기/클릭통과, 프레임 봉쇄, 랜딩·posterless 축 |

`scripts/measure-chrome.mjs`는 `bun scripts/measure-chrome.mjs --theme dark|light`로 돌린다. **세션 tmp에 다시 쓰지 말 것**(#586, 여섯 번 반복됨).

## 2. `capture-export.mjs` — 저장물 픽셀 측정 (#506)

저장물(export JPEG)을 픽셀로 재려면 이 스크립트다. `--material/--coating/--intensity/--out`으로 후가공 저장물을 파일로 떨어뜨리고, `--compare a.jpg b.jpg [--diff-out d.png]`가 채널 최대 절대차·넘침 bbox·×20 증폭 diff를 낸다(디코더는 Chrome 자신 = 새 의존성 0). 하네스 잡음 바닥은 같은 트리 2회 캡처 기준 maxΔ 2라 허용치는 3.

### Stub 무드는 dev 서버에서 이 바닥을 벗어난 사례가 있다 (#751)

2026-08-31 #751 재검증(port 3021, dev): 같은 HEAD를 두 번 캡처해도 maxΔ 9·pixelsOver3 907(1.49%, 상단 텍스처대 국한)이 재현됐고, before/after diff와 after/after(자기 자신 재캡처) diff가 수치까지 완전히 같아 코드 변화 탓이 아님은 확인했다.

다만 같은 날 별도 세션이 **prod 서버**(`bun run build && next start`, port 3010)로 3회 재캡처했을 땐 페어별 maxAbsDiff가 0/2/2로 전부 tolerance 3 이내였다. 그러니 이건 Stub 무드 자체의 구조적 잡음 바닥이 아니라 **dev 서버 특유의 타이밍 변동일 가능성이 높다**(둘 다 n이 작아 단정은 이르다).

운용 규칙: Stub의 회귀 여부를 픽셀 diff로 볼 땐 **prod로 재는 게 안전**하고, dev로 잴 땐 raw fail이 나와도 곧바로 회귀로 보지 말고 같은 코드 재캡처로 통제군부터 잡는다.

### 헤드리스에서 '사진에 저장'이 안 끝나는 건 앱 버그가 아니다

macOS 헤드리스 Chrome이 `navigator.canShare({files})`에 **true**를 줘서 `ResultPanel`이 `shareTicketAsJpeg` 경로를 타는데, OS 공유 시트가 못 뜨니 `navigator.share`의 Promise가 영영 settle하지 않아 CTA가 "저장 중..."에 묶인다. 캡처는 그 전에 이미 끝나 있다(`?debug=1` 로그 `[capture:main] out=…`이 t<3s).

그래서 이 하네스는 `canShare`를 false로 스텁해 다운로드 경로로 떨어뜨리고, 이미 있던 `capture-debug-result` 이벤트로 바이트를 회수한다. **Web Share 게이트를 타는 흐름을 헤드리스로 재는 새 스크립트는 전부 같은 스텁이 필요하다.**

### bun에선 `await browser.close()`가 resolve하지 않는다

Chrome은 죽는데 프로세스가 7분 넘게 매달렸다. 닫기는 3초 race로 감싸고 끝에 `process.exit(0)`를 둔다. 안 그러면 배치 루프가 매 실행 타임아웃을 기다린다.

## 3. `measure-font-metrics.mjs` — 폰트 체감 크기 (#437)

`bun scripts/measure-font-metrics.mjs --url http://localhost:3010/`. **폰트를 더하거나 갈아치우면 다시 돌려 `_shared.tsx`의 `HANGUL_SIZE_SCALE`·`LATIN_SIZE_SCALE`과 `__tests__/userTextFontOptions.ts`를 둘 다 갱신한다** — 두 자리가 갈리면 테스트가 옛 배율을 잠근 채 통과한다.

### OS/2의 sxHeight·sCapHeight를 쓰지 않는 이유

잉크립퀴드체·KCC은영체는 둘 다 **0**이고(제작사 미기입) 꽃길은 x와 cap이 500으로 같다. 제작사가 안 채운 값이라 신뢰할 수 없다. 그리고 애초에 **한글은 라틴 x-height가 체감 크기를 대표하지 않는다**: 한글 음절은 em 사각형을 채우는 글자면이라, 같은 fontSize에서 커 보이는 건 그 글자면이 em의 몇 %를 쓰느냐다. 그래서 캔버스 잉크 박스(`actualBoundingBox*`)로 대표 음절 10자의 세로 높이를 재고, **라틴도 cap-height 하나가 아니라** 어센더~디센더가 다 걸리는 10자 평균으로 잰다(나눔손글씨붓은 cap 96.4로 작은 대신 디센더가 길어, cap만 보면 1.5배로 잘못 키운다).

### 기준이 축마다 다른 이유

`auto`의 도착지가 달라서다. 한글은 `hand`(아이스자람체), 라틴은 Instrument Serif가 1.000이다. 그래야 기존 저장본의 렌더가 안 변한다. **확대만 1.25에서 자른다**(hand·brush·flower의 라틴이 원시 1.252·1.353·1.468로 걸렸다): 줄이는 쪽은 텍스트 예산을 안 깨지만 키우는 쪽은 깬다.

### 실측값

2026-08-26 실측(em 200, 세로 잉크 높이) — 한글 `hand 139.84 · eunyoung 148.32 · flower 152.34 · coolguy 154.60 · ink 154.92 · brush 157.08 · gothic 166.93 · batang 184.68`.

폰트 하나라도 못 받으면 exit 1이다(폴백으로 잰 숫자를 실측이라고 커밋하는 게 이 스크립트의 유일한 조용한 실패).

## 4. `measure-chrome.mjs` — dock·프리뷰·모달·레일 슬롯

dock·프리뷰 rect, 레일 슬롯 넘침, 항목별 WCAG 대비, 모달 포커스/닫기/클릭통과를 한 번에 잰다. **레일 슬롯을 열고 재는 게 전제**다 — 불변식 dock 290 / 프리뷰 190.9×305는 열린 상태 기준이고, 안 열면 dock 114.5가 나오는데 스크립트는 조용히 성공한다.

### "잰다"와 "게이트에 실린다"는 다르다 (#714)

새 축을 넣으면 종료 조건에도 넣었는지 확인한다. 모달 축은 #609부터 재고 출력만 하고 `process.exitCode`엔 안 실려 있었다: `AdvancedSettingsModal`의 Escape 닫기를 실제로 없애면 `close.escape:false` + `focusRestoredToTrigger:false`가 뜨는데도 스크립트가 **exit 0**을 냈다(2026-08-16 실측). 지금은 `modal.pass`로 게이트에 실려 같은 파괴에 exit 1이 난다. `present:false`(= '고급 설정' 진입 버튼 소실)도 실패로 친다 — 진입점이 사라진 걸 "모달 없는 판본"으로 관용하면 그게 `checked:false`를 통과로 넘기던 #609의 조용한 성공과 같은 구멍이다.

### `bannerToastCollision` (#731·#737)

OCR 되돌리기 배너와 전역 토스트가 동시에 뜰 때 겹치는지 잰다. 토스트 `bottom-28`(112px)은 손계산이었는데 실측으로 확인됨(2026-08-20, dark) — banner top 595.5 / toast bottom 563, gap 32.5px. `bottom-6` 고정으로 되돌리면 toast bottom 651 > banner top 595.5(gap −55.5)로 겹쳐 `pass:false`·exit 1.

### `railSlot`은 게이트가 아니라 관측값이고, 그게 맞다

#682가 크기 패널의 잔여 상태(재크롭 직후 채우기 칩 노출)는 슬롯을 +8px 넘치도록 **일부러** 뒀고, #781이 크기→로고의 빈 상태(+59px)·숨김 상태(+28px, 393×659 기준)를 더했으므로(`DesignRail.tsx` 슬롯 주석 참고) `overflows:false`를 불변식으로 걸면 의도된 설계를 회귀로 신고한다. 출력만 보고 사람이 판단할 값이다. (같이 넘치던 형압 패널의 +6px 상태는 #785에서 기능째 삭제됐다.)

**커스텀(폰트) 패널은 잔여 상태가 아니라 정상 상태에서도 넘치고, #797이 그걸 스크롤로 인정했다.** 피커 하나가 217px(320 폭 305px)라 슬롯에 안 들어가고, 피커가 둘인 Criterion은 축 전환으로 263px(320 폭 351px)까지 줄였다. `--rail custom`을 기본 무드(minimal)로 재면 `217/176`이 나오는 게 정상이다. Criterion은 `--mood criterion --rail custom`으로 재고(시드 draft의 무드를 바꾼다) 400×675에서 `263/176`이다(2026-10-10 prod 재실측, 320·375·393·414 × 다크·라이트 동일 콘텐츠 높이).

## 5. 기준선과 레일 슬롯 높이의 종속 (#707·#714)

dock 290 / 프리뷰 190.9×305, 이 세 숫자는 **레일 상세 슬롯 높이에 종속**이다. 슬롯이 커진 만큼 dock이 그대로 커지고, dock이 먹은 만큼 fit 스테이지(#366)가 줄어 프리뷰가 따라 내려간다:

| 시점 | 슬롯 | dock | 프리뷰 |
|---|---|---|---|
| #563 | `h-[118px]`(118.0) | 232.6 | 226.8×362.3 |
| #682 | `h-[min(214px,26svh)]`(175.5) | **290** | **190.9×305** |

2026-08-16 실측, `232.6 − 118.0 + 175.5 = 290.1`. #682가 슬롯만 바꾸고 불변식을 안 고쳐서 main이 건강한데도 두 주 넘게 항상 exit 1이었다. 운용 규칙: **`DesignRail.tsx`의 슬롯 높이를 건드리면 스크립트 `BASELINE`과 CLAUDE.md의 해당 줄을 같이 다시 잰다.**

### 이 결합은 주석이 아니라 테스트가 잠근다 (#714)

하네스는 브라우저가 필요해 `ci.yml`에 결선돼 있지 않으니, 결합만이라도 `bun test`(= required check)로 내렸다. `scripts/measure-chrome.mjs`의 `BASELINE_SLOT_HEIGHT_CLASS`가 `DesignRail.tsx`의 슬롯 클래스와 문자로 어긋나면 `__tests__/measureChromeBaselineCoupling.test.ts`가 깨져 **머지 전에** "다시 재라"가 뜬다. 숫자로 환산해 비교하지 않는 건 `min(214px,26svh)`가 뷰포트에 따라 어느 쪽이 이기는지 갈리기 때문이고, 잠그려는 건 계산 결과가 아니라 선언이 바뀌었다는 사실이다. 이 테스트가 하네스를 대신하진 않는다 — 다시 재라고 말할 뿐이다.

## 6. 러너(`chrome-harness.yml`)와 로컬의 일치

`.github/workflows/chrome-harness.yml`이 매 push마다 `bun run build` → `next start` → `--theme dark`·`--theme light`를 돌린다. **required가 아니다** — 브라우저·서버·타이밍이 끼어 실패 성격이 `ci.yml`과 다르고, 그 잡음이 required를 흔들면 안 된다(#593의 두 축 분리와 같은 자세, `docs/CONTRIBUTING.md` "리뷰 게이트"). 5절의 결합 테스트는 그대로 둔다: 저건 required 안에서 "다시 재라"를 머지 전에 띄우고, 이건 실제로 잰다.

- **ubuntu 러너와 macOS 로컬이 같은 px를 낸다**(2026-08-16 실측): dock 290 / 프리뷰 190.9×305 / posterless 300.7×480.5로 소수점까지 일치하고 `checked:true`. **그러니 러너에서만 나는 하네스 실패를 "플랫폼 차이"로 접지 말 것** — 같은 값이 나오는 게 확인된 축이라, 값이 갈리면 그건 진짜 회귀이거나 서버가 stale한 것이다(#601). job 전체가 66초라 빌드 포함해도 부담이 아니다.
- `CHROME_PATH=/usr/bin/google-chrome`이 필요하다 — 스크립트 기본값이 macOS 경로라 안 주면 러너에서 못 찾는다. prod로 재는 건 dev의 Turbopack이 요청 시점에 컴파일해 첫 측정이 서버 상태를 같이 재기 때문이고, prod·dev가 같은 px를 낸다는 건 #601에서 이미 실측됐다.

## 7. 대조 기준은 뷰포트가 아니라 `#phone-frame` rect (#609)

예전엔 `VW===400 && VH===675`로 게이팅해 `--viewport 1440x675`로 돌리면 프레임이 망가져도 `checked:false` + exit 0으로 조용히 통과했다. 지금은 프레임이 400×675면 뷰포트와 무관하게 같은 불변식을 대조한다(1440×675 → 프레임 400×675 at x=520, dock·프리뷰 값 무변경).

**`checked:false`는 통과가 아니라 실패다.** 못 재면 그대로 exit 1이라, 1440×900(프레임 400×900)은 이 불변식의 대상이 아니라 실패로 나온다.

## 8. stale 서버 함정 (#601)

2026-07-31 실측 정정. **하네스는 dev 전용이 아니다 — 함정은 stale 서버다.** `bun run build && next start`로 **새로** 띄운 prod에서 세 하네스가 다 돌고, px 불변식도 dev와 같은 값이 나온다(dock·프리뷰 동일, frameFit 전부 통과).

#601이 "prod에선 크롭 '적용'이 끝까지 안 뜬다"로 잡았던 건 앱 버그도 DataTransfer 주입 아티팩트도 아니고, **하루 전부터 떠 있던 `next start`가 옛 빌드의 HTML을 주던 것**이었다. `_next/static/chunks/*.js`가 전부 404라 앱이 하이드레이션을 못 하고, 그래서 파일 input에 핸들러가 안 붙어 **모달이 아예 안 열린다**(`dialogOpen:false`). 같은 서버에서 DataTransfer 주입과 CDP 실제 파일 선택이 **똑같이** 실패하고, 새 서버에선 **둘 다** 통과한 게 근거다.

- 착각이 성립하는 이유: 포트가 이미 물려 있으면 새 `next start`는 `EADDRINUSE`로 죽는데 **앞 서버가 그대로 200을 준다.** "방금 띄운 서버"라고 믿은 게 남의 프로세스였다. 재는 대상이 진짜 지금 빌드인지부터 확인한다.
- 진단 순서: 크롭 모달이 안 열리면 앱을 뒤지기 전에 **콘솔의 chunk 404**를 본다. 그게 있으면 서버 문제고, 앱 코드는 무관하다.

## 9. 워크트리에서 dev 띄우기 (#708)

지금은 그냥 `bun run dev`다. 예전엔 `.claude/worktrees/` 안에서만 모든 요청이 500이었다(`Failed to load external module clsx-<해시>`). 원인은 심링크 node_modules도 Turbopack 워크스페이스 루트 추론도 아니고 스크립트가 강제하던 **`bun --bun`(bun 런타임)**이었다. 워크트리 경로에서만 Turbopack의 external 핸들 해석이 깨지고, 같은 플래그로 메인 체크아웃은 200이 뜬다(`turbopack.root`를 워크트리로 명시해도 500 그대로, `node node_modules/.bin/next dev`는 200 — 그래서 `dev` 스크립트에서 `--bun`을 뺐다). `build`/`start`는 `--bun`으로도 멀쩡해 그대로 뒀다.

**포트는 나눠 쓴다.** :3000은 메인 체크아웃이 물고 있기 쉬운데, 물려 있으면 새 서버가 죽고 앞 서버가 그대로 200을 준다(8절 #601 착각과 같은 함정, 이번엔 남의 브랜치를 재게 된다). 워크트리는 `bun run dev --port 3010` 식으로 띄우고 하네스에 `--url http://localhost:3010/`을 준다.

## 10. 프레임 봉쇄 축과 `backdrop` (#609·#786)

두 번째 축은 프레임 봉쇄다(#609). 크롭 모달·필드 드로어·편집 메뉴·max 오버레이·결과 스테이지·결과 hero가 프레임 사각형 안인지 방향별 넘침으로 잰다. dock/프리뷰 숫자가 원리적으로 못 보는 축인 게 실측으로 증명돼 있다 — `PhoneFrame`의 `contain:paint`를 지우면 fixed 오버레이 3종이 좌 520px 넘치는데 **dock/프리뷰 불변식은 그대로 통과한다.**

**`backdrop` 축은 이제 부재 확인이다**(#786). 랜딩 반복 배경 타일(#615 D3)이 캐러셀과 겹쳐 산만하다는 사용자 결정(2026-09-19)으로 제거돼, 예전의 봉쇄 두 명제(레이어가 `overflow:hidden`으로 자른다 + 오버사이즈 그리드가 레이어를 덮는다)는 잴 대상이 사라졌다. 남은 명제는 `[data-testid="landing-backdrop"]`이 되살아나지 않았다는 것 하나고, 유닛 쪽은 `__tests__/landingOverlay.test.tsx`가 같은 부재를 잡는다. 배경을 다시 들이면 봉쇄 축도 같이 되살려야 한다 — `getBoundingClientRect`는 조상 클리핑을 반영하지 않아 오버사이즈 그리드를 frameFit에 그냥 넣으면 멀쩡한 트리에서도 항상 실패한다(옛 측정 로직은 git 이력 `scripts/measure-chrome.mjs`의 #615 backdrop 축).

## 11. `landingShownOnDraft`·`posterless` 축과 파괴 실험 (#727·#674)

이 두 축은 살아 있고 파괴 실험으로 확인된다(dark, prod :3010). draft 복원 상태·포스터 없는 진입 상태를 각각 만들어야 도달하는 자리라 단일 knob으로 안 깨져 한동안 파괴 검증이 비어 있었다. 소스를 한 줄씩 되돌려 확인한 결과:

- **랜딩 축은 #727에서 명제가 뒤집혔다.** 옛 `landingSkippedOnDraft`(draft가 있으면 랜딩이 안 덮는다, #675 D7)가 `landingShownOnDraft`(draft가 있어도 랜딩이 **fixed로 덮고**, 숨지 않고, 복원 행을 담고, 스크롤이 안 생긴다)로 교체됐다. 삭제된 `globals.css`의 `html.has-draft [data-testid='landing'].fixed { display:none }`를 되살리면 `display:"none"` → `pass:false` → exit 1(2026-08-20 실측). 그때 나머지 축 8종은 전부 true로 남는다 — 랜딩 진입 단계가 실패해도 스크립트가 안 죽게 `waitForFunction`을 catch로 감싸 `dismissed:false`로만 기록하기 때문이고, 그게 없으면 진단이 통째로 날아간다.
- **이 축은 draft를 심은 메인 페이지에서 잰다.** 별도 `landingCtx`(저장분 없음)에선 복원 행이 `display:none`이라 조용히 통과한다 — 복원 행·주 CTA의 `measureFit`도 같은 이유로 메인 페이지 쪽에 있다. 그리고 그 측정 직후 스크립트는 **"이어서 만들기"로 draft를 이어받아** 편집으로 들어간다: "새로 시작" 네 경로로 들어가면 문서가 새 문서로 되돌아가(#727 c7) 심어둔 title·titleOg·releaseDate가 사라져 완료 게이트와 결과 스테이지 축이 통째로 죽는다.
- `MobileEditorShell`의 랜딩 판정에 `croppedImageUrl`을 되살리면(#727 c1이 걷어낸 항) 포스터 있는 draft 재방문에서 랜딩이 도로 숨는다 — 브라우저 축은 이 스크립트가, 유닛 축은 `__tests__/awaitingPosterRestore.test.tsx`가 IDB 게이트를 쥐고 도착 전/후로 잰다.
- 위 회귀들은 **그 축만** 뒤집는다. dock/프리뷰 불변식은 이 부류를 원리적으로 못 본다.
- `MobileEditorShell`의 fit 스테이지에서 **`background: 'var(--workbench)'`를 지우면** `posterless.stagePainted:false`(#674의 두 번째 증상, "아래쪽만 회색 블록"). 이것도 그 축만 뒤집는다.
- 같은 스테이지에서 **`flex-1`을 빼면** `stageFillsBody:false`(stage 24 vs body 504.5), **`mode === 'hidden'` 분기를 무력화하면** `landingHidden:false` + `stageFillsBody:false`(stage 264.3 vs body 504.5 — #674의 두 증상이 같이 재현). 이 둘은 fit 스테이지가 무너지므로 `invariant`도 함께 실패한다 — 축이 겹치는 건 정상이고, 중요한 건 posterless가 자기 명제로 먼저 운다는 것이다.
