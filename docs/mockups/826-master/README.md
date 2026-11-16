# #826 페이지 마스터 — 영사실

#826 리뉴얼 3단계 산출물이에요. 소유자가 고른 F′(`f-refined`, "영사실")를 바탕으로 앱 화면 전체를 393 기준 프레임과 상태 변형, 레드라인, 컴포넌트 사양, 토큰, 기능·요구 추적표, 레퍼런스 근거표로 정의해요. 프로덕션 코드(`src/`)와 Seed(4단계)는 범위 밖이에요.

## 여는 법

정적 서버로 이 폴더의 상위(`docs/mockups/`)를 띄우고 `826-master/index.html`을 열어요. `file://`로도 열리지만 Pretendard·Nunito는 CDN에서 받아서 오프라인이면 시스템 서체로 보여요.

위 막대에서 프레임 폭(393/375), 테마(시스템/라이트/다크), 레드라인을 바꿔요. 쿼리로 고정할 수도 있어요: `?fw=375&theme=dark&rl=off#editor`.

## 구성

| 파일 | 역할 |
| --- | --- |
| `master.css` | `--pr-` 토큰(라이트·다크)과 모든 컴포넌트·프레임 스타일 |
| `lib.js` | 프레임 조각 빌더(상단 줄·티켓·패널·슬라이더…)와 레드라인 실측 |
| `frames.js` | 프레임 34개 · 상태 변형 87개 정의(상태 설명·컴포넌트·흐름·메모) |
| `data/components.js` | 컴포넌트 사양(구성·크기·토큰·변형·상태·대응 파일) |
| `data/trace.js` | 현재 기능 52개 · 이관 요구 6개 추적 |
| `data/refs.js` | 레퍼런스 근거표 |
| `data/verify.js` · `verification/` | Aside 렌더 검사 기록 |
| `render.js` | 페이지 목록·라우팅·표 렌더 |
| `check.js` | 렌더 검사 `MASTER_CHECK()` |

출발 자료는 브랜치 `docs/826-direction-mockups` 81f7039의 `docs/mockups/826-directions/`(방향 목업 A~F, `f-refined.html`, `shared/features.js`)예요. 이 브랜치에선 마스터가 대체해서 지웠고, 그 커밋에서 언제든 꺼내 볼 수 있어요.

## Claude Design

같은 토큰·컴포넌트는 Design System 아티팩트 "FILME 영사실"에, 프레임과 작업 중 비교판은 Design 캔버스 "FILME 리뉴얼"에 있어요. 작업 중 나오는 목업은 그 캔버스의 페이지에 계속 더해요(링크는 표지 페이지).
