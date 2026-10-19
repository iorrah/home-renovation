import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/user.entity.js';

export const ROLES_KEY = 'roles';

/** Restricts a resolver or route to the given roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
