# Phase 1 학습 내용 정리

**작성일**: 2024.12.01
**Phase**: Phase 1 MVP 완료

## 개요

Phase 0 프로토타입을 Next.js 웹앱으로 성공적으로 전환했습니다. 이 문서는 Phase 1 개발 과정에서 배운 핵심 내용, 기술적 결정, 문제 해결 방법을 정리합니다.

---

## 주요 성과

### 완성된 기능
- ✅ 이미지 업로드 및 자동 크롭 (JPG, PNG, WebP)
- ✅ 영화 정보 입력 폼 (제목, 날짜, 극장)
- ✅ 컴포넌트 선택 (극장 체인 4개, 상영 포맷 5개)
- ✅ 실시간 프리뷰
- ✅ JPEG 다운로드 (960×1477px)

### 기술 스택 확정
- Next.js 16 (Pages Router)
- React 19
- TypeScript
- Tailwind CSS v3
- **Canvas API (네이티브)** - Fabric.js 제거

---

## 핵심 기술 결정

### 1. Fabric.js 제거 → Canvas API 전환

#### 문제 상황
Fabric.js v6를 Next.js + React 19 환경에서 사용하려다 여러 문제 발생:
1. 모듈 import 구조 변경 (v6는 named exports)
2. React Strict Mode와 충돌 (useEffect 이중 실행)
3. "fabric: canvas already initialized" 에러 반복

#### 시도한 해결책
```typescript
// 시도 1: 기존 방식 (실패)
import('fabric').then(({ fabric }) => { ... })

// 시도 2: 모듈 전체 import (실패)
import('fabric').then((fabricModule) => {
  const fabric = fabricModule.fabric; // undefined
})

// 시도 3: Named imports (여전히 React 충돌)
const { Canvas, Image, Rect, Text } = fabricModule;
```

#### 최종 결정: Fabric.js 제거
**이유**:
- Phase 0에서 Canvas API만으로도 충분히 검증됨
- MVP는 고정 위치 레이아웃만 필요 (드래그 앤 드롭 불필요)
- 120개 패키지 제거 → 더 가벼운 번들
- React 라이프사이클과의 호환성 개선

**결과**: 모든 기능 정상 작동 ✅

---

### 2. Canvas API 패턴 (React 통합)

#### 핵심 코드 패턴
```typescript
// src/components/PhototicketCanvas.tsx
export default function PhototicketCanvas({
  croppedImageUrl, movieTitle, watchDate, theater, chain, format
}: PhototicketCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !croppedImageUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas 크기 설정
    canvas.width = TARGET_WIDTH;
    canvas.height = TARGET_HEIGHT;

    // 배경 검은색
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

    // 이미지 로드 및 렌더링
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);

      // 오버레이
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, TARGET_HEIGHT - 200, TARGET_WIDTH, 200);

      // 텍스트 렌더링
      if (movieTitle) {
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(movieTitle, 40, TARGET_HEIGHT - 140);
      }

      // ... 더 많은 텍스트

      // Canvas를 window에 노출 (다운로드용)
      (window as any).phototicketCanvas = canvas;
    };

    img.src = croppedImageUrl;
  }, [croppedImageUrl, movieTitle, watchDate, theater, chain, format]);

  return <canvas ref={canvasRef} className="border border-gray-300 max-w-full h-auto" />;
}
```

#### 학습 포인트
1. **useRef로 Canvas DOM 접근**: `canvasRef.current`
2. **useEffect 의존성 배열**: 상태 변경 시 자동 리렌더링
3. **Image.onload 패턴**: 비동기 이미지 로딩 처리
4. **window 노출**: 다른 컴포넌트에서 Canvas 접근 (다운로드용)

---

### 3. 이미지 크롭 로직 (Phase 0 재사용)

