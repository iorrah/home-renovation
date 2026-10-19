import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, extractBearerToken } from '../auth.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { getAuthorizationHeader, getAuthUser, setAuthUser } from '../request-context.js';

/**
 * Registered globally, so every resolver and route requires a valid token unless it is marked
 * @Public(). Forgetting a decorator therefore fails closed, not open.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // WebSocket subscriptions authenticate once, when the connection opens (see GraphQL config).
    if (getAuthUser(context)) return true;

    const token = extractBearerToken(getAuthorizationHeader(context));
    const user = token ? await this.auth.verifyAccessToken(token) : null;
    if (!user) throw new UnauthorizedException('Missing or invalid access token');

    setAuthUser(context, user);
    return true;
  }
}
