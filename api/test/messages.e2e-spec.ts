import type { Job } from '../src/jobs/job.entity.js';
import { UserRole } from '../src/users/user.entity.js';
import { createTestApp, gql, loginAs, type TestApp } from './support/app.js';
import { createJob, createUser, resetDatabase } from './support/database.js';

type MessageRow = { id: string; body: string; author: { username: string } };

describe('Messages (e2e)', () => {
  let t: TestApp;
  let job: Job;
  let token: Record<'carlos' | 'hannah' | 'hugo', string>;

  beforeAll(async () => {
    t = await createTestApp();
    await resetDatabase(t.dataSource);
    const carlos = await createUser(t.dataSource, 'carlos', UserRole.CONTRACTOR);
    const hannah = await createUser(t.dataSource, 'hannah', UserRole.HOMEOWNER);
    await createUser(t.dataSource, 'hugo', UserRole.HOMEOWNER);
    job = await createJob(t.dataSource, carlos, [hannah]);
    token = {
      carlos: await loginAs(t.app, 'carlos'),
      hannah: await loginAs(t.app, 'hannah'),
      hugo: await loginAs(t.app, 'hugo'),
    };
  });

  afterAll(async () => {
    await t.app.close();
  });

  const send = (as: string, body: string) =>
    gql(
      t.app,
      'mutation ($input: SendMessageInput!) { sendMessage(input: $input) { id body author { username } } }',
      { input: { jobId: job.id, body } },
      as,
    );
  const list = async (as: string, args = '') =>
    (
      await gql(
        t.app,
        `{ messages(jobId: "${job.id}"${args}) { id body author { username } } }`,
        undefined,
        as,
      )
    ).body;

  it('lets the contractor and a homeowner on the job talk', async () => {
    const fromCarlos = await send(token.carlos, 'Tiles arrive Monday');
    const fromHannah = await send(token.hannah, '  Great, thanks!  ');

    expect(fromCarlos.body.data.sendMessage.author.username).toBe('carlos');
    expect(fromHannah.body.data.sendMessage.body).toBe('Great, thanks!');
    const bodies = ((await list(token.hannah)).data.messages as MessageRow[]).map((m) => m.body);
    expect(bodies).toEqual(['Tiles arrive Monday', 'Great, thanks!']);
  });

  it('keeps people outside the job out', async () => {
    expect((await send(token.hugo, 'hi')).body.errors[0].extensions.code).toBe('NOT_FOUND');
    expect((await list(token.hugo)).errors[0].extensions.code).toBe('NOT_FOUND');
  });

  it('rejects a blank message', async () => {
    expect((await send(token.carlos, '   ')).body.errors[0].extensions.code).toBe('BAD_REQUEST');
  });

  it('pages: the latest N without a cursor, then only newer ones after a cursor', async () => {
    for (let i = 1; i <= 5; i++) await send(token.carlos, `update ${i}`);

    const latest = (await list(token.carlos, ', limit: 3')).data.messages as MessageRow[];
    expect(latest.map((m) => m.body)).toEqual(['update 3', 'update 4', 'update 5']);

    const afterThird = (await list(token.carlos, `, after: "${latest[0].id}"`)).data
      .messages as MessageRow[];
    expect(afterThird.map((m) => m.body)).toEqual(['update 4', 'update 5']);

    const caughtUp = (await list(token.carlos, `, after: "${latest[2].id}"`)).data.messages;
    expect(caughtUp).toEqual([]);
  });
});
