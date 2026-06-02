import type { MovieInfo } from '@/types';
import { detectChain } from './detectChain';

// ============================================================
// Shared normalizers — date / time
// ============================================================

function normalizeDate(text: string): string | undefined {
  let m: RegExpMatchArray | null;

  // --- 연도 포함 형식 우선 ---
  m = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (m && isValidDate(+m[1], +m[2], +m[3])) return pad(m[1], m[2], m[3]);

  m = text.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (m && isValidDate(+m[1], +m[2], +m[3])) return pad(m[1], m[2], m[3]);

  m = text.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m && isValidDate(+m[1], +m[2], +m[3])) return pad(m[1], m[2], m[3]);

  m = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m && isValidDate(+m[1], +m[2], +m[3])) return pad(m[1], m[2], m[3]);

  // --- 연도 없는 MM.DD / MM/DD (앱 티켓 단축 표기) ---
  // lookbehind 로 '26.5.12' 같은 표기의 부분 오매칭 방지
  const year = new Date().getFullYear();

  m = text.match(/(?<!\d\.)(\d{1,2})\.(\d{1,2})(?:\s*\([가-힣]\))?/);
  if (m && isValidDate(year, +m[1], +m[2])) return pad(String(year), m[1], m[2]);

  m = text.match(/(?<!\d\/)(\d{1,2})\/(\d{1,2})(?:\([가-힣]\))?/);
  if (m && isValidDate(year, +m[1], +m[2])) return pad(String(year), m[1], m[2]);

  return undefined;
}

function isValidDate(y: number, mo: number, d: number): boolean {
  return y >= 1900 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31;
}

