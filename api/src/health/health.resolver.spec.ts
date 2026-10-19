import { PubSub } from 'graphql-subscriptions';
import { HealthResolver } from './health.resolver.js';

describe('HealthResolver', () => {
  it('returns ok', () => {
    expect(new HealthResolver(new PubSub()).health()).toBe('ok');
  });
});
