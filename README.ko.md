# 🎬 FILME

**브라우저에서 실물 같은 CGV 포토플레이 프리미엄 포토티켓을 직접 만들고 내려받는 무료 웹 앱입니다.**

영화관에서 받은 포토티켓이 마음에 들었거나 나만의 디자인으로 한 장 만들고 싶을 때, 포스터·티켓 스크린샷·빈 티켓 중 하나로 시작해 고해상도 이미지로 뽑아줍니다. 설치도 회원가입도 필요 없습니다.

👉 **[지금 바로 써보기](https://filme-web.vercel.app/)**  ·  🇺🇸 [English README](./README.md)

## ✨ 주요 기능

- **모바일 중심 편집기** — 크림색 라이트 UI와 Pretendard를 사용해요. PC에서도 같은 모바일 화면을 제공해요.
- **6가지 무드 디자인** — `Minimal` · `Criterion` · `35mm` · `Editorial` · `Stub` · `35mm Wide` 중에서 고릅니다. 네 가지는 세로형, 두 가지는 가로형입니다.
- **선택형 포스터 & 수동 크롭** — 포스터를 올려 직접 자르거나, 포스터 없이 티켓을 만듭니다.
- **티켓 스크린샷 자동 인식 (OCR)** — 실물 포토티켓 스크린샷을 올리면 영화 제목·관람일·좌석 정보를 AI가 읽어 폼을 자동으로 채웁니다.
- **영화 검색 (KOBIS)** — 영화진흥위원회 Open API로 제목을 검색해 정보를 빠르게 입력합니다.
- **극장·포맷 로고 직접 업로드** — CGV·IMAX·4DX 같은 극장 체인과 특별관 로고를 원하는 이미지로 직접 넣습니다. 저작권 문제로 기본 로고는 번들하지 않습니다.
- **고해상도 다운로드** — 실제 출력 사양에 맞춘 고해상도 JPEG로 즉시 저장합니다.

## 🪄 사용 방법

1. **무드 선택** — 랜딩 화면이나 편집기에서 티켓 디자인 무드를 고릅니다.
2. **시작 방식 선택** — 포스터를 올리거나, 실물 티켓 스크린샷을 OCR로 읽거나, 포스터 없이 직접 입력합니다.
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
| `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ (OCR) | [Google AI Studio](https://aistudio.google.com/apikey) 키 (Gemini vision) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | 프로덕션 | rate limit. 로컬은 미설정 시 통과하지만 프로덕션 OCR·티켓 공유는 미설정 시 차단됩니다. |

프로덕션은 `bun run build` / `bun run start`를 사용합니다. 저장소 검증은 `bun run typecheck`, `bun run lint`, `bun run test`입니다.

## 🏗 기술 스택

- **Framework**: Next.js 16 (Pages Router), React 19, TypeScript
- **Styling**: Tailwind CSS v3
- **티켓 렌더링**: DOM(JSX/CSS) + `html-to-image` 캡처, `react-image-crop` 포스터·스탬프 크롭
- **OCR / AI**: Gemini 3.1 Flash Lite vision — `ai` SDK v6 + `@ai-sdk/google`(Google AI Studio 직결), Zod 스키마, Upstash rate limit
- **영화 데이터**: KOBIS Open API
- **Package Manager**: Bun

## 📄 라이선스

[MIT](./LICENSE)
