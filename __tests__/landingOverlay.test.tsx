/**
 * 랜딩 오버레이(#614) 회귀 테스트 — 오버레이를 걷는 조건과 그 반대(안 걷히는 것)를 고정한다.
 *
 * 세 경로:
 *   1. 드래프 없음 → 랜딩이 뜬다(헤드카피 + CTA)
 *   2. 드래프 복원(D7) → 오버레이 생략, 재방문자는 편집으로 직행. 단 포스터가 없으면 진입
 *      컨트롤(CTA·OCR)은 본문에 남아야 한다 — 안 그러면 헤더만 있는 빈 화면이고, IndexedDB
 *      포스터 복원 실패 시 재업로드를 유도하는 #489 결정 5의 경로가 갈 곳을 잃는다.
 *   3. CTA 1탭 → 셸의 숨은 포스터 input이 **같은 제스처 안에서** click된다(라우트 전환이 없어야
 *      파일 다이얼로그가 열린다는 게 /studio 분리안을 버린 이유다) → 파일 선택 시 오버레이가 걷힌다
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

const { usePhototicket } = require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');
const { MobileEditorShell } =
  require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');

const STORAGE_KEY = 'filme:phototicket:v1';

function Harness() {
  const photo = usePhototicket();
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

const landing = () => screen.getByTestId('landing');
// 오버레이로 떠 있는지 — 랜딩은 세 모드다(overlay / inline / hidden). 걷혔다는 건 hidden이 아니라
// "더는 셸을 덮지 않는다"이므로 fixed 여부로 잰다. 포스터 없이 걷힌 상태는 inline으로 남아
// 진입 컨트롤을 그대로 들고 있다.
const landingOverlayShown = () => landing().classList.contains('fixed');
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
    expect(screen.getByRole('button', { name: '포스터 있으면 올리기' })).toBeDefined();
    expect(screen.getByTestId('landing-skip-poster').textContent).toBe('포스터 없이 직접 입력');
    // 히어로 auto-scroll 갤러리(#615, 2026-08-04 개정) — 무드칩 대신 무드 샘플이 랜딩에 함께 뜬다.
    // 목록은 LAYOUTS 전체가 아니라 GALLERY_LAYOUTS다(35mm Wide 제외, 2026-08-08 사용자 피드백).
    // 각 샘플은 role 없는 순수 button(라디오그룹이 아니다, Landing.tsx 컴포넌트 주석). seamless
    // loop를 위해 DOM엔 이름당 두 벌이 있지만 뒤 절반은 aria-hidden(fresh-context 리뷰 지적)이라
    // role 쿼리엔 하나씩만 잡혀야 정상이다.
    for (const layout of GALLERY_LAYOUTS) {
      expect(within(landing()).getAllByRole('button', { name: new RegExp(`^${layout.label} 무드로 바로 시작`) })).toHaveLength(1);
    }
    expect(within(landing()).queryAllByRole('button', { name: /^35mm Wide 무드로 바로 시작/ })).toHaveLength(0);
  });

  test('드래프가 복원되면 오버레이를 생략하되 진입 컨트롤은 본문에 남는다 (D7)', () => {
    // 포스터 없이 텍스트만 있던 draft도 "재방문자"다 — croppedImageUrl로는 구분되지 않으므로
    // usePhototicket.draftRestored가 이 경로의 유일한 근거다.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '인터스텔라' } }));

    render(<Harness />);

    expect(landingOverlayShown()).toBe(false);
    // 마케팅 카피는 빠지고(편집 화면이다) 진입 컨트롤만 남는 inline 모드.
    expect(landing().classList.contains('hidden')).toBe(false);
    expect(landing().textContent).not.toContain('내 굿즈가 돼요');
    expect(screen.getByRole('button', { name: '포스터 있으면 올리기' })).toBeDefined();
    expect(ocrButton()).toBeDefined();
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

  test('이탈 경로 "포스터 있으면 올리기" 1탭이 포스터 input을 그 자리에서 click하고, 파일 선택에 오버레이가 걷힌다', () => {
    render(<Harness />);
    const input = posterInput();
    let clicked = 0;
    // click()이 실제로 그 input에 도달했는지 — 라우트 전환 없이 같은 제스처 안에서 열린다는 것의
    // 관측 가능한 대리(파일 다이얼로그 자체는 테스트 환경에 없다).
    input.addEventListener('click', () => {
      clicked += 1;
    });

    fireEvent.click(screen.getByRole('button', { name: '포스터 있으면 올리기' }));
    expect(clicked).toBe(1);
    expect(landingOverlayShown()).toBe(true); // 아직 안 고름 — 여기서 걷히면 빈 셸이 드러난다

    fireEvent.change(input, {
      target: { files: [new File(['x'], 'poster.png', { type: 'image/png' })] },
    });

    expect(landingOverlayShown()).toBe(false);
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
