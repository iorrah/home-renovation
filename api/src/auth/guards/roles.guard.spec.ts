import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/user.entity.js';
import type { AuthUser } from '../auth-user.js';
import { RolesGuard } from './roles.guard.js';

function contextFor(user: AuthUser | undefined): ExecutionContext {
  const request = { user };
  return {
    getType: () => 'http',
    getHandler: () => () => {},
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const contractor: AuthUser = { id: 'c1', role: UserRole.CONTRACTOR };
  const homeowner: AuthUser = { id: 'h1', role: UserRole.HOMEOWNER };

  function guardRequiring(roles: UserRole[] | undefined) {
    const reflector = { getAllAndOverride: () => roles } as unknown as Reflector;
    return new RolesGuard(reflector);
  }

  it('allows anyone when no roles are required', () => {
    expect(guardRequiring(undefined).canActivate(contextFor(homeowner))).toBe(true);
  });

  it('allows a user with a required role', () => {
    expect(guardRequiring([UserRole.CONTRACTOR]).canActivate(contextFor(contractor))).toBe(true);
  });

  it('forbids a user without a required role', () => {
    expect(() => guardRequiring([UserRole.CONTRACTOR]).canActivate(contextFor(homeowner))).toThrow(
      ForbiddenException,
    );
  });
});
