import { QueryFailedError } from 'typeorm';

/** True when an insert hit the given unique constraint or index (Postgres error 23505). */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = error.driverError as { code?: string; constraint?: string };
  return driverError.code === '23505' && driverError.constraint === constraint;
}