#### 핵심 알고리즘
```typescript
// src/utils/imageCrop.ts
export const TARGET_WIDTH = 960;
export const TARGET_HEIGHT = 1477;
export const TARGET_RATIO = TARGET_WIDTH / TARGET_HEIGHT; // 0.65:1

export async function cropImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const imgRatio = img.width / img.height;
        let cropX, cropY, cropWidth, cropHeight;

        if (imgRatio > TARGET_RATIO) {
          // 이미지가 더 넓음 → 좌우 크롭
          cropHeight = img.height;
          cropWidth = img.height * TARGET_RATIO;
          cropX = (img.width - cropWidth) / 2;  // 중앙 정렬
          cropY = 0;
        } else {
          // 이미지가 더 좁음 → 상하 크롭
          cropWidth = img.width;
          cropHeight = img.width / TARGET_RATIO;
          cropX = 0;
          cropY = (img.height - cropHeight) / 2;  // 중앙 정렬
        }

        // Canvas에 크롭 적용
        const canvas = document.createElement('canvas');
        canvas.width = TARGET_WIDTH;
        canvas.height = TARGET_HEIGHT;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(
          img,
          cropX, cropY, cropWidth, cropHeight,  // 소스 영역
          0, 0, TARGET_WIDTH, TARGET_HEIGHT      // 대상 영역
        );

        const croppedImageUrl = canvas.toDataURL('image/jpeg', 0.95);
        resolve(croppedImageUrl);
      };

      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}
```

#### 학습 포인트
1. **비율 계산**: 원본 이미지 비율과 타겟 비율 비교
2. **중앙 정렬**: `(total - crop) / 2`
3. **Canvas drawImage 9개 인자**: src x/y/w/h, dest x/y/w/h
4. **Promise 패턴**: 비동기 이미지 처리

---

### 4. JPEG 다운로드

#### 핵심 코드
```typescript
// src/utils/canvasExport.ts
export function downloadCanvasAsJPEG(
  canvas: HTMLCanvasElement,
  filename: string = 'phototicket.jpg'
) {
  const dataURL = canvas.toDataURL('image/jpeg', 0.95);

  fetch(dataURL)
    .then(res => res.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);  // 메모리 정리
    });
}
```

#### 사용 방법
```typescript
// src/pages/index.tsx
const handleDownload = () => {
  const canvas = (window as any).phototicketCanvas;
  if (!canvas) {
    alert('먼저 이미지를 업로드하세요');
    return;
  }
  const filename = `phototicket_${movieTitle || 'untitled'}.jpg`;
  downloadCanvasAsJPEG(canvas, filename);
};
```

---

### 5. 상태 관리 (단순 구조)

#### useState만 사용
```typescript
// src/pages/index.tsx
export default function Home() {
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  const [movieTitle, setMovieTitle] = useState('');
  const [watchDate, setWatchDate] = useState('');
  const [theater, setTheater] = useState('');
  const [chain, setChain] = useState('');
  const [format, setFormat] = useState('');

  // ... 핸들러 함수들
}
```

#### 왜 Context/Zustand를 사용하지 않았나?
- **단순한 구조**: 상태가 1개 페이지에만 존재
- **prop drilling 깊이**: 최대 1단계 (index → PhototicketCanvas)
- **추가 라이브러리 불필요**: MVP에서 과도한 추상화 지양

**Phase 2 이후 고려 사항**:
- 여러 페이지 추가 시
- 상태 공유 필요 시
- 그때 Context API 또는 Zustand 도입

---

### 6. Tailwind CSS v4 → v3 다운그레이드

#### 문제
```
Error: It looks like you're trying to use `tailwindcss` directly
as a PostCSS plugin...
```

#### 원인
Tailwind CSS v4는 PostCSS 플러그인 구조가 변경됨

#### 해결
```bash
npm uninstall tailwindcss
npm install tailwindcss@^3.4.0
```

#### 교훈
- 최신 버전이 항상 좋은 것은 아님
- LTS 버전이나 안정화된 버전 선택이 중요
- Phase 2에서 v4 재시도 고려 가능

---

## 파일 구조 및 역할

### 핵심 파일

