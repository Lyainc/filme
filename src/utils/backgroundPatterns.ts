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

export type BackgroundPatternId = 'none' | 'dots' | 'diagonal' | 'grid';

export const BACKGROUND_PATTERN_OPTIONS: readonly { value: BackgroundPatternId; label: string }[] = [
  { value: 'none', label: '없음' },
  { value: 'dots', label: '도트' },
  { value: 'diagonal', label: '사선' },
  { value: 'grid', label: '그리드' },
];

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** 패턴 id + 무드 잉크(hex) → CSS 배경 스타일. 'none'은 빈 스타일(레이어 자체를 안 그리는 게 호출부 책임). */
export function backgroundPatternStyle(id: BackgroundPatternId, ink: string): CSSProperties {
  switch (id) {
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
