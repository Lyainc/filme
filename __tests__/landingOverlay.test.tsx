/**
 * 랜딩 오버레이(#614) 회귀 테스트 — 오버레이를 걷는 조건과 그 반대(안 걷히는 것)를 고정한다.
 *
 * 세 경로:
 *   1. 드래프 없음 → 랜딩이 뜬다(헤드카피 + CTA)
 *   2. 드래프 복원 → **랜딩이 그대로 뜨고**(#727 c1, #675 D7 뒤집기) 주 CTA 위에 복원 진입점
 *      ("이어서 만들기")이 선다. 눌러야 편집으로 들어가고, 그때 복원된 필드가 그대로 남는다.
 *   3. CTA 1탭 → 셸의 숨은 포스터 input이 **같은 제스처 안에서** click된다(라우트 전환이 없어야
 *      파일 다이얼로그가 열린다는 게 /studio 분리안을 버린 이유다) → 크롭 확정에 오버레이가 걷힌다.
 *      파일 선택만으로는 안 걷힌다(#727 c4) — 크롭 모달은 DOM 순서로 랜딩 위에 그려지고, 취소하면
 *      랜딩이 그 자리에 그대로 남아 빈 셸이 안 생긴다.
 *
 * 랜딩↔편집 전환에서 OcrUploadCard가 remount되지 않는 건 mobileChromeOrder.test.tsx가 이미
 * 노드 동일성으로 잡고 있어 여기서 겹쳐 재지 않는다.
 *
 * 표시 여부는 className으로 본다 — 이 레포엔 jest-dom이 없고 Tailwind CSS도 테스트에 안 실려
 * getComputedStyle이 클래스를 반영하지 않는다(레포 컨벤션, mobileChromeOrder와 동일).
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { UNOFFICIAL_TICKET_NOTICE } from '@/utils/ticketCleanup';
import { GALLERY_LAYOUTS } from '@/components/v2/Landing';
import { mobileShellProps } from './shellHarness';

const { usePhototicket, STORAGE_KEY } = require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');
const { MobileEditorShell } =
  require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');

function Harness() {
  const photo = usePhototicket();
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

const landing = () => screen.getByTestId('landing');
// 랜딩은 두 모드다(overlay / hidden, #727 c3 — inline 삭제). 걷혔다 = 셸을 더는 안 덮는다이므로
// fixed 여부로 잰다. hidden도 unmount가 아니라 CSS다(#297 P1).
const landingOverlayShown = () => landing().classList.contains('fixed');
const restoreRow = () => screen.getByTestId('landing-restore');
const posterInput = () =>
  document.querySelector('input[type="file"][accept*="jpeg"]') as HTMLInputElement;
const ocrButton = () => screen.getByRole('button', { name: '티켓 스크린샷으로 자동입력' });

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('랜딩 오버레이(#614)', () => {
  test('드래프가 없으면 랜딩이 뜨고 카피·히어로·주 CTA·이탈 경로·미인증 고지가 함께 있다', () => {
    render(<Harness />);

    expect(landingOverlayShown()).toBe(true);
    expect(landing().textContent).toContain('내 굿즈가 돼요');
    // 실물 티켓 사진도 인식된다는 안내는 서브카피로 옮겨왔다(#635 c7).
    expect(landing().textContent).toContain('사진으로 찍은 실물 티켓도 돼요.');
    // 법적 고지는 랜딩 레이아웃 정리 중 제일 지워지기 쉬운 자리라 명시적으로 잡아둔다(#614).
    expect(landing().textContent).toContain(UNOFFICIAL_TICKET_NOTICE);
    // OCR이 주 CTA(#635), 포스터 업로드·직접 입력은 그 아래 이탈 경로.
    expect(ocrButton()).toBeDefined();
    expect(screen.getByRole('button', { name: '포스터 업로드' })).toBeDefined();
    expect(screen.getByTestId('landing-skip-poster').textContent).toBe('포스터 없이 직접 입력');
    // 히어로 auto-scroll 갤러리(#615, 2026-08-04 개정) — 무드칩 대신 무드 샘플이 랜딩에 함께 뜬다.
    // 목록은 LAYOUTS 전체가 아니라 GALLERY_LAYOUTS다(35mm Wide 제외, 2026-08-08 사용자 피드백).
    // 각 샘플은 role 없는 순수 button(라디오그룹이 아니다, Landing.tsx 컴포넌트 주석). seamless
    // loop를 위해 DOM엔 이름당 두 벌이 있지만 뒤 절반은 aria-hidden(fresh-context 리뷰 지적)이라
    // role 쿼리엔 하나씩만 잡혀야 정상이다.
    for (const layout of GALLERY_LAYOUTS) {
      const buttons = within(landing()).getAllByRole('button', { name: new RegExp(`^${layout.label} 무드로 바로 시작`) });
      expect(buttons).toHaveLength(1);
      // 히어로 이미지 매핑(HERO_IMAGES, #613) 회귀 방어 — 무드 추가·오타로 엔트리가 빠지면
      // <img src>가 비거나 잘못된 경로로 조용히 깨진다(claude-review PR #759 P1).
      expect(buttons[0].querySelector('img')?.getAttribute('src')).toBe(`/assets/landing/hero-${layout.id}.webp`);
    }
    expect(within(landing()).queryAllByRole('button', { name: /^35mm Wide 무드로 바로 시작/ })).toHaveLength(0);
  });

  // ac1 — #675 D7의 정확한 반대. 텍스트만 있던 draft가 여기, 포스터가 있던 draft는
  // awaitingPosterRestore.test.tsx가 IDB 게이트를 쥐고 잰다(복원이 **끝난 뒤에도** 유지되는지).
  test('드래프가 복원돼도 랜딩이 오버레이로 그대로 뜬다 (#727 c1, D7 뒤집기)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '인터스텔라' } }));

    render(<Harness />);

    expect(landingOverlayShown()).toBe(true);
    // 마케팅 층도 그대로다 — 재방문자도 무드 갤러리·OCR·업로드·직접 입력을 같은 화면에서 고른다.
    expect(landing().textContent).toContain('내 굿즈가 돼요');
    expect(!!screen.queryByRole('button', { name: '포스터 업로드' })).toBe(true);
    expect(!!ocrButton()).toBe(true);
  });

  // ac2 — 복원 진입점의 자리와 라벨. 라벨 규칙은 docs/COPY_TONE_GUIDE.md 축 2의 기계적 판별을
  // 그대로 옮긴 것이다(조건절·종결어미·마침표 금지). `-하기`는 금지가 아니다.
  test('복원 진입점이 주 CTA 위에 있고, 라벨이 조건절 없는 명령형에 제목을 싣는다', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '인터스텔라' } }));

    render(<Harness />);

    const label = restoreRow().textContent ?? '';
    expect(label.startsWith('이어서 만들기')).toBe(true);
    expect(label).toContain('인터스텔라');
    expect(/[.]|있으면|없으면|세요|까요/.test(label)).toBe(false);
    // DOCUMENT_POSITION_FOLLOWING(4) — 복원 행이 주 CTA보다 DOM 앞이다(= 위).
    expect((restoreRow().compareDocumentPosition(ocrButton()) & 4) !== 0).toBe(true);
    // 탭 타깃 44px(#646 선례, c12) — 테스트에 Tailwind가 안 실려 클래스로 잰다(레포 컨벤션).
    expect(restoreRow().className).toContain('min-h-touch');
  });

  // ac3 — 눌렀을 때 랜딩이 걷히고 복원된 문서가 그대로 편집 화면에 있다. 다섯 이탈 중 유일하게
  // 문서를 새 문서로 안 되돌리는 경로다(c7의 "새로 시작" 넷과 갈리는 지점).
  test('복원 진입점을 누르면 랜딩이 걷히고 복원된 필드가 편집 화면에 남는다', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '인터스텔라' } }));

    render(<Harness />);
    fireEvent.click(restoreRow());

    expect(landing().classList.contains('hidden')).toBe(true);
    expect(landingOverlayShown()).toBe(false);
    // 편집 크롬이 실제로 열렸는지 — posterlessCanvas.test.tsx와 같은 두 진입점으로 잰다.
    expect(!!screen.queryByRole('button', { name: '완료' })).toBe(true);
    expect(!!screen.queryByRole('button', { name: '티켓 항목 목록 열기' })).toBe(true);
    // 복원된 제목이 문서에 살아 있다 — 티켓 프리뷰가 그 값을 그린다.
    expect(document.body.textContent).toContain('인터스텔라');
  });

  test('주 CTA 1탭이 포스터 input이 아니라 OCR 파일 input을 그 자리에서 연다', () => {
    render(<Harness />);
    const input = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
    let clicked = 0;
    input.addEventListener('click', () => {
      clicked += 1;
    });

    fireEvent.click(ocrButton());
    expect(clicked).toBe(1);
  });

  test('이탈 경로 "포스터 업로드" 1탭이 포스터 input을 그 자리에서 click하고, 파일 선택 뒤에도 오버레이가 남는다 (#727 c4)', () => {
    render(<Harness />);
    const input = posterInput();
    let clicked = 0;
    // click()이 실제로 그 input에 도달했는지 — 라우트 전환 없이 같은 제스처 안에서 열린다는 것의
    // 관측 가능한 대리(파일 다이얼로그 자체는 테스트 환경에 없다).
    input.addEventListener('click', () => {
      clicked += 1;
    });

    fireEvent.click(screen.getByRole('button', { name: '포스터 업로드' }));
    expect(clicked).toBe(1);
    expect(landingOverlayShown()).toBe(true); // 아직 안 고름

    fireEvent.change(input, {
      target: { files: [new File(['x'], 'poster.png', { type: 'image/png' })] },
    });

    // #727 c4 — 예전엔 crop.cropOpen이 랜딩 판정에 들어 있어 이 프레임에 걷혔다. 지금은 크롭
    // 모달이 z-50 + DOM 순서로 랜딩 위에 그려지므로 걷을 필요가 없고, 걷지 않으니 크롭 취소가
    // 저절로 랜딩으로 되돌아간다(파생 판정 없이). 실제로 걷히는 건 크롭 **확정** 시점이고
    // posterCropPipeline.test.tsx가 그 축을 크롭 모달까지 태워 잠근다.
    //
    // #717 진단 프로브 — 이 케이스는 #727이 흡수하지 않고 #717에 남긴 셋 중 하나다(단언 방향은
    // c4가 뒤집었지만 부하 상태 전 스위트에서만 깨지는 원인 조사는 그쪽 소유다). landingOverlayShown()은
    // getByTestId를 거쳐 n≠1이면 그 자리에서 throw하므로, 그보다 먼저 querySelectorAll로 개수를
    // 세야 "landing이 중복/소실됐다"는 가설 자체를 진단할 수 있다.
    const diagAll = document.querySelectorAll('[data-testid="landing"]');
    if (diagAll.length !== 1 || !diagAll[0].classList.contains('fixed')) {
      console.error(
        `[#717] n=${diagAll.length} cls=${JSON.stringify(Array.from(diagAll).map((e) => e.className))}` +
        ` ls=${JSON.stringify(localStorage.getItem(STORAGE_KEY))}` +
        ` done=${!!screen.queryByRole('button', { name: '완료' })}`
      );
    }
    expect(landingOverlayShown()).toBe(true);
  });
});

/**
 * 배경 타일 그리드(#615) 위에서 카피가 읽히게 만든 세 수정은 전부 브라우저 픽셀 샘플링·rect
 * 실측으로만 검증됐고 자동 가드가 없었다(claude-review 지적) — 같은 PR의 marquee 6px 스냅과
 * reduced-motion 폴백은 테스트를 받았는데 이 셋만 안 받아서, 토큰을 되돌리거나 스크림·gap을
 * 지워도 `bun test`가 그대로 통과했다. 여기서 클래스 문자열로 고정한다(이 레포엔 jest-dom도
 * Tailwind CSS도 테스트에 안 실려 getComputedStyle이 클래스를 반영하지 않는다 — 위 파일 주석의
 * 같은 컨벤션).
 *
 * 재는 건 "왜 그 값인가"가 아니라 "그 장치가 아직 거기 있는가"다: 대비 수치 자체(라이트 5.24:1
 * 등)는 브라우저에서만 잴 수 있으므로, 그 수치를 만들어낸 구조(불투명 스크림 · landing-muted
 * 토큰 · 헤드↔서브 간격)가 사라지는 걸 잡는 데까지가 이 테스트의 사정거리다.
 */