```
PhototicketMaker/
├── src/
│   ├── pages/
│   │   └── index.tsx              # 메인 페이지, 상태 관리, UI 레이아웃
│   ├── components/
│   │   └── PhototicketCanvas.tsx  # Canvas 렌더링 컴포넌트
│   ├── utils/
│   │   ├── imageCrop.ts           # 자동 크롭 로직
│   │   └── canvasExport.ts        # JPEG 다운로드
│   └── styles/
│       └── globals.css            # Tailwind 설정
├── public/
│   └── assets/                    # (Phase 2) 로고/아이콘
├── package.json                   # 의존성 (3개 production)
├── tsconfig.json
└── tailwind.config.js
```

### 각 파일의 책임

| 파일 | 책임 | 핵심 코드 |
|------|------|----------|
| `index.tsx` | 상태 관리, 이벤트 핸들링, UI 레이아웃 | `useState`, `handleImageUpload`, `handleDownload` |
| `PhototicketCanvas.tsx` | Canvas 렌더링, 실시간 업데이트 | `useEffect`, `ctx.drawImage`, `ctx.fillText` |
| `imageCrop.ts` | 이미지 크롭 알고리즘 | `cropImage()`, 비율 계산, Canvas drawImage |
| `canvasExport.ts` | JPEG 생성 및 다운로드 | `canvas.toDataURL()`, Blob 변환 |

---

## 발생한 문제 및 해결

### 문제 1: Fabric.js import 에러
**에러**: `can't access property 'Canvas', fabric is undefined`

**원인**: Fabric.js v6는 모듈 구조가 변경됨

**해결**: Fabric.js 완전 제거, Canvas API 사용

---

### 문제 2: React Strict Mode 이중 실행
**에러**: `fabric: canvas already initialized`

**원인**: React Strict Mode는 개발 모드에서 useEffect를 2번 실행

**시도한 해결책**:
1. cleanup 함수 추가 (실패)
2. canvas dispose 호출 (실패)
3. ref 초기화 체크 (실패)

**최종 해결**: Fabric.js 제거

---

### 문제 3: Tailwind CSS PostCSS 에러
**에러**: PostCSS 플러그인 에러

**원인**: Tailwind v4 구조 변경

**해결**: v3.4로 다운그레이드

---

## Phase 2를 위한 준비 사항

### 보존해야 할 것
1. ✅ **Canvas API 패턴**: useEffect + useRef 구조
2. ✅ **크롭 로직**: `imageCrop.ts` 완전 재사용 가능
3. ✅ **다운로드 로직**: `canvasExport.ts` 그대로 사용
4. ✅ **단순한 상태 관리**: 복잡해지기 전까지 유지

### 추가할 기능 (Phase 2)
1. **수동 크롭**: react-image-crop 통합
2. **영화 API**: TMDB 연동 (Next.js API Routes)
3. **웹폰트**: Pretendard 적용 (next/font)
4. **별점 UI**: 0~5점, 0.5 단위
5. **로고 에셋**: 극장 체인, 상영 포맷 실제 로고

### 개선할 부분
1. **타입 안정성**: `(window as any)` 제거, 전역 타입 정의
2. **에러 처리**: try-catch, 사용자 피드백
3. **로딩 상태**: 이미지 처리 중 스피너
4. **모바일 최적화**: 터치 인터랙션, 반응형 개선

---

## 코드 예제 모음

### 1. 이미지 업로드 핸들러
```typescript
const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const cropped = await cropImage(file);
    setCroppedImageUrl(cropped);
  } catch (error) {
    console.error('크롭 실패:', error);
    alert('이미지 처리 실패');
  }
};
```

