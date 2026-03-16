/**
 * Formats a number as a USD currency string.
 * e.g. 1234.5 → "$1,234.50"
 */
export function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
