/**
 * 키보드 밑판(#826 S4 constraint-3) — 키보드가 떠 있는 동안 패널 아래 끝(= visualViewport 바닥)부터 프레임 바닥까지 패널과
 * 같은 면을 깐다. iOS 26 Safari는 입력 액세서리 바(^ v ✓)와 자동완성 알약을 visualViewport 밖 반투명 층으로 그려, 밑판이
 * 없으면 그 틈으로 도크 행이 비쳤다(iOS Simulator 26.5 실측). 패널 자체를 늘이지 않는 건 패널 아래 끝 = 키보드 윗변이라는
 * 측정 기준(acceptance-2 · 10)을 지키기 위해서다.
 */
export function KeyboardUnderlay({ inset }: { inset: number }) {
  if (inset <= 0) return null;
  return <div aria-hidden="true" data-keyboard-underlay="" className="fixed inset-x-0 bottom-0 z-50 bg-s1" style={{ height: inset }} />;
}
