import type { GraphQLFormattedError } from 'graphql';

/** Stable, documented error codes for clients, keyed by the HTTP status Nest exceptions carry. */
const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
};

/**
 * Shapes every GraphQL error before it leaves the server: gives Nest exceptions a proper code
 * (Nest only maps 400, 401 and 403 itself, so a 404 would arrive as INTERNAL_SERVER_ERROR), and
 * removes stack traces and internal details. Unexpected errors get a generic message, so a
 * failing SQL query cannot leak table names or data.
 */
export function formatGraphQLError(error: GraphQLFormattedError): GraphQLFormattedError {
  const extensions = error.extensions ?? {};
  const original = extensions.originalError as
    | { statusCode?: number; message?: unknown }
    | undefined;
  const status = original?.statusCode ?? (extensions.status as number | undefined);
  const knownCode = status ? CODE_BY_STATUS[status] : undefined;
  const code = knownCode ?? (extensions.code as string | undefined) ?? 'INTERNAL_SERVER_ERROR';

  // GraphQL's own errors (syntax, unknown field, wrong variable type) are safe to show.
  const isGraphQLValidation =
    code === 'GRAPHQL_VALIDATION_FAILED' ||
    code === 'GRAPHQL_PARSE_FAILED' ||
    code === 'BAD_USER_INPUT';
  const safe = Boolean(knownCode) || isGraphQLValidation;

  // class-validator lists every failed rule; keep them so clients can show field errors.
  const details = Array.isArray(original?.message) ? { details: original.message } : {};

  const message = details.details
    ? 'Invalid input'
    : safe
      ? error.message
      : 'Internal server error';

  return {
    message,
    locations: error.locations,
    path: error.path,
    extensions: { code, ...details },
  };
}
