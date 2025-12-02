# 에셋 관리 가이드

포토티켓 메이커에서 사용하는 모든 이미지 에셋(로고, 아이콘)의 폴더 구조와 네이밍 규칙을 정의합니다.

---

## 📁 폴더 구조

```
public/assets/
├── chains/          # 극장 체인 로고
├── formats/         # 상영 포맷 로고/아이콘
└── icons/           # UI 아이콘 (별점 등)
```

---

## 🎭 1. 극장 체인 로고 (`public/assets/chains/`)

### 필요한 파일

| 극장 체인 | 파일명 | 형식 | 현재 상태 |
|----------|--------|------|----------|
| CGV | `cgv.png` 또는 `cgv.svg` | PNG/SVG | ✅ cgv.png |
| 롯데시네마 | `lotte.png` 또는 `lotte.svg` | PNG/SVG | ✅ lotte.png |
| 메가박스 | `megabox.png` 또는 `megabox.svg` | PNG/SVG | ✅ megabox.svg |
| 씨네큐 | `cineq.png` 또는 `cineq.svg` | PNG/SVG | ✅ cineq.svg |

### 네이밍 규칙
- **파일명**: 소문자, 영문 (한글 X)
- **형식**: PNG (투명 배경) 또는 SVG 권장
- **크기**: 최소 가로 200px 이상 (고해상도)

### 예시
```
✅ cgv.png
✅ lotte.svg
❌ CGV.png (대문자 사용)
❌ 롯데시네마.png (한글 사용)
```

---

## 🎬 2. 상영 포맷 로고 (`public/assets/formats/`)

### 필요한 파일

| 상영 포맷 | 파일명 | 형식 | 현재 상태 |
|----------|--------|------|----------|
| IMAX | `imax.png` 또는 `imax.svg` | PNG/SVG | ✅ imax.svg |
| 4DX | `4dx.png` 또는 `4dx.svg` | PNG/SVG | ✅ 4dx.png, 4dx.svg |
| ULTRA 4DX | `ultra4dx.png` 또는 `ultra4dx.svg` | PNG/SVG/WebP | ✅ ultra4dx.webp |
| ScreenX | `screenx.png` 또는 `screenx.svg` | PNG/SVG | ✅ screenx.png |
| MX4D (롯데) | `smx4d.png` 또는 `smx4d.svg` | PNG/SVG | ✅ smx4d.png |
| SUPER PLEX | `superplex.png` 또는 `superplex.svg` | PNG/SVG | ✅ superplex.svg |
| DOLBY CINEMA | `dolby-cinema.png` 또는 `dolby-cinema.svg` | PNG/SVG | ✅ dolby-cinema.png |
| DOLBY Atmos | `dolby-atmos.png` 또는 `dolby-atmos.svg` | PNG/SVG | ✅ dolby-atmos.png |
| DOLBY Vision+Atmos | `dolby-va.png` 또는 `dolby-va.svg` | PNG/SVG | ✅ dolby-va.png |
| 샬롯데 (롯데) | `chalotte.png` 또는 `chalotte.svg` | PNG/SVG | ✅ chalotte.png |
| 크레이지사운드 | `crazysound.png` 또는 `crazysound.svg` | PNG/SVG | ✅ crazysound.svg |
| 크레이지사운드LED | `crazysoundled.png` 또는 `crazysoundled.svg` | PNG/SVG | ✅ crazysoundled.svg |
| SLED | `sled.png` 또는 `sled.svg` | PNG/SVG | ✅ sled.png |
| SUPER LED | `superled.png` 또는 `superled.svg` | PNG/SVG | ✅ superled.svg |
| MEGA LED | `megaled.png` 또는 `megaled.svg` | PNG/SVG | ✅ megaled.png |
| 부티크 | `boutique.png` 또는 `boutique.svg` | PNG/SVG | ✅ boutique.png |
| 부티크 프라이빗 | `boutiqueprivate.png` 또는 `boutiqueprivate.svg` | PNG/SVG | ✅ boutiqueprivate.png |
| 부티크 스위트 | `boutiquesuite.png` 또는 `boutiquesuite.svg` | PNG/SVG | ✅ boutiquesuite.png |
| 르클라이너 | `lerecliner.png` 또는 `lerecliner.svg` | PNG/SVG | ✅ lerecliner.png |

