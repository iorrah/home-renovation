import { HealthResolver } from './health.resolver.js';

describe('HealthResolver', () => {
  it('returns ok', () => {
    expect(new HealthResolver().health()).toBe('ok');
  });
});