function pad(y: string, mo: string, d: string): string {
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// 오전/오후, AM/PM 기반 — 신뢰도 높음
function normalizeTimeStrong(text: string): string | undefined {
  let m: RegExpMatchArray | null;

  m = text.match(/오후\s*(\d{1,2}):(\d{2})/);
  if (m) {
    const h = parseInt(m[1]);
    if (h >= 1 && h <= 12) return `${String(h === 12 ? 12 : h + 12).padStart(2, '0')}:${m[2]}`;
  }
  m = text.match(/오전\s*(\d{1,2}):(\d{2})/);
  if (m) {
    const h = parseInt(m[1]);
    if (h >= 1 && h <= 12) return `${String(h === 12 ? 0 : h).padStart(2, '0')}:${m[2]}`;
  }
  m = text.match(/(\d{1,2}):(\d{2})\s*[Pp][Mm]/);
  if (m) {
    const h = parseInt(m[1]);
    if (h >= 1 && h <= 12) return `${String(h === 12 ? 12 : h + 12).padStart(2, '0')}:${m[2]}`;
  }
  m = text.match(/(\d{1,2}):(\d{2})\s*[Aa][Mm]/);
  if (m) {
    const h = parseInt(m[1]);
    if (h >= 1 && h <= 12) return `${String(h === 12 ? 0 : h).padStart(2, '0')}:${m[2]}`;
  }
  return undefined;
}

// HH:MM ~ HH:MM 범위에서 시작 시간 — 신뢰도 중간
// lookbehind (?<!\d) 로 '171:00' 같은 OCR 오류에서 '1:00' 오매칭 방지
function normalizeTimeRange(text: string): string | undefined {
  const m = text.match(/(?<!\d)((?:[01]?\d|2[0-3])):([0-5]\d)\s*[~\-]\s*(?:[01]?\d|2[0-3]):\d{2}/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return undefined;
}

// 단독 24h HH:MM — 상태바 오매칭 가능성 있음, 마지막 수단
function normalizeTimeWeak(text: string): string | undefined {
  const m = text.match(/\b((?:[01]?\d|2[0-3])):([0-5]\d)\b/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return undefined;
}

function searchLines<T>(lines: string[], extractor: (line: string) => T | undefined): T | undefined {
  for (const line of lines) {
    const result = extractor(line);
    if (result !== undefined) return result;
  }
  return undefined;
}

function extractTime(lines: string[]): string | undefined {
  // 폰 상태바 시계(예: '1:55')는 스크린샷 최상단 = 첫 줄에 옴. 실제 티켓(여러 줄)
  // 에서는 weak 패스에서 첫 줄을 빼 상태바 오매칭을 차단. 짧은 입력(테스트 등)은 보존.
  const weakLines = (lines.length > 4 ? lines.slice(1) : lines).filter((l) => !/\s{4,}/.test(l));
  return (
    searchLines(lines, normalizeTimeStrong) ??
    searchLines(lines, normalizeTimeRange) ??
    searchLines(weakLines, normalizeTimeWeak)
  );
}

// ============================================================
// Shared line helpers
// ============================================================

// 관람가/관람불가 — OCR이 '관람개' 등으로 흘려도 '관람[가-힣]'로 흡수
const RATING_RE = /청소년관람불가|\d{1,2}\s*세\s*이상\s*관람[가-힣]|전체\s*관람[가-힣]|\d{1,2}\s*세\s*관람[가-힣]/;
const SCREEN_RE = /([A-Z]+관|[0-9]+관|스크린X관|ScreenX관|아이맥스관|IMAX관)/i;
// CGV는 '전도연관'처럼 한글 이름을 단 상영관도 있음. '관람'(rating)은 제외.
const CGV_SCREEN_RE = /[가-힣A-Za-z0-9]+관(?!람)/;

// 좌석은 'A12' / 'G14, G15'처럼 문자+숫자 토큰일 때만 신뢰.
// 숫자만(866, '02 03', '(7, 18')은 OCR 노이즈/좌석유형과 구분 불가 → 채우지 않음(보수적).
const SEAT_GATE = /[A-Za-z]\s?\d{1,3}/;

function koreanCount(s: string): number {
  return (s.match(/[가-힣]/g) || []).length;
}

function isSubstantive(s: string): boolean {
  return koreanCount(s) >= 2 || /[A-Za-z]{2,}/.test(s);
}

function findIndex(lines: string[], re: RegExp): number {
  return lines.findIndex((l) => re.test(l));
}

// 라벨 라인(예: '상영영화') 다음의 첫 substantive 라인
function lineAfterLabel(lines: string[], label: RegExp): string | undefined {
  const i = findIndex(lines, label);
  if (i < 0) return undefined;
  for (let j = i + 1; j < lines.length; j++) {
    if (isSubstantive(lines[j])) return lines[j].trim();
  }
  return undefined;
}

// 라벨 라인 바로 다음(비어있지 않은) 라인 — 좌석처럼 단일 문자 토큰('H2','E12')이
// substantive 필터에 걸려 누락되는 케이스용.
function rawLineAfter(lines: string[], label: RegExp): string | undefined {
  const i = findIndex(lines, label);
  return i >= 0 ? lines[i + 1]?.trim() : undefined;
}

// 제목 앞뒤 OCR 장식 제거: 선행 [배지]/기호, 후행 (포맷 러닝타임)/밑줄
function stripTitleNoise(s: string): string {
  return s
    .replace(/^[\s.·ㆍ>]+/, '')
    .replace(/^\[[^\]]*\]\s*/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/[_\s]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// 지점 라인 선행 OCR 잡음 제거 ('에 광교' → '광교', '(례 월드타워' → '월드타워')
function stripBranchNoise(s: string): string {
  return s
    .replace(/^[\s().·ㆍ>\[\]]+/, '')
    .replace(/^[가-힣]\s+(?=[가-힣\d])/, '')
    .trim();
}

// '광교 1관 [경기인디시네마] 관/아르떼' → { branch: '광교', screen: '1관 ...' }
function splitBranchScreen(line: string): { branch?: string; screen?: string } {
  const cleaned = stripBranchNoise(line);
  const m = cleaned.match(/^(.*?)\s*(\d+\s*관.*)$/);
  if (m) {
    const branch = m[1].trim();
    const screen = m[2].replace(/\s{2,}/g, ' ').trim();
    return { branch: branch || undefined, screen: screen || undefined };
  }
  return { branch: cleaned || undefined, screen: undefined };
}

// 좌석 후보 라인 → 신뢰 가능하면 정규화, 아니면 undefined
function normalizeSeat(line: string | undefined): string | undefined {
  if (!line) return undefined;
  if (!SEAT_GATE.test(line)) return undefined;
  return line
    .replace(/\s*[ㆍ·]\s*/g, ', ')
    .replace(/\s{2,}/g, ', ')
    .trim();
}

// 제목 후보 영역(start~end)에서 한글 글자수가 가장 많은 라인
function richestTitle(lines: string[], start: number, end: number): string | undefined {
  let best: string | undefined;
  let bestScore = 1;
  // 제목이 될 수 없는 안내문구·메타·푸터버튼 라인 제외
  const TITLE_NOISE =
    /판매번호|예매번호|관람[가-힣]|입장|상영이|영화는|최소화|불편|캡쳐|적립|고객님|예매취소|선물하기|좌석보기/;
  for (let i = Math.max(0, start); i < Math.min(lines.length, end); i++) {
    const t = stripTitleNoise(lines[i]);
    if (TITLE_NOISE.test(t)) continue;
    const k = koreanCount(t);
    if (k > bestScore) {
      bestScore = k;
      best = t;
    }
  }
  return best;
}

// 라인 선두의 연속 한글 토큰 ('코엑스   탄:비미' → '코엑스')
function leadingKoreanRun(line: string): string | undefined {
  const m = stripBranchNoise(line).match(/^[가-힣]{2,}/);
  return m ? m[0] : undefined;
}

// ============================================================
// Booking number — chain-specific
// ============================================================

// 메가박스: 4-3-5 자리
function bookingMegabox(lines: string[]): string | undefined {
  for (const l of lines) {
    const m = l.match(/\b(\d{4}-\d{3}-\d{5})\b/);
    if (m) return m[1];
  }
  return undefined;
}

// CGV: '판매번호' 앵커, 값은 YYYY-MMDD-XXXX-XXXX (4-4-4-4). 그룹별 4자리로 정규화.
function bookingCgv(lines: string[]): string | undefined {
  for (const l of lines) {
    if (!/판매번호/.test(l)) continue;
    const after = l.split(/판매번호/)[1] ?? '';
    const m = after.match(/(\d{3,5}(?:-\d{3,5}){2,3})/);
    if (m) {
      return m[1]
        .split('-')
        .map((g) => (g.length > 4 ? g.slice(0, 4) : g))
        .join('-');
    }
  }
  return undefined;
}

// 롯데: '예매번호' 앵커, 같은 줄 또는 다음 줄의 숫자 그룹
function bookingLotte(lines: string[]): string | undefined {
  const i = findIndex(lines, /예매번호/);
  if (i < 0) return undefined;
  const cand = lines[i] + ' ' + (lines[i + 1] ?? '');
  const m = cand.match(/(\d{3,5}(?:-\d{3,5}){1,3})/);
  return m ? m[1] : undefined;
}

// ============================================================
// Per-chain parsers
// ============================================================

function parseCgv(lines: string[]): Partial<MovieInfo> {
  const out: Partial<MovieInfo> = {};

  const booking = bookingCgv(lines);
  if (booking) out.bookingNumber = booking;

  // 제목: 판매번호 라인 ~ rating 라인 사이에서 한글 최다 라인
  const bookingIdx = findIndex(lines, /판매번호/);
  const ratingIdx = findIndex(lines, RATING_RE);
  const title = richestTitle(
    lines,
    bookingIdx >= 0 ? bookingIdx + 1 : 0,
    ratingIdx >= 0 ? ratingIdx : lines.length
  );
  if (title) out.title = title;

  // 지점/관: 날짜 라인 다음
  const dateIdx = lines.findIndex((l) => /(\d{1,2}[./]\d{1,2})/.test(l) && /[()월일월화수목금토]/.test(l));
  if (dateIdx >= 0) {
    for (let j = dateIdx + 1; j < lines.length; j++) {
      if (RATING_RE.test(lines[j])) break;
      const isScreen = CGV_SCREEN_RE.test(lines[j]);
      if (!out.theater && isSubstantive(lines[j]) && !isScreen) {
        const branch = leadingKoreanRun(lines[j]);
        if (branch) out.theater = branch;
      }
      if (!out.screen && isScreen) {
        out.screen = lines[j].replace(/\s{2,}/g, ' ').trim();
      }
      if (out.theater && out.screen) break;
    }
  }

  // 좌석: '일반 N' / '성인 N' 좌석유형 라인 다음
  const seatTypeIdx = findIndex(lines, /일반\s*\d|성인\s*\d/);
  if (seatTypeIdx >= 0) {
    out.seat = normalizeSeat(lines[seatTypeIdx + 1]);
    if (!out.seat) delete out.seat;
  }

  return out;
}

function parseLotte(lines: string[]): Partial<MovieInfo> {
  const out: Partial<MovieInfo> = {};

  const booking = bookingLotte(lines);
  if (booking) out.bookingNumber = booking;

  const rawTitle = lineAfterLabel(lines, /상영영화/);
  if (rawTitle) {
    const t = stripTitleNoise(rawTitle);
    if (koreanCount(t) >= 1 || /[A-Za-z]{2,}/.test(t)) out.title = t;
  }

  const venue = lineAfterLabel(lines, /상영관/);
  if (venue) {
    const { branch, screen } = splitBranchScreen(venue);
    if (branch) out.theater = branch;
    if (screen) out.screen = screen;
  }

  const seat = normalizeSeat(rawLineAfter(lines, /좌석/));
  if (seat) out.seat = seat;

  return out;
}

function parseMegabox(lines: string[]): Partial<MovieInfo> {
  const out: Partial<MovieInfo> = {};

  const booking = bookingMegabox(lines);
  if (booking) out.bookingNumber = booking;

  // 제목: 예매번호 라인 ~ '입장' 라인 사이에서 한글 최다
  const bookingIdx = lines.findIndex((l) => /\d{4}-\d{3}-\d{5}/.test(l));
  const enterIdx = findIndex(lines, /입장/);
  const title = richestTitle(
    lines,
    bookingIdx >= 0 ? bookingIdx + 1 : 0,
    enterIdx >= 0 ? enterIdx : lines.length
  );
  if (title) out.title = title;

  // 지점: '입장' 라인 다음의 선두 한글 토큰
  if (enterIdx >= 0) {
    for (let j = enterIdx + 1; j < lines.length; j++) {
      const branch = leadingKoreanRun(lines[j]);
      if (branch) {
        out.theater = branch;
        break;
      }
    }
  }

  // 관: 'N관' 포함 라인
  const screenLine = lines.find((l) => /\d+\s*관/.test(l));
  if (screenLine) out.screen = screenLine.replace(/\s{2,}/g, ' ').trim();

  // 좌석: '좌석' 라벨 바로 다음
  const seat = normalizeSeat(rawLineAfter(lines, /좌석/));
  if (seat) out.seat = seat;

  return out;
}

// ============================================================
// Generic (chain 미감지) — chain-agnostic 기존 로직
// ============================================================

const THEATER_RE = /(CGV|롯데시네마|메가박스|씨네큐|씨네마운트|씨네파크)\s*([^\n\r\t,]{1,20})/;

function parseGeneric(lines: string[]): Partial<MovieInfo> {
  const out: Partial<MovieInfo> = {};

  // 제목
  const skip = [
    THEATER_RE,
    /\d{4}[.\-/년]/,
    /오전\s*\d{1,2}:\d{2}|오후\s*\d{1,2}:\d{2}/,
    /\d{1,2}:\d{2}\s*[AaPp][Mm]/,
    /[A-Z]\d+/,
    /\s{4,}/,
    /판매번호|예매번호|성인\s*\d|일반\s*\d|예매취소|선물하기|좌석보기|모바일\s*티켓|리필적립|입장\s*지연|고객님|상영관|상영일|상영영화|상영시간|주차|좌석/,
  ];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 2) continue;
    if (skip.some((re) => re.test(trimmed))) continue;
    if ((trimmed.match(/[가-힣a-zA-Z]/g) || []).length < 2) continue;
    out.title = trimmed;
    break;
  }

  // 극장 (체인+지점)
  const theater = searchLines(lines, (line) => {
    const m = line.match(THEATER_RE);
    if (!m) return undefined;
    const full = (m[1] + ' ' + m[2]).trim();
    return full.length > 1 ? full : undefined;
  });
  if (theater) out.theater = theater;

  // 상영관
  const screen = searchLines(lines, (line) => {
    const m = line.match(SCREEN_RE);
    return m ? m[1].trim() : undefined;
  });
  if (screen) out.screen = screen;

  return out;
}

// ============================================================
// Public entry
// ============================================================

/**
 * Parse raw Tesseract OCR text from a Korean cinema ticket.
 *
 * Detects the chain (CGV / 롯데 / 메가박스 / 씨네Q) and dispatches to a
 * layout-aware extractor; falls back to chain-agnostic parsing when no chain
 * signal is present. Date/time are normalized chain-independently.
 *
 * Returns up to 7 fields: title, theater(지점), screen(관), watchDate,
 * watchTime, seat, bookingNumber. Fields absent from the OCR text are omitted.
 */
export function parseTicket(raw: string): Partial<MovieInfo> {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const chain = detectChain(raw);

  let result: Partial<MovieInfo>;
  switch (chain) {
    case 'cgv':
      result = parseCgv(lines);
      break;
    case 'lotte':
      result = parseLotte(lines);
      break;
    case 'megabox':
      result = parseMegabox(lines);
      break;
    default:
      result = parseGeneric(lines);
  }

  // 날짜/시간은 체인 무관 정규화
  const watchDate = searchLines(lines, normalizeDate);
  if (watchDate) result.watchDate = watchDate;

  const watchTime = extractTime(lines);
  if (watchTime) result.watchTime = watchTime;

  return result;
}
