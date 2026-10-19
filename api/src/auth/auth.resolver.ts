import { NotFoundException } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UserModel } from '../users/user.model.js';
import { UsersService } from '../users/users.service.js';
import type { AuthUser } from './auth-user.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { AuthPayload } from './dto/auth-payload.model.js';
import { LoginInput } from './dto/login.input.js';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Mutation(() => AuthPayload)
  login(@Args('input') input: LoginInput): Promise<AuthPayload> {
    return this.auth.login(input.username, input.password);
  }

  @Query(() => UserModel, { description: 'The user the access token belongs to.' })
  async me(@CurrentUser() currentUser: AuthUser): Promise<UserModel> {
    const user = await this.users.findById(currentUser.id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
