import { expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { ResultStage } from '@/components/v2/ResultStage';

function Harness({ result = false }: { result?: boolean }) {
  const photo = usePhototicket();
  if (result) return <ResultStage onBack={() => {}} onWordmarkTap={() => {}}
    croppedImageUrl={null} movieInfo={photo.state.movieInfo}
    components={photo.state.components} fieldVisibility={photo.state.fieldVisibility} />;
  return <>
    <button onClick={() => photo.handleImageUpload('blob:test-poster')}>seed</button>
    <MobileEditorShell photo={photo} canExport onDone={() => {}} disabledReason=""
      previewMovieInfo={photo.state.movieInfo} previewComponents={photo.state.components}
      fieldVisibility={photo.state.fieldVisibility} />
  </>;
}

afterEach(() => { cleanup(); window.localStorage.clear(); });

test.each([false, true])('editor and result share the light UI (result=%s)', (result) => {
  window.localStorage.setItem('phototicket:theme', 'dark');
  render(<Harness result={result} />);
  expect(document.querySelector('.app-canvas')?.getAttribute('data-theme')).toBe('light');
  expect(document.querySelector('.chrome-dark, .chrome-ambient')).toBeNull();
  expect(screen.queryByRole('switch', { name: '다크모드' })).toBeNull();
  expect(document.querySelector('[data-rail-id="highlight"]')).toBeNull();
});

test('max view preserves the mounted design rail', () => {
  render(<Harness />);
  fireEvent.click(screen.getByText('seed'));
  fireEvent.click(screen.getByRole('button', { name: '최대화' }));
  expect(screen.getByRole('button', { name: '무드', hidden: true })).toBeTruthy();
});
