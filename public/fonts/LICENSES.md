# 번들 한글 웹폰트 라이선스 (#437)

한줄평·서명 폰트 9택(`QuoteFont`)이 쓰는 폰트의 출처·허용 범위. 전부 **상업적 이용 + 웹폰트
임베딩이 명시적으로 허용**된 것만 반입했다(2026-08-26 눈누 noonnu.cc 라이선스 요약표 확인).

## 반입 파일

| 파일 | 폰트 | 제작 | 눈누 | 임베딩 | 특기 |
|---|---|---|---|---|---|
| `PretendardVariable.woff2` | 프리텐다드 | 길형진(orioncactus) | [694](https://noonnu.cc/font_page/694) | 허용 | OFL. `--font-sans`로 앱 전역 공용 |
| `GyeonggiBatang-Regular.woff` | 경기천년바탕 | 경기도청 | [13](https://noonnu.cc/font_page/13) | 허용 | 유료 양도·판매 금지 |
| `IceJaram-Rg.woff2` | 인천교육자람체(아이스자람체) | 인천광역시교육청 | [1226](https://noonnu.cc/font_page/1226) | 허용 | #391부터 반입돼 있던 파일 |
| `InkLipquid.woff` | 잉크립퀴드체 | 더페이스샵(LG생활건강) | [68](https://noonnu.cc/font_page/68) | 허용 | **BI/CI 사용 금지 · 장평/기울기 변형 금지** |
| `KCC-eunyoung-Regular.woff` | KCC은영체 | 한국저작권위원회 | [85](https://noonnu.cc/font_page/85) | 허용 | **CCL 저작자표시 — 출처 고지 의무** |
| `CoolGuy-Medium.woff2` | 쿨가이 | 캘리폰트 | [1350](https://noonnu.cc/font_page/1350) | 허용 | CI/BI까지 허용 |
| `SangSangFlowerRoad.woff` | 꽃길 | 상상토끼 | [91](https://noonnu.cc/font_page/91) | 허용 | **폰트 파일 수정 금지** · 한글 2352자만 커버 |

`나눔손글씨붓`(네이버, [눈누 43](https://noonnu.cc/font_page/43))은 파일을 반입하지 않는다 —
Google Fonts에 `Nanum Brush Script`로 있고 한글이 unicode-range 92슬라이스로 쪼개져 있어
`next/font/google`이 자체 호스팅하면서 브라우저가 필요한 슬라이스만 받는다(`_app.tsx` 참고).

## 지켜야 하는 세 조항

1. **KCC은영체 = CCL 저작자표시.** 8종 중 유일하게 크레딧이 **의무**다 —
   `src/components/v2/AppFooter.tsx`가 출처 링크와 함께 상시 표기한다. 그 줄을 지우면 라이선스
   위반이므로, 이 폰트를 빼기 전엔 footer 크레딧을 먼저 건드리지 말 것.
2. **잉크립퀴드체 = BI/CI 사용 금지 + 변형 금지.** 이 서비스의 사용 범위는 *사용자가 입력한*
   한줄평·서명 텍스트라 BI/CI(회사명·브랜드명·로고)에 해당하지 않는다 — FILME 워드마크는
   `Wordmark.tsx`가 Nunito로 따로 그린다. 변형 금지는 **장평·기울기**를 말하므로 `transform:
   scaleX` / `fontStyle: 'italic'` / `skew`를 이 폰트에 적용하면 안 된다(`userTextFont`가 한글
   폰트에 `fontStyle: 'normal'`을 고정하는 게 이 조항과 같은 방향이다). `fontSize` 균일 보정은
   장평이 아니라 등비 확대라 해당 없음.
3. **파일 수정 금지(꽃길·경기천년바탕 등).** 그래서 눈누/제작사가 배포하는 웹폰트 아티팩트를
   **그대로** 둔다 — `.woff`를 `.woff2`로 재압축하지 않는다. 눈누가 실제로 배포하는 형식이
   5종 중 4종은 `.woff`뿐이고(같은 경로의 `.woff2`는 404), 재압축으로 아끼는 ~30%보다
   "수정 안 함"이 확실한 쪽이다. 새 폰트를 추가할 때도 같은 자세를 지킬 것.
