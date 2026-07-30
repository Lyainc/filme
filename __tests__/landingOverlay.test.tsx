/**
 * 랜딩 오버레이(#614) 회귀 테스트 — 오버레이를 걷는 조건과 그 반대(안 걷히는 것)를 고정한다.
 *
 * 세 경로:
 *   1. 드래프 없음 → 랜딩이 뜬다(헤드카피 + CTA)
 *   2. 드래프 복원(D7) → 랜딩 생략, 재방문자는 편집으로 직행
 *   3. CTA 1탭 → 셸의 숨은 포스터 input이 **같은 제스처 안에서** click된다(라우트 전환이 없어야
 *      파일 다이얼로그가 열린다는 게 /studio 분리안을 버린 이유다) → 파일 선택 시 오버레이가 걷힌다
 *
 * 그리고 #363/PR #372 리뷰 P1의 제약: 랜딩↔편집 전환에서 OcrUploadCard가 **같은 DOM 노드**로
 * 남아야 한다. 랜딩을 조건부 unmount로 짜면 여기서 깨진다.
 *
 * 표시 여부는 className으로 본다 — 이 레포엔 jest-dom이 없고 Tailwind CSS도 테스트에 안 실려
 * getComputedStyle이 클래스를 반영하지 않는다. 숨김 구현이 display:none(=`hidden` 유틸)인 것은
 * Landing.tsx의 계약이다(unmount가 아니어야 하므로).
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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
const landingShown = () => !landing().classList.contains('hidden');
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
  test('드래프가 없으면 랜딩이 뜨고 카피·CTA·미인증 고지가 함께 있다', () => {
    render(<Harness />);

    expect(landingShown()).toBe(true);
    expect(landing().textContent).toContain('내 굿즈가 돼요');
    expect(landing().textContent).toContain('영화 스틸컷이나 직접 찍은 사진도 돼요.');
    // 법적 고지는 랜딩 레이아웃 정리 중 제일 지워지기 쉬운 자리라 명시적으로 잡아둔다(#614).
    expect(landing().textContent).toContain('비공식');
    expect(screen.getByRole('button', { name: '포스터 올리기' })).toBeDefined();
  });

  test('드래프가 복원되면 랜딩을 생략한다 — 재방문자 마찰 0 (D7)', () => {
    // 포스터 없이 텍스트만 있던 draft도 "재방문자"다 — croppedImageUrl로는 구분되지 않으므로
    // usePhototicket.draftRestored가 이 경로의 유일한 근거다.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '인터스텔라' } }));

    render(<Harness />);

    expect(landingShown()).toBe(false);
  });

  test('CTA 1탭이 포스터 input을 그 자리에서 click하고, 파일 선택에 오버레이가 걷힌다', () => {
    render(<Harness />);
    const input = posterInput();
    let clicked = 0;
    // click()이 실제로 그 input에 도달했는지 — 라우트 전환 없이 같은 제스처 안에서 열린다는 것의
    // 관측 가능한 대리(파일 다이얼로그 자체는 테스트 환경에 없다).
    input.addEventListener('click', () => {
      clicked += 1;
    });

    fireEvent.click(screen.getByRole('button', { name: '포스터 올리기' }));
    expect(clicked).toBe(1);
    expect(landingShown()).toBe(true); // 아직 안 고름 — 여기서 걷히면 빈 셸이 드러난다

    const ocrNodeBefore = ocrButton();
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'poster.png', { type: 'image/png' })] },
    });

    expect(landingShown()).toBe(false);
    // 랜딩→편집 전환이 OcrUploadCard를 remount하면 in-flight KOBIS 보강이 유실된다(#363).
    expect(ocrButton()).toBe(ocrNodeBefore);
  });
});
