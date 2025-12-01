# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**영화 포토티켓 생성 웹앱** - CGV 포토플레이 premium 기계에 최적화된 포토티켓 이미지를 생성하는 웹 애플리케이션

### 핵심 목표
- 영화 포스터 + 관람 정보 입력 → 즉시 인쇄 가능한 포토티켓 생성
- 출력 사양: 960×1477px (0.65:1 비율), JPEG
- 신용카드 사이즈 출력 최적화

### 참고 문서
- **PRD.md**: 전체 프로젝트 요구사항 명세서 (상세 기능, 기술 스택, 개발 계획)
- PRD를 먼저 읽고 전체 맥락을 파악할 것

## 프로젝트 상태

**현재**: Phase 1 MVP 완성! 정상 작동 확인 ✅

### 개발 Phase
- **Phase 0 (프로토타입)**: ✅ 완료 - prototype.html로 핵심 로직 검증
- **Phase 1 (MVP)**: ✅ 완료 - Next.js 웹앱 구현, 모든 핵심 기능 작동
- **Phase 2**: 영화 API 연동, 수동 크롭, 배포 (다음)
- **Phase 3**: Supabase 연동, 히스토리, 갤러리
- **Phase 4**: 성능 최적화, 고급 기능 (선택)

## 기술 스택

### 핵심 기술 (MVP 완성)
```
Next.js 16 (Pages Router) + React 19 + TypeScript
순수 Canvas API (이미지 합성 ⭐ 네이티브)
Tailwind CSS v3
```

### 주요 라이브러리
- **Canvas API**: 브라우저 네이티브, 이미지 합성 및 텍스트 렌더링
- **react-image-crop**: 수동 크롭 (Phase 2 예정)
- **상태 관리**: useState만 사용 (Context/Zustand 불필요)

### 배포
- Vercel (Next.js 최적화)

## 개발 스타일: 바이브 코딩

이 프로젝트는 **바이브 코딩** 방식으로 진행됩니다.

### 프로토타입 전략 (JavaScript 초보자용)

**Phase 0: 단일 HTML 프로토타입**으로 시작합니다.
- **파일**: `prototype.html` 하나만
- **실행**: 브라우저에서 파일 열기 (더블클릭)
- **의존성**: CDN으로 Fabric.js 로드 (npm 불필요)
- **목표**: 크롭 → 합성 → 다운로드 3가지 핵심 기능 검증

성공하면 → Next.js로 이전

### 바이브 코딩 원칙
1. **빠르게 동작하는 것부터**: 완벽한 구조보다 작동하는 코드 우선
2. **점진적 개선**: 일단 만들고 → 테스트하고 → 리팩토링
3. **최소한의 추상화**: 필요할 때만 추상화, 과도한 설계 지양
4. **실용주의**: "지금 필요한가?" 질문하고, 아니면 나중으로

### Coding Assistant 활용 전략

#### ✅ DO: 이렇게 요청하세요
- "일단 동작하는 버전부터 만들어줘"
- "이 기능 빠르게 프로토타입 만들자"
- "나중에 리팩토링할 부분은 주석으로 표시해줘"
- "최소한의 코드로 구현해줘"
- "하드코딩해도 괜찮으니 빠르게"

#### ❌ DON'T: 이런 요청은 피하세요
- "완벽한 아키텍처로 설계해줘"
- "모든 엣지 케이스 처리해줘"
- "확장 가능한 구조로 만들어줘" (필요하기 전까지)
- "추상화 레이어 추가해줘" (명확한 이유 없이)

### Coding Assistant에게 주는 지침

#### 코드 생성 시
1. **일단 동작하는 코드**: 복잡한 타입, 에러 처리는 나중에
2. **하드코딩 OK**: 설정 파일, 추상화보다 직접 값 사용
3. **TODO 주석 활용**: 나중에 개선할 부분은 `// TODO: [Phase 2] ...` 형식으로 표시
4. **최소 의존성**: 새 라이브러리 추가 전에 기존 것으로 해결 가능한지 확인

#### 리팩토링 시점 (이럴 때만)
- 같은 코드가 3번 이상 반복될 때
- 코드가 너무 길어서 (300줄+) 읽기 힘들 때
- 버그를 여러 번 고쳐야 할 때
- 성능 문제가 실제로 발생했을 때

## 코딩 컨벤션

### 파일 및 컴포넌트 명명
- 컴포넌트: PascalCase (`ImageUploader.tsx`)
- 훅: camelCase with `use` prefix (`usePhototicket.ts`)
- 유틸: camelCase (`imageCrop.ts`)
- 타입: PascalCase interface/type (`PhototicketData`)

