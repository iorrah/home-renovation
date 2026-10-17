import { Inject } from '@nestjs/common';
import { Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';

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
