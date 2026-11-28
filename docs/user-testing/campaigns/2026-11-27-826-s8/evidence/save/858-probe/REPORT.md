# #858 원인 조사 — [저장] 사용자 활성 소실 (iOS 27.0 Simulator)

2026-11-27~28, iPhone 18 Pro · iOS 27.0 Simulator(UDID 0E3F59D2-…), prod 빌드 `5a991303`(`next start --port 3038`, buildId `2oirV_4ScQe3BajcmG83d`, 서버 cwd가 이 워크트리임을 확인해 stale 서버 배제, docs/HARNESS.md 8절). 탭은 전부 XCTest 합성 터치(`scripts/ios-sim/sim.py`). **Simulator 결과이고 실기기 결과가 아니에요.**

## 결론

- **활성을 끄는 원인 API는 특정하지 못했어요.** 페이지 JS에서 보이는 호출로는 꺼지지 않고, WebKit 내부 경로로 보여요.
- 대신 **실패 조건은 좁혔어요: 새로 연 페이지의 첫 [저장]**. 같은 페이지의 두 번째 이후 [저장]은 성공해요.
- 첫 [저장] 전에 캡처를 한 번 미리 돌려 두면(활성 없이 JS `.click()`) 첫 실제 탭이 성공했어요(4/4).
- 클릭 즉시 share하는 구조는 같은 조건에서 6/6 성공했어요.

## 실측

| 실험 | 파일 | 결과 |
|---|---|---|
| 새 페이지(정상 로드) → 결과 화면 → 첫 [저장], Appium · simctl 탐색 번갈아 | `firstsave-appium-vs-simctl.json` | **실패 9/10**(NotAllowedError, share 순간 활성 false). 로드는 모두 정상(`domInteractive` 15~33ms) |
| 같은 페이지에서 [저장] 반복, 하네스 폴링 있음/없음 번갈아 | `savereal-poll-nopoll.json` | 1회차만 실패, 2~12회차 11/11 성공(폴링 무관) |
| 첫 [저장] 전에 JS `.click()`으로 캡처를 미리 한 번 돌림 | `firstsave-warm1.json` | **성공 4/4**(활성은 share 순간 share가 소비) |
| 결과 화면 [저장]을 캡처 단계에서 가로채 share만 호출: 클릭 즉시 vs 750ms 뒤(캡처 없음) | `sharetiming.json` | 즉시 6/6, 750ms 뒤 6/6 모두 시트 |
| 정적 문서(`og.jpg`)에 버튼 · 빈 영역 탭, 활성 수명 | `lifetime-static-og.json` | 10/10 약 5000ms(정상 만료) |

## 배제한 가설

| 가설 | 근거 | 판정 |
|---|---|---|
| 캡처 코드(handleSave)가 소비 | [저장] 클릭을 캡처 단계 `stopImmediatePropagation`으로 막아도 활성이 193~2819ms에 꺼진 회차가 있었어요(`probe-block-*`). 다만 이 회차들엔 2ms 간격 setTimeout 샘플러가 돌았고, 샘플러 없는 `sharetiming` 750ms 대기는 6/6 성공이라 이 대조군 자체가 샘플러에 교란됐을 수 있어요 | 단독 원인 아님 |
| 페이지 JS의 소비 API | 대문자 전역 생성자 prototype의 함수 · setter 전부 + window 함수 전부를 감싸 호출 전 true → 후 false를 잡았지만 0건(`probe-block-nopoll-wrapped.json`). 꺼지기 직전 호출은 샘플러의 setTimeout뿐 | 배제(감싸기 전에 참조를 붙든 코드는 못 봄) |
| 지난 세션 후보(fetch · canvas · createElement · focus · img.src) | 위 일괄 래핑에 포함 | 배제 |
| 하네스의 XCUITest `source` 폴링 | 폴링 있음/없음 번갈아 같은 결과(`savereal`, `probe-block-nopoll-block-save`) | 배제 |
| Appium의 Web Inspector JS 평가 | 탭 약 730ms 뒤 `return 1` 평가에도 활성 5초 유지(`lifetime-keep-app-eval.json`) | 배제 |
| 시간 만료(5초) | 정상 만료는 정확히 약 5000ms. 실패는 그보다 훨씬 이름 | 배제 |
| focus · blur · visibilitychange · pagehide | 캡처 단계 리스너에 0건 | 배제 |
| 탐색 직후 파서 멈춤 | 무거운 페이지에서 Appium `url` 탐색 시 HTML 응답 5ms인데 `domInteractive` 24~30초가 난 회차가 있었고(`nav-loading-mont.png`: 주소창 × 로딩), 그 구간 탭은 활성이 약 1.75초에 꺼졌어요(`lifetime-keep-app-nodelay.json` 1~3회). 하지만 정상 로드(15~33ms)에서도 첫 [저장]이 9/10 실패 | 하네스 부수 현상, 원인 아님 |
| 앱 DOM · CSS | DOM을 비워도(JS 환경은 유지) 같은 꼴(`lifetime-wipe-app-wipe.json`) | 배제 |

## 남은 가설(검증 못 함)

첫 캡처에서만 도는 작업이 WebKit 안에서 활성 시각을 덮어써요. 후보: `import('html-to-image')` 청크 로드(첫 캡처에만 `<script>` 삽입, 클릭 +35ms), html-to-image의 웹폰트 임베딩 fetch 22건(+83~99ms), 텍스처 SVG · 스탬프 프로브 이미지의 첫 디코드. 이 중 하나가 옛 제스처 토큰으로 활성 통지를 다시 하면(WebKit `notifyActivated(token.startTime)`) 활성이 즉시 만료된 것처럼 보일 수 있어요. 페이지 안에서는 이 경로를 관측할 수 없어요.

## 수정 방식에 주는 함의

- ①(결과 화면 진입 때 미리 캡처 → [저장]은 바로 시트): 첫 캡처가 클릭 밖에서 끝나고 share가 클릭 안에서 바로 불려요. 위 두 실험(미리 데움 4/4 · 즉시 share 6/6)과 맞아요.
- ②(거절 뒤 "다시 눌러 저장"): 두 번째 탭은 이미 데워진 상태라 `savereal` 기준 성공해요. 첫 탭은 계속 실패해요.
- [공유]는 링크 발급(캡처 + 업로드) 뒤 share라 같은 구조예요. 이번엔 재지 않았어요.
- 실기기 재현은 여전히 모름(#826 S8 T02 · T17).

## 처리

소유자가 ①을 골랐어요(2026-11-28). 적용 뒤 Simulator 재검증은 `../858-verify/`에 있어요.