### 코드 스타일
```typescript
// ✅ 좋은 예: 간단하고 직접적
const cropImage = (file: File) => {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 1477;
  // ... 직접 구현
};

// ❌ 나쁜 예: 과도한 추상화 (아직 필요 없음)
const cropImage = (file: File, config: CropConfig) => {
  const strategy = CropStrategyFactory.create(config);
  return strategy.execute(file);
};
```

### TypeScript 사용
- **MVP**: `any` 사용해도 OK, 나중에 타입 추가
- **인터페이스**: 실제로 여러 곳에서 쓸 때만 정의
- **타입 추론**: 명시적 타입보다 추론 활용

### 주석 원칙
```typescript
// ✅ 좋은 주석: 왜(Why)를 설명
// CGV 포토플레이는 0.65:1 비율 필수
const ASPECT_RATIO = 0.65;

// TODO: [Phase 2] API 연동 시 동적으로 가져오기
const THEATER_CHAINS = ['CGV', '롯데시네마', '메가박스', '씨네Q'];

// ❌ 나쁜 주석: 코드가 하는 일 반복
// 너비를 960으로 설정
canvas.width = 960;
```

## 디렉토리 구조 (MVP 완성 시)

```
PhototicketMaker/
├── public/
│   └── assets/           # 로고, 아이콘 (SVG/PNG)
│       ├── chains/       # CGV, 롯데, 메가박스, 씨네Q
│       ├── formats/      # IMAX, Dolby 등
│       └── icons/        # 별 아이콘 등
├── src/
│   ├── pages/
│   │   └── index.tsx     # 메인 페이지 (단일 페이지로 시작)
│   ├── components/       # React 컴포넌트
│   ├── hooks/            # 커스텀 훅
│   ├── utils/            # 유틸 함수
│   ├── types/            # TypeScript 타입
│   └── styles/           # Tailwind CSS
└── 설정 파일들
```

## 핵심 기능 구현 가이드

### 1. 이미지 크롭 (자동)
```typescript
// 목표: 업로드한 이미지를 0.65:1 비율로 자동 크롭
// 구현: Canvas API로 중앙 크롭
// 출력: Blob 또는 Data URL
```

### 2. Canvas API (네이티브)
```typescript
// 목표: 960×1477px 캔버스에 이미지 + 로고 + 텍스트 합성
// ⚠️ Fabric.js 제거됨 - 순수 Canvas API 사용
// 핵심 API:
// - canvas.getContext('2d')
// - ctx.drawImage()
// - ctx.fillText()
// - ctx.fillRect() (오버레이)
// - canvas.toDataURL('image/jpeg')
```

### 3. 실시간 프리뷰
```typescript
// 목표: 상태 변경 시 즉시 Canvas 업데이트
// 방법: useEffect로 상태 감지 → Canvas 리렌더링
```

### 4. 다운로드
```typescript
// 목표: Canvas → JPEG → 다운로드
// 구현: canvas.toDataURL() → Blob → a.download
```

## 데이터 구조 (핵심만)

```typescript
// 포토티켓 상태 (전역 또는 Context)
interface PhototicketState {
  posterImage: File | null;
  movieInfo: {
    title: string;
    watchDate: string; // YYYY. MM. DD.
    rating?: number;
  };
  components: {
    chain?: string;      // 'cgv' | 'lotte' | ...
    formats?: string[];  // ['imax', 'dolby-cinema']
  };
}
```

## 개발 시 자주 참조할 것

### CGV 포토플레이 사양
- **해상도**: 960×1477px
- **비율**: 0.65:1 (width:height)
- **포맷**: JPEG
- **출력**: 신용카드 사이즈

### 컴포넌트 목록
- **극장 체인**: CGV, 롯데시네마, 메가박스, 씨네Q
- **상영 포맷**: IMAX, 4DX, ULTRA 4DX, ScreenX, MX4D, SUPER PLEX, DOLBY CINEMA, DOLBY Atmos, DOLBY Vision, DOLBY Atmos+Vision, 광음시네마, 광음LED, SLED

### 템플릿 레이아웃 (MVP 기본)
```
[포스터 이미지 - 전체 배경]
  ↑ 상단 영역
  [극장 체인 로고]
  [상영 포맷 로고들]

  ↓ 하단 영역
  [영화 제목]
  [관람일]
  [별점]
```

## 문제 해결 가이드

### Canvas API 관련
- **이미지 로딩 안됨**: `img.onload` 콜백 확인
- **폰트 안 보임**: `ctx.font` 설정, 웹폰트 로딩 대기
- **해상도 흐림**: `canvas.width/height` 정확히 설정
- **React 통합**: useEffect + useRef로 관리, cleanup 필요

