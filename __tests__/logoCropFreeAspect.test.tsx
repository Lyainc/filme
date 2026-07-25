/**
 * #220/#347/#421 — 극장/포맷 로고 업로드 자유 크롭 + 포스터 크롭박스 리사이즈(react-image-crop).
 *
 * 검증하는 정합성:
 *  1) 포스터(aspect 생략) → POSTER_RATIO 고정. 미디어가 로드돼도 안 바뀐다.
 *  2) 로고(aspect={undefined}) → 크롭 프레임 = 업로드 이미지의 자연 종횡비(#347).
 *     완전 자유형(어떤 비율이든)이 아니라 "그 비율의 박스를 리사이즈"(#421)로 유지된다 —
 *     react-image-crop의 aspect=undefined는 defaultProps로 덮이지 않으므로(react-easy-crop과
 *     달리) 자연비를 직접 계산해 잠근다(ImageCropModal의 mediaAspect).
 *  3) 로고 편집 본문(StampSheet — chain/format)이 파일 선택 시 그 모달을 연다(#231).
 *  4) 원본 비율 보존 토글(#420 → #440) — 포스터 크롭(layout 전달)이면 전 무드 노출,
 *     initialPreserveRatio로 재크롭 시 이전 선택을 이어받는다(claude-review PR #429 P1 —
 *     안 이어받으면 크롭 영역만 조정해도 posterFit이 조용히 되돌아간다).
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
import { centerCrop, convertToPixelCrop, makeAspectCrop } from 'react-image-crop';
import { POSTER_HEIGHT, POSTER_RATIO, POSTER_WIDTH } from '@/utils/constants';
import type { Area } from '@/utils/imageCrop';

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
  // #525 — 크롭 프레임 비율과 출력 해상도 비율이 갈리면 getCroppedImg의 drawImage가 크롭을
  // 늘여서 그린다(옛 구조: 프레임 0.667 × 출력 960×1534). 두 값이 한 상수에서 나오는지 못 박는다.
  test('크롭 출력 해상도(960×1440)가 프레임 비율과 정확히 같다 — 그리기에서 안 늘어남', () => {
    expect(POSTER_WIDTH / POSTER_HEIGHT).toBe(POSTER_RATIO);
    expect(POSTER_HEIGHT).toBe(1440);
  });

  test('aspect prop 생략 → 포스터 기본 POSTER_RATIO (미디어 로드돼도 고정)', () => {
    render(<ImageCropModal imageSrc="blob:x" onClose={noop} onComplete={noop} />);
    expect(aspectOf(screen.getByTestId('crop-frame'))).toBe(POSTER_RATIO);
    loadImage(800, 200);
    expect(aspectOf(screen.getByTestId('crop-frame'))).toBe(POSTER_RATIO);
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

  test('layout 전달 시 전 무드에서 토글 노출(#440) — editorial도 노출', () => {
    render(<ImageCropModal imageSrc="blob:x" onClose={noop} onComplete={noop} layout="editorial" />);
    expect(screen.queryByRole('checkbox')).not.toBeNull();
  });

  test('layout이 stub → 토글 노출(#525 (a)로 stub 예외 폐지, 6무드 동일 정책)', () => {
    render(<ImageCropModal imageSrc="blob:x" onClose={noop} onComplete={noop} layout="stub" />);
    expect(screen.queryByRole('checkbox')).not.toBeNull();
  });

  test('layout 전달(minimal) → 토글 노출, 기본 unchecked, aspect는 포스터 표준 POSTER_RATIO', () => {
    render(<ImageCropModal imageSrc="blob:x" onClose={noop} onComplete={noop} layout="minimal" />);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(aspectOf(screen.getByTestId('crop-frame'))).toBe(POSTER_RATIO);
  });

  test('토글 클릭 시 aspect가 POSTER_RATIO ↔ 자연비로 전환된다', () => {
    render(<ImageCropModal imageSrc="blob:x" onClose={noop} onComplete={noop} layout="minimal" />);
    loadImage(2000, 3000);
    expect(aspectOf(screen.getByTestId('crop-frame'))).toBe(POSTER_RATIO);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(aspectOf(screen.getByTestId('crop-frame'))).toBeCloseTo(2000 / 3000, 5);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(aspectOf(screen.getByTestId('crop-frame'))).toBe(POSTER_RATIO);
  });

  test('원본 비율 보존 ON → 크롭 기본값이 전체 이미지(90% 축소 없음, 좌우 무손실) (#439)', () => {
    // 크롭 종횡비가 이미지 자연비와 같을 때 makeAspectCrop({width:90})이 90%로 줄여 좌우·상하 5%씩
    // 잘라내던 회귀 — 세로 포스터의 제목 첫·끝 글자가 잘려 나가는 실사용 버그. 전체(100%)로 열어야 한다.
    let received: Area | null = null;
    render(
      <ImageCropModal imageSrc="blob:x" onClose={noop} onComplete={(a: Area) => { received = a; }} layout="minimal" />
    );
    loadImage(2000, 2865); // 자연=렌더, 세로 포스터
    fireEvent.click(screen.getByRole('checkbox')); // 원본 비율 보존 ON → aspect=자연비
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    // 90% 축소면 x/y가 양수·width<2000이 된다. 전체 이미지여야 (0,0)에서 원본 크기 그대로.
    expect(received).toEqual({ x: 0, y: 0, width: 2000, height: 2865 });
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

  test('렌더 크기 ≠ 자연 크기: onComplete 좌표가 자연 픽셀로 스케일업된다 (claude-review PR #429 3차 P1)', () => {
    // <img style={{maxWidth:'100cqw',maxHeight:'100cqh'}}>(#474)라 실제 브라우저에선 렌더 크기가 자연
    // 크기보다 작은 게 보통이다. completedCrop은 react-image-crop이 렌더 픽셀 좌표계로 주므로,
    // handleConfirm의 scaleX/scaleY 환산이 없거나 틀리면 사용자가 고른 크롭 위치와 실제 출력
    // 이미지의 크롭 위치가 어긋난다. loadImage(자연=렌더)만 쓰는 다른 테스트는 scaleX/Y가
    // 항상 1로 고정돼 이 회귀를 못 잡는다. scaleX(2)≠scaleY(3)로 일부러 비대칭을 둬 축이
    // 뒤바뀌는 회귀(x에 scaleY를 곱하는 등)도 함께 잡는다(claude-review PR #429 4차 P2).
    let received: Area | null = null;
    const onCompleteSpy = (area: Area) => {
      received = area;
    };
    render(<ImageCropModal imageSrc="blob:x" onClose={noop} onComplete={onCompleteSpy} />);

    const img = document.querySelector('img') as HTMLImageElement;
    const [naturalW, naturalH, renderW, renderH] = [2000, 3000, 1000, 1000]; // scaleX=2, scaleY=3
    Object.defineProperty(img, 'naturalWidth', { value: naturalW, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: naturalH, configurable: true });
    Object.defineProperty(img, 'width', { value: renderW, configurable: true });
    Object.defineProperty(img, 'height', { value: renderH, configurable: true });
    fireEvent.load(img);

    // ImageCropModal의 initCrop과 동일한 계산(POSTER_RATIO 고정, centerCrop 90%)을 독립적으로
    // 재현해 "렌더 픽셀 기준 기대 크롭"을 구하고, scaleX/Y를 곱해 "자연 픽셀 기준 기대값"을 만든다.
    const percent = centerCrop(makeAspectCrop({ unit: '%', width: 90 }, POSTER_RATIO, renderW, renderH), renderW, renderH);
    const renderPx = convertToPixelCrop(percent, renderW, renderH);
    const scaleX = naturalW / renderW;
    const scaleY = naturalH / renderH;
    const expected: Area = {
      x: Math.round(renderPx.x * scaleX),
      y: Math.round(renderPx.y * scaleY),
      width: Math.round(renderPx.width * scaleX),
      height: Math.round(renderPx.height * scaleY),
    };

    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(received).toEqual(expected);
    // 렌더=자연이었다면 나왔을 값(스케일 누락 시의 버그 값)과는 달라야 한다 — 회귀 시 여기가 조용히
    // 통과하지 않도록 자연 픽셀 쪽이 실제로 더 커야 함을 명시적으로 확인.
    expect((received as unknown as Area).width).toBeGreaterThan(renderPx.width);
  });

  // DesktopStudioShell과 동형 — #525에서 posterFit 저장이 사라져 onUpload는 URL만 받는다.
  function UploaderHarness() {
    const [url, setUrl] = useState<string | null>(null);
    return <ImageUploader onUpload={setUrl} isProcessing={false} imageUrl={url} layout="minimal" />;
  }

  test('ImageUploader: 재크롭은 포스터 표준(unchecked)으로 열린다 — 크롭 비율이 결과에 이미 구워져 있어 되살릴 렌더 상태가 없다', async () => {
    const user = userEvent.setup();
    render(<UploaderHarness />);

    await user.upload(fileInput(), pngFile('poster.jpg'));
    await screen.findByTestId('crop-frame');
    await user.click(screen.getByRole('checkbox')); // 원본 비율 보존 ON으로 1차 크롭
    loadImage(2000, 3000);
    await user.click(screen.getByRole('button', { name: '적용' }));

    // 옛 구조에선 이 토글이 posterFit(렌더 설정)에 저장돼, 재크롭이 그걸 조용히 'cover'로
    // 되돌리는 회귀가 있었다(claude-review PR #429 P1). #525로 posterFit 자체가 사라져
    // 토글은 크롭 프레임만 정하므로, 되돌아갈 렌더 상태가 없다 — 표준 프리셋으로 여는 게 맞다.
    await user.click(await screen.findByRole('button', { name: '재크롭' }));
    const checkbox = (await screen.findByRole('checkbox')) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });
});