### 네이밍 규칙
- **파일명**: 소문자, 영문, 하이픈(-) 허용
- **형식**: PNG (투명 배경) 또는 SVG 권장
- **크기**: 최소 가로 150px 이상

### 예시
```
✅ imax.svg
✅ dolby-cinema.png
✅ ultra4dx.webp
❌ IMAX.png (대문자 사용)
❌ dolby_cinema.png (언더스코어 사용, 하이픈 권장)
```

---

## ⭐ 3. UI 아이콘 (`public/assets/icons/`)

### 필요한 파일 (Phase 2 예정)

| 아이콘 | 파일명 | 형식 | 용도 |
|--------|--------|------|------|
| 별 (채워짐) | `star-filled.svg` | SVG | 평점 표시 |
| 별 (반) | `star-half.svg` | SVG | 0.5점 평점 |
| 별 (빈) | `star-empty.svg` | SVG | 평점 표시 |

### 네이밍 규칙
- **파일명**: 소문자, 영문, 하이픈(-) 사용
- **형식**: SVG (권장) 또는 PNG
- **크기**: 24×24px 또는 32×32px

---

## 📝 에셋 추가 시 체크리스트

새로운 에셋을 추가할 때는 다음을 확인하세요:

- [ ] 파일명이 소문자 + 영문 + 하이픈(-) 규칙을 따르는가?
- [ ] 이미지 배경이 투명한가? (PNG/SVG)
- [ ] 해상도가 충분한가? (최소 가로 150px 이상)
- [ ] 파일 크기가 적절한가? (1MB 이하 권장)
- [ ] 올바른 폴더에 저장했는가? (`chains/`, `formats/`, `icons/`)
- [ ] Git에 커밋하기 전에 `.DS_Store` 파일 제거했는가?

---

## 🔧 코드에서 사용하는 방법

### 극장 체인 로고
```tsx
import Image from 'next/image';

// CGV 로고
<Image
  src="/assets/chains/cgv.png"
  alt="CGV"
  width={120}
  height={40}
/>
```

### 상영 포맷 로고
```tsx
// IMAX 로고
<Image
  src="/assets/formats/imax.svg"
  alt="IMAX"
  width={80}
  height={30}
/>
```

### Canvas에서 사용
```typescript
const img = new Image();
img.src = '/assets/chains/cgv.png';
img.onload = () => {
  ctx.drawImage(img, x, y, width, height);
};
```

---

## 🚫 Git에서 제외할 파일

다음 파일들은 `.gitignore`에 추가하여 커밋하지 않습니다:

```
# macOS
.DS_Store

# 개인 작업 파일
*.ai (Adobe Illustrator 원본)
*.psd (Photoshop 원본)
*_원본/
```

---

## 📌 참고 사항

### 저작권 주의
- 모든 로고는 각 영화관/포맷의 공식 에셋을 사용하세요
- 개인 프로젝트 범위에서 사용하되, 상업적 용도는 확인 필요

### 파일 형식 선택 가이드
- **SVG**: 벡터 이미지, 확대/축소 시 깨지지 않음 (권장)
- **PNG**: 투명 배경 지원, 래스터 이미지
- **WebP**: 파일 크기 작음, 최신 브라우저 지원

---

## ✅ 현재 에셋 상태 요약

### 극장 체인 (4개)
- ✅ CGV
- ✅ 롯데시네마
- ✅ 메가박스
- ✅ 씨네큐

### 상영 포맷 (19개)
- ✅ IMAX, 4DX, ULTRA 4DX, ScreenX
- ✅ MX4D, SUPER PLEX, DOLBY 시리즈 (3개)
- ✅ 샬롯데, 크레이지사운드 시리즈, LED 시리즈
- ✅ 부티크 시리즈 (3개), 르클라이너

### UI 아이콘
- ⚠️ 별 아이콘 (Phase 2에서 추가 예정)

---

**마지막 업데이트**: 2024.12.02
