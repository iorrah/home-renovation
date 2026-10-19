import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';

export type TestApp = { app: INestApplication<App>; dataSource: DataSource };

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  await app.init();
  return { app, dataSource: app.get(DataSource) };
}

/** Logs in over GraphQL and returns the access token. Every test user's password is password123. */
export async function loginAs(app: INestApplication<App>, username: string): Promise<string> {
  const res = await gql(
    app,
    'mutation ($input: LoginInput!) { login(input: $input) { accessToken } }',
    { input: { username, password: 'password123' } },
  );
  return res.body.data.login.accessToken as string;
}

/** Sends one GraphQL operation over HTTP, optionally as a logged-in user. */
export function gql(
  app: INestApplication<App>,
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
) {
  const req = request(app.getHttpServer()).post('/graphql');
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send({ query, variables });
}
