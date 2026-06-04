# Goal: 배포 환경 티켓 다운로드 긴급 수정 (Hotfix)

> 배포(Vercel/CSP) 환경에서 티켓 저장 버튼 클릭 시 다운로드가 실행되지 않는 버그를 수정한다. 포함 이슈: #22

## 1. 배경 / 왜 이 단위인가

### 이슈 묶음 근거
이슈가 #22 하나뿐인 단일 파일 핫픽스다. `src/utils/captureToImage.ts`의 `downloadTicketAsJpeg` 함수 내부 12줄 수정으로 완결된다.

### 왜 이 순서인가
- 다른 청크와 공유 파일이 없어 병렬 머지가 가능하다.
- 배포 버전의 핵심 기능(티켓 저장)이 완전히 작동 불가 상태이므로 최우선 처리가 필요하다.

### 근본 원인
현재 코드(`captureToImage.ts` 68번 줄):

```ts
const blob = await (await fetch(dataUrl)).blob();
```

`html-to-image`가 반환한 `data:image/jpeg;base64,...` URL을 다시 `fetch()`로 불러오는 방식이다. Vercel 배포 환경의 Content Security Policy(CSP)는 `fetch('data:...')` 형태의 요청을 `connect-src` 지시어로 차단할 수 있다. 로컬 개발 서버는 CSP가 느슨해 재현되지 않는다.

Safari의 `<a download>` + `data:` href 무시 이슈를 우회하려고 Blob 경로를 선택했으나, 그 우회책 자체가 CSP에 걸리는 구조다.

### 수정 방향
`fetch()` 없이 base64 문자열을 직접 디코딩해 `Uint8Array` → `Blob`을 생성한다. 네트워크 요청이 전혀 발생하지 않으므로 CSP에 무관하며, Safari 호환성도 유지된다.

---

## 2. 완료 조건 (Definition of Done)

- [ ] `downloadTicketAsJpeg` 내부에서 `fetch(dataUrl)` 호출이 제거되고 `atob` 기반 Blob 생성으로 교체됨
- [ ] 교체 후 생성되는 Blob의 `type`이 `'image/jpeg'`임
- [ ] `URL.createObjectURL` / `URL.revokeObjectURL` 패턴은 그대로 유지됨 (다운로드 트리거 방식 불변)
- [ ] `captureNodeToJpeg` 및 `buildJpegOptions` 함수는 변경 없음
- [ ] `bun run typecheck` 오류 없음 (tsc --noEmit 통과)
- [ ] `bun run build` 성공
- [ ] `bun test` 통과 (기존 테스트 회귀 없음)
- [ ] 로컬에서 동일 바이트 JPEG Blob 생성 단위 검증 통과 (아래 §6 참조)
- [ ] Vercel 배포 후 실제 저장 버튼 → 파일 다운로드 동작 확인 (수동)

---

## 3. 쟁점과 트레이드오프

### 선택지 A: `atob` + `Uint8Array` 루프 (이슈 #22 권장안)
```ts
const byteString = atob(dataUrl.split(',')[1]);
const bytes = new Uint8Array(byteString.length);
for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
const blob = new Blob([bytes], { type: 'image/jpeg' });
```
- **장점**: 순수 동기 연산(await 없음), CSP 완전 무관, 브라우저 전방위 호환
- **단점**: 고해상도 JPEG(≈2-5 MB base64)를 문자 단위로 순회하는 루프 — 수십 ms 수준의 메인스레드 점유 가능

### 선택지 B: `Response` 생성자 활용
```ts
const blob = await new Response(dataUrl).blob();
```
- **장점**: 간결
- **단점**: `fetch()`와 동일하게 CSP `connect-src`에 걸릴 수 있다는 브라우저별 이슈 보고 존재. 검증 어려움.

### 선택지 C: `TextEncoder` / `TextDecoder` 기반
- base64 디코딩에는 `atob`가 더 직접적. 복잡도만 높아짐.

**권장 결정: 선택지 A.**
이미 이슈에서 방향이 확정됐고, 구현이 단순하며 예측 가능하다. 성능 비용(루프)은 JPEG 캡처 자체(`html-to-image` 수백 ms) 대비 무시할 수준이다.

### MIME 타입 하드코딩 여부
현재 `captureNodeToJpeg`는 항상 `toJpeg`를 호출하므로 `type: 'image/jpeg'` 하드코딩은 안전하다. 향후 PNG 내보내기가 추가되면 `dataUrl.split(';')[0].replace('data:', '')` 로 동적 추출이 필요하나, 지금은 오버엔지니어링이다.

---

## 4. 슬라이스 순서 (goal 내부 실행 순서)

이슈가 하나, 파일이 하나이므로 슬라이스도 하나다.

