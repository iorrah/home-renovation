import { createTestApp, gql, type TestApp } from './support/app.js';

describe('GraphQL (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('answers the public health query without a token', async () => {
    const res = await gql(t.app, '{ health }').expect(200);

    expect(res.body).toEqual({ data: { health: 'ok' } });
  });
});
