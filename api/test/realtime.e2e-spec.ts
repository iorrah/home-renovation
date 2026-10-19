import type { Job } from '../src/jobs/job.entity.js';
import { UserRole } from '../src/users/user.entity.js';
import { createTestApp, gql, loginAs, type TestApp } from './support/app.js';
import { createJob, createUser, resetDatabase } from './support/database.js';
import { subscribe, subscriptionReady } from './support/ws.js';

const MESSAGE_ADDED = `
  subscription ($jobId: ID!) {
    messageAdded(jobId: $jobId) { id jobId body createdAt author { username role } }
  }`;
type MessageAdded = {
  messageAdded: {
    id: string;
    jobId: string;
    body: string;
    createdAt: string;
    author: { username: string };
  };
};

describe('Real-time messages (e2e)', () => {
  let t: TestApp;
  let url: string;
  let kitchen: Job;
  let bathroom: Job;
  let token: Record<'carlos' | 'hannah' | 'hugo', string>;
  const open: { dispose: () => unknown }[] = [];

  beforeAll(async () => {
    t = await createTestApp();
    await t.app.listen(0);
    url = (await t.app.getUrl()).replace('http', 'ws') + '/graphql';

    await resetDatabase(t.dataSource);
    const carlos = await createUser(t.dataSource, 'carlos', UserRole.CONTRACTOR);
    const hannah = await createUser(t.dataSource, 'hannah', UserRole.HOMEOWNER);
    const hugo = await createUser(t.dataSource, 'hugo', UserRole.HOMEOWNER);
    kitchen = await createJob(t.dataSource, carlos, [hannah], { description: 'Kitchen' });
    bathroom = await createJob(t.dataSource, carlos, [hugo], { description: 'Bathroom' });
    token = {
      carlos: await loginAs(t.app, 'carlos'),
      hannah: await loginAs(t.app, 'hannah'),
      hugo: await loginAs(t.app, 'hugo'),
    };
  });

  afterEach(async () => {
    await Promise.all(open.splice(0).map((s) => s.dispose()));
  });

  afterAll(async () => {
    await t.app.close();
  });

  function watch(jobId: string, as?: string) {
    const subscription = subscribe<MessageAdded>(url, MESSAGE_ADDED, { jobId }, as);
    open.push(subscription);
    return subscription;
  }
  const send = (jobId: string, body: string, as: string) =>
    gql(
      t.app,
      'mutation ($input: SendMessageInput!) { sendMessage(input: $input) { id } }',
      { input: { jobId, body } },
      as,
    );

  it('delivers a message to everyone watching the job, as soon as it is sent', async () => {
    const asHannah = watch(kitchen.id, token.hannah);
    const asCarlos = watch(kitchen.id, token.carlos);
    await subscriptionReady();

    const sent = await send(kitchen.id, 'Cabinets arrive Monday', token.carlos);

    for (const subscription of [asHannah, asCarlos]) {
      const { data } = await subscription.next();
      expect(data?.messageAdded).toMatchObject({
        id: sent.body.data.sendMessage.id,
        jobId: kitchen.id,
        body: 'Cabinets arrive Monday',
        author: { username: 'carlos', role: 'CONTRACTOR' },
      });
      expect(Number.isNaN(Date.parse(data!.messageAdded.createdAt))).toBe(false);
    }
  });

  it('works in both directions', async () => {
    const asCarlos = watch(kitchen.id, token.carlos);
    await subscriptionReady();

    await send(kitchen.id, 'Can we start at 9?', token.hannah);

    expect((await asCarlos.next()).data?.messageAdded.author.username).toBe('hannah');
  });

  it('only delivers messages for the job being watched', async () => {
    const kitchenFeed = watch(kitchen.id, token.carlos);
    await subscriptionReady();

    await send(bathroom.id, 'Bathroom only', token.carlos);
    await send(kitchen.id, 'Kitchen only', token.carlos);

    expect((await kitchenFeed.next()).data?.messageAdded.body).toBe('Kitchen only');
    expect(kitchenFeed.pending()).toBe(0);
  });

  it('reaches subscribers on another server instance (Redis pub/sub, not memory)', async () => {
    const second = await createTestApp();
    await second.app.listen(0);
    try {
      const secondUrl = (await second.app.getUrl()).replace('http', 'ws') + '/graphql';
      const onSecond = subscribe<MessageAdded>(
        secondUrl,
        MESSAGE_ADDED,
        { jobId: kitchen.id },
        token.hannah,
      );
      open.push(onSecond);
      await subscriptionReady();

      await send(kitchen.id, 'Sent through the first instance', token.carlos);

      expect((await onSecond.next()).data?.messageAdded.body).toBe(
        'Sent through the first instance',
      );
    } finally {
      await second.app.close();
    }
  });

  it('refuses to start a subscription for someone outside the job', async () => {
    const result = await watch(kitchen.id, token.hugo).next();

    expect(result.errors?.[0]).toMatchObject({
      message: 'Job not found',
      extensions: { code: 'NOT_FOUND' },
    });
  });

  it('refuses an anonymous subscription', async () => {
    const result = await watch(kitchen.id).next();

    expect(result.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('does not publish a message that failed to save', async () => {
    const feed = watch(kitchen.id, token.carlos);
    await subscriptionReady();

    const rejected = await send(kitchen.id, '   ', token.carlos);
    await send(kitchen.id, 'Valid one', token.carlos);

    expect(rejected.body.errors[0].extensions.code).toBe('BAD_REQUEST');
    expect((await feed.next()).data?.messageAdded.body).toBe('Valid one');
  });
});
