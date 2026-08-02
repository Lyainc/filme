/**
 * #402→#415 회귀 테스트 — 모바일 셸 html 배경 동기화.
 *
 * .chrome-dark는 셸 내부 div 스코프라 documentElement(html) 자신의 배경(--bg)까진 CSS 변수
 * 상속이 안 닿는다(상속은 자손 방향으로만). MobileEditorShell이 theme를 그대로 따르게 되며(#415)
 * html의 기존 .theme-dark 동기화만으로 편집 셸과는 항상 맞아떨어져, showMobile 기준 무조건
 * forcing은 필요 없어졌다(오히려 라이트 테마에서 셸은 라이트인데 html만 다크가 되는 역전 회귀를
 * 만든다). documentElement.chrome-dark forcing은 여전히 다크인 ResultStage(#357, theme 무관)가
 * 떠 있을 때만 필요 — 라이트 테마에서 그 화면을 볼 때 iOS 탄성 스크롤·100dvh 재계산 순간 밝은
 * html 배경이 다크 크롬 위로 노출되는 걸 막는다(원 #402 재현 조건).
 *
 * resultOpen===true 경로(claude-review PR #426 P1 지적) — index.tsx:89의
 * `showMobile && resultOpen` 중 resultOpen 절이 실제로 켜지는 코드 경로는 편집 완료("완료" 탭)
 * 뒤 ResultStage가 뜨는 흐름뿐이라, 그걸 타야 이 effect의 진짜 목적(라이트 테마에서 결과화면
 * 진입 시 배경 매치)이 검증된다. ImageCropModal(canvas)만 mock — mobileEditorShellPosterCropPipeline
 * .test.tsx와 동일 패턴(공유 훅인 usePhototicket은 mock하지 않음, #179 bun mock.module 전역 누수 회피).
 * localStorage에 title/titleOg/releaseDate를 미리 심어 canExport를 채우고, 실제 파일 input +
 * mock 크롭 모달로 포스터만 업로드해 "완료" 탭까지 실제 UI 경로로 돈다.
 */
import { describe, expect, test, afterAll, afterEach, beforeEach, mock } from 'bun:test';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// **스냅샷은 mock.module보다 먼저 떠야 하고, 스프레드여야 한다(#611).** `require()`가 주는 건
// 살아있는 모듈 네임스페이스라 mock.module이 그 객체를 제자리에서 갈아끼운다 — 얕은 복사본만
// 그 변조를 피해 afterAll에서 진짜로 되돌릴 수 있다. 안 되돌리면 이 크롭 모달 스텁이 프로세스
// 끝까지 남아, 진짜 모달을 기다리는 뒤 파일(posterCropPipeline의 #182·#315·#548 11개)이 통째로
// asyncUtilTimeout까지 매달렸다가 깨진다. Linux CI에서만 터진 건 파일 실행 순서 차이일 뿐이다.
// #618: 이 파일은 ImageCropModal만 되돌리는 반쪽이었다 — 아래 `@/utils/imageCrop` 스텁은 안
// 풀려 프로세스 끝까지 남았고, 같은 모듈을 쓰는 뒤 파일이 실제 canvas 크롭 대신
// `blob:cropped-result` 문자열을 받았다. 두 스냅샷을 같은 afterAll에서 함께 되돌린다.
const realImageCropModal = { ...require('@/components/ImageCropModal') };
const realImageCrop = { ...require('@/utils/imageCrop') };
afterAll(() => {
  mock.module('@/components/ImageCropModal', () => realImageCropModal);
  mock.module('@/utils/imageCrop', () => realImageCrop);
});

mock.module('@/components/ImageCropModal', () => ({
  default: ({
    imageSrc,
    onComplete,
  }: {
    imageSrc: string;
    onClose: () => void;
    onComplete: (a: unknown) => void;
  }) => (
    <div role="dialog">
      <span data-testid="crop-src">{imageSrc}</span>
      <button type="button" onClick={() => onComplete({ x: 0, y: 0, width: 1, height: 1 })}>
        mock-apply
      </button>
    </div>
  ),
}));

