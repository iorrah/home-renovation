import { formatCents } from '../common/money.js';
import type { JobDiff } from './job-change.entity.js';

const LABELS: Record<string, string> = {
  description: 'description',
  address: 'address',
  status: 'status',
  costCents: 'cost',
  homeowner: 'homeowner',
};

/** One value as a person would read it: cents as money, strings as they are, null as "none". */
export function formatValue(field: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (field === 'costCents' && typeof value === 'number') return formatCents(value);
  return typeof value === 'object'
    ? JSON.stringify(value)
    : String(value as string | number | boolean);
}

/** 'cost: $100.00 -> $150.00; status: PLANNING -> IN_PROGRESS' */
export function describeDiff(diff: JobDiff): string {
  return Object.entries(diff)
    .map(([field, { from, to }]) => {
      const label = LABELS[field] ?? field;
      const before = formatValue(field, from);
      const after = formatValue(field, to);
      if (before === null) return `${label}: ${after}`;
      if (after === null) return `${label}: removed ${before}`;
      return `${label}: ${before} -> ${after}`;
    })
    .join('; ');
}
