import { Global, Module, type OnApplicationShutdown, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import type { Env } from '../config/env.js';

export const PUB_SUB = Symbol('PUB_SUB');

/** Dates arrive from Redis as ISO strings (JSON has no date type); turn them back into Dates. */
const DATE_FIELDS = new Set(['createdAt', 'updatedAt']);
const reviveDates = (key: string, value: unknown) =>
  DATE_FIELDS.has(key) && typeof value === 'string' ? new Date(value) : value;

/**
 * Pub/sub for GraphQL subscriptions, backed by Redis rather than process memory. An in-memory
 * PubSub only reaches clients connected to the same server process; with Redis, a message sent
 * through one API instance reaches subscribers connected to any other instance.
 */
@Global()
@Module({
  providers: [
    {
      provide: PUB_SUB,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new RedisPubSub({
          connection: config.get('REDIS_URL', { infer: true }),
          reviver: reviveDates,
        }),
    },
  ],
  exports: [PUB_SUB],
})
export class PubSubModule implements OnApplicationShutdown {
  constructor(@Inject(PUB_SUB) private readonly pubSub: RedisPubSub) {}

  /** Closes both Redis connections, so the process (and test runs) can exit cleanly. */
  async onApplicationShutdown(): Promise<void> {
    await this.pubSub.close();
  }
}

/**
 * One channel per job, e.g. "bull:messages:<jobId>". A subscriber listens only to its job's
 * channel, so a message is never even delivered to processes with nobody watching that job.
 */
export function jobMessagesChannel(prefix: string, jobId: string): string {
  return `${prefix}:messages:${jobId}`;
}
