import type { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';
import type { AuthUser } from './auth-user.js';

/**
 * GraphQL operations keep the user on the per-operation context object; REST routes keep it on
 * the Express request. These helpers hide that difference from the guards and decorators.
 */
export type GraphQLContext = { req?: Request; user?: AuthUser };
type HttpRequest = Request & { user?: AuthUser };

function holder(context: ExecutionContext): GraphQLContext | HttpRequest {
  return context.getType<'graphql' | 'http'>() === 'graphql'
    ? GqlExecutionContext.create(context).getContext<GraphQLContext>()
    : context.switchToHttp().getRequest<HttpRequest>();
}

export function getAuthorizationHeader(context: ExecutionContext): string | undefined {
  if (context.getType<'graphql' | 'http'>() === 'http') {
    return context.switchToHttp().getRequest<HttpRequest>().headers.authorization;
  }
  // WebSocket operations have no req: they authenticate in onConnect instead.
  return GqlExecutionContext.create(context).getContext<GraphQLContext>().req?.headers
    ?.authorization;
}

export function getAuthUser(context: ExecutionContext): AuthUser | undefined {
  return holder(context).user;
}

export function setAuthUser(context: ExecutionContext, user: AuthUser): void {
  holder(context).user = user;
}
