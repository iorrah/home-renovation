const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** 150000 -> "$1,500.00". Money is stored as integer cents and only formatted for display. */
export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}