### 2. Canvas 텍스트 렌더링 (위치 참고)
```typescript
// 극장 체인 (상단, 빨간색)
if (chain) {
  ctx.font = 'bold 32px Arial';
  ctx.fillStyle = '#ff0000';
  ctx.fillText(chain, 40, 70);
}

// 상영 포맷 (상단, 흰색 + 배경)
if (format) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(35, 95, ctx.measureText(format).width + 10, 35);
  ctx.font = '24px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(format, 40, 120);
}

// 영화 제목 (하단, 큰 글씨)
if (movieTitle) {
  ctx.font = 'bold 48px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(movieTitle, 40, TARGET_HEIGHT - 140);
}

// 관람일 (하단)
if (watchDate) {
  ctx.font = '24px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(watchDate, 40, TARGET_HEIGHT - 90);
}

// 극장 위치 (하단, 회색)
if (theater) {
  ctx.font = '20px Arial';
  ctx.fillStyle = '#cccccc';
  ctx.fillText(theater, 40, TARGET_HEIGHT - 45);
}
```

### 3. UI 레이아웃 (Tailwind)
```tsx
<div className="grid grid-cols-2 gap-8">
  {/* 왼쪽: 입력 폼 */}
  <div className="space-y-6">
    {/* 이미지 업로드 */}
    {/* 영화 정보 입력 */}
    {/* 컴포넌트 선택 */}
    {/* 다운로드 버튼 */}
  </div>

  {/* 오른쪽: 프리뷰 */}
  <div className="bg-white p-6 rounded-lg shadow">
    <PhototicketCanvas {...props} />
  </div>
</div>
```

---

## 배운 교훈 (Lessons Learned)

### 1. 프로토타입 검증의 중요성
Phase 0에서 핵심 로직을 검증했기 때문에 Phase 1에서 빠르게 진행 가능했습니다.

**교훈**:
- 새로운 기술을 사용할 때는 프로토타입으로 먼저 검증
- 단일 HTML로 빠르게 테스트 가능
- 프레임워크 설정에 시간 낭비하지 않기

---

### 2. 무거운 라이브러리보다 네이티브 API
Fabric.js는 강력하지만 MVP에는 과도했습니다.

**교훈**:
- "필요한가?"를 항상 물어보기
- 네이티브 API만으로 해결 가능한지 먼저 확인
- 라이브러리는 명확한 이유가 있을 때만 추가

---

### 3. 바이브 코딩의 효과
1일 만에 MVP를 완성할 수 있었던 이유:
- 완벽한 구조보다 작동하는 코드 우선
- 최소한의 추상화
- 필요할 때만 리팩토링

**교훈**:
- 과도한 설계는 시간 낭비
- 일단 동작하게 만들고 개선
- 사용자 피드백 받고 반복

---

### 4. 단순한 상태 관리의 가치
useState만으로 충분했습니다.

**교훈**:
- 복잡해지기 전까지는 단순하게
- Context/Redux/Zustand는 필요할 때 추가
- "나중에"는 괜찮다

---

## 다음 세션을 위한 체크리스트

### 개발 환경 확인
- [ ] `npm run dev` 실행 확인 (localhost:3000)
- [ ] 브라우저 개발자 도구 에러 없음
- [ ] 모든 기능 정상 작동 (업로드 → 프리뷰 → 다운로드)

### Phase 2 시작 전
- [ ] TMDB API 키 발급
- [ ] 극장 체인 로고 수집 (CGV, 롯데, 메가박스, 씨네Q)
- [ ] 상영 포맷 로고 수집 (IMAX, Dolby, 4DX 등)
- [ ] Pretendard 폰트 다운로드

### 코드 개선 우선순위
1. **타입 정의**: PhototicketData interface 정의
2. **에러 처리**: try-catch 추가, 사용자 피드백
3. **로딩 상태**: 이미지 처리 중 표시
4. **코드 정리**: 주석 추가, 매직 넘버 상수화

---

## 참고 링크

- [Canvas API 문서](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Next.js Pages Router](https://nextjs.org/docs/pages)
- [Tailwind CSS v3](https://v3.tailwindcss.com/)
- [TMDB API](https://www.themoviedb.org/settings/api)

---

**마지막 업데이트**: 2024.12.01
**다음 Phase**: Phase 2 (고도화 - 사용성 개선)
