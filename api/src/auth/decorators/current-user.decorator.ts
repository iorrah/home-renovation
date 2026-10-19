import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../auth-user.js';
import { getAuthUser } from '../request-context.js';

/** Injects the authenticated user into a resolver or route handler argument. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const user = getAuthUser(context);
    if (!user) throw new Error('CurrentUser used on a handler that is not authenticated');
    return user;
  },
);
