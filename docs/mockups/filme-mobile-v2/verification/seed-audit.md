# Seed 최종 대조 · 2026-09-24

기준: `/private/tmp/filme-v6/seed.yaml`, spec_version 2, r1–r16 / ac1–ac7.
범위: `docs/mockups/filme-mobile-v2`의 로컬 목업. 프로덕션 코드·API·티켓 자연 픽셀 조판·JPEG 출력은 변경하지 않았어요.

## 수정한 결함

- 키보드: viewport를 `resizes-visual`로 지정해 기존 VisualViewport 기반 키보드 감지와 일치시켰어요. Chrome에서 시각 뷰포트 축소·이동·복원 시 입력 패널과 포커스 필드의 가시성을 확인했어요. 실제 Android/iPhone 키보드 검증은 아니에요.
- 상영 시간: 입력 검증과 같은 숫자 조건으로 표시값을 정규화해요. `118.0`과 `1.18e2`는 입력 원문을 보존하고 티켓에는 `118`을 표시해요. 완료·초안 저장·새로고침 후 복원까지 검증했어요. 소수 분 등 유효하지 않은 입력의 오류 표시는 유지해요.

## 구현 대조

| 요구사항 | 판정 | 구현과 확인 근거 |
| --- | --- | --- |
| r1 공통 패널 | 구현 | styles.css 패널·닫기·라벨/값/트랙; redesign/refinement 화면 기하 |
| r2 그룹 입력 | 구현 | DataField, 영화/관람/기록 폼, native 입력·Enter 이동; redesign/mobile |
| r3 편집 대상 | 구현 | LiveTicket의 자연 DOM 밖 강조선·키보드 초점 확대; mobile 기하 |
| r4 사진 상태 | 구현 | 미등록 선택/샘플, 등록 후 교체/자르기/제거/배치/불투명도; redesign/experience |
| r5 디자인 비교 | 구현 | DesignPresets의 동일 문서 6무드·독립 스크롤과 선택·원본 비율; redesign/experience |
| r6 색상 역할 | 구현 | 브릭 표시명, 이전 오렌지 값 호환, 별도 불투명도; 코드 대조·refinement |
| r7 질감 | 구현 | 소재/코팅 견본 및 독립 강도, 원본/없음 비활성화; redesign/experience |
| r8 로고 | 구현 | 텍스트/이미지 상태, 업로드/자르기/제거/표시/크기/포맷; redesign |
| r9 편집·완료 | 구현 | 정보 채우기, 제목 필수, 사진 CTA 조건, 완료→결과·공유; experience/refinement |
| r10 출처·설정 | 구현 | 필드별 출처·수정 표시, 표시/서체/날짜 설정; redesign |
| r11 메뉴 위계 | 구현 | 좌측 아이콘/이름·우측 상태, 작은 브랜드·접이식 안내; refinement |
| r12 초안 보존 | 구현 | OFF 기존 초안 유지·예약/pagehide 저장 차단, ON 현재 문서 저장; refinement |
| r13 확인창 | 구현 | 사진/입력/꾸미기 초기화 문구·취소·44px 닫기; refinement |
| r14 색상 패널 | 구현 | 일반 212px/고정색 136px, 전체 화면 미리보기 유지; refinement/mobile |
| r15 사용자 지정 | 구현 | 팔레트 아이콘·작은 색 견본·native 피커·선택 접근성; redesign/refinement |
| r16 적용 대상 | 구현 | Minimal 잉크·배경 톤, Editorial 강조색, 나머지 고정색; refinement |

코드와 Seed를 별도로 대조한 독립 검토에서도 추가 미구현은 발견되지 않았어요. 두 결함 수정에 대한 별도 1회 코드 리뷰에서도 추가 결함은 발견되지 않았어요.

## 실행 증거와 남은 검증 경계

- 목업 빌드 성공. Chrome 검증 **40개 통과**: experience 8, redesign 15, mobile 8, refinement 9. 각 JSON 보고서에 실패와 브라우저 오류가 없어요.
- ac1·ac2·ac4·ac6·ac7: 구현 대조 및 해당 Chrome 검증을 완료했어요. 너비 320·375·393·414px와 768px 화면의 모바일 프레임을 포함해요.
- ac3: 숫자 원문/표시/복원, 날짜, 긴 텍스트, Enter, 축소·이동 뷰포트를 확인했어요. Chrome CDP 입력 조합으로 `ㅎ→한→한글`의 즉시 반영, 조합 중 Enter의 포커스 유지, 확정 후 Enter 이동과 초안 저장도 확인했어요. 실제 OS 한글 키보드의 증거로 간주하지 않아요.
- ac5: 비교 캡처와 화면 검토 자료는 유지해요. 사용자 최종 사용성 평가는 완료로 간주하지 않아요.
- 직전 검토에서 Mac Safari의 랜딩과 여섯 편집 메뉴 기본 동작을 확인했어요. 실제 iPhone은 감지됐으나 WebDriver 세션 생성에 실패했어요. 이번 변경 후 실기기 검증을 완료했다고 주장하지 않아요.
- OCR·영화 검색·JPEG 저장·OS 공유는 명세대로 샘플 동작이에요. 실제 API/내보내기 구현 누락으로 분류하거나, 실서비스 검증 완료로 표시하지 않아요.

보고서: [experience](./experience-report.json), [redesign](./redesign-report.json), [mobile](./mobile-report.json), [refinement](./refinement-report.json).
