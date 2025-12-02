# KOBIS API 연동 가이드

영화진흥위원회(KOFIC)에서 제공하는 KOBIS 오픈 API를 사용하여 영화 정보를 검색하는 방법을 정리합니다.

---

## 📚 KOBIS API 개요

### 제공 서비스
- 일별/주간/주말 박스오피스
- 영화 목록 검색
- 영화 상세 정보
- 공통 코드 조회

### ⚠️ 중요 제한사항
**KOBIS API는 포스터 이미지를 제공하지 않습니다.**
- 포스터가 필요한 경우 별도 API 사용 필요 (TMDB, KMDb 등)

---

## 🔑 API 키 발급

1. **KOBIS 오픈 API 포털 접속**
   - https://www.kobis.or.kr/kobisopenapi/homepg/main/main.do

2. **키 발급/관리 메뉴**
   - 사용 목적 및 관리명 입력
   - API 키 발급 (무료)

3. **환경 변수 설정**
   ```bash
   # .env.local
   NEXT_PUBLIC_KOBIS_API_KEY=your_api_key_here
   ```

---

## 🎬 영화 검색 API

### 1. 영화 목록 검색 (`searchMovieList`)

#### 엔드포인트
```
GET http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json
```

#### 필수 파라미터
| 파라미터 | 설명 | 예시 |
|----------|------|------|
| `key` | API 키 | `your_api_key` |

#### 선택 파라미터
| 파라미터 | 설명 | 예시 |
|----------|------|------|
| `movieNm` | 영화명 (UTF-8 인코딩 필요) | `인터스텔라` |
| `directorNm` | 감독명 | `크리스토퍼 놀란` |
| `openStartDt` | 개봉 시작일 (YYYYMMDD) | `20140101` |
| `openEndDt` | 개봉 종료일 (YYYYMMDD) | `20141231` |
| `prdtStartYear` | 제작 시작년도 (YYYY) | `2014` |
| `prdtEndYear` | 제작 종료년도 (YYYY) | `2014` |

#### 요청 예시
```javascript
const query = encodeURIComponent("인터스텔라");
const url = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json?key=${apiKey}&movieNm=${query}`;

const response = await fetch(url);
const data = await response.json();
```

#### 응답 예시
```json
{
  "movieListResult": {
    "movieList": [
      {
        "movieCd": "20124079",
        "movieNm": "인터스텔라",
        "movieNmEn": "Interstellar",
        "prdtYear": "2014",
        "openDt": "20141106",
        "typeNm": "장편",
        "prdtStatNm": "개봉",
        "nationAlt": "미국",
        "genreAlt": "SF,드라마,모험",
        "repNationNm": "미국",
        "repGenreNm": "SF"
      }
    ],
    "totCnt": 1
  }
}
```

---

## 🎯 영화 상세 정보 API

### 2. 영화 상세 조회 (`searchMovieInfo`)

#### 엔드포인트
```
GET http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieInfo.json
```

#### 필수 파라미터
| 파라미터 | 설명 | 예시 |
|----------|------|------|
| `key` | API 키 | `your_api_key` |
| `movieCd` | 영화 코드 | `20124079` |

#### 요청 예시
```javascript
const url = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieInfo.json?key=${apiKey}&movieCd=20124079`;

const response = await fetch(url);
const data = await response.json();
```

#### 응답 데이터
```json
{
  "movieInfoResult": {
    "movieInfo": {
      "movieCd": "20124079",
      "movieNm": "인터스텔라",
      "movieNmEn": "Interstellar",
      "showTm": "169",
      "prdtYear": "2014",
      "openDt": "20141106",
      "nations": [...],
      "genres": [...],
      "directors": [...],
      "actors": [...]
    }
  }
}
```

---

## 💻 Next.js API Routes 구현

