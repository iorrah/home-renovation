import { Inject } from '@nestjs/common';
import { Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import { Public } from '../auth/decorators/public.decorator.js';

// Temporary resolver for checking the GraphQL setup; open to everyone.
@Public()
@Resolver()
export class HealthResolver {
  constructor(@Inject('PUB_SUB') private readonly pubSub: PubSub) {}

  @Query(() => String)
  health(): string {
    return 'ok';
  }

  @Mutation(() => String)
  async ping(): Promise<string> {
    await this.pubSub.publish('pinged', { pinged: 'pong' });
    return 'sent';
  }

  @Subscription(() => String)
  pinged() {
    return this.pubSub.asyncIterableIterator('pinged');
  }
}
