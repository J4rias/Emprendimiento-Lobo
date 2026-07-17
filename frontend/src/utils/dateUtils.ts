/**
 * Local-timezone date helpers.
 *
 * `new Date().toISOString().slice(0,10)` returns the UTC date — after 8 PM in
 * UTC-4 (Venezuela) it already shows tomorrow.  These helpers always use the
 * browser's local clock.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD string for the local "today". */
export const localToday = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** YYYY-MM-DD for the first day of the current local month. */
export const localMonthStart = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
};

/** Convert any Date to a local YYYY-MM-DD string. */
export const toLocalDateStr = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
