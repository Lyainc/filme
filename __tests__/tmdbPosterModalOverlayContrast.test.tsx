/**
 * #656 회귀 — TmdbPosterModal의 검색/포스터 패널은 --overlay-fill(반투명) + blur 유리 위에 뜬다.
 * globals.css:15-22가 이미 문서화한 규칙("muted·accent·danger 잉크를 쓰는 행은 불투명 표면
 * bg-surface/bg-surface-elevated 위에 얹을 것", FieldDrawer/AdvancedSettingsModal이 세운 계약)을
 * 이 모달만 안 지켜서 헤더·본문 메시지·귀속 표시가 유리 위에 직접 뜨며 WCAG AA가 깨졌던 문제.
 *
 * 두 축을 잠근다:
 *  1. 순수 계산 — globals.css에서 실제 토큰을 뽑아, 고친 뒤 이 컴포넌트가 실제로 쓰는 잉크·표면
 *     조합의 대비가 라이트/다크 양쪽에서 하한을 넘는지 확인한다(픽셀 렌더 없이도 solid color라 등가).
 *  2. 구조 — 헤더·귀속 표시·검색 실패 카드가 실제로 bg-surface/bg-surface-elevated 조상을 갖는지
 *     렌더해서 확인한다(클래스가 빠지면 계산이 아무리 맞아도 무의미하므로).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { TmdbPosterModal } from '@/components/TmdbPosterModal';

afterEach(() => {
  cleanup();
});

// ---- 1. 순수 계산 (scripts/check-fg-contrast.mjs, #650과 같은 방식 — 이 브랜치엔 그 스크립트가
// 아직 없어 자급한다) ----
const css = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8');

function extractBlock(source: string, selectorRe: RegExp): string {
  const m = source.match(selectorRe);
  if (!m || m.index === undefined) throw new Error(`selector block not found: ${selectorRe}`);
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  while (depth > 0) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    i++;
  }
  return source.slice(start, i - 1);
}

function extractVar(block: string, name: string): string {
  const m = block.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`--${name} not found`);
  return m[1];
}

function hex2rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function lin(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(hexA: string, hexB: string): number {
  const l1 = luminance(hex2rgb(hexA));
  const l2 = luminance(hex2rgb(hexB));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const rootBlock = extractBlock(css, /:root\s*\{/);
const darkBlock = extractBlock(css, /\.theme-dark,\s*\n?\s*\.chrome-dark\s*\{/);

const light = {
  surface: extractVar(rootBlock, 'surface'),
  surfaceElevated: extractVar(rootBlock, 'surface-elevated'),
  fg: extractVar(rootBlock, 'fg'),
  fgMuted: extractVar(rootBlock, 'fg-muted'),
};
const dark = {
  surface: extractVar(darkBlock, 'surface'),
  surfaceElevated: extractVar(darkBlock, 'surface-elevated'),
  fg: extractVar(darkBlock, 'fg'),
  fgMuted: extractVar(darkBlock, 'fg-muted'),
};

describe('TmdbPosterModal 불투명 표면 대비 — 실측 계산 (#656)', () => {
  // 실제로 이 컴포넌트가 지금 쓰는 잉크·표면 조합만 잰다 — accent는 다크 테마에서 불투명 표면
  // 위에서도 3.97:1로 AA(4.5:1)에 못 닿아(AdvancedSettingsModal과 같은 실측) 링크 잉크를 fg로
  // 바꿨으므로, accent 자체는 여기서 잴 대상이 아니다.
  const pairs: Array<[string, string, string, number]> = [
    ['light fg-muted vs surface', light.fgMuted, light.surface, 4.5],
    ['light fg-muted vs surface-elevated', light.fgMuted, light.surfaceElevated, 4.5],
    ['light fg vs surface', light.fg, light.surface, 4.5],
    ['dark fg-muted vs surface', dark.fgMuted, dark.surface, 4.5],
    ['dark fg-muted vs surface-elevated', dark.fgMuted, dark.surfaceElevated, 4.5],
    ['dark fg vs surface', dark.fg, dark.surface, 4.5],
  ];

  test.each(pairs)('%s는 AA(%s:1) 이상이다', (_label, fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});

// ---- 2. 구조 — 실제로 불투명 조상 위에 얹혔는지 ----
function noop() {}

describe('TmdbPosterModal 불투명 표면 대비 — 구조 (#656)', () => {
  test('헤더(h2·닫기 버튼)와 TMDB 귀속 표시가 bg-surface 조상 위에 있다', () => {
    render(<TmdbPosterModal onClose={noop} onSelect={noop} onFallbackUpload={noop} />);

    expect(screen.getByRole('heading', { name: '영화 검색' }).closest('.bg-surface')).not.toBeNull();
    expect(screen.getByRole('button', { name: '닫기' }).closest('.bg-surface')).not.toBeNull();
    expect(
      screen.getByText(/This product uses the TMDB API/).closest('.bg-surface'),
    ).not.toBeNull();
  });

  test('검색 실패 메시지·"파일 업로드로 전환" 링크가 불투명 카드(bg-surface-elevated) 위에 있다', async () => {
    const fetchSpy = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ results: [] }), { status: 200 })) as unknown as typeof fetch;

    render(<TmdbPosterModal onClose={noop} onSelect={noop} onFallbackUpload={noop} />);
    fireEvent.change(screen.getByLabelText('영화 제목 검색'), { target: { value: '없는영화' } });
    fireEvent.click(screen.getByRole('button', { name: '검색' }));

    await waitFor(() => {
      expect(screen.getByText('검색 결과가 없어요.')).toBeTruthy();
    });
    expect(screen.getByText('검색 결과가 없어요.').closest('.bg-surface-elevated')).not.toBeNull();
    const fallback = screen.getByRole('button', { name: '파일 업로드로 전환' });
    expect(fallback.closest('.bg-surface-elevated')).not.toBeNull();

    globalThis.fetch = fetchSpy;
  });
});
