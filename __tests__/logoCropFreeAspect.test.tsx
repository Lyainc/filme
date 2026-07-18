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
 *  4) 원본 비율 보존 토글(#420) — 대상 무드에서만 노출, initialPreserveRatio로 재크롭 시
 *     이전 선택을 이어받는다(claude-review PR #429 P1 — 안 이어받으면 크롭 영역만 조정해도
 *     posterFit이 조용히 'cover'로 되돌아간다).
 *
 * ImageCropModal이 렌더하는 <img>에 직접 load 이벤트를 흘려(naturalWidth/naturalHeight를
 * defineProperty로 스텁) 실제 react-image-crop을 그대로 태운다 — 라이브러리를 목킹하지 않고
 * ImageCropModal 자신이 노출하는 data-aspect(crop-frame)만 관측한다(구현 라이브러리에 비의존).
 * getCroppedImg(canvas)만 mock — happy-dom 한계(다른 크롭 테스트와 동일 사유). `Area`는 타입
 * 전용 import라 이 mock으로 대체돼도 ImageCropModal 자체 로딩에는 영향이 없다.
 */
import { describe, expect, test, afterEach, beforeEach, mock } from 'bun:test';
import { useState } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TARGET_RATIO } from '@/utils/constants';

mock.module('@/utils/imageCrop', () => ({
  getCroppedImg: () => Promise.resolve('blob:cropped'),
}));

const ImageCropModal = (
  require('@/components/ImageCropModal') as {
    default: typeof import('@/components/ImageCropModal').default;
  }
).default;
const { FieldEditorBody } = require('@/components/v2/FieldEditorBody') as typeof import('@/components/v2/FieldEditorBody');
const { usePhototicket } = require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');
const ImageUploader = (
  require('@/components/ImageUploader') as {
    default: typeof import('@/components/ImageUploader').default;
  }
).default;

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

describe('원본 비율 보존 토글 (#420, claude-review PR #429 P1)', () => {
  test('layout 미전달 → 토글 없음(로고 컨텍스트)', () => {
    render(<ImageCropModal imageSrc="blob:x" aspect={undefined} onClose={noop} onComplete={noop} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  test('layout이 대상 무드 아님(editorial) → 토글 없음', () => {
    render(<ImageCropModal imageSrc="blob:x" onClose={noop} onComplete={noop} layout="editorial" />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  test('layout이 대상 무드(minimal) → 토글 노출, 기본 unchecked, aspect는 TARGET_RATIO', () => {
    render(<ImageCropModal imageSrc="blob:x" onClose={noop} onComplete={noop} layout="minimal" />);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(aspectOf(screen.getByTestId('crop-frame'))).toBe(TARGET_RATIO);
  });

  test('initialPreserveRatio=true → 토글이 처음부터 checked(재크롭 시 posterFit 유지)', () => {
    render(
      <ImageCropModal
        imageSrc="blob:x"
        onClose={noop}
        onComplete={noop}
        layout="criterion"
        initialPreserveRatio
      />
    );
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    // 재크롭 버튼이 매번 initialPreserveRatio 없이 모달을 열면 여기서 unchecked로 깨진다 —
    // 크롭 영역만 조정해도 posterFit이 조용히 'cover'로 되돌아가는 회귀(claude-review PR #429 P1).
    expect(checkbox.checked).toBe(true);
  });

  test('토글 클릭 시 aspect가 TARGET_RATIO ↔ 자연비로 전환된다', () => {
    render(<ImageCropModal imageSrc="blob:x" onClose={noop} onComplete={noop} layout="minimal" />);
    loadImage(2000, 3000);
    expect(aspectOf(screen.getByTestId('crop-frame'))).toBe(TARGET_RATIO);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(aspectOf(screen.getByTestId('crop-frame'))).toBeCloseTo(2000 / 3000, 5);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(aspectOf(screen.getByTestId('crop-frame'))).toBe(TARGET_RATIO);
  });

  test('적용 시 onComplete가 현재 토글 상태를 preserveRatio로 전달한다', () => {
    let received: [unknown, boolean] | null = null;
    const onCompleteSpy = (area: unknown, preserveRatio: boolean) => {
      received = [area, preserveRatio];
    };
    render(
      <ImageCropModal imageSrc="blob:x" onClose={noop} onComplete={onCompleteSpy} layout="minimal" />
    );
    loadImage(2000, 3000);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(received).not.toBeNull();
    expect((received as unknown as [unknown, boolean])[1]).toBe(true);
  });

  // DesktopStudioShell과 동형 — onUpload에서 posterFit을 갱신하고, 그 posterFit을 다시
  // ImageUploader에 넘겨(재크롭 시 initialPreserveRatio로 이어짐) 실제 배선을 재현한다.
  function UploaderHarness() {
    const [url, setUrl] = useState<string | null>(null);
    const [posterFit, setPosterFit] = useState<'cover' | 'contain'>('cover');
    return (
      <ImageUploader
        onUpload={(u, preserveRatio) => {
          setUrl(u);
          setPosterFit(preserveRatio ? 'contain' : 'cover');
        }}
        isProcessing={false}
        imageUrl={url}
        layout="minimal"
        posterFit={posterFit}
      />
    );
  }

  test('ImageUploader: 원본 비율 보존으로 적용 후 재크롭하면 체크박스가 checked로 다시 열린다', async () => {
    const user = userEvent.setup();
    render(<UploaderHarness />);

    await user.upload(fileInput(), pngFile('poster.jpg'));
    await screen.findByTestId('crop-frame');
    await user.click(screen.getByRole('checkbox'));
    loadImage(2000, 3000);
    await user.click(screen.getByRole('button', { name: '적용' }));

    // 포스터가 커밋된 뒤 재크롭 — 크롭 영역만 조정하려는 것이지 프리셋을 끄려는 게 아니므로
    // 모달은 이전 선택(원본 비율 보존 on)을 유지한 채 다시 열려야 한다(claude-review PR #429 P1).
    await user.click(await screen.findByRole('button', { name: '재크롭' }));
    const checkbox = (await screen.findByRole('checkbox')) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  test('ImageUploader: 기본(cover)으로 적용 후 재크롭하면 체크박스가 unchecked로 열린다', async () => {
    const user = userEvent.setup();
    render(<UploaderHarness />);

    await user.upload(fileInput(), pngFile('poster.jpg'));
    await screen.findByTestId('crop-frame');
    loadImage(2000, 3000);
    await user.click(await screen.findByRole('button', { name: '적용' }));

    await user.click(await screen.findByRole('button', { name: '재크롭' }));
    const checkbox = (await screen.findByRole('checkbox')) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });
});
