/**
 * Money is integer cents everywhere (the API stores and returns cents). Dollars only exist in
 * the form the user types and the text they read.
 */
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** The API's largest cost: Postgres integer max, in cents. */
export const MAX_COST_CENTS = 2_147_483_647;

/** 150050 -> "$1,500.50" */
export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}

/** 150050 -> "1500.50", for pre-filling an input. */
export function centsToDollarInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * "1,500.5" -> 150050. Parses the digits as text rather than multiplying a float by 100, which
 * can be off by a cent (19.99 * 100 = 1998.9999...).
 */
export function dollarInputToCents(value: string): number {
  const [whole, fraction = ''] = value.replace(/[$,\s]/g, '').split('.');
  return Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'));
}

/** Accepts "1500", "1,500.50", "$1500.5"; rejects negatives and more than two decimals. */
export const DOLLAR_INPUT_PATTERN = /^\$?\s*(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/;
