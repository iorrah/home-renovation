import { UserRole } from '../users/user.entity.js';

/** Who is making the request, decoded from a verified access token. */
export type AuthUser = { id: string; role: UserRole };

/** What the access token carries. `sub` (subject) is the standard JWT claim for the user id. */
export type AccessTokenPayload = { sub: string; role: UserRole };
