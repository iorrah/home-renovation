import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/user.entity.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { getAuthUser } from '../request-context.js';

/**
 * Checks the caller's role against @Roles(). Runs after AuthGuard. It only answers "may this
 * kind of user call this at all"; whether they own a specific job is checked in the services.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const user = getAuthUser(context);
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('Your role cannot perform this action');
    }
    return true;
  }
}
