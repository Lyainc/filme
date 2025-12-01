# 영화 포토티켓 생성 웹앱

## 프로젝트 개요

### 배경 및 목적
영화를 좋아하는 사람들이 관람한 영화를 기념하고 싶어하지만, 매번 외부 업체에 굿즈 제작을 의뢰하거나 복잡한 디자인 툴을 다루는 것은 현실적으로 어렵다. 특히 CGV 포토플레이 premium과 같은 즉석 인쇄 기계를 활용하려면 최적화된 사이즈와 디자인의 이미지가 필요하다.

본 프로젝트는 영화 정보와 포스터 이미지만 입력하면 자동으로 예쁜 디자인의 포토티켓 이미지를 생성해주는 웹 기반 도구를 제공한다. 생성된 이미지는 즉석 인쇄 기계에 바로 사용할 수 있도록 최적화되어 있어, 누구나 쉽게 나만의 영화 굿즈를 만들 수 있다.

### 타겟 사용자
- 영화를 즐겨 보는 사람들
- 영화 관람 기록을 예쁘게 남기고 싶은 사람들
- 디자인 툴을 다루기 어려운 일반 사용자
- CGV 포토플레이 등 즉석 인쇄 서비스를 이용하려는 사람들

### 핵심 가치 제안
1. **쉽고 간단하게**: 복잡한 디자인 작업 없이 정보만 입력하면 완성
2. **예쁜 디자인**: 전문적인 디자인 템플릿으로 즉시 고퀄리티 결과물 생성
3. **내 취향대로**: 다양한 템플릿과 커스터마이징 옵션 제공
4. **실용성**: CGV 포토플레이 premium 등 실제 인쇄 기계에 바로 사용 가능한 사양