### `/pages/api/kobis/search.ts`

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { movieNm } = req.query;

  if (!movieNm) {
    return res.status(400).json({ error: 'movieNm is required' });
  }

  const apiKey = process.env.KOBIS_API_KEY;
  const query = encodeURIComponent(movieNm as string);
  const url = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json?key=${apiKey}&movieNm=${query}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch movie data' });
  }
}
```

### 클라이언트에서 호출

```typescript
const searchMovie = async (movieName: string) => {
  const response = await fetch(`/api/kobis/search?movieNm=${encodeURIComponent(movieName)}`);
  const data = await response.json();
  return data.movieListResult.movieList;
};
```

---

## 🔍 사용 예시

### 영화 검색 플로우

```typescript
// 1. 사용자가 영화명 입력
const movieName = "인터스텔라";

// 2. KOBIS API로 검색
const movies = await searchMovie(movieName);

// 3. 결과 목록 표시
movies.forEach(movie => {
  console.log(movie.movieNm, movie.openDt, movie.genreAlt);
});

// 4. 사용자가 선택한 영화의 상세 정보 조회
const movieDetail = await getMovieInfo(movies[0].movieCd);
```

---

## ⚠️ 주의사항

### 1. 한글 인코딩
```javascript
// ✅ 올바른 방법
const query = encodeURIComponent("인터스텔라");

// ❌ 잘못된 방법
const query = "인터스텔라"; // 한글이 깨짐
```

### 2. API 키 보안
```javascript
// ✅ 올바른 방법: 서버 사이드에서 호출
// pages/api/kobis/search.ts
const apiKey = process.env.KOBIS_API_KEY;

// ❌ 잘못된 방법: 클라이언트에 노출
const apiKey = process.env.NEXT_PUBLIC_KOBIS_API_KEY; // 브라우저에 노출됨
```

### 3. CORS 문제
- 브라우저에서 직접 호출 시 CORS 에러 발생 가능
- **해결**: Next.js API Routes를 프록시로 사용

---

## 📊 데이터 매핑

### KOBIS → 포토티켓 데이터

```typescript
interface KobisMovie {
  movieCd: string;        // 영화 코드
  movieNm: string;        // 한글 제목 → movieTitle
  movieNmEn: string;      // 영문 제목
  openDt: string;         // 개봉일 (YYYYMMDD)
  genreAlt: string;       // 장르 (SF,드라마,모험)
  nationAlt: string;      // 국가
  prdtYear: string;       // 제작년도
}

// 변환
const phototicketData = {
  movieTitle: kobisMovie.movieNm,
  // watchDate는 사용자가 직접 입력 (개봉일 아님)
  // 포스터는 별도 API 필요
};
```

---

## 🚀 Phase 2 구현 계획

### 구현할 기능
1. ✅ **영화 검색 API Routes** (`/api/kobis/search`)
2. ✅ **검색 결과 목록 표시** (영화명, 개봉일, 장르)
3. ✅ **영화 선택 시 제목 자동 입력**
4. ❌ **자동완성 UI** (복잡도로 인해 제외)
5. ❌ **포스터 이미지** (KOBIS에서 미제공, 별도 API 필요)

### 대안: 포스터는 수동 업로드
- KOBIS는 메타데이터만 제공
- 포스터 이미지는 사용자가 직접 업로드 (기존 방식 유지)
- 또는 Phase 3에서 TMDB/KMDb API 추가 연동 고려

---

## 📝 참고 자료

**Sources:**
- [영화진흥위원회 오픈API](https://www.kobis.or.kr/kobisopenapi/homepg/main/main.do)
- [JS 영화진흥위원회 오픈API 사용하기](https://velog.io/@boyon99/JS-영화진흥위원회-오픈API-KOFIC-OPEN-API-사용하기)
- [TIL 영화진흥위원회 오픈 API 활용](https://velog.io/@seeyong_0/TIL-영화진흥위원회에서-제공하는-오픈-API-활용해보기)
- [영화목록 조회 API 서비스](https://www.kobis.or.kr/kobisopenapi/homepg/apiservice/searchServiceInfo.do?serviceId=searchMovieList)

---

**마지막 업데이트**: 2024.12.02
