// Small, pure utilities suitable for unit tests

/** Returns true if the given year is a leap year (Gregorian rules). */
export function isLeapYear(year: number): boolean {
  if (!Number.isInteger(year)) throw new Error('year must be an integer');
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Formats a Date as YYYY-MM-DD (UTC). */
export function formatISODate(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid Date');
  }
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