mock.module('@/utils/imageCrop', () => ({
  ...realImageCrop,
  getCroppedImg: () => Promise.resolve('blob:cropped-result'),
}));

const Home = (require('@/pages/index') as { default: typeof import('@/pages/index').default })
  .default;

function setViewportWidth(width: number) {
  window.innerWidth = width;
}

const posterFileInput = () =>
  document.querySelector('input[type="file"][accept*="jpeg"]') as HTMLInputElement;
const pngFile = (name: string) => new File([name], name, { type: 'image/png' });

// canExport(title·titleOg·releaseDate — 포스터는 #631로 조건에서 빠졌다)를 채워 "완료" 탭이
// 실제로 onDone까지 도달하게 한다.
function seedExportableDraft() {
  window.localStorage.setItem(
    'filme:phototicket:v1',
    JSON.stringify({
      movieInfo: { title: 'TITLE', titleOg: 'TITLE_OG', releaseDate: '2026-01-01' },
      components: {},
      fieldVisibility: {},
    })
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('chrome-dark', 'theme-dark');
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.classList.remove('chrome-dark', 'theme-dark');
});

describe('모바일 셸 html 배경 동기화 (#402→#415)', () => {
  test('모바일 + 라이트 테마(기본): documentElement에 chrome-dark 미적용 — 셸도 라이트라 매치', () => {
    setViewportWidth(500);
    render(<Home />);
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(false);
  });

  test('모바일 + 다크 테마: documentElement에 theme-dark 적용(기존 테마 동기화, chrome-dark forcing 불필요)', () => {
    setViewportWidth(500);
    // _document.tsx의 FOUC 스크립트가 이미 얹어놨을 상태를 시뮬레이트 — Home의 mount effect가
    // 이 클래스를 읽어 theme state를 'dark'로 확정한다.
    document.documentElement.classList.add('theme-dark');
    render(<Home />);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(false);
  });

  // #607 — 데스크톱 폭에서도 셸이 갈리지 않는다. 예전엔 이 자리에 "데스크톱 렌더 시엔 chrome-dark
  // 미적용"이 있었는데, 그 명제 자체가 두 셸을 전제했다. 지금 확인할 건 두 가지다:
  // (a) 폭과 무관하게 같은 모바일 셸이 뜨고, (b) 그게 폰 프레임 **안**에 뜬다. 프레임은 fixed
  // 컨테이닝 블록이자 cq 기준점이고 ImageCropModal의 포털 타깃·getFrameRect의 좌표 원점이라,
  // 래퍼가 빠지면 그 넷이 전부 조용히 뷰포트/ body 폴백으로 돌아간다(테스트는 다 통과한 채로).
  test('데스크톱 폭에서도 같은 모바일 셸이 폰 프레임 안에 뜬다 (#607)', () => {
    setViewportWidth(1200);
    render(<Home />);
    expect(document.getElementById('phone-frame')).not.toBeNull();
    expect(screen.getByRole('button', { name: /포스터 올리기/ })).toBeTruthy();
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(false);
  });

  test('모바일 + 라이트 테마 + 결과화면(resultOpen) 진입: documentElement에 chrome-dark 적용', async () => {
    setViewportWidth(500);
    seedExportableDraft();
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole('button', { name: /포스터 올리기/ }));
    fireEvent.change(posterFileInput(), { target: { files: [pngFile('poster.png')] } });
    await user.click(await screen.findByText('mock-apply'));

    expect(document.documentElement.classList.contains('chrome-dark')).toBe(false);

    await user.click(await screen.findByRole('button', { name: '완료' }));

    expect(document.documentElement.classList.contains('chrome-dark')).toBe(true);
  });

  test('unmount(페이지 이동) 시 chrome-dark cleanup', async () => {
    setViewportWidth(500);
    seedExportableDraft();
    const user = userEvent.setup();
    const { unmount } = render(<Home />);

    await user.click(screen.getByRole('button', { name: /포스터 올리기/ }));
    fireEvent.change(posterFileInput(), { target: { files: [pngFile('poster.png')] } });
    await user.click(await screen.findByText('mock-apply'));
    await user.click(await screen.findByRole('button', { name: '완료' }));
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(true);

    unmount();
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(false);
  });
});
