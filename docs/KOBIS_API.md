# KOBIS 연동 가이드

FILME는 KOBIS 키를 브라우저에 노출하지 않아요. 클라이언트는 내부 API를 호출하고, Pages Router API가 서버 환경 변수의 키로 KOBIS 영화 목록·상세 API를 대신 호출해요.

KOBIS는 영화 메타데이터만 제공하며 포스터 이미지는 제공하지 않아요. FILME의 포스터는 사용자 업로드가 source of truth예요.

## 설정

영화진흥위원회 [KOBIS Open API](https://www.kobis.or.kr/kobisopenapi/homepg/main/main.do)에서 키를 발급한 뒤 서버 전용 변수에 넣어요.

```bash
KOBIS_API_KEY=your_api_key_here
```

`NEXT_PUBLIC_KOBIS_API_KEY`는 사용하지 않아요. `NEXT_PUBLIC_` 변수는 브라우저 번들에 노출되거든요.

프로덕션 rate limit 설정은 루트 [`.env.example`](../.env.example)을 따라요. KOBIS는 Upstash가 없어도 fail-open이지만, OCR과 티켓 공유는 프로덕션에서 fail-closed예요.

## 요청 흐름

```text
useKobisSearch / triggerKobisLookup
  → GET /api/kobis/search?movieNm=...
  → GET /api/kobis/detail?movieCd=12345678
  → KOBIS Open API
```

- [검색 훅](../src/hooks/useKobisSearch.ts): 300ms debounce, 요청 취소, 검색어별 메모리 캐시, 최신 상세 응답만 적용
- [OCR 후 자동 보강](../src/utils/kobisLookup.ts): 검색 결과가 정확히 한 건일 때만 상세 조회, 실패·무매치·다중매치는 수동 검색으로 하강
- [검색 프록시](../src/pages/api/kobis/search.ts): `movieNm` 검증, rate limit, 1일 CDN 캐시
- [상세 프록시](../src/pages/api/kobis/detail.ts): 8자리 `movieCd` 검증, rate limit, 1일 CDN 캐시
- [공통 rate limit](../src/utils/ratelimit.ts): 분당 30회·일 1000회 per-IP, 프로덕션 Upstash 미설정 시 KOBIS만 fail-open

## 폼 반영 규칙

검색 결과를 고르면 `title`, `titleOg`, `releaseDate`, `movieCd`를 먼저 반영해요. 상세 응답이 오면 배우와 러닝타임을 보강해요. 입력 패널을 닫아도 같은 문서·영화 선택에는 보강을 적용하고, 새 문서 시작·영화 재선택·제목 수정·실행 취소로 선택이 바뀌면 이전 응답을 무시해요. 해외 영화 배우는 영문명이 있으면 우선하고, 러닝타임은 `NN MIN` 형식으로 저장해요.

화면과 데이터 계약의 현재 source of truth:

- [KOBIS 응답 타입](../src/types/index.ts)
- [결과 목록 UI](../src/components/v2/FieldEditorBody.tsx)
- [인플레이스 제목 편집기](../src/components/v2/InPlaceFieldEditor.tsx)
- [검색·상세 추출 테스트](../src/utils/kobisLookup.test.ts)
- [검색 결과 UI 테스트](../__tests__/titleSheetSearch.test.tsx)
