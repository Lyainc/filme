# FILME 모바일 잔여 검증 — iOS Simulator 캠페인 (2026-10-21)

[결과표 형식](../../RUN.md)을 따른 캠페인 기록이에요. 범위는 Seed `docs/specs/mobile-device-verification.yaml`의 acceptance-1~4 iOS 행(#777, #779, #768, #585)이고, 같은 결과표의 U01–U14·N01–N04는 이 Seed 범위 밖이라 N/A예요. **iOS 필수 행은 모두 실행했고, FAIL이 있어요.** 이 기록은 Seed 완료나 이슈 닫힘을 뜻하지 않아요.

## 실행 환경

- 실행자 / 날짜·시간: Claude Code 세션(소유자 Lyainc 승인 하에) / 2026-10-21 13:33–19:00 KST. 실작업 약 75분 뒤 사용량 한도로 약 2시간 정지, 소유자가 3시간 상한을 넘겨 계속하도록 결정(17:4x)한 뒤 재개.
- 대상 URL / 전체 commit SHA: `http://localhost:3038/` 로컬 prod(`bun run build` → `bun run start --port 3038`) / 앱 코드 `f56dabfcccb2fcb2a37f76f69e22818f196bb81a`(= 실행 시점 origin/main). 이후 이 브랜치의 커밋은 문서(Seed constraint-3·README·이 기록)뿐이라 서버 빌드는 그대로예요. `_next/static/chunks/*.js` 200 확인(stale 서버 아님).
- 기기 / OS / 브라우저: iPhone 17 Pro 시뮬레이터(UDID `2E1CE4CC-1DB0-4D03-A511-4C0AB87CA474`) / iOS 26.5(23F77) / Mobile Safari 26.5
- 시뮬레이터 / 화면: Xcode 27.1(27A9275) DeviceHub / 세로, viewport 402×714(하단 주소창, 화면 402×874pt), DPR 3 / 보조기술 없음
- 하드웨어 키보드 끔 / 소프트웨어 키보드 표시: 끔, 표시 확인 — [01-softkb.png](./evidence/01-softkb.png)(사람 직접 탭)
- 테마: 라이트·다크(`phototicket:theme`, `html.theme-dark` 확인)
- 입력 fixture: #585·#779 빈 문서(포스터 없음). #777 `scripts/measure-field-taps.mjs`와 같은 전 필드 draft(포스터 없음). #768 [README](../../README.md) 공통 입력(짧은/긴), 포스터 A `sample-bus.jpg`, 스탬프 B `sample-crossing.jpg`.
- 증거: 이 디렉터리의 `evidence/<이슈>/`. 스크린샷은 시뮬레이터 원본(1206×2622 PNG)을 JPEG q85로 옮겼고, #768 `*-saved.jpg`는 사진 앱 DCIM에서 꺼낸 **저장 원본 그대로**예요. 각 디렉터리의 JSON이 측정 원시값이에요.

### 입력 방식과 판정 근거

- 시작 시 사람이 DeviceHub 창에서 탭해 랜딩 → 편집 진입과 키보드 표시를 확인했어요.
- 소유자 결정(2026-10-21)으로 Seed constraint-3을 고쳐 **XCTest 합성 터치(Appium 3.8.0 + XCUITest driver 12.19.1, NATIVE_APP 컨텍스트 W3C touch pointer action)**를 판정 근거로 인정했어요(이 브랜치의 `docs(specs)` 커밋). 상태 준비·측정은 WEBVIEW 컨텍스트 JS로 해요.
- 판정 근거로 쓰지 않은 경로: AXe 1.8.0(`axe tap`은 성공 응답만 하고 화면 무반응), 호스트 CGEvent 마우스(포커스·커서 점유로 불안정), safaridriver 웹 합성 터치.
- 모든 터치 결과는 스크린샷 또는 DOM 상태(포커스된 입력의 `aria-label`, range 값)로 확인했어요.

## 결과

| ID | 상태 | 실제 결과 / 증거 |
|---|---|---|
| **#585 iOS** 포스터 % · 키보드 ✓ | FAIL | % 칸 탭 → 숫자 키패드 + **Safari 포커스 줌(scale 1.455)**. 입력칸만 보이고 라벨 '포스터'는 화면 밖, 프리뷰는 상단 띠만 보임. ✓ 뒤 값 37 유지, **확대가 남아 dock·프리뷰가 원래 슬롯으로 복원되지 않음**. 실측 fontSize 11px(`text-micro`), viewport에 `maximum-scale` 없음 — [during](./evidence/585/585-0a-during.jpg) · [after](./evidence/585/585-0a-after.jpg) |
| #585 iOS 포스터 % · 바깥 탭 | FAIL | 같은 줌·라벨 가림, 종료 후 확대 유지(값 42 유지) — [during](./evidence/585/585-0b-during.jpg) · [after](./evidence/585/585-0b-after.jpg) |
| #585 iOS 컴포넌트 % · ✓ / 바깥 탭 | FAIL / FAIL | 위와 같음(11px, 1.455, 종료 후 1.455) — [1a](./evidence/585/585-1a-during.jpg) · [1b](./evidence/585/585-1b-after.jpg) |
| #585 iOS 재질 강도 % · ✓ / 바깥 탭 | FAIL / FAIL | 재질 '미술용지' 선택 후 같은 결과 — [2a](./evidence/585/585-2a-during.jpg) · [2b](./evidence/585/585-2b-after.jpg) |
| #585 iOS 코팅 강도 % · ✓ / 바깥 탭 | FAIL / FAIL | 같은 결과 — [3a](./evidence/585/585-3a-during.jpg) · [3b](./evidence/585/585-3b-after.jpg) |
| #585 iOS 극장 로고 크기 % · ✓ / 바깥 탭 | FAIL / FAIL | 80·90 입력, 같은 결과 — [4a](./evidence/585/585-4a-during.jpg) · [4b](./evidence/585/585-4b-after.jpg) |
| #585 iOS 포맷 로고 크기 % · ✓ / 바깥 탭 | FAIL / FAIL | 같은 결과 — [5a](./evidence/585/585-5a-during.jpg) · [5b](./evidence/585/585-5b-after.jpg) |
| #585 iOS return 키 | N/A | `inputMode="numeric"` 숫자 키패드에 return 키 없음. 액세서리 바는 ✓와 ^/v(포커스 이동)뿐 |
| #585 Android | BLOCKED | Android Emulator 미설치, 설치 승인 없음 |
| **#779** 트랙 25% 탭 · 라이트 / 다크 | PASS / PASS | 50% → **20%로 점프**(0.1 스냅). 인접 '컴포넌트' 100% 그대로 — [light](./evidence/779/779-light-track-tap-25.jpg) · [dark](./evidence/779/779-dark-track-tap-25.jpg) |
| #779 트랙 중심·위아래 10px·14px 탭 · 라이트 / 다크 | PASS / PASS | 다섯 위치 모두 20%로 점프, 인접 컨트롤 무변화(32px 히트 박스 안) — `779-*-track-tap-25-{up,down}{10,14}.jpg` |
| #779 트랙에서 시작한 드래그(25%→80%) · 라이트 / 다크 | FAIL / FAIL | **값이 50% 그대로** — 트랙 탭은 점프하지만 트랙에서 시작한 드래그는 값을 못 바꿈 — [light](./evidence/779/779-light-track-drag-25-to-80.jpg) |
| #779 thumb에서 시작한 드래그(→80%) · 라이트 / 다크 | PASS / PASS | 50% → 80% — [light](./evidence/779/779-light-thumb-drag-to-80.jpg) |
| #779 인접 컨트롤 간섭 · 라이트 / 다크 | PASS / PASS | 위 모든 제스처에서 '컴포넌트' 슬라이더·% 입력 무변화(JSON `after.component`) |
| #779 값·범위·step·% 입력·undo · 라이트 / 다크 | PASS / PASS | min 0·max 1·`step="any"`, 드래그는 0.1 스냅, % 37 입력은 스냅 없이 0.37 커밋, undo로 드래그·% 입력 모두 0.5 복원. 단 % 입력 뒤에는 포커스 줌으로 undo 버튼이 화면 밖(y=-157)이라 **핀치 축소 후에만** 누를 수 있음(#585와 같은 원인) — [light undo](./evidence/779/779-light-undo.jpg) · [dark undo](./evidence/779/779-dark-undo.jpg) |
| **#777** Minimal · 라이트 / 다크 | FAIL / FAIL | 14필드 × 3지점(중심·안쪽 위/아래 2px) 중 **상영관(screen) 3지점 모두 좌석(seat)이 열림** — `elementFromPoint`도 seat(좌석 탭 영역이 상영관을 덮음), 포커스 입력 '좌석' — [screen](./evidence/777/777-dbg-screen.jpg) |
| #777 Criterion · 라이트 / 다크 | PASS / PASS | 16필드 × 3지점 모두 해당 필드가 열림(복구 경로 결함은 아래 복구 경로 행에서 셈) |
| #777 35mm · 라이트 / 다크 | PASS / PASS | 14필드 × 3지점 모두 해당 필드가 열림 |
| #777 Editorial · 라이트 / 다크 | FAIL / FAIL | **bookingNo·format·seat를 항목 목록 핸들이 42%·100%·52% 덮어**, 누르면 드로어가 열림(드로어에서 편집으로 복구는 가능) — [start](./evidence/777/777-editorial-light-start.jpg) |
| #777 Stub · 라이트 / 다크 | PASS / PASS | 15필드 × 3지점 정상 |
| #777 35mm Wide · 라이트 / 다크 | PASS / PASS | 14필드 × 3지점 정상 |
| #777 툴바 가림·자동 이동(6무드) | PASS | 열린 필드와 필드 편집 바의 겹침 비율 전 프로브 0(JSON `barOverlap`) |
| #777 복구 경로·편집 후 포커스·undo·저장(라이트, 6무드) | PASS 5 / FAIL 1(Criterion) | Criterion: 원제 편집 중 **필드 편집 바의 '이전 항목'이 플로팅 툴바 밑에 깔려, 누르면 '최대화'가 대신 눌림** — [before](./evidence/777/777-criterion-light-before-prev.jpg) · [after](./evidence/777/777-criterion-light-after-prev.jpg). 핸들 → '티켓 항목' 드로어 6/6. 이전/다음: 제목 → 원제 → 제목(포커스 입력 라벨 기준, [prevnext](./evidence/777/777-prevnext.json)). 제목 편집(공백 추가) → 자동저장 draft에 반영 → undo로 원래 텍스트 복원 5/5. Criterion은 위 '이전' 가림으로 undo 단계 미실행 |
| #777 작은 필드 확대 경로(Minimal 상영관) | FAIL | ① 최대화: 최대화 화면엔 필드 탭 대상이 0개라 탭하면 기본 크기로 돌아갈 뿐 편집이 안 열림 — [before](./evidence/777/777-enlarge-max-before.jpg) · [after](./evidence/777/777-enlarge-max-after.jpg) ② Safari 핀치 확대(scale 4.0) 후 상영관 탭: 그 지점이 여전히 좌석 탭 영역(`elementFromPoint`=seat)이고 편집도 열리지 않음 — [before](./evidence/777/777-enlarge-pinch-before.jpg) · [after](./evidence/777/777-enlarge-pinch-after.jpg). 상영관은 항목 목록·이전/다음으로만 편집 가능 |
| #777 복구 경로·편집 후 포커스·undo·저장(다크, 6무드) | PASS 5 / FAIL 1(Criterion) | 라이트와 같은 결과. 이전/다음은 포커스 입력 라벨로 제목 → 원제 → 제목(5무드), Criterion은 '이전'이 '최대화'로 흡수 — `777-<무드>-dark-{next,prev}.jpg`, [777-rest.json](./evidence/777/777-rest.json) |
| **S01**–**S16**(#768) | FAIL ×16 | 16셀 모두 저장 원본 확보(1960×3108 = 자연 960×1534 + 여백 10px, ×2). **편집 프리뷰(빈 항목 끔)와 완료 화면에는 스탬프 B가 있는데, 사진 앱에 저장된 JPEG에는 16장 모두 스탬프가 없음.** 저장본은 제목 위에 빈 슬롯(세로 선)이 생겨 본문이 아래로 밀림. 프리뷰의 스탬프는 원제 토글·제목 길이 변경 후 이전 좌표 잔류 없이 이동하고 텍스트와 겹치지 않음(JSON `interactions`). 셀별: `evidence/768/Sxx-editor.jpg` · `Sxx-result.jpg` · `Sxx-saved.jpg` · `Sxx-compare.jpg`(정렬 프리뷰 / 저장본 / 차이) — 예: [S01 비교](./evidence/768/S01-compare.jpg) · [S01 저장](./evidence/768/S01-saved.jpg) · [S16 저장](./evidence/768/S16-saved.jpg). 스탬프 자리 픽셀 표준편차가 종이와 같음(`stamp-presence.json`, S02·S04는 밀린 본문 텍스트가 걸림 — 눈으로 부재 확인) |
| S01 대조군(스탬프 실제 업로드 경로) | FAIL | seed 대신 DESIGN '스탬프 이미지 업로드' + 크롭 적용으로 넣어도 편집 프리뷰엔 보이고 **저장본엔 없음** → fixture(`data:` URL) 탓이 아님 — [editor](./evidence/768/S01-upload-editor.jpg) · [saved](./evidence/768/S01-upload-saved.jpg) |
| U01–U14, N01–N04(18행) | N/A | 이 Seed 범위 밖 |

## 실패 기록

1. **#585 · 포커스 줌**(12/12 재현, 두 종료 경로): % 입력(11px) 포커스 시 iOS Safari가 1.455배 확대 → 라벨 화면 밖, 프리뷰 거의 가려짐, 종료 후 확대 유지로 dock·프리뷰 원래 슬롯 미복원. 값은 보존. 부수 영향: 확대 중에는 플로팅 툴바(undo)가 화면 밖(#779 마지막 행). 우회: 핀치 축소. 원인 추정: 입력 글꼴 16px 미만.
2. **#779 · 트랙 시작 드래그 무반응**(라이트·다크 각 1회): 트랙 25%에서 시작해 80%로 끌어도 값 50% 유지. 트랙 탭은 점프, thumb 드래그는 동작. acceptance-2가 트랙 탭의 Safari 동작은 강제하지 않지만 트랙 드래그 무반응은 사용성 결함으로 판단해 FAIL로 기록 — 소유자 재판정 대상.
3. **#777 · Minimal 상영관 → 좌석**(두 테마, 3/3 지점): 좌석 탭 영역이 상영관 탭 영역을 덮음. 복구: 항목 목록·이전/다음.
4. **#777 · Editorial 핸들 가림**(두 테마): 항목 목록 핸들이 bookingNo(42%)·format(100%)·seat(52%)을 덮음. format은 직접 선택 불가, 드로어 경유로만 편집.
5. **#777 · Criterion '이전 항목' 가림**(라이트·다크): 원제 편집 시 필드 편집 바의 '이전'이 플로팅 툴바 아래에 깔려 '최대화'가 실행됨.
7. **#777 · 작은 필드 확대 경로 부재**: 최대화는 보기 전용이고, 핀치 확대해도 Minimal 상영관은 좌석 영역에 덮여 직접 편집 불가.
8. **#768 · 저장 JPEG 스탬프 누락 + 상단 빈 슬롯**(16/16 + 대조군): 진행 차단은 아니지만 **저장 결과 누락**이에요. 같은 조건의 Chrome 자동 점검(README, `99a6ae2`)은 통과했으므로 iOS WebKit 캡처 경로 특이로 의심(미확인).

## 캠페인 판정

- 이 캠페인 행(U/N 제외, 셀·테마·종료 경로·무드를 각각 1행으로 셈) 74행: PASS 34 / FAIL 38 / BLOCKED 1 / UNRUN 0 / N/A 1. 내역 — #585 iOS FAIL 12·N/A 1·Android BLOCKED 1, #779 PASS 10·FAIL 2, #777 직접 선택(무드×테마) PASS 8·FAIL 4 + 툴바 가림(무드) PASS 6 + 복구 경로(무드×테마) PASS 10·FAIL 2 + 확대 경로 FAIL 1, #768 FAIL 16 + 대조군 FAIL 1. U/N 18행은 범위 밖 N/A.
- #768 S01–S16 저장 JPEG 확보: 16/16(+대조군 1). 전부 스탬프 누락 FAIL.
- 자동 Chrome 검사: 이번 캠페인에서 실행하지 않음.
- 결론: **실패 있음.** 필수 행 PASS 근거가 없는 행이 있으므로 Seed는 active 유지, 이슈는 닫지 않음.
- 이슈 연결: #585, #777, #779, #768 댓글.

## 재개 지점

1. 서버: `bun run start --port 3038`(SHA `f56dabf` 빌드), Appium: `appium --port 4725`, iPhone 17 Pro 부팅·하드웨어 키보드 끔.
2. 남은 미실행: 없음(iOS). #585 Android는 에뮬레이터 설치 승인 필요(BLOCKED).
3. FAIL 7종은 제품 수정 범위 결정 대상이에요(constraint-4: 이 목표는 제품 코드를 고치지 않음). 수정 뒤 같은 스크립트로 재검증해요.
4. 실행 스크립트(세션 scratchpad, 커밋하지 않음): `sim.py`(Appium 헬퍼: 줌 보정 좌표 변환·핀치·네이티브 탭), `run585.py`·`run779.py`·`run777.py`·`run768.py`·`compare768.py`·`stamp768.py`. 함정: ① 랜딩 '이어서 만들기' 행이 늦게 나타나 링크가 밀림 — 랜딩 닫힘을 확인하고 재시도 ② 레일을 코드로 스크롤한 직후 탭은 스크롤 정지로 흡수됨 — 0.8초 대기 ③ reload는 Safari 확대를 유지 — 새 URL 탐색(`?r=N`)으로 초기화 ④ 첫 포스터 업로드는 `fieldVisibility`를 기본값으로 덮음 — seed에 `hadPoster: true` ⑤ 이전 셀의 포스터가 IndexedDB(`filme-images`)에서 복원됨 — 셀마다 비움 ⑥ 공유 시트는 원격 뷰라 요소 rect가 맞지 않음 — 화면 좌표로 '이미지 저장' 탭 후 DCIM 새 파일로 성공 판정 ⑦ safaridriver 세션이 남으면 Safari 페어링으로 입력이 막힘 — `xcrun simctl terminate <udid> com.apple.mobilesafari`.