describe('배경 타일 위 카피 대비 장치 (#615)', () => {
  const scrimOf = (el: Element) => el.firstElementChild as HTMLElement;

  test('헤드·서브카피 블록이 불투명 스크림을 깔고 gap-4로 간격을 유지한다', () => {
    render(<Harness />);

    const copyBlock = within(landing()).getByRole('heading', { level: 1 }).parentElement!;

    // 스크림이 없으면 배경 타일이 카피 밑에서 그대로 비쳐 서브카피가 라이트 2.89:1까지 떨어진다.
    // absolute 스크림을 얹으려면 부모가 relative여야 하므로 둘을 같이 잡는다.
    expect(copyBlock.className).toContain('relative');
    expect(scrimOf(copyBlock).getAttribute('aria-hidden')).toBe('true');
    expect(scrimOf(copyBlock).className).toContain('bg-bg');
    expect(scrimOf(copyBlock).className).toContain('-z-[5]');

    // h1·p가 바깥 flex 컬럼에서 이 블록 자식으로 한 단 내려오면서 부모 gap-4가 안 걸리게 됐다 —
    // 같은 리듬을 이 안에서 다시 선언한 것이라, 지우면 헤드와 서브카피가 붙는다.
    expect(copyBlock.className).toContain('gap-4');
  });

  test('서브카피와 이탈 경로 줄이 text-fg-muted가 아니라 text-landing-muted를 쓴다', () => {
    render(<Harness />);

    const sub = within(landing()).getByText(/^스크린샷으로 자동입력/);
    expect(sub.className).toContain('text-landing-muted');
    expect(sub.className).not.toContain('text-fg-muted');

    const exitRow = screen.getByTestId('landing-skip-poster').parentElement!;
    expect(exitRow.className).toContain('text-landing-muted');
    expect(exitRow.className).not.toContain('text-fg-muted');
  });

  test('이탈 경로 줄도 자기 스크림을 깔고 있다', () => {
    render(<Harness />);

    const exitRow = screen.getByTestId('landing-skip-poster').parentElement!;
    expect(exitRow.className).toContain('relative');
    expect(scrimOf(exitRow).getAttribute('aria-hidden')).toBe('true');
    expect(scrimOf(exitRow).className).toContain('bg-bg');
    expect(scrimOf(exitRow).className).toContain('-z-[5]');
  });
});