1. **Slice 1 — `downloadTicketAsJpeg` Blob 생성 교체** (이슈 #22)
   - **건드리는 파일**: `src/utils/captureToImage.ts` (68번 줄 단 1줄 → 5줄)
   - **변경 요지**:
     - `const blob = await (await fetch(dataUrl)).blob();` 제거
     - `atob` 루프 기반 Blob 생성 코드로 교체
     - 주석 업데이트: "Go through Blob + ObjectURL" 기존 설명을 CSP-safe 경로임을 명시하도록 수정
   - **이 슬라이스만의 완료 기준**:
     - `fetch` 호출이 해당 함수 내에 존재하지 않음
     - TypeScript 타입 오류 없음 (`Uint8Array`, `Blob`, `atob` 모두 브라우저 전역)
     - `bun run typecheck` 통과

---

## 5. 의존성 / 선행 조건

**독립** — 다른 청크, 외부 서비스, 환경변수와 무관하다. `captureToImage.ts`를 import하는 곳은 `src/pages/index.tsx`의 `handleDownload` 콜백 하나뿐이며, 함수 시그니처(`node`, `options`)와 반환 타입(`Promise<void>`)이 변경되지 않으므로 호출부 수정이 불필요하다.

---

## 6. E2E 자가 검증 방법 (에이전트가 스스로 수행)

### 6-A. 정적 검증 (로컬, 명령어)

```bash
# 1. 타입 검사
bun run typecheck
# 기대: 오류 0건, 종료코드 0

# 2. 빌드
bun run build
# 기대: 종료코드 0, .next/ 생성

# 3. 기존 테스트
bun test
# 기대: 종료코드 0, 실패 0건
```

### 6-B. 단위 검증 — base64 → Blob 동일 바이트 확인 (로컬 Node/브라우저)

CSP 위반은 로컬에서 재현되지 않는다. 대신 **"교체된 코드가 fetch 경로와 동일한 바이트를 생성하는지"** 를 로컬에서 검증한다.

**방법 1 — bun 스크립트로 검증:**

```ts
// scripts/verify-blob-bytes.ts
// bun run scripts/verify-blob-bytes.ts
import { readFileSync } from 'fs';

// 임의의 JPEG 파일을 data: URL로 변환
const jpegBytes = readFileSync('./public/assets/sample.jpg'); // 아무 JPEG
const base64 = jpegBytes.toString('base64');
const dataUrl = `data:image/jpeg;base64,${base64}`;

// fetch 경로 (CSP 없는 Node 환경에서만 동작)
const blobViaFetch = await (await fetch(dataUrl)).blob();
const fetchBytes = new Uint8Array(await blobViaFetch.arrayBuffer());

// atob 경로 (교체 후 코드)
const byteString = atob(dataUrl.split(',')[1]);
const bytes = new Uint8Array(byteString.length);
for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);

// 비교
const match = fetchBytes.length === bytes.length &&
  fetchBytes.every((b, i) => b === bytes[i]);
console.log('바이트 일치:', match); // 기대: true
console.log('길이:', bytes.length, '원본:', jpegBytes.length);
```

기대 출력: `바이트 일치: true`

**방법 2 — 브라우저 콘솔에서 직접 확인 (`bun run dev` 후):**

```js
// 브라우저 DevTools Console에 붙여넣기
const testB64 = btoa('hello world test bytes 0123456789');
const dataUrl = `data:image/jpeg;base64,${testB64}`;
const byteString = atob(dataUrl.split(',')[1]);
const bytes = new Uint8Array(byteString.length);
for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
const blob = new Blob([bytes], { type: 'image/jpeg' });
console.log('Blob size:', blob.size, '/ 기대:', byteString.length);
console.log('Blob type:', blob.type); // 기대: 'image/jpeg'
```

### 6-C. UI 흐름 검증 (로컬, `bun run dev`)

1. `bun run dev` 실행 후 `http://localhost:3000` 접속
2. Phase 1: 임의 이미지 업로드 → 크롭 완료
3. Phase 2로 이동 → 영화 정보 입력 (최소 제목)
4. "JPEG 다운로드" 버튼 클릭
5. **관찰**:
   - 버튼이 `loading` 상태(스피너 등)로 전환됨
   - 브라우저 다운로드가 트리거되어 `.jpg` 파일이 저장됨
   - 버튼이 `success` 상태로 전환 후 2초 뒤 `idle`로 복귀
   - DevTools Console에 오류 없음, 특히 `fetch`/`CSP` 관련 오류 없음
6. 다운로드된 JPEG를 열어 티켓 이미지가 깨지지 않았는지 확인

### 6-D. 배포 후 수동 확인 (Vercel, 자동화 불가)

> CSP 위반은 로컬에서 재현되지 않으므로 배포 후 별도 확인이 필요하다.

- [ ] Vercel에 배포 후 프로덕션 URL 접속
- [ ] 동일한 UI 흐름(6-C)을 프로덕션에서 반복
- [ ] Vercel 배포 환경에서 "JPEG 다운로드" 클릭 → 파일 다운로드 성공
- [ ] 브라우저 DevTools → Network 탭에서 `data:` 스킴 fetch 요청이 없음을 확인
- [ ] 브라우저 DevTools → Console 탭에서 CSP 위반 오류(빨간 `Content Security Policy` 경고)가 없음을 확인
- [ ] Safari에서도 동일하게 다운로드 트리거 확인 (iOS Safari 포함 권장)

---

## 7. 리스크 / 롤백

### 망가뜨릴 수 있는 것
- **없음 (범위 최소)**: 함수 시그니처 불변, 호출부(`index.tsx`) 수정 없음, 다른 유틸/컴포넌트 import 없음.

### 회귀 위험
- `atob`는 base64 문자열에 ASCII 범위를 벗어난 문자가 있으면 예외를 던진다. `html-to-image`의 `toJpeg`는 표준 base64만 반환하므로 실질적 위험은 없다. 방어적으로 `try/catch`는 이미 `handleDownload`(index.tsx 83번 줄)에 존재한다.
- 대용량 JPEG(2–5 MB decoded) 루프에서 메인스레드 블로킹이 수십 ms 발생할 수 있으나, 캡처 단계(`html-to-image`) 자체가 이미 수백 ms이므로 UX 영향 없음.

### 롤백 방법
단일 커밋이므로 `git revert <commit-sha>` 한 번으로 복구된다. 변경 줄 수가 5줄 미만이라 수동 롤백도 즉각 가능하다.
