import { API_URL } from './config';
import { clearSession, getSession } from './session';

/**
 * An error from the API, with the stable code the server sends (NOT_FOUND, CONFLICT,
 * BAD_REQUEST, FORBIDDEN, UNAUTHENTICATED...), or NETWORK_ERROR when it could not be reached.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type GraphQLResponse<T> = {
  data?: T | null;
  errors?: { message: string; extensions?: { code?: string; details?: string[] } }[];
};

/** Sends one GraphQL operation, as the logged-in user when there is one. */
export async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const session = getSession();
  let response: Response;
  try {
    response = await fetch(`${API_URL}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session && { Authorization: `Bearer ${session.accessToken}` }),
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is the API running?', 'NETWORK_ERROR');
  }

  const body = (await response.json()) as GraphQLResponse<T>;
  const error = body.errors?.[0];
  if (error) {
    const code = error.extensions?.code ?? 'INTERNAL_SERVER_ERROR';
    // The token expired or was rejected: drop it, and the route guard sends the user to login.
    if (code === 'UNAUTHENTICATED' && session) clearSession();
    throw new ApiError(error.message, code, error.extensions?.details);
  }
  return body.data as T;
}
