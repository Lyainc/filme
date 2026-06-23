import type { DateFormatToken, DateGranularity } from '@/types';

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

/**
 * Format a variable-length ISO date according to token + granularity.
 *
 * Input ISO is gracefully degradable: if the stored value has less precision
 * than the requested granularity, the function falls back to the available level
 * (e.g. `'1994'` + `granularity: 'date'` returns `'1994'`).
 *
 * Examples:
 *   formatDate('2014-11-06', 'iso', 'date')         → '2014-11-06'
 *   formatDate('2014-11-06', 'kr-compact', 'date')  → '2014.11.06.'
 *   formatDate('2014-11-06', 'cinema-mono', 'date') → '06·NOV·2014'
 *   formatDate('2014-11-06', 'en-long', 'date')     → 'November 6, 2014'
 *   formatDate('2014-11', 'cinema-mono', 'year-month') → 'NOV 2014'
 *   formatDate('2014', 'en-long', 'year')           → '2014'
 */
/** Matches a variable-length ISO date with optionally non-padded month/day. */
const ISO_RE = /^\d{4}(-\d{1,2}(-\d{1,2})?)?$/;

export function formatDate(
  iso: string | undefined,
  token: DateFormatToken = 'kr-compact',
  granularity: DateGranularity = 'date'
): string {
  if (!iso || !ISO_RE.test(iso)) return '';
  // Normalize digit-width: parse each part to an int, re-pad to 2 digits so
  // a non-padded ISO like '2014-1-6' formats correctly across all tokens.
  const raw = iso.split('-');
  const y = raw[0];
  const m = raw[1] != null ? String(parseInt(raw[1], 10)).padStart(2, '0') : undefined;
  const d = raw[2] != null ? String(parseInt(raw[2], 10)).padStart(2, '0') : undefined;
  if (!y) return '';
  if (granularity === 'year' || !m) return y;

  const mi = parseInt(m, 10) - 1;
  if (mi < 0 || mi > 11) return y;

  if (granularity === 'year-month' || !d) {
    switch (token) {
      case 'iso': return `${y}-${m}`;
      // 한국어 날짜 표기 관례의 끝점 — YYYY.MM. (#141 (13))
      case 'kr-compact': return `${y}.${m}.`;
      case 'cinema-mono': return `${MONTHS_SHORT[mi]} ${y}`;
      case 'en-long': return `${MONTHS_LONG[mi]} ${y}`;
      default: return `${y}-${m}`;
    }
  }

  switch (token) {
    case 'iso': return `${y}-${m}-${d}`;
    // 한국어 날짜 표기 관례의 끝점 — YYYY.MM.DD. (#141 (13))
    case 'kr-compact': return `${y}.${m}.${d}.`;
    case 'cinema-mono': return `${d}·${MONTHS_SHORT[mi]}·${y}`;
    case 'en-long': return `${MONTHS_LONG[mi]} ${parseInt(d, 10)}, ${y}`;
    default: return `${y}-${m}-${d}`;
  }
}

/** KOBIS openDt (YYYYMMDD) → ISO YYYY-MM-DD. Empty/invalid → empty string. */
export function openDtToIso(dt: string): string {
  if (!dt || dt.length !== 8) return "";
  return dt.substring(0, 4) + "-" + dt.substring(4, 6) + "-" + dt.substring(6, 8);
}
