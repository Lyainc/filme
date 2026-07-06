# 에셋 관리 가이드

> **[저작권 회피 정책]** 더 이상 브랜드 로고(CGV, IMAX 등)를 저장소에 번들하지 않습니다. 
> 앱 내에서 사용자가 직접 체인 및 포맷 로고를 업로드할 수 있는 업로드 UI와 파선(dashed) 가이드가 제공됩니다.
> 아래의 파일명 기반 에셋 생성 스크립트는 **로컬 개발 및 개인 테스트용**으로 에셋 폴더에 이미지를 수동 배치할 때만 사용됩니다.

---

## 📁 폴더 구조

```
public/assets/
├── chains_transparent/      # ✅ 극장 체인 누끼 PNG — generator 대상
├── formats_transparent/     # ✅ 상영 포맷 누끼 PNG — generator 대상
├── chains/                  # (옵션) 원본/벡터 보관 — 코드는 안 봄
└── formats/                 # (옵션) 원본/벡터/deprecated 보관 — 코드는 안 봄
```

- `*_transparent/`만 generator가 스캔해요. `chains/`, `formats/`는 누끼 작업 전 원본 / SVG / WebP / deprecated 백업용이라 자유 형식.

---

## 📛 파일명 규약

```
<value>_<label>.png
```

| 필드   | 규칙                                                | 역할                        |
|--------|-----------------------------------------------------|-----------------------------|
| `value`| `[a-z0-9][a-z0-9-]*` (소문자/숫자/하이픈, 첫 문자는 소문자/숫자) | 안정적 식별자. 코드의 `chain`/`format` state에 저장되는 값. |
| `_`    | 구분자 1개                                          | 첫 번째 언더스코어만 분할에 사용. |
| `label`| 첫 `_` 이후 ~ `.png` 직전. 한글/공백/`+`/`|` 등 허용 | picker 칩과 본문 alt에 보이는 표기명. |

### 예시
```
✅ cgv_CGV.png
✅ lotte_롯데시네마.png
✅ dolby-va_Dolby Vision+Atmos.png
✅ megaled_MEGA | LED.png
✅ tempurcinema_템퍼 시네마.png

❌ CGV.png                    (대문자 value, 언더스코어 누락)
❌ cgv_CGV.svg                (확장자는 .png만)
❌ _CGV.png                   (value 비어있음)
❌ cgv_.png                   (label 비어있음)
❌ cgv_CGV_extra.png          (두 번째 _ 이후도 label로 들어감 — 의도면 OK)
❌ cgv_CGV.png + cgv_씨지비.png (같은 value 중복 — generator throw)
```

### 라벨 표기 정책
영문/한글 혼재 허용. 현재는 브랜드 공식 표기를 따르고 있어요 (예: `BOUTIQUE`, `샤롯데`, `Dolby Atmos`, `광음시네마`). 이해관계자가 폴더에서 표기명을 결정하면 코드/문서는 손대지 않아도 자동 반영.

---

## 🔄 자산 추가 워크플로

1. 누끼 PNG를 `public/assets/{chains,formats}_transparent/`에 드랍 (파일명 규약 준수)
2. 다음 중 한 가지를 실행:
   - `bun run dev` → `predev` hook이 자동 regenerate
   - `bun run build` → `prebuild` hook이 자동 regenerate
   - `bun run gen:assets` → 명시적 regenerate (자산 변경만 했을 때)
3. picker / 본문 티켓 모두 자동 갱신

자산 삭제도 동일 — 파일만 빼고 위 명령 한 번이면 picker에서 자동 사라져요.

---

## 🚨 Generator 동작과 fail-fast

`scripts/generate-asset-manifest.ts`가 폴더 스캔 시 다음을 강제해요. 위반 시 dev 서버 / build가 즉시 실패해서 PR 이전에 문제를 잡아요.

- **파일명 규약 위반** → `[asset-manifest] ... violates <value>_<label>.png ...` throw
- **같은 폴더 안에서 value 중복** → `[asset-manifest] duplicate value "..." in ...` throw
- **숨김 파일(`.DS_Store` 등)** → 자동 무시
- **`.png` 외 확장자** → 자동 무시 (즉 SVG/JPG를 같은 폴더에 두면 무시되지만 누끼 PNG 만들기 전 임시 보관용으로 두지 마세요 — 혼란 야기)

`superled_SUPER LED.png` 같이 파일은 없는데 코드만 참조하는 상황은 발생하지 않아요. 폴더 = 진실.

---

## 🧩 코드 의존 지점

전부 generated를 통해서만 자산에 닿아요. 의존 파일은 4곳:

| 파일                                                | 역할                                                   |
|-----------------------------------------------------|--------------------------------------------------------|
| `src/utils/assets.generated.ts`                     | generator 출력. **수동 편집 금지**.                    |
| `src/utils/constants.ts`                            | `THEATER_CHAINS` / `SCREENING_FORMATS` derive. NONE 항목(`value: ''`)만 추가. |
| `src/components/moods/_shared.tsx`                  | `ChainStamp` / `FormatStamp` — 본문 티켓 로고. `CHAIN_INDEX` / `FORMAT_INDEX` Map으로 O(1) lookup. |

> 로고 **선택/업로드 UI**는 이 매니페스트 체인을 쓰지 않아요 — 사용자가 StampSheet(`FieldEditorBody`)에서 직접 업로드(useLogoCrop 자유 크롭)해요. 구 `TheaterChainPicker`/`FormatPicker`는 #231에서 제거됐어요.

`ChainStamp` / `FormatStamp`은 entry를 찾지 못하거나 `file`이 비어있으면 **null 렌더**해요. 의도치 않은 raw value(`cgv` 같은 슬러그)가 티켓에 노출되지 않도록 안전망. 즉 picker에서 정상 선택한 경우에만 렌더되고, 외부 dirty input(예: 백엔드에서 들어온 unknown chain code)은 그냥 자리만 비워요.

---

## 🚫 Git에서 제외

```
.DS_Store
Thumbs.db
*.ai, *.psd                   # 원본 디자인 파일
src/utils/assets.generated.ts # ← generator가 항상 재생성하므로 untracked
```

`src/utils/assets.generated.ts`는 `.gitignore` 등록 상태. PR에는 자산 파일 추가/삭제만 보여요. CI는 `bun run build`가 prebuild hook으로 알아서 생성하니 누락 걱정 없음.

---

## ✅ 자산 추가 체크리스트

- [ ] 파일명이 `<value>_<label>.png` 패턴인가? (value는 ASCII 소문자/숫자/하이픈)
- [ ] 같은 폴더 내 value가 unique한가?
- [ ] 배경이 깨끗하게 누끼처리됐는가? (네 모서리 + 외곽선 알파 0)
- [ ] 올바른 폴더(`*_transparent/`)에 두었는가?
- [ ] `bun run dev` 또는 `bun run gen:assets`로 generator 통과 확인했는가?
- [ ] `.DS_Store` 같은 메타파일 같이 커밋하지 않았는가?

---

## 📌 참고

- 저작권: 각 영화관/포맷의 공식 에셋 사용. 상업 사용 전 별도 확인.
- 권장 해상도: 가로 200px 이상 (실제 사용 영역의 2배 권장 — 본문 렌더는 게임당 30-46px 라인 높이)
- 파일 크기: 1MB 이하 권장. 형식은 PNG (투명 배경) 고정.

---

**마지막 업데이트**: 2026-05-11
