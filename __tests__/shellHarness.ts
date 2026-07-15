import type { ComponentProps } from 'react';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import type { DesktopStudioShell } from '@/components/v2/DesktopStudioShell';

type Photo = ReturnType<typeof usePhototicket>;

/**
 * MobileEditorShell*·desktopStudioShell* 계열 11파일이 각 16~31줄씩 복붙하던 props 뼈대만
 * 공유한다. 파일별 seed 버튼·프로브 div·assertion 같은 Harness 구조는 그대로 각 파일에 남긴다
 * (DRY는 반복되는 기본 props 값에만 — 로직·렌더 구조는 숨기지 않는다).
 *
 * import type만 써서 이 파일 자체는 런타임에 아무것도 require하지 않는다 —
 * mobileEditorShellPosterCropPipeline.test.tsx처럼 mock.module 등록 후 require()로
 * MobileEditorShell을 가로채는 파일에서도 이 헬퍼를 안전하게 쓸 수 있다.
 */
export function mobileShellProps(
  photo: Photo,
  overrides: Partial<ComponentProps<typeof MobileEditorShell>> = {}
): ComponentProps<typeof MobileEditorShell> {
  return {
    photo,
    canExport: true,
    theme: 'light',
    onThemeChange: () => {},
    onDone: () => {},
    disabledReason: '',
    previewMovieInfo: photo.state.movieInfo,
    previewComponents: photo.state.components,
    fieldVisibility: photo.state.fieldVisibility,
    ...overrides,
  };
}

export function desktopShellProps(
  photo: Photo,
  overrides: Partial<ComponentProps<typeof DesktopStudioShell>> = {}
): ComponentProps<typeof DesktopStudioShell> {
  return {
    photo,
    theme: 'light',
    onThemeChange: () => {},
    canExport: true,
    disabledReason: '',
    resultOpen: false,
    onDone: () => {},
    onBackToEdit: () => {},
    previewMovieInfo: photo.state.movieInfo,
    previewComponents: photo.state.components,
    fieldVisibility: photo.state.fieldVisibility,
    ...overrides,
  };
}
