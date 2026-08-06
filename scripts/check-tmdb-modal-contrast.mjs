/**
 * TmdbPosterModal 대비 검증 (#656) — 브라우저 없이 순수 계산.
 *
 * 패널(--overlay-fill 반투명+blur) 자체 위엔 이제 텍스트를 안 얹는다 — 헤더·검색결과·상태
 * 메시지·TMDB 귀속 표시를 전부 불투명 CARD(bg-surface, MobileEditorShell MENU_GROUP_CLS /
 * AdvancedSettingsModal CARD와 같은 패턴)로 옮겼다. 그래서 검사는 두 갈래:
 *   1. 오버레이 위 최악 케이스(포스터 유무 → 검정/흰 포스터 합성) — 회귀 안전망. 이 패널에서
 *      오버레이에 직접 얹힌 텍스트는 --fg(h2 등)뿐이었는데 지금은 그마저도 카드 안이라 실사용
 *      조합은 없지만, 나중에 누가 카드 밖으로 다시 텍스트를 빼면 여기서 잡힌다.
 *   2. 카드(--surface, 불투명) 위 실사용 잉크(fg/fg-muted/accent/fg-faint) — 배경(포스터)과
 *      무관한 고정 대비라 라이트/다크 두 값만 있으면 충분하다.
 * 색상은 globals.css에서 직접 파싱한다 — 하드코딩하면 토큰이 바뀌어도 스크립트가 안 따라간다.
 *
 *   bun scripts/check-tmdb-modal-contrast.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSS_PATH = fileURLToPath(new URL('../src/styles/globals.css', import.meta.url));
const css = readFileSync(CSS_PATH, 'utf8');

function parseTokens(blockSrc) {
  const tokens = {};
  for (const m of blockSrc.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    tokens[m[1]] = m[2].trim();
  }
  return tokens;
}

const rootBlock = css.match(/:root\s*\{([^}]*)\}/s);
const darkBlock = css.match(/\.theme-dark,\s*\n\s*\.chrome-dark\s*\{([^}]*)\}/s);
if (!rootBlock || !darkBlock) throw new Error('globals.css 토큰 블록을 못 찾았어요 — :root/.theme-dark 셀렉터가 바뀌었는지 확인');

const THEMES = {
  light: parseTokens(rootBlock[1]),
  dark: parseTokens(darkBlock[1]),
};

function parseColor(raw) {
  const v = raw.trim();
  if (v.startsWith('#')) {
    const h = v.slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
    return [parts[0], parts[1], parts[2], parts[3] ?? 1];
  }
  throw new Error(`색상을 못 읽었어요: ${raw}`);
}

function composite([r, g, b, a], bgRgb) {
  return [a * r + (1 - a) * bgRgb[0], a * g + (1 - a) * bgRgb[1], a * b + (1 - a) * bgRgb[2]];
}

function srgbToLinear(c8bit) {
  const c = c8bit / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relLuminance([r, g, b]) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(rgbA, rgbB) {
  const [lighter, darker] = [relLuminance(rgbA), relLuminance(rgbB)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const checks = [];
for (const [theme, tokens] of Object.entries(THEMES)) {
  const overlay = parseColor(tokens['overlay-fill']);
  const surface = parseColor(tokens.surface).slice(0, 3);
  const fg = parseColor(tokens.fg).slice(0, 3);

  // --fg는 라이트=어두운 잉크(검정 포스터가 최악), 다크=밝은 잉크(흰 포스터가 최악).
  const worstPosterBg = theme === 'light' ? [0, 0, 0] : [255, 255, 255];
  checks.push({
    theme,
    label: `overlay(최악 포스터 합성) 위 --fg`,
    fg,
    bg: composite(overlay, worstPosterBg),
    min: 4.5,
  });

  // TmdbPosterModal.tsx가 카드 위에서 실제로 쓰는 잉크만 — text-accent/text-fg-faint는 카드
  // 위에서도 AA 미달(다크 3.97:1 / 라이트 2.49:1, AdvancedSettingsModal이 이미 같은 이유로
  // 피한 조합)이라 안 쓴다. 소스에 새 잉크가 추가되면 이 배열도 같이 갱신할 것.
  for (const ink of ['fg', 'fg-muted']) {
    checks.push({
      theme,
      label: `카드(--surface) 위 --${ink}`,
      fg: parseColor(tokens[ink]).slice(0, 3),
      bg: surface,
      min: 4.5, // 이 모달의 잉크는 전부 텍스트(h2·버튼 글리프·본문) — 3:1(비텍스트) 대상 아이콘 없음
    });
  }
}

let failed = false;
for (const c of checks) {
  const ratio = contrastRatio(c.fg, c.bg);
  const ok = ratio >= c.min;
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'} [${c.theme}] ${c.label}: ${ratio.toFixed(2)}:1 (기준 ${c.min}:1)`);
}

process.exit(failed ? 1 : 0);
