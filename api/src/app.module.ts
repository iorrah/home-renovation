import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import { AuthModule } from './auth/auth.module.js';
import { AuthService } from './auth/auth.service.js';
import { envSchema } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { buildGraphQLConfig } from './graphql/graphql.config.js';
import { HealthResolver } from './health/health.resolver.js';
import { JobsModule } from './jobs/jobs.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { ReportsModule } from './reports/reports.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    DatabaseModule,
    AuthModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [AuthModule],
      inject: [AuthService],
      useFactory: buildGraphQLConfig,
    }),
    JobsModule,
    MessagesModule,
    ReportsModule,
  ],
  providers: [
    // Registered here rather than in main.ts so e2e tests, which build AppModule directly,
    // validate input exactly like the running server.
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, transform: true }) },
    HealthResolver,
    { provide: 'PUB_SUB', useValue: new PubSub() },
  ],
})
export class AppModule {}