### Canvas 관련
- **모바일 성능**: 이미지 크기 2000px 이하로 제한
- **CORS 에러**: 이미지는 같은 도메인 또는 CORS 허용 필요

### 일반적인 이슈
- **상태 업데이트 느림**: 불필요한 리렌더링 체크
- **파일 업로드 안됨**: input accept 속성, File API 확인

## 명령어 (개발 환경 설정 후)

```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 타입 체크
npm run type-check

# 린트
npm run lint
```

## Phase별 핵심 태스크

### Phase 0 (프로토타입 검증) ✅ 완료
**목표**: 단일 HTML 파일로 핵심 로직 검증
- [x] prototype.html 생성
- [x] 이미지 업로드 UI
- [x] 자동 크롭 로직 구현 (0.65:1 비율, 중앙 정렬)
- [x] Fabric.js로 에셋 합성 (하드코딩)
- [x] JPEG 다운로드 (960×1477px)
- [x] WebP 포맷 지원 추가

**검증 완료**:
✅ Canvas API로 이미지 크롭 동작 확인
✅ Fabric.js로 텍스트/오버레이 합성 가능
✅ JPEG 다운로드 정상 작동 (960×1477px)
✅ JPG, PNG, WebP 모두 지원

**핵심 학습**:
- 크롭 로직: 비율 계산 → 중앙 정렬 → Canvas drawImage
- 이미지 합성: Canvas API만으로도 충분 (Fabric.js는 Phase 1에서 재검토)
- 다운로드: canvas.toDataURL() → Blob → download

**Phase 1으로 이전한 코드**:
- `src/utils/imageCrop.ts`: cropImage() 함수
- `src/utils/canvasExport.ts`: downloadCanvasAsJPEG() 함수
- Canvas 렌더링 로직 → PhototicketCanvas 컴포넌트

---

### Phase 1 (MVP) ✅ 완료 - 2024.12.01
**목표**: Next.js 기반 웹앱으로 확장

**완료된 태스크**:
- [x] Next.js 16 프로젝트 초기화 (TypeScript + Tailwind v3)
- [x] Phase 0 코드 이전 및 컴포넌트 분리
  - [x] `src/utils/imageCrop.ts` 생성
  - [x] `src/utils/canvasExport.ts` 생성
  - [x] `src/components/PhototicketCanvas.tsx` 생성
- [x] 영화 정보 입력 폼 (제목, 날짜, 극장)
- [x] 컴포넌트 선택 UI (극장 체인 4개, 상영 포맷 5개)
- [x] 상태 관리 (useState - 단순 구조)
- [x] 실시간 프리뷰 업데이트 (useEffect)
- [x] UI 레이아웃 (2-column grid, Tailwind)
- [x] JPEG 다운로드 기능

**완료 기준 검증**:
✅ 사용자가 정보를 입력하면 즉시 프리뷰에 반영
✅ 컴포넌트 선택 시 실시간 업데이트
✅ 다운로드 시 입력한 정보가 포함된 포토티켓 생성 (960×1477px JPEG)
✅ 정상 작동 확인 완료

**주요 기술 결정**:
- **Fabric.js 제거**: React Strict Mode와 충돌, 순수 Canvas API로 전환
  - 제거 이유: useEffect 이중 실행으로 "canvas already initialized" 에러
  - 해결: Phase 0에서 Canvas API로 충분히 검증됨
  - 결과: 120개 패키지 제거, 더 가벼운 번들 사이즈
- **Tailwind CSS v4 → v3 다운그레이드**: PostCSS 플러그인 호환성 문제
- **상태 관리**: Context/Zustand 대신 useState 사용 (충분히 단순한 구조)

**Phase 2로 가져갈 것**:
- 현재 코드베이스 유지 (안정적으로 작동)
- Canvas API 패턴 (useEffect + useRef)
- 단순한 상태 관리 구조

### Phase 2 (고도화) - 다음 세션
- [ ] 수동 크롭 (react-image-crop)
- [ ] TMDB API 연동
- [ ] Vercel 배포
- [ ] 웹폰트 (Pretendard)
- [ ] 로고 에셋 (극장 체인, 상영 포맷)

### Phase 3 (데이터)
- [ ] Supabase 연동
- [ ] 히스토리 저장

---

## 다음 세션 준비 사항 (Next Session Checklist)

### 개발 환경 확인

**개발 서버 실행**:
```bash
cd /Users/byeonghyeonlim/Library/CloudStorage/Dropbox/Projects/PhototicketMaker
npm run dev
```
- 서버 주소: http://localhost:3000
- 자동 재시작: 파일 저장 시 Hot Reload

