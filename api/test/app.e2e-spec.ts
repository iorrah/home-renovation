import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('GraphQL (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers the health query', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ health }' })
      .expect(200);

    expect(res.body).toEqual({ data: { health: 'ok' } });
  });
});
