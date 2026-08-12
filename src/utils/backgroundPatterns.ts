/**
 * 배경 기하 패턴 카탈로그(#530 PR 1) — Editorial·Criterion·Stub 세 무드가 공유하는 단일 목록.
 * 무드는 "어느 슬롯에 어떤 크기로 깔지"만 정하고, 패턴 자체(모양·색 파생)는 여기 하나에서 나온다
 * (TEXTURE_RECIPES와 같은 레포 관례).
 *
 * [hard] CSS gradient만 — SVG data:URL·`<pattern>`·feTurbulence 금지(#530). 패턴 레이어는
 * `data-poster-root` 밖(html-to-image가 직접 캡처하는 일반 DOM)이라 TEXTURE_RECIPES처럼 비트맵으로
 * 구울 필요 자체가 없다 — CSS 문자열 그대로 미리보기=저장물이 보장된다.
 *
 * [hard] 색은 무드 잉크 파생 하드코딩, `themeColor` 파생 금지 — 호출부가 자기 무드의 고정 INK
 * hex를 그대로 넘긴다. 강도 슬라이더는 없고 알파는 패턴별 프리셋(0.06~0.12)에 고정.
 */
import type { CSSProperties } from 'react';

export type BackgroundPatternId = 'none' | 'dots' | 'diagonal' | 'grid' | 'custom';

export const BACKGROUND_PATTERN_OPTIONS: readonly { value: BackgroundPatternId; label: string }[] = [
  { value: 'none', label: '없음' },
  { value: 'dots', label: '도트' },
  { value: 'diagonal', label: '사선' },
  { value: 'grid', label: '그리드' },
  { value: 'custom', label: '내 이미지' },
];

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * 패턴 id + 무드 잉크(hex) → CSS 배경 스타일. 빈 스타일을 돌려주는 경우가 둘이고(‘none’,
 * 그리고 이미지를 아직 안 올린 'custom') 호출부는 **`backgroundImage`가 비면 레이어 자체를
 * 안 그린다** — 그래야 'custom'을 골라두고 업로드 전인 상태에서 빈 div가 안 남는다.
 *
 * @param customImage 'custom'일 때 쓸 사용자 업로드 이미지 URL(#671). 다른 id에선 무시된다.
 */
export function backgroundPatternStyle(id: BackgroundPatternId, ink: string, customImage?: string): CSSProperties {
  switch (id) {
    // 사용자 업로드 이미지(#671) — 프리셋 3종과 **같은 레이어**에 실린다. 그래서 componentOpacity
    // 밖(종이에 이미 인쇄된 바탕)이고, 무드가 이미 들고 있는 clip-path(Criterion 도판·Stub 밴드)를
    // 그대로 물려받아 저장물에서 포스터 위에 인쇄되는 z-order 함정(#490/#495)을 자동으로 피한다.
    //
    // cover/center/no-repeat인 이유: 여기 들어오는 건 임의의 사진이라 타일링하면 이음매가 그대로
    // 보인다. 알파는 프리셋(0.06~0.12)과 달리 안 깎는다 — 사용자가 고른 이미지를 임의로 흐리면
    // "내가 올린 게 왜 안 보이지"가 된다.
    // ponytail: 농도 슬라이더는 안 넣었다. 원하는 목소리가 나오면 그때.
    case 'custom':
      return customImage
        ? {
            backgroundImage: `url("${customImage}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }
        : {};
    case 'dots':
      return {
        backgroundImage: `radial-gradient(circle, ${hexToRgba(ink, 0.12)} 0 2px, transparent 2px)`,
        backgroundSize: '18px 18px',
      };
    case 'diagonal':
      return {
        backgroundImage: `repeating-linear-gradient(45deg, ${hexToRgba(ink, 0.08)} 0 1px, transparent 1px 11px)`,
      };
    case 'grid':
      return {
        backgroundImage: [
          `repeating-linear-gradient(0deg, ${hexToRgba(ink, 0.06)} 0 1px, transparent 1px 26px)`,
          `repeating-linear-gradient(90deg, ${hexToRgba(ink, 0.06)} 0 1px, transparent 1px 26px)`,
        ].join(', '),
      };
    default:
      return {};
  }
}
