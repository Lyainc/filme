# 🎬 포토티켓 메이커 (Phototicket Maker)

CGV 포토플레이용 고품질 포토티켓 이미지를 생성하는 웹 애플리케이션입니다.

## ✨ 주요 기능

*   **포스터 업로드 및 수동 크롭**: 원하는 이미지를 업로드하고 포토티켓 비율(0.65:1)에 맞게 수동으로 크롭할 수 있습니다.
*   **영화 정보 검색 (KOBIS API)**: 영화진흥위원회(KOBIS) API를 연동하여 영화 제목을 검색하고 관람일, 장르 등의 정보를 쉽게 입력할 수 있습니다.
*   **다양한 극장 체인 및 포맷 지원**: CGV, 메가박스, 롯데시네마 등 다양한 극장 체인과 IMAX, 4DX, Dolby Cinema 등 특별관 포맷 로고를 지원합니다.
*   **프리미엄 텍스처 (후가공) 효과**: 홀로그램, 메탈릭, 스코딕스 등 실제 포토티켓에 적용되는 특수 후가공 질감을 캔버스에 시뮬레이션합니다.
*   **고해상도 JPEG 다운로드**: 실제 포토플레이 기기 출력 사양에 맞춘 고해상도(960×1477px) JPEG 이미지를 즉시 생성하고 다운로드합니다.

## 🚀 시작하기

이 프로젝트는 패키지 매니저로 **Bun**을 사용합니다. 시작하기 전에 시스템에 Bun이 설치되어 있는지 확인하세요.

### 1. 의존성 설치

```bash
bun install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 API 키를 설정합니다. KOBIS 키 발급처는 [영화진흥위원회 오픈API](https://www.kobis.or.kr/kobisopenapi/homepg/main/main.do)입니다.

```bash
cp .env.example .env.local
```

`.env.local` 파일 내용:
```env
KOBIS_API_KEY=당신의_발급받은_API_키를_여기에_입력하세요
AI_GATEWAY_API_KEY=로컬_OCR_테스트용_AI_Gateway_키
UPSTASH_REDIS_REST_URL=Upstash_REST_URL
UPSTASH_REDIS_REST_TOKEN=Upstash_REST_TOKEN
```

`UPSTASH_REDIS_REST_URL`과 `UPSTASH_REDIS_REST_TOKEN`은 로컬 개발에서는 생략할 수 있지만, production에서는 공개 OCR/KOBIS API 남용 방지를 위해 필요합니다.

### 3. 개발 서버 실행

```bash
bun run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하여 앱을 확인할 수 있습니다.

## 🛠 스크립트

*   `bun run dev`: 개발 서버를 실행합니다.
*   `bun run build`: 프로덕션용으로 앱을 빌드합니다.
*   `bun run start`: 빌드된 프로덕션 앱을 실행합니다.
*   `bun run lint`: ESLint를 사용하여 코드 린팅을 수행합니다.

## 🧪 테스트 방법

로컬 서버를 실행한 후 다음 흐름에 따라 정상 작동 여부를 테스트해 보세요.

1.  **포스터 업로드**: `[이미지 선택]` 버튼을 눌러 사진을 업로드하고 나타나는 크롭 모달에서 원하는 영역을 지정한 후 `[적용]`을 클릭합니다.
2.  **영화 검색**: 영화 정보 폼의 영화 제목 입력칸에 제목(예: "인터스텔라")을 입력하고 `[검색]` 버튼을 누르거나 엔터를 칩니다. 검색 결과에서 영화를 선택하면 제목이 자동 입력됩니다.
3.  **상세 정보 입력**: 관람일, 극장 위치, 상영관, 좌석 번호 등을 자유롭게 기입합니다.
4.  **디자인 적용**: 후가공 재질, 극장 체인, 상영 포맷을 변경해 가며 우측(또는 하단) 미리보기 캔버스에 로고와 질감이 실시간으로 적용되는지 확인합니다.
5.  **다운로드**: 캔버스 하단의 `[⬇️ JPEG 다운로드]` 버튼을 클릭하여 최종 결과물이 `960x1477` 해상도의 `.jpg` 파일로 저장되는지 확인합니다.

## 🏗 기술 스택

*   **Framework**: Next.js 16 (Pages Router)
*   **UI/Styling**: React 19, Tailwind CSS v3
*   **Image Processing**: 순수 Canvas API, react-easy-crop
*   **Language**: TypeScript
*   **Package Manager**: Bun
