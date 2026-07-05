/**
 * #220 — 극장/포맷 로고 업로드 자유 크롭.
 *
 * 두 개의 핵심 정합성 요구를 검증한다:
 *  1) ImageCropModal은 `aspect`를 그대로 react-easy-crop에 전달한다.
 *     - aspect prop 생략   → 포스터 기본(TARGET_RATIO)
 *     - aspect={undefined} → 자유 크롭(undefined). 구조분해 기본값이면 여기서 덮여버리므로
 *       `'aspect' in props` 분기가 살아있는지 회귀로 잡는다.
 *  2) TheaterChainPicker/FormatPicker는 파일 선택 시 자유 크롭 모달을 연다(aspect undefined).
 *
 * react-easy-crop(Cropper)만 mock — 이 모듈을 렌더하는 건 ImageCropModal뿐이고, 다른
 * 테스트는 ImageCropModal 자체를 mock으로 대체하므로 실제 Cropper를 렌더하지 않는다.
 * 따라서 이 mock은 파일 간에 새어도 피해가 없다(공유 모듈 mock 회피 — MEMORY).
 * 캔버스/적용 경로(getCroppedImg)는 happy-dom 한계라 건드리지 않고, 모달 오픈 + aspect만 본다.
 */
import { describe, expect, test, afterEach, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TARGET_RATIO } from '@/utils/constants';

// aspect를 DOM 속성으로 노출하는 더미 Cropper.
mock.module('react-easy-crop', () => ({
  default: ({ aspect }: { aspect?: number }) => (
    <div data-testid="cropper" data-aspect={String(aspect)} />
  ),
}));

// mock 등록 후 require로 대상 import(bun mock hoisting 없음 — CLAUDE.md 테스트 규약).
const ImageCropModal = (
  require('@/components/ImageCropModal') as {
    default: typeof import('@/components/ImageCropModal').default;
  }
).default;
const TheaterChainPicker = (
  require('@/components/wizard/TheaterChainPicker') as {
    default: typeof import('@/components/wizard/TheaterChainPicker').default;
  }
).default;
const FormatPicker = (
  require('@/components/wizard/FormatPicker') as {
    default: typeof import('@/components/wizard/FormatPicker').default;
  }
).default;

const noop = () => {};
const pngFile = (name: string) => new File([name], name, { type: 'image/png' });
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

afterEach(cleanup);

describe('ImageCropModal aspect forwarding (#220)', () => {
  test('aspect prop 생략 → 포스터 기본 TARGET_RATIO', () => {
    render(<ImageCropModal imageSrc="blob:x" onClose={noop} onComplete={noop} />);
    expect(screen.getByTestId('cropper').getAttribute('data-aspect')).toBe(String(TARGET_RATIO));
  });

  test('aspect={undefined} → 자유 크롭(undefined 전달)', () => {
    render(
      <ImageCropModal imageSrc="blob:x" aspect={undefined} onClose={noop} onComplete={noop} />
    );
    expect(screen.getByTestId('cropper').getAttribute('data-aspect')).toBe('undefined');
  });
});

describe('로고 픽커 파일 선택 → 자유 크롭 모달 오픈 (#220)', () => {
  test('TheaterChainPicker: 업로드 시 자유 aspect 모달', async () => {
    const user = userEvent.setup();
    render(
      <TheaterChainPicker
        value=""
        onChange={noop}
        label=""
        onLabelChange={noop}
        visible
        onVisibilityChange={noop}
      />
    );
    await user.upload(fileInput(), pngFile('cgv.png'));
    // dynamic(ssr:false) 로딩 대기 후 모달 등장.
    const cropper = await screen.findByTestId('cropper');
    expect(cropper.getAttribute('data-aspect')).toBe('undefined');
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('로고 크롭');
  });

  test('FormatPicker: 업로드 시 자유 aspect 모달', async () => {
    const user = userEvent.setup();
    render(
      <FormatPicker
        value=""
        onChange={noop}
        label=""
        onLabelChange={noop}
        chain=""
        visible
        onVisibilityChange={noop}
      />
    );
    await user.upload(fileInput(), pngFile('imax.png'));
    const cropper = await screen.findByTestId('cropper');
    expect(cropper.getAttribute('data-aspect')).toBe('undefined');
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('로고 크롭');
  });
});
