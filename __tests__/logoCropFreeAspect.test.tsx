/**
 * #220/#347 — 극장/포맷 로고 업로드 자유 크롭.
 *
 * 검증하는 정합성:
 *  1) 포스터(aspect 생략) → TARGET_RATIO 고정. 미디어가 로드돼도 안 바뀐다.
 *  2) 로고(aspect={undefined}) → 크롭 프레임 = 업로드 이미지의 자연 종횡비(#347).
 *     예전엔 undefined를 그대로 넘겨 react-easy-crop의 defaultProps(4/3)에 덮여 4:3 강제였다.
 *     프레임이 자연비면 zoom 1에서 크롭 영역이 원본 전체와 일치하고(getCropSize), 결과 PNG는
 *     getCroppedImg(maxSide)가 크롭 종횡비를 그대로 보존하므로 원본 종횡비 = 결과 종횡비다.
 *  3) 로고 편집 본문(StampSheet — chain/format)이 파일 선택 시 그 모달을 연다(#231).
 *
 * react-easy-crop(Cropper)만 mock — 이 모듈을 렌더하는 건 ImageCropModal뿐이고, 다른
 * 테스트는 ImageCropModal 자체를 mock으로 대체하므로 실제 Cropper를 렌더하지 않는다.
 * 따라서 이 mock은 파일 간에 새어도 피해가 없다(공유 모듈 mock 회피 — MEMORY).
 * 캔버스 경로(getCroppedImg)는 happy-dom 한계라 건드리지 않고, 프레임 종횡비까지만 본다.
 */
import { describe, expect, test, afterEach, beforeEach, mock } from 'bun:test';
import { useEffect } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TARGET_RATIO } from '@/utils/constants';

// 각 테스트가 "업로드된 이미지의 자연 크기"를 여기 세팅한다.
let natural = { naturalWidth: 1000, naturalHeight: 1000 };

// aspect를 DOM 속성으로 노출하고, 마운트 시 실제 Cropper처럼 onMediaLoaded를 쏘는 더미.
mock.module('react-easy-crop', () => ({
  default: ({
    aspect,
    onMediaLoaded,
  }: {
    aspect?: number;
    onMediaLoaded?: (m: { width: number; height: number; naturalWidth: number; naturalHeight: number }) => void;
  }) => {
    useEffect(() => {
      onMediaLoaded?.({ width: 0, height: 0, ...natural });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="cropper" data-aspect={String(aspect)} />;
  },
}));

// mock 등록 후 require로 대상 import(bun mock hoisting 없음 — CLAUDE.md 테스트 규약).
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

// StampSheet(로고 본문)를 실제 photo로 렌더 — chain/format 타깃.
function StampHarness({ target }: { target: 'chain' | 'format' }) {
  const photo = usePhototicket();
  return <FieldEditorBody target={target} photo={photo} />;
}

beforeEach(() => {
  natural = { naturalWidth: 1000, naturalHeight: 1000 };
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('ImageCropModal 크롭 프레임 종횡비 (#220/#347)', () => {
  test('aspect prop 생략 → 포스터 기본 TARGET_RATIO (미디어 로드돼도 고정)', () => {
    natural = { naturalWidth: 800, naturalHeight: 200 };
    render(<ImageCropModal imageSrc="blob:x" onClose={noop} onComplete={noop} />);
    expect(aspectOf(screen.getByTestId('cropper'))).toBe(TARGET_RATIO);
  });

  // 정방형 / 좌우로 긴 워드마크 / 세로형 — #347이 요구한 세 경우.
  const cases: [string, number, number][] = [
    ['정방형 512×512', 512, 512],
    ['워드마크 1200×300', 1200, 300],
    ['세로형 300×900', 300, 900],
  ];
  for (const [name, w, h] of cases) {
    test(`aspect={undefined} → 프레임이 원본 자연 종횡비: ${name}`, () => {
      natural = { naturalWidth: w, naturalHeight: h };
      render(<ImageCropModal imageSrc="blob:x" aspect={undefined} onClose={noop} onComplete={noop} />);
      // 4/3(react-easy-crop defaultProps)으로 덮이면 여기서 깨진다 — #347 회귀 가드.
      expect(aspectOf(screen.getByTestId('cropper'))).toBeCloseTo(w / h, 5);
    });
  }
});

describe('로고 본문(StampSheet) 파일 선택 → 자연비 크롭 모달 오픈 (#220/#231)', () => {
  test('극장 로고: 업로드 시 자연비 프레임 모달', async () => {
    natural = { naturalWidth: 1200, naturalHeight: 300 };
    const user = userEvent.setup();
    render(<StampHarness target="chain" />);
    await user.upload(fileInput(), pngFile('cgv.png'));
    // dynamic(ssr:false) 로딩 대기 후 모달 등장.
    const cropper = await screen.findByTestId('cropper');
    expect(aspectOf(cropper)).toBeCloseTo(4, 5);
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('로고 크롭');
  });

  test('포맷 로고: 업로드 시 자연비 프레임 모달', async () => {
    natural = { naturalWidth: 512, naturalHeight: 512 };
    const user = userEvent.setup();
    render(<StampHarness target="format" />);
    await user.upload(fileInput(), pngFile('imax.png'));
    const cropper = await screen.findByTestId('cropper');
    expect(aspectOf(cropper)).toBeCloseTo(1, 5);
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('로고 크롭');
  });
});
