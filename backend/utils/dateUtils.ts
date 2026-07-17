/**
 * Local-timezone date helpers for backend controllers.
 *
 * `new Date('2026-07-16')` parses as UTC midnight — on a server running in
 * UTC-4 that is 8 PM of the previous day, making BETWEEN queries miss the
 * entire local day.  These helpers always produce local-timezone Date objects.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Parse a 'YYYY-MM-DD' (or 'YYYY-MM-DDTHH:MM:SS') string into a Date at
 * local midnight.  The time portion, if present, is discarded.
 */
export const parseLocalDate = (s: string): Date => {
  const dateOnly = s.includes('T') ? s.split('T')[0] : s;
  const [y, m, d] = dateOnly.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** End-of-day Date (23:59:59.999) in local timezone for a 'YYYY-MM-DD' string. */
export const parseLocalDateEnd = (s: string): Date => {
  const d = parseLocalDate(s);
  d.setHours(23, 59, 59, 999);
  return d;
};

/** YYYY-MM-DD string for the local "today". */
export const localToday = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
