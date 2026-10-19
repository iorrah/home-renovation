import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import type { AccessTokenPayload, AuthUser } from './auth-user.js';
import { hashPassword, verifyPassword } from './password.js';

@Injectable()
export class AuthService {
  // Hash of a random value, compared against when the username does not exist, so a login for
  // an unknown user takes as long as one with a wrong password and usernames cannot be probed.
  private readonly dummyHash = hashPassword(crypto.randomUUID());

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string): Promise<{ accessToken: string; user: User }> {
    const user = await this.users.findByUsername(username);
    const valid = await verifyPassword(password, user?.passwordHash ?? (await this.dummyHash));
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    return { accessToken: await this.jwt.signAsync(payload), user };
  }

  /** Returns the user for a valid token, or null for a missing, expired or tampered one. */
  async verifyAccessToken(token: string): Promise<AuthUser | null> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      return { id: payload.sub, role: payload.role };
    } catch {
      return null;
    }
  }
}

/** Reads the token from an "Authorization: Bearer <token>" value. */
export function extractBearerToken(header: unknown): string | null {
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