**정상 작동 테스트**:
1. [ ] 이미지 업로드 (JPG/PNG/WebP)
2. [ ] 자동 크롭 확인
3. [ ] 영화 정보 입력 (제목, 날짜, 극장)
4. [ ] 컴포넌트 선택 (극장 체인, 상영 포맷)
5. [ ] 실시간 프리뷰 업데이트
6. [ ] JPEG 다운로드 (960×1477px)

### Phase 1 완료 상태 요약

**작동하는 기능**: ✅ 모두 정상
- 이미지 업로드 및 자동 크롭
- 동적 정보 입력
- 실시간 Canvas 렌더링
- JPEG 다운로드

**기술 스택**:
- Next.js 16 + React 19 + TypeScript
- Canvas API (네이티브)
- Tailwind CSS v3
- useState (상태 관리)

**핵심 파일**:
- `src/pages/index.tsx`: 메인 페이지
- `src/components/PhototicketCanvas.tsx`: Canvas 렌더링
- `src/utils/imageCrop.ts`: 크롭 로직
- `src/utils/canvasExport.ts`: 다운로드

### Phase 2 시작 전 준비물

1. **API 키**:
   - [ ] TMDB API 키 발급: https://www.themoviedb.org/settings/api

2. **에셋 수집**:
   - [ ] 극장 체인 로고 (SVG/PNG):
     - CGV
     - 롯데시네마
     - 메가박스
     - 씨네Q
   - [ ] 상영 포맷 로고:
     - IMAX
     - 4DX
     - DOLBY CINEMA
     - ScreenX
     - 기타 포맷들

3. **폰트**:
   - [ ] Pretendard 폰트 다운로드
   - [ ] `public/fonts/` 디렉토리에 배치

### Phase 2 우선순위

**P0 (필수)**:
1. 수동 크롭 기능 (react-image-crop)
2. TMDB API 연동 (영화 검색, 포스터 자동 로드)
3. 웹폰트 적용 (Pretendard)

**P1 (중요)**:
4. 로고 에셋 통합 (실제 극장/포맷 로고)
5. UI/UX 개선 (로딩, 에러 처리)
6. 별점 UI

**P2 (선택)**:
7. Vercel 배포
8. 모바일 최적화

### 주의사항

**보존해야 할 것**:
- ✅ Canvas API 패턴 (useEffect + useRef)
- ✅ 크롭 로직 (`imageCrop.ts`)
- ✅ 다운로드 로직 (`canvasExport.ts`)
- ✅ 단순한 상태 관리 (useState)

**개선할 것** (Phase 2):
- 타입 정의: `(window as any)` 제거
- 에러 처리: try-catch, 사용자 피드백
- 로딩 상태: 이미지 처리 중 표시
- 코드 정리: 주석, 매직 넘버 상수화

### 참고 문서

- **PHASE0_LESSONS.md**: Phase 0 프로토타입 학습 내용
- **PHASE1_LESSONS.md**: Phase 1 MVP 학습 내용 (⭐ 중요)
- **PRD.md**: 전체 프로젝트 요구사항
- **package.json**: 현재 설치된 패키지 (3개 production)

### 트러블슈팅 가이드

**문제**: 개발 서버 실행 안됨
```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
npm run dev
```

**문제**: Canvas 렌더링 안됨
- 브라우저 콘솔 확인
- `croppedImageUrl` 상태 확인
- Image.onload 콜백 확인

**문제**: 다운로드 안됨
- `(window as any).phototicketCanvas` 확인
- Canvas가 렌더링되었는지 확인

---

## 특이사항 및 주의사항

1. **에셋 준비 필요**: 극장/포맷 로고는 별도로 준비, 일단 placeholder로 진행 가능
2. **폰트**: Pretendard 또는 나눔글꼴 사용, next/font로 최적화
3. **저작권**: 로고 사용 시 공식 에셋 확인 필요 (개인 프로젝트이므로 일단 진행)
4. **MVP 범위**: 완벽보다 동작하는 것, 1개 템플릿으로 충분

## 개발 철학

> "일단 만들고, 테스트하고, 필요하면 고친다."

- 완벽한 코드는 나중에
- 동작하는 프로토타입이 최우선
- 사용자 피드백 받고 개선
- 과도한 최적화는 시간 낭비

## 언어 규칙

- **모든 UI 텍스트**: 한국어
- **코드 주석**: 한국어
- **변수/함수명**: 영어 (camelCase)
- **커밋 메시지**: 한국어 또는 영어 (일관성 유지)
