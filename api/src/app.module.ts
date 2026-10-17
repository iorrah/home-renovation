import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import { join } from 'node:path';
import { envSchema } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthResolver } from './health/health.resolver.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    DatabaseModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'schema.gql'),
      sortSchema: true,
      graphiql: true,
      subscriptions: { 'graphql-ws': { path: '/graphql' } },
    }),
  ],
  providers: [HealthResolver, { provide: 'PUB_SUB', useValue: new PubSub() }],
})
export class AppModule {}
