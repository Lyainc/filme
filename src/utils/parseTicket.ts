import type { MovieInfo } from '@/types';

function normalizeDate(text: string): string | undefined {
  let m: RegExpMatchArray | null;

  // 2026년 5월 12일 / 2026년5월12일
  m = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (m) {
    const [, y, mo, d] = m;
    if (isValidDate(+y, +mo, +d)) return pad(y, mo, d);
  }

  // 2026.5.12 / 2026. 5. 12
  m = text.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    if (isValidDate(+y, +mo, +d)) return pad(y, mo, d);
  }

  // 2026/5/12
  m = text.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    if (isValidDate(+y, +mo, +d)) return pad(y, mo, d);
  }

  // 2026-5-12 (ISO-like but possibly unpadded)
  m = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    if (isValidDate(+y, +mo, +d)) return pad(y, mo, d);
  }

  return undefined;
}

function isValidDate(y: number, mo: number, d: number): boolean {
  return y >= 1900 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31;
}

function pad(y: string, mo: string, d: string): string {
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function normalizeTime(text: string): string | undefined {
  let m: RegExpMatchArray | null;

  // 오후 H:mm  (오후 12:00 = 정오 = 12:00)
  m = text.match(/오후\s*(\d{1,2}):(\d{2})/);
  if (m) {
    const h = parseInt(m[1]);
    if (h >= 1 && h <= 12) {
      const h24 = h === 12 ? 12 : h + 12;
      return `${String(h24).padStart(2, '0')}:${m[2]}`;
    }
  }

  // 오전 H:mm  (오전 12:00 = 자정 = 00:00)
  m = text.match(/오전\s*(\d{1,2}):(\d{2})/);
  if (m) {
    const h = parseInt(m[1]);
    if (h >= 1 && h <= 12) {
      const h24 = h === 12 ? 0 : h;
      return `${String(h24).padStart(2, '0')}:${m[2]}`;
    }
  }

  // H:mm PM
  m = text.match(/(\d{1,2}):(\d{2})\s*[Pp][Mm]/);
  if (m) {
    const h = parseInt(m[1]);
    if (h >= 1 && h <= 12) {
      const h24 = h === 12 ? 12 : h + 12;
      return `${String(h24).padStart(2, '0')}:${m[2]}`;
    }
  }

  // H:mm AM
  m = text.match(/(\d{1,2}):(\d{2})\s*[Aa][Mm]/);
  if (m) {
    const h = parseInt(m[1]);
    if (h >= 1 && h <= 12) {
      const h24 = h === 12 ? 0 : h;
      return `${String(h24).padStart(2, '0')}:${m[2]}`;
    }
  }

  // 24h standalone HH:mm
  m = text.match(/\b((?:[01]?\d|2[0-3])):([0-5]\d)\b/);
  if (m) {
    return `${m[1].padStart(2, '0')}:${m[2]}`;
  }

  return undefined;
}

// Searches each line individually so a match on one line doesn't bleed into another.
function searchLines<T>(
  lines: string[],
  extractor: (line: string) => T | undefined
): T | undefined {
  for (const line of lines) {
    const result = extractor(line);
    if (result !== undefined) return result;
  }
  return undefined;
}

const THEATER_RE = /(CGV|롯데시네마|메가박스|씨네큐|씨네마운트|씨네파크)\s*([^\n\r\t,]{1,20})/;
const SCREEN_RE = /([A-Z]+관|[0-9]+관|스크린X관|ScreenX관|아이맥스관|IMAX관)/i;

// Extracts theater+branch as one string, or undefined.
function extractTheater(lines: string[]): string | undefined {
  return searchLines(lines, (line) => {
    const m = line.match(THEATER_RE);
    if (!m) return undefined;
    const full = (m[1] + ' ' + m[2]).trim();
    return full.length > 1 ? full : undefined;
  });
}

function extractScreen(lines: string[]): string | undefined {
  return searchLines(lines, (line) => {
    const m = line.match(SCREEN_RE);
    return m ? m[1].trim() : undefined;
  });
}

// Picks the most plausible title line:
// - Not a theater line, date line, time line, or seat line
// - At least 2 characters, mostly non-numeric
function extractTitle(lines: string[]): string | undefined {
  const skip = [THEATER_RE, /\d{4}[.\-\/년]/, /오전|오후|AM|PM/i, /[A-Z]\d+/];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 2) continue;
    if (skip.some((re) => re.test(trimmed))) continue;
    // Skip lines that are mostly digits/punctuation
    const letterCount = (trimmed.match(/[가-힣a-zA-Z]/g) || []).length;
    if (letterCount < 2) continue;
    return trimmed;
  }
  return undefined;
}

/**
 * Parse raw Tesseract OCR text from a Korean cinema ticket.
 *
 * Returns at most 5 fields: title, theater, screen, watchDate, watchTime.
 * seat and bookingNumber are structurally excluded — they are never present
 * in the output object regardless of what the raw text contains.
 */
export function parseTicket(raw: string): Partial<MovieInfo> {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const result: Partial<MovieInfo> = {};

  const title = extractTitle(lines);
  if (title) result.title = title;

  const theater = extractTheater(lines);
  if (theater) result.theater = theater;

  const screen = extractScreen(lines);
  if (screen) result.screen = screen;

  const watchDate = searchLines(lines, normalizeDate);
  if (watchDate) result.watchDate = watchDate;

  const watchTime = searchLines(lines, normalizeTime);
  if (watchTime) result.watchTime = watchTime;

  return result;
}
