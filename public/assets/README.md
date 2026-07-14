# 에셋 폴더

이 폴더에는 포토티켓에 사용할 로고, 아이콘 파일들을 저장합니다.

## 폴더 구조

```
assets/
├── chains/          # 극장 체인 로고
│   ├── cgv.svg
│   ├── lotte.svg
│   ├── megabox.svg
│   └── cineq.svg
├── formats/         # 상영 포맷 로고
│   ├── imax.svg
│   ├── dolby-cinema.svg
│   ├── 4dx.svg
│   ├── ultra4dx.svg
│   ├── screenx.svg
│   ├── mx4d.svg
│   ├── superplex.svg
│   ├── dolby-atmos.svg
│   ├── dolby-vision.svg
│   ├── dolby-av.svg
│   ├── gwangeum.svg
│   ├── gwangeum-led.svg
│   └── sled.svg
└── icons/           # UI 아이콘
    ├── star-filled.svg
    ├── star-half.svg
    └── star-empty.svg
```

## 파일 형식

- **추천**: SVG (벡터, 확대해도 깨지지 않음)
- **대안**: PNG (투명 배경, 2배속 해상도)

## 에셋 준비 방법

1. 공식 로고 다운로드
2. 배경 제거 (투명 배경)
3. SVG로 변환 (권장)
4. 적절한 크기로 최적화

## 현재 상태

번들 로고는 저작권 문제로 배포에서 뺐다(#231). 사용자가 필드 에디터의
Theater/Format 스탬프 행에서 직접 업로드하는 방식으로 대체됐다.

`chains/`, `formats/`, `메가박스_BI/`는 **로컬 보관용이라 gitignore 대상**이라서
새로 clone하면 없다. 레포에 추적되는 건 `texture-sample.svg`뿐이다.
