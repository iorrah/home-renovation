import { createClient } from 'graphql-ws';
import { UserRole } from '../src/users/user.entity.js';
import { createTestApp, gql, type TestApp } from './support/app.js';
import { createUser, resetDatabase } from './support/database.js';

const LOGIN = `
  mutation Login($input: LoginInput!) {
    login(input: $input) { accessToken user { id username role } }
  }`;
const ME = '{ me { id username role } }';

describe('Auth (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    await resetDatabase(t.dataSource);
    await createUser(t.dataSource, 'carlos', UserRole.CONTRACTOR);
  });

  afterAll(async () => {
    await t.app.close();
  });

  async function login(username = 'carlos', password = 'password123') {
    const res = await gql(t.app, LOGIN, { input: { username, password } });
    return res.body;
  }

  it('returns a token and the user for valid credentials', async () => {
    const body = await login();

    expect(body.errors).toBeUndefined();
    expect(body.data.login.accessToken).toEqual(expect.any(String));
    expect(body.data.login.user).toMatchObject({ username: 'carlos', role: 'CONTRACTOR' });
  });

  it('gives the same error for a wrong password and an unknown user', async () => {
    const wrongPassword = await login('carlos', 'nope');
    const unknownUser = await login('nobody', 'nope');

    for (const body of [wrongPassword, unknownUser]) {
      expect(body.data).toBeNull();
      expect(body.errors[0].message).toBe('Invalid username or password');
      expect(body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
    }
  });

  it('rejects invalid input before touching the database', async () => {
    const body = await login('', 'password123');

    expect(body.errors[0].extensions.code).toBe('BAD_REQUEST');
  });

  it('requires a token for non-public operations', async () => {
    const res = await gql(t.app, ME);

    expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a tampered token', async () => {
    const token = (await login()).data.login.accessToken as string;
    const tampered = `${token.slice(0, -2)}xx`;

    const res = await gql(t.app, ME, undefined, tampered);

    expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  it('returns the current user for a valid token', async () => {
    const token = (await login()).data.login.accessToken as string;

    const res = await gql(t.app, ME, undefined, token);

    expect(res.body.data.me).toMatchObject({ username: 'carlos', role: 'CONTRACTOR' });
  });

  describe('over WebSocket', () => {
    let url: string;

    beforeAll(async () => {
      await t.app.listen(0);
      const { port } = new URL(await t.app.getUrl());
      url = `ws://localhost:${port}/graphql`;
    });

    /** Opens a connection, runs one query, and resolves with the result or the close code. */
    function queryOverWs(authorization?: string) {
      const client = createClient({
        url,
        lazy: false,
        retryAttempts: 0,
        connectionParams: authorization ? { authorization } : {},
      });
      return new Promise<{ data?: unknown; errors?: unknown; closeCode?: number }>((resolve) => {
        client.on('closed', (event) => resolve({ closeCode: (event as CloseEvent).code }));
        client.subscribe(
          { query: ME },
          { next: (result) => resolve(result as never), error: () => {}, complete: () => {} },
        );
      }).finally(() => client.dispose());
    }

    it('authenticates with a token in connectionParams', async () => {
      const token = (await login()).data.login.accessToken as string;

      const result = await queryOverWs(`Bearer ${token}`);

      expect(result.data).toMatchObject({ me: { username: 'carlos' } });
    });

    it('closes the connection for an invalid token', async () => {
      const result = await queryOverWs('Bearer not-a-real-token');

      expect(result.closeCode).toBe(4403);
    });

    it('lets an anonymous connection run only public operations', async () => {
      const result = (await queryOverWs()) as { errors?: { message: string }[] };

      // graphql-ws sends errors without Apollo's formatting, so there is no extensions.code here.
      expect(result.errors?.[0]?.message).toBe('Missing or invalid access token');
    });
  });
});
