# 🎬 FILME

**브라우저에서 실물 같은 CGV 포토플레이 프리미엄 포토티켓을 직접 만들고 내려받는 무료 웹 앱입니다.**

영화관에서 받은 포토티켓이 마음에 들었거나 나만의 디자인으로 한 장 만들고 싶을 때, 포스터 한 장만 올리면 영화·극장·좌석 정보를 채워 고해상도 이미지로 뽑아줍니다. 설치도 회원가입도 필요 없습니다.

👉 **[지금 바로 써보기](https://filme-web.vercel.app/)**  ·  🇺🇸 [English README](./README.md)

<!-- TODO: 메인 화면 스크린샷 또는 데모 GIF 추가 (docs/screenshot.png) -->

## ✨ 주요 기능

- **4가지 무드 디자인** — `Minimal` · `Criterion` · `35mm` · `Editorial` 중에서 분위기를 고릅니다. 앞 셋은 세로형, Editorial은 가로형입니다.
- **포스터 업로드 & 수동 크롭** — 원하는 이미지를 올리고 티켓 비율에 맞게 직접 잘라 넣습니다.
- **티켓 스크린샷 자동 인식 (OCR)** — 실물 포토티켓 스크린샷을 올리면 영화 제목·관람일·좌석 정보를 AI가 읽어 폼을 자동으로 채웁니다.
- **영화 검색 (KOBIS)** — 영화진흥위원회 Open API로 제목을 검색해 정보를 빠르게 입력합니다.
- **극장·포맷 로고 직접 업로드** — CGV·IMAX·4DX 같은 극장 체인과 특별관 로고를 원하는 이미지로 직접 넣습니다. 저작권 문제로 기본 로고는 번들하지 않습니다.
- **고해상도 다운로드** — 실제 출력 사양에 맞춘 고해상도 JPEG로 즉시 저장합니다.

## 🪄 사용 방법

1. **무드 선택** — 위쪽에서 티켓 디자인 무드를 고릅니다.
2. **포스터 넣기** — 이미지를 업로드하고 크롭 영역을 지정합니다. 실물 티켓 스크린샷이 있다면 올려서 OCR로 정보를 한 번에 채울 수 있습니다.
3. **정보 입력** — 영화 제목을 검색하고 관람일·상영관·좌석·로고를 채웁니다. 미리보기에 바로 반영됩니다.
4. **다운로드** — 완성된 티켓을 고해상도 JPEG로 내려받습니다.

> 💡 실물 출력은 **CGV Premium** 기기를 추천합니다. 이미지가 이 기기에 맞춰 최적화되어 있으며, 메가박스·롯데시네마 기기에서도 사용할 수 있습니다.

## 🛠 셀프 호스팅

[Bun](https://bun.sh)이 필요합니다.

```bash
bun install
cp .env.example .env.local   # 아래 키를 채웁니다
bun run dev                  # http://localhost:3000
```

| 변수 | 필수 | 용도 |
| --- | --- | --- |
| `KOBIS_API_KEY` | ✅ | 영화 검색 ([키 발급](https://www.kobis.or.kr/kobisopenapi/homepg/main/main.do)) |
| `AI_GATEWAY_API_KEY` | ✅ (OCR) | [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) 키. 배포 환경에선 `VERCEL_OIDC_TOKEN`으로 대체 가능 |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | ⬜ | rate limit (production 권장, 로컬에선 미설정 시 자동 skip) |

프로덕션은 `bun run build` / `bun run start`를 사용합니다.

## 🏗 기술 스택

- **Framework**: Next.js 16 (Pages Router), React 19, TypeScript
- **Styling**: Tailwind CSS v3
- **티켓 렌더링**: DOM(JSX/CSS) + `html-to-image` 캡처, `react-easy-crop` 포스터 크롭
- **OCR / AI**: GPT-4o mini vision — `ai` SDK v6 + Vercel AI Gateway, Zod 스키마, Upstash rate limit
- **영화 데이터**: KOBIS Open API
- **Package Manager**: Bun

## 📄 라이선스

[MIT](./LICENSE)
