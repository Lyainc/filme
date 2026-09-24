# Documentation archive

이 디렉터리는 폐기·완료·대체된 문서의 원문을 보존해요. 현재 스펙이나 로드맵이 아니에요.

## Agent policy

- 일반 구현·계획·리뷰에서는 `docs/archive/**`를 읽지 않아요.
- 사용자가 역사적 근거를 요청했거나, 현재 코드·테스트·문서만으로 결정 이유를 확인할 수 없을 때만 읽어요.
- archive의 상태·경로·수치는 현재 사실로 인용하지 않고 실제 코드, 테스트, `package.json`, `CLAUDE.md`와 다시 대조해요.

## Current source of truth

- 프로젝트·런타임 규칙: [`CLAUDE.md`](../../CLAUDE.md)
- 사용자 기능·실행 방법: [`README.md`](../../README.md), [`README.ko.md`](../../README.ko.md)
- 레이아웃·타입: [`src/utils/layouts.ts`](../../src/utils/layouts.ts), [`src/types/index.ts`](../../src/types/index.ts)
- 현재 기능 동작: [`src/`](../../src), [`__tests__/`](../../__tests__)
- 의존성과 명령: [`package.json`](../../package.json)

보관 범위는 초기 PRD·디자인 시스템·iOS RFC·Editor Chrome v8 handoff와 완료·대체된 Seed spec이에요.
