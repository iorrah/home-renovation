import { ApolloDriverConfig } from '@nestjs/apollo';
import type { Request } from 'express';
import type { Context as WsContext } from 'graphql-ws';
import { join } from 'node:path';
import type { AuthUser } from '../auth/auth-user.js';
import { AuthService, extractBearerToken } from '../auth/auth.service.js';
import type { GraphQLContext } from '../auth/request-context.js';
import { formatExecutionError, formatGraphQLError } from './format-error.js';

type WsExtra = { user?: AuthUser };

export function buildGraphQLConfig(auth: AuthService): ApolloDriverConfig {
  return {
    autoSchemaFile: join(process.cwd(), 'schema.gql'),
    sortSchema: true,
    graphiql: true,
    formatError: formatGraphQLError,
    subscriptions: {
      'graphql-ws': {
        path: '/graphql',
        // A WebSocket stays open for many operations, so it is authenticated once, here.
        // Browsers cannot set headers on a WebSocket, so the token travels in connectionParams.
        onConnect: async (ctx: WsContext<Record<string, unknown> | undefined>) => {
          const token = extractBearerToken(ctx.connectionParams?.authorization);
          if (!token) return true; // Anonymous: only @Public() subscriptions will work.
          const user = await auth.verifyAccessToken(token);
          if (!user) return false; // A bad token closes the connection (code 4403).
          (ctx.extra as WsExtra).user = user;
          return true;
        },
        // Give WebSocket errors the same codes and redaction as HTTP ones: formatError above only
        // runs for HTTP. This covers errors while running an operation, including a subscription
        // refused at start (not logged in, not on the job).
        onNext: (_ctx, _id, _payload, _args, result) =>
          result.errors
            ? { ...result, errors: result.errors.map(formatExecutionError) }
            : undefined,
      },
    },
    // Called once per operation. HTTP requests arrive as { req }; WebSocket operations arrive as
    // the graphql-ws context, which carries the user stored by onConnect.
    context: (input: { req?: Request; extra?: WsExtra }): GraphQLContext =>
      input.req ? { req: input.req } : { user: input.extra?.user },
  };
}
