// Centralised date display helpers. Internal storage stays ISO (YYYY-MM-DD)
// because HTML5 date inputs and MongoDB queries require it, but everywhere
// we *display* a date to the Azerbaijani user we render it as "DD/MM/YYYY".

/**
 * Format a date-like value as DD/MM/YYYY.
 * Accepts ISO strings (YYYY-MM-DD, YYYY-MM-DDTHH:MM:SSZ), Date objects, or empty values.
 * Returns "" for empty/invalid inputs so it can be used directly inside JSX.
 */
export function formatDate(value) {
  if (!value) return '';
  let d;
  if (value instanceof Date) {
    d = value;
  } else {
    const s = String(value);
    // Take the date portion before T or space to avoid timezone shifts (e.g. "2026-05-01T00:00:00Z" in UTC+4 returns 2026-04-30 if we use new Date()).
    const datePart = s.split(/[T\s]/)[0];
    const m = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      const [, y, mo, da] = m;
      return `${da.padStart(2, '0')}/${mo.padStart(2, '0')}/${y}`;
    }
    d = new Date(s);
  }
  if (Number.isNaN(d.getTime())) return String(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

/**
 * Format a timestamp as DD/MM/YYYY HH:MM. Useful for activity logs and audit
 * trails. Returns "" for empty inputs.
 */
export function formatDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return formatDate(value);
  const datePart = formatDate(d);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${datePart} ${hh}:${mi}`;
}

/**
 * Parse a user-typed "DD/MM/YYYY" string back into ISO "YYYY-MM-DD". Returns
 * "" if the input cannot be parsed. Used by Excel imports where Azerbaijani
 * users enter dates in their local format.
 */
export function parseDate(value) {
  if (!value) return '';
  const s = String(value).trim();
  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!m) return '';
  let [, dd, mo, yy] = m;
  if (yy.length === 2) yy = '20' + yy;
  return `${yy}-${mo.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}
