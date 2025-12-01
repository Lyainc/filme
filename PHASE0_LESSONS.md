# Phase 0 학습 내용 정리

Phase 0 프로토타입에서 검증하고 배운 내용을 정리합니다.
Phase 1 개발 시 이 내용을 참고하세요.

## 검증 완료 사항

✅ **이미지 크롭 로직**: Canvas API로 구현 가능
✅ **에셋 합성**: Fabric.js로 레이어 관리 용이
✅ **다운로드**: canvas.toDataURL() → Blob → download
✅ **포맷 지원**: JPG, PNG, WebP 모두 작동
✅ **브라우저 처리**: 서버 없이 클라이언트만으로 완결

## 핵심 코드 스니펫

### 1. 이미지 자동 크롭 로직

```javascript
// 타겟 비율 (CGV 포토플레이)
const TARGET_RATIO = 960 / 1477; // 0.65:1

// 원본 이미지 비율
const imgRatio = img.width / img.height;

// 크롭 영역 계산 (중앙 정렬)
let cropX, cropY, cropWidth, cropHeight;

if (imgRatio > TARGET_RATIO) {
  // 이미지가 더 넓음 → 좌우를 자름
  cropHeight = img.height;
  cropWidth = img.height * TARGET_RATIO;
  cropX = (img.width - cropWidth) / 2;  // 중앙
  cropY = 0;
} else {
  // 이미지가 더 좁음 → 상하를 자름
  cropWidth = img.width;
  cropHeight = img.width / TARGET_RATIO;
  cropX = 0;
  cropY = (img.height - cropHeight) / 2;  // 중앙
}

// Canvas에 크롭된 이미지 그리기
ctx.drawImage(
  img,
  cropX, cropY, cropWidth, cropHeight,  // 소스 영역
  0, 0, 960, 1477                       // 타겟 영역 (960×1477)
);
```

**포인트**:
- 비율 비교로 어느 방향을 자를지 결정
- 중앙 정렬: `(전체 크기 - 크롭 크기) / 2`
- `drawImage()`의 9개 파라미터 활용

### 2. Fabric.js Canvas 초기화

```javascript
// Canvas 생성
const fabricCanvas = new fabric.Canvas('canvas-id', {
  width: 960,
  height: 1477,
  backgroundColor: '#000000'
});

// 배경 이미지 설정
fabric.Image.fromURL(croppedImageUrl, (img) => {
  img.set({
    left: 0,
    top: 0,
    scaleX: 960 / img.width,
    scaleY: 1477 / img.height,
    selectable: false  // 사용자가 드래그 못하게
  });
  fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
});
```

**포인트**:
- `fabric.Canvas()` 생성자로 초기화
- 배경 이미지는 `setBackgroundImage()` 사용
- `selectable: false`로 고정

### 3. 텍스트/오버레이 추가

```javascript
// 반투명 오버레이 (텍스트 가독성)
const overlay = new fabric.Rect({
  left: 0,
  top: 1277,  // 하단부터
  width: 960,
  height: 200,
  fill: 'rgba(0, 0, 0, 0.6)',  // 검은색 60% 투명도
  selectable: false
});
fabricCanvas.add(overlay);

// 텍스트 추가
const title = new fabric.Text('인터스텔라', {
  left: 40,
  top: 1307,
  fontSize: 48,
  fontWeight: 'bold',
  fill: '#ffffff',
  fontFamily: 'Arial, sans-serif',
  selectable: false
});
fabricCanvas.add(title);

// 렌더링
fabricCanvas.renderAll();
```

**포인트**:
- `fabric.Rect()`로 사각형 오버레이
- `fabric.Text()`로 텍스트
- `add()` 후 `renderAll()` 필수

### 4. JPEG 다운로드

```javascript
// Canvas → Data URL
const dataURL = fabricCanvas.toDataURL({
  format: 'jpeg',
  quality: 0.95,
  multiplier: 1  // 1:1 크기
});

// Blob 변환 → 다운로드
fetch(dataURL)
  .then(res => res.blob())
  .then(blob => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'phototicket.jpg';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);  // 메모리 정리
  });
```

**포인트**:
- `toDataURL()` 옵션: format, quality, multiplier
- fetch로 Blob 변환
- `URL.createObjectURL()` → `<a>` download → `revokeObjectURL()`

## Phase 1에서 해야 할 일

### 코드 이전
- [ ] 크롭 로직을 `utils/imageCrop.ts`로 분리
- [ ] Fabric.js Canvas를 `components/PhototicketCanvas.tsx`로 분리
- [ ] 다운로드 로직을 `utils/canvasExport.ts`로 분리

### 동적화
- [ ] 하드코딩된 "인터스텔라" → 입력 폼에서 받기
- [ ] 하드코딩된 날짜 → 날짜 선택기
- [ ] 하드코딩된 "CGV" → 극장 체인 선택
- [ ] 하드코딩된 "IMAX" → 상영 포맷 선택
- [ ] 별점 UI 추가

### 상태 관리
```typescript
interface PhototicketState {
  posterImage: File | null;
  croppedImageUrl: string | null;
  movieInfo: {
    title: string;
    watchDate: string;
    theater?: string;
    rating?: number;
  };
  components: {
    chain?: string;
    formats?: string[];
  };
}
```

## 주의사항 및 팁

### ⚠️ 주의사항

1. **Canvas 크기 고정**: 960×1477px는 절대 변경하지 말 것
2. **비율 계산**: TARGET_RATIO = 0.65는 상수로 관리
3. **메모리 관리**: `URL.createObjectURL()` 후 반드시 `revokeObjectURL()`
4. **폰트 로딩**: 웹폰트 사용 시 로드 완료 후 렌더링

### 💡 팁

1. **Fabric.js 디버깅**: `canvas.toJSON()` 으로 상태 확인
2. **이미지 품질**: JPEG quality는 0.9~0.95 권장 (용량 vs 품질)
3. **레이어 순서**: 나중에 `add()`한 것이 위에 표시됨
4. **반응형 Canvas**: 표시는 CSS로 크기 조정, 내부 해상도는 960×1477 유지

## 성능 고려사항

- **이미지 크기**: 업로드 시 2000px 이상은 리사이징 권장
- **Fabric.js 인스턴스**: 재사용 가능, 매번 생성하지 말 것
- **렌더링 빈도**: 상태 변경 시마다 `renderAll()` 호출, 디바운싱 고려

## Next.js 이전 시 고려사항

1. **window 객체**: SSR에서 undefined → `useEffect` 내에서 실행
2. **File API**: 클라이언트 사이드만 사용 가능
3. **Fabric.js 타입**: `@types/fabric` 설치 필요
4. **Canvas ref**: `useRef<HTMLCanvasElement>(null)` 사용

## 참고 자료

- [Fabric.js 공식 문서](http://fabricjs.com/docs/)
- [Canvas API MDN](https://developer.mozilla.org/ko/docs/Web/API/Canvas_API)
- prototype.html 파일 (실제 동작 코드)

---

**작성일**: 2024-12-01
**작성자**: Phase 0 프로토타입 검증 결과
**다음 단계**: Phase 1 - Next.js 프로젝트 시작