### 참고 프로젝트
- [Paddie](https://github.com/C4NU/Paddie): EXIF 기반 포토티켓 생성 데스크톱 앱
  - 본 프로젝트는 영화 특화 + 웹 기반 + CGV 포토플레이 최적화에 초점

## 주요 기능 명세

### 1. 이미지 업로드 및 크롭

#### 1.1 자동 크롭 (MVP)
- **입력**: 사용자가 영화 포스터 이미지 업로드 (JPG, PNG, WebP 지원)
- **처리**: CGV 포토플레이 전체형 사양에 맞게 자동 크롭
  - 비율: 0.65:1 (960×1477px)
  - 신용카드 사이즈에 최적화
  - 이미지가 화면을 가득 채우도록 자동 조정
- **출력**: 크롭된 이미지 실시간 프리뷰

#### 1.2 수동 크롭 (고도화)
- 사용자가 직접 크롭 영역을 선택할 수 있는 인터랙티브 크롭 도구 제공
- 비율은 고정, 위치만 조정 가능

### 2. 영화 정보 입력

#### 2.1 수동 입력 (MVP)
사용자가 직접 입력하는 필드:
- **필수 항목**:
  - 영화 제목
  - 관람일 (형식: YYYY. MM. DD.)
- **선택 항목**:
  - 극장명 (텍스트 입력)
  - 상영관
  - 좌석 번호
  - 개인 평점 (별 5개 기준, 반 개 단위 선택 가능)
  - 한줄평 (짧은 텍스트)

#### 2.2 API 연동 자동 입력 (고도화)
- 영화 제목 검색 시 외부 API (TMDB, KOBIS 등)에서 메타 정보 자동 가져오기
- 가져온 정보를 기본값으로 채우고, 사용자가 수정 가능
- 포스터 이미지 자동 다운로드 옵션 제공

### 3. 컴포넌트 선택 시스템

사용자가 포토티켓에 추가할 시각적 요소를 선택:

#### 3.1 극장 체인 로고
- **옵션**: CGV, 롯데시네마, 메가박스, 씨네Q
- **표시 방식**: 각 체인의 공식 로고 이미지

#### 3.2 상영 포맷 아이콘/로고
- **옵션**:
  - IMAX
  - 4DX
  - ULTRA 4DX
  - ScreenX
  - MX4D
  - SUPER PLEX
  - DOLBY CINEMA
  - DOLBY Atmos
  - DOLBY Vision
  - DOLBY Atmos+Vision
  - 광음시네마
  - 광음LED
  - SLED
- **표시 방식**: 각 포맷의 공식 아이콘/로고

#### 3.3 기타 정보 컴포넌트
- 관람일자 (텍스트, 형식: YYYY. MM. DD.)
- 극장 위치 (텍스트)
- 평점 표시 (별 아이콘, 0~5점, 0.5점 단위)

#### 3.4 컴포넌트 배치 (MVP)
- 1개의 기본 레이아웃 템플릿 제공
- 컴포넌트들이 자동으로 정해진 위치에 배치됨
- 신용카드 사이즈를 고려한 가독성 있는 크기와 간격

#### 3.5 컴포넌트 배치 커스터마이징 (고도화)
- 사용자가 각 컴포넌트의 배치 위치를 선택 가능
- 드래그 앤 드롭 또는 위치 프리셋 선택

### 4. 실시간 프리뷰

- 모든 변경사항이 즉시 화면에 반영
- 예시:
  - 극장 체인을 "CGV"에서 "메가박스"로 변경 → 로고가 즉시 교체
  - 상영 포맷을 "IMAX"에서 "Dolby Cinema"로 변경 → 아이콘이 즉시 교체
  - 평점을 3.5에서 5.0으로 변경 → 별 표시가 즉시 업데이트
- 최종 출력물과 동일한 모습을 WYSIWYG 방식으로 확인

### 5. 이미지 다운로드

- **출력 포맷**: JPEG
- **해상도**: 960×1477px (CGV 포토플레이 전체형 사양)
- **파일명**: `phototicket_[영화제목]_[날짜].jpg` (자동 생성)
- **다운로드 방식**: 브라우저 기본 다운로드

### 6. 사용자 플로우

```
[1단계] 포스터 이미지 업로드
   ↓ (자동 크롭 적용)
[2단계] 영화 정보 입력 (제목, 날짜, 극장 등)
   ↓
[3단계] 컴포넌트 선택 (극장 체인, 상영 포맷 등)
   ↓ (실시간 프리뷰 확인)
[4단계] 최종 확인 및 다운로드
```

## 기술 스택

### MVP 단계 (프론트엔드 중심) ✅ 완료

#### 핵심 프레임워크
- **Next.js 16** (Pages Router) ✅
  - React 기반 풀스택 프레임워크
  - 파일 기반 라우팅
  - API Routes로 서버리스 함수 작성 가능
  - Vercel 배포 최적화
- **React 19** ✅
  - UI 컴포넌트 구조
- **TypeScript** ✅
  - 타입 안정성 확보
  - 1인 개발 시 버그 조기 발견

#### 이미지 처리
- **Canvas API (네이티브)** ⭐ 핵심 기술 ✅
  - 브라우저 네이티브 API (외부 라이브러리 불필요)
  - 이미지 위에 로고, 텍스트, 오버레이 직접 렌더링
  - 고품질 JPEG 내보내기
  - 960×1477px 해상도 출력 지원
  - **기술 변경 이유**: ~~Fabric.js~~ 제거
    - React Strict Mode와 충돌 (useEffect 이중 실행)
    - MVP는 고정 위치 레이아웃만 필요 (드래그 앤 드롭 불필요)
    - Phase 0에서 Canvas API만으로 충분히 검증됨
    - 120개 패키지 제거, 더 가벼운 번들

#### UI/스타일링
- **Tailwind CSS v3** ✅
  - 유틸리티 우선 CSS 프레임워크
  - 빠른 프로토타이핑
  - 반응형 디자인
  - **기술 변경**: Tailwind v4 → v3 다운그레이드 (PostCSS 플러그인 호환성)
- **shadcn/ui** (Phase 2 이후)
  - MVP에서는 기본 HTML 요소로 충분
- **react-rating-stars-component** (Phase 2 이후)
  - MVP에서는 별점 기능 미구현

#### 상태 관리
- **useState (React 내장)** ✅ MVP 선택
  - 추가 라이브러리 불필요
  - 단순한 구조로 충분
  - 영화 정보, 컴포넌트 선택 상태 관리
- **Zustand/Context API** (Phase 2 이후)
  - 상태가 복잡해지면 고려

#### 폰트
- **next/font**
  - Next.js 내장 폰트 최적화
  - Pretendard, 나눔글꼴 등 오픈소스 폰트 사용
  - 폰트 로딩 깜빡임 방지

### 고도화 단계

#### 수동 크롭 기능
- **react-image-crop**
  - 인터랙티브 크롭 UI
  - 비율 고정 (0.65:1)
  - 위치 조정 가능

#### 영화 API 연동
- **TMDB API**
  - 글로벌 영화 정보
  - 고품질 포스터 이미지
  - 무료 API 키 제공
- **KOBIS API** (선택)
  - 한국영화진흥위원회 제공
  - 국내 영화 정보, 박스오피스 데이터
- **Next.js API Routes**
  - 영화 API 프록시 (CORS 우회)
  - API 키 보안 처리

#### 데이터베이스 (고도화)
- **Supabase**
  - PostgreSQL 기반
  - 사용자 인증 (선택)
  - 포토티켓 히스토리 저장
  - 공개 갤러리 기능

### 최종 단계 (선택)

#### 백엔드 (필요 시)
- **Python FastAPI**
  - RESTful API
  - 대용량 이미지 처리
  - 배치 작업
  - 관리자 기능
- 현재 MVP에서는 불필요, Next.js만으로 충분

### 배포 및 인프라

- **Vercel**
  - Next.js 최적화 호스팅
  - 무료 플랜으로 시작 가능
  - 자동 CI/CD
  - 도메인 연결

### 개발 도구

- **Git + GitHub**
  - 버전 관리
  - 이슈 트래킹
- **ESLint + Prettier**
  - 코드 품질 관리
  - 일관된 코드 스타일
- **VS Code**
  - 권장 IDE
  - Tailwind CSS IntelliSense 확장

### 에셋 관리

- **로고/아이콘 파일**
  - 경로: `/public/assets/`
  - 극장 체인: `/public/assets/chains/`
  - 상영 포맷: `/public/assets/formats/`
  - 아이콘: `/public/assets/icons/`
  - 형식: SVG 또는 PNG (2x 해상도)
- **폰트 파일**
  - 경로: `/public/fonts/`
  - Pretendard, 나눔글꼴

### 기술적 제약사항 및 고려사항

1. **이미지 크기 제한**
   - 업로드 최대 10MB
   - 처리 전 자동 리사이징 (최대 2000px)
   - 브라우저 메모리 고려

2. **브라우저 호환성**
   - 모던 브라우저 (Chrome, Safari, Edge, Firefox)
   - Canvas API 지원 필수
   - 모바일 브라우저 지원

3. **성능 최적화**
   - 이미지 지연 로딩
   - 컴포넌트 메모이제이션
   - Fabric.js 인스턴스 재사용

4. **보안**
   - API 키는 환경 변수로 관리
   - Next.js API Routes로 프록시
   - 클라이언트 사이드에 민감 정보 노출 금지

## 설계 및 구조

### 프로젝트 디렉토리 구조

```
PhototicketMaker/
├── public/
│   ├── assets/
│   │   ├── chains/          # 극장 체인 로고
│   │   │   ├── cgv.svg
│   │   │   ├── lotte.svg
│   │   │   ├── megabox.svg
│   │   │   └── cineq.svg
│   │   ├── formats/         # 상영 포맷 로고
│   │   │   ├── imax.svg
│   │   │   ├── dolby-cinema.svg
│   │   │   ├── 4dx.svg
│   │   │   └── ...
│   │   └── icons/           # UI 아이콘
│   │       ├── star-filled.svg
│   │       ├── star-half.svg
│   │       └── star-empty.svg
│   └── fonts/               # 커스텀 폰트
├── src/
│   ├── pages/
│   │   ├── index.tsx        # 메인 페이지
│   │   └── api/             # API Routes (고도화)
│   │       └── movies/
│   │           └── search.ts
│   ├── components/
│   │   ├── ImageUploader.tsx       # 이미지 업로드
│   │   ├── ImageCropper.tsx        # 이미지 크롭
│   │   ├── MovieInfoForm.tsx       # 영화 정보 입력
│   │   ├── ComponentSelector.tsx   # 컴포넌트 선택
│   │   ├── PhototicketCanvas.tsx   # Fabric.js 캔버스
│   │   ├── PreviewPanel.tsx        # 실시간 프리뷰
│   │   └── DownloadButton.tsx      # 다운로드 버튼
│   ├── hooks/
│   │   ├── usePhototicket.ts       # 포토티켓 상태 관리
│   │   └── useImageCrop.ts         # 이미지 크롭 로직
│   ├── utils/
│   │   ├── imageCrop.ts            # 자동 크롭 로직
│   │   ├── canvasExport.ts         # JPEG 내보내기
│   │   └── constants.ts            # 상수 정의
│   ├── types/
│   │   └── index.ts                # TypeScript 타입 정의
│   └── styles/
│       └── globals.css             # Tailwind CSS
├── .env.local                      # 환경 변수
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### 데이터 구조

#### PhototicketData 타입

```typescript
interface PhototicketData {
  // 이미지
  posterImage: File | null;
  croppedImageUrl: string | null;

  // 영화 정보
  movieInfo: {
    title: string;
    watchDate: string; // YYYY. MM. DD.
    theater?: string;
    screen?: string;
    seat?: string;
    rating?: number; // 0-5, 0.5 단위
    review?: string;
  };

  // 컴포넌트 선택
  components: {
    chain?: 'cgv' | 'lotte' | 'megabox' | 'cineq';
    formats?: Array<
      'imax' | '4dx' | 'ultra4dx' | 'screenx' | 'mx4d' |
      'superplex' | 'dolby-cinema' | 'dolby-atmos' |
      'dolby-vision' | 'dolby-av' | 'gwangeum' |
      'gwangeum-led' | 'sled'
    >;
  };

  // 레이아웃 (고도화)
  layout?: {
    template: 'default' | 'custom';
    componentPositions?: Record<string, { x: number; y: number }>;
  };
}
```

#### 템플릿 구조 (MVP)

```typescript
interface Template {
  id: 'default';
  name: '기본 템플릿';
  layout: {
    posterArea: { x: 0, y: 0, width: 960, height: 1477 };
    chainLogo: { x: 40, y: 40, width: 120, height: 40 };
    formatLogos: { x: 40, y: 100, spacing: 10 };
    movieTitle: { x: 40, y: 1300, fontSize: 32, fontWeight: 'bold' };
    watchDate: { x: 40, y: 1350, fontSize: 20 };
    rating: { x: 40, y: 1400, starSize: 24 };
  };
}
```

### 핵심 로직 플로우

#### 1. 이미지 크롭 플로우

```
사용자 이미지 업로드
    ↓
이미지 로드 및 크기 확인
    ↓
타겟 비율 0.65:1 계산
    ↓
[자동 크롭 모드]
  이미지를 비율에 맞게 중앙 크롭
  Canvas에 그리기
    ↓
크롭된 이미지 URL 생성
    ↓
상태 업데이트 → 프리뷰 반영
```

#### 2. 포토티켓 생성 플로우

```
Fabric.js Canvas 초기화 (960×1477px)
    ↓
크롭된 포스터 이미지를 배경으로 설정
    ↓
컴포넌트 레이어 추가:
  - 극장 체인 로고
  - 상영 포맷 로고(들)
  - 영화 제목 텍스트
  - 관람 날짜 텍스트
  - 별점 아이콘
    ↓
각 레이어 위치 및 스타일 적용
    ↓
실시간 렌더링 → 프리뷰
```

#### 3. 다운로드 플로우

```
다운로드 버튼 클릭
    ↓
Fabric.js Canvas를 JPEG로 변환
  - 품질: 95%
  - 해상도: 960×1477px
    ↓
Blob 생성
    ↓
파일명 생성: phototicket_[제목]_[날짜].jpg
    ↓
브라우저 다운로드 트리거
```

### UI/UX 설계 원칙

1. **모바일 우선 반응형 디자인**
   - 모바일에서도 편리한 입력
   - 터치 인터랙션 최적화

2. **단계별 명확한 진행 표시**
   - 스텝 인디케이터
   - 각 단계별 완료 상태 표시

3. **실시간 피드백**
   - 모든 변경사항 즉시 프리뷰 반영
   - 로딩 상태 명확히 표시

4. **간결한 인터페이스**
   - 불필요한 옵션 최소화
   - 직관적인 아이콘과 레이블

5. **접근성**
   - 키보드 네비게이션 지원
   - 충분한 대비율
   - 의미 있는 alt 텍스트

### API 설계 (고도화 단계)

#### 영화 검색 API

```
GET /api/movies/search?q=[영화제목]

Response:
{
  "results": [
    {
      "id": "12345",
      "title": "인터스텔라",
      "posterUrl": "https://...",
      "releaseDate": "2014-11-06",
      "director": "크리스토퍼 놀란"
    }
  ]
}
```

### 성능 목표

- **초기 로딩 시간**: 3초 이내
- **이미지 업로드 → 크롭**: 1초 이내
- **컴포넌트 변경 → 프리뷰**: 즉시 (100ms 이내)
- **다운로드 생성**: 2초 이내
- **모바일 지원**: iOS Safari, Android Chrome

## 개발 계획

### Phase 0: 프로토타입 검증 ✅ 완료

**목표**: 단일 HTML 파일로 핵심 이미지 처리 로직 검증

#### 배경
- JavaScript 학습 곡선 최소화
- npm, 프레임워크 설정 없이 빠른 검증
- 브라우저만으로 즉시 테스트 가능

#### 구현 방식
- **파일**: `prototype.html` 단일 파일
- **실행**: 브라우저에서 파일 열기 (로컬 파일)
- **라이브러리**: Fabric.js (CDN)
- **UI**: 최소한 (파일 업로드, 캔버스, 다운로드 버튼)

#### 구현 내용
- 이미지 파일 업로드 input
- 자동 크롭 로직 (0.65:1 비율, 중앙 정렬)
- Fabric.js Canvas (960×1477px)
- 하드코딩된 에셋 합성 (텍스트, 로고)
- JPEG 다운로드 버튼
- WebP 포맷 지원

**완료 기준**: ✅ 모두 달성
- ✅ 이미지 업로드 → 자동 크롭 → 프리뷰 표시
- ✅ 하드코딩된 텍스트/로고가 이미지에 합성됨
- ✅ 960×1477px JPEG 다운로드 성공
- ✅ JPG, PNG, WebP 모두 정상 작동

**검증 결과**:
- Canvas API로 비율 계산 및 크롭 성공
- Fabric.js 레이어 시스템으로 에셋 합성 용이
- 브라우저만으로 완전한 이미지 처리 가능
- 모든 주요 이미지 포맷 지원

**실제 소요 시간**: 반나일

**다음 단계**: Phase 1 (Next.js)로 코드 이전

---

### Phase 1: MVP (최소 기능 제품) ✅ 완료 - 2024.12.01

**목표**: Next.js 기반 완전한 웹앱 구현

#### 1.1 개발 환경 설정 ✅
- [x] Next.js 16 + TypeScript 프로젝트 초기화
- [x] Tailwind CSS v3 설정
- [x] ~~Fabric.js~~ → Canvas API 전환 (React 호환성 문제 해결)
- [x] 기본 디렉토리 구조 구성 (src/pages, src/components, src/utils)

#### 1.2 이미지 처리 기능 ✅
- [x] 이미지 업로드 컴포넌트 (JPG, PNG, WebP)
- [x] 자동 크롭 로직 구현 (0.65:1 비율) - `src/utils/imageCrop.ts`
- [x] Canvas에 크롭된 이미지 표시 - `PhototicketCanvas` 컴포넌트

#### 1.3 정보 입력 폼 ✅
- [x] 영화 제목 입력 (text input)
- [x] 관람일 입력 (text input, 수동 형식)
- [x] 극장명 입력 (text input)
- [ ] ~~상영관, 좌석 입력~~ (Phase 2 이후)
- [ ] ~~별점 선택 UI~~ (Phase 2 이후)

#### 1.4 컴포넌트 선택 UI ✅
- [x] 극장 체인 선택 (CGV, 롯데시네마, 메가박스, 씨네Q)
- [x] 상영 포맷 선택 (IMAX, 4DX, DOLBY CINEMA, ScreenX, 5개 핵심 포맷)
- [x] select 드롭다운 방식

#### 1.5 포토티켓 생성 엔진 ✅
- [x] Canvas API로 Canvas 구성 (960×1477px)
- [x] 기본 템플릿 1개 구현
- [x] 컴포넌트 자동 배치 로직 (고정 위치)
- [x] 텍스트 렌더링 (Arial, 웹폰트는 Phase 2)
- [x] 하단 오버레이 (반투명 검정색)
- [x] 상단 체인/포맷 렌더링

#### 1.6 실시간 프리뷰 ✅
- [x] 상태 변경 → Canvas 업데이트 (useEffect)
- [x] 2-column 레이아웃 (입력 폼 | 프리뷰)

#### 1.7 다운로드 기능 ✅
- [x] Canvas → JPEG 변환 (0.95 품질)
- [x] 파일명 자동 생성 (`phototicket_[제목].jpg`)
- [x] 브라우저 다운로드 - `src/utils/canvasExport.ts`

**완료 기준**: ✅ 모두 달성
- ✅ 로컬에서 전체 플로우 완전 작동
- ✅ 960×1477px JPEG 출력 성공
- ✅ 기본 템플릿 1개로 포토티켓 생성 가능
- ✅ 정상 작동 확인 완료

**실제 소요 시간**: 1일

**주요 학습**:
- **Fabric.js 제거 결정**: React Strict Mode와 충돌, Canvas API로 충분
- **Tailwind v4 → v3 다운그레이드**: PostCSS 플러그인 호환성
- **단순한 상태 관리**: useState로 충분, Context/Zustand 불필요
- **Phase 0 검증의 중요성**: 프로토타입으로 핵심 로직 미리 검증

**Phase 2로 이월된 기능**:
- 수동 크롭
- 영화 API 연동
- 웹폰트 (Pretendard)
- 별점 UI
- 상영관/좌석 입력

---

### Phase 2: 고도화 - 사용성 개선

**목표**: 사용자 경험 향상, 외부 공개 준비

#### 2.1 수동 크롭 기능
- react-image-crop 통합
- 비율 고정 크롭 UI
- 크롭 미리보기

#### 2.2 영화 API 연동
- TMDB API 연동
- Next.js API Routes 구현
- 영화 검색 및 자동 완성
- 포스터 이미지 자동 다운로드

#### 2.3 UI/UX 개선
- 로딩 상태 표시
- 에러 처리 및 알림
- 스텝 인디케이터 추가
- 모바일 최적화

#### 2.4 배포
- Vercel 배포 설정
- 환경 변수 설정
- 도메인 연결 (선택)
- 외부 사용자 테스트

**완료 기준**:
- ✅ 영화 제목 입력 시 자동 완성
- ✅ 수동 크롭으로 원하는 영역 선택 가능
- ✅ 공개 URL로 접근 가능
- ✅ 모바일에서도 정상 작동

**예상 기간**: 2-3주

---

### Phase 3: 고도화 - 데이터 및 커뮤니티

**목표**: 사용자 데이터 저장, 공유 기능

#### 3.1 Supabase 연동
- Supabase 프로젝트 설정
- 데이터베이스 스키마 설계
- 사용자 인증 (선택)

#### 3.2 히스토리 기능
- 생성한 포토티켓 저장
- 내 히스토리 페이지
- 재편집 기능

#### 3.3 갤러리 기능
- 공개 포토티켓 갤러리
- 좋아요, 공유 기능
- 필터 및 검색

#### 3.4 커스터마이징 확장
- 컴포넌트 위치 수동 조정
- 드래그 앤 드롭
- 다양한 템플릿 추가

**완료 기준**:
- ✅ 사용자별 히스토리 저장
- ✅ 갤러리에서 다른 사용자 작품 확인
- ✅ 다양한 레이아웃 선택 가능

**예상 기간**: 3-4주

---

### Phase 4: 최적화 및 확장 (선택)

**목표**: 성능 최적화, 고급 기능 추가

#### 4.1 성능 최적화
- 이미지 최적화 (CDN)
- 코드 스플리팅
- 캐싱 전략

#### 4.2 FastAPI 백엔드 (필요 시)
- Python FastAPI 서버 구축
- 이미지 처리 오프로드
- 관리자 대시보드

#### 4.3 고급 기능
- 포토티켓 배치 생성
- 템플릿 마켓플레이스
- 맞춤 폰트 업로드

**완료 기준**:
- ✅ 페이지 로딩 시간 1초 이내
- ✅ 동시 사용자 100명 이상 처리
- ✅ 관리자 도구 완성

**예상 기간**: 4-6주

---

### 개발 우선순위

1. **P0 (필수)**: Phase 1 전체 - MVP 핵심 기능
2. **P1 (중요)**: Phase 2 - API 연동, 사용성 개선
3. **P2 (선택)**: Phase 3 - 데이터 저장, 커뮤니티
4. **P3 (나중)**: Phase 4 - 최적화, 확장

### 위험 요소 및 대응 방안

| 위험 요소 | 영향도 | 대응 방안 |
|----------|-------|----------|
| Fabric.js 성능 이슈 | 중 | 이미지 크기 제한, 최적화 |
| 브라우저 호환성 | 중 | 폴리필, 브라우저 체크 |
| 로고 저작권 이슈 | 고 | 공식 에셋 사용, 라이선스 확인 |
| 모바일 Canvas 렌더링 | 중 | 모바일 전용 최적화, 테스트 |
| 영화 API 제한 | 저 | 캐싱, Rate Limiting |

### 성공 지표 (KPI)

**MVP 단계**:
- 전체 플로우 에러 없이 완료: 100%
- 출력 이미지 품질 만족도: 개인 평가

**공개 후**:
- 일일 활성 사용자 (DAU): 10명 이상
- 포토티켓 생성 완료율: 80% 이상
- 평균 생성 시간: 3분 이내
- 모바일 사용 비율: 50% 이상

### 다음 단계

1. **개발 환경 설정**: Next.js 프로젝트 초기화
2. **에셋 수집**: 극장, 포맷 로고 준비
3. **Phase 1 시작**: 이미지 업로드 및 크롭 기능 구현

