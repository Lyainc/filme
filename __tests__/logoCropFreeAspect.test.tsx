/**
 * #220/#347/#421 — 극장/포맷 로고 업로드 자유 크롭 + 포스터 크롭박스 리사이즈(react-image-crop).
 *
 * 검증하는 정합성:
 *  1) 포스터(aspect 생략) → TARGET_RATIO 고정. 미디어가 로드돼도 안 바뀐다.
 *  2) 로고(aspect={undefined}) → 크롭 프레임 = 업로드 이미지의 자연 종횡비(#347).
 *     완전 자유형(어떤 비율이든)이 아니라 "그 비율의 박스를 리사이즈"(#421)로 유지된다 —
 *     react-image-crop의 aspect=undefined는 defaultProps로 덮이지 않으므로(react-easy-crop과
 *     달리) 자연비를 직접 계산해 잠근다(ImageCropModal의 mediaAspect).
 *  3) 로고 편집 본문(StampSheet — chain/format)이 파일 선택 시 그 모달을 연다(#231).
 *
 * ImageCropModal이 렌더하는 <img>에 직접 load 이벤트를 흘려(naturalWidth/naturalHeight를
 * defineProperty로 스텁) 실제 react-image-crop을 그대로 태운다 — 라이브러리를 목킹하지 않고
 * ImageCropModal 자신이 노출하는 data-aspect(crop-frame)만 관측한다(구현 라이브러리에 비의존).
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TARGET_RATIO } from '@/utils/constants';

const ImageCropModal = (
  require('@/components/ImageCropModal') as {
    default: typeof import('@/components/ImageCropModal').default;
  }
).default;
const { FieldEditorBody } = require('@/components/v2/FieldEditorBody') as typeof import('@/components/v2/FieldEditorBody');
const { usePhototicket } = require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');

const noop = () => {};
const pngFile = (name: string) => new File([name], name, { type: 'image/png' });
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const aspectOf = (el: HTMLElement) => Number(el.getAttribute('data-aspect'));

// 업로드 이미지의 자연 크기를 <img>에 스텁하고 load 이벤트를 흘려 ImageCropModal의
// onImageLoad(mediaAspect 계산 → 크롭 초기화)를 실제로 태운다. 모달은 createPortal로
// document.body에 붙으므로 render()의 container가 아니라 document 전체에서 찾는다.
function loadImage(naturalWidth: number, naturalHeight: number) {
  const img = document.querySelector('img') as HTMLImageElement;
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: naturalHeight, configurable: true });
  Object.defineProperty(img, 'width', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'height', { value: naturalHeight, configurable: true });
  fireEvent.load(img);
}

// StampSheet(로고 본문)를 실제 photo로 렌더 — chain/format 타깃.
function StampHarness({ target }: { target: 'chain' | 'format' }) {
  const photo = usePhototicket();
  return <FieldEditorBody target={target} photo={photo} />;
}

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('ImageCropModal 크롭 프레임 종횡비 (#220/#347)', () => {
  test('aspect prop 생략 → 포스터 기본 TARGET_RATIO (미디어 로드돼도 고정)', () => {
    render(<ImageCropModal imageSrc="blob:x" onClose={noop} onComplete={noop} />);
    expect(aspectOf(screen.getByTestId('crop-frame'))).toBe(TARGET_RATIO);
    loadImage(800, 200);
    expect(aspectOf(screen.getByTestId('crop-frame'))).toBe(TARGET_RATIO);
  });

  // 정방형 / 좌우로 긴 워드마크 / 세로형 — #347이 요구한 세 경우.
  const cases: [string, number, number][] = [
    ['정방형 512×512', 512, 512],
    ['워드마크 1200×300', 1200, 300],
    ['세로형 300×900', 300, 900],
  ];
  for (const [name, w, h] of cases) {
    test(`aspect={undefined} → 프레임이 원본 자연 종횡비: ${name}`, () => {
      render(<ImageCropModal imageSrc="blob:x" aspect={undefined} onClose={noop} onComplete={noop} />);
      loadImage(w, h);
      // 자유형(완전 무관)으로 풀리면 여기서 깨진다 — #347/#421 회귀 가드.
      expect(aspectOf(screen.getByTestId('crop-frame'))).toBeCloseTo(w / h, 5);
    });
  }
});

describe('로고 본문(StampSheet) 파일 선택 → 자연비 크롭 모달 오픈 (#220/#231)', () => {
  test('극장 로고: 업로드 시 자연비 프레임 모달', async () => {
    const user = userEvent.setup();
    render(<StampHarness target="chain" />);
    await user.upload(fileInput(), pngFile('cgv.png'));
    // dynamic(ssr:false) 로딩 대기 후 모달 등장.
    await screen.findByTestId('crop-frame');
    loadImage(1200, 300);
    expect(aspectOf(screen.getByTestId('crop-frame'))).toBeCloseTo(4, 5);
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('로고 크롭');
  });

  test('포맷 로고: 업로드 시 자연비 프레임 모달', async () => {
    const user = userEvent.setup();
    render(<StampHarness target="format" />);
    await user.upload(fileInput(), pngFile('imax.png'));
    await screen.findByTestId('crop-frame');
    loadImage(512, 512);
    expect(aspectOf(screen.getByTestId('crop-frame'))).toBeCloseTo(1, 5);
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('로고 크롭');
  });
});
