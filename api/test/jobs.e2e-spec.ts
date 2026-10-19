import type { Job } from '../src/jobs/job.entity.js';
import { UserRole, type User } from '../src/users/user.entity.js';
import { createTestApp, gql, loginAs, type TestApp } from './support/app.js';
import { createJob, createUser, resetDatabase } from './support/database.js';

const JOB_FIELDS = 'id description address status costCents version homeowners { username }';

describe('Jobs (e2e)', () => {
  let t: TestApp;
  let carlos: User;
  let diana: User;
  let hannah: User;
  let hugo: User;
  let token: Record<'carlos' | 'diana' | 'hannah' | 'hugo', string>;

  beforeAll(async () => {
    t = await createTestApp();
    await resetDatabase(t.dataSource);
    carlos = await createUser(t.dataSource, 'carlos', UserRole.CONTRACTOR);
    diana = await createUser(t.dataSource, 'diana', UserRole.CONTRACTOR);
    hannah = await createUser(t.dataSource, 'hannah', UserRole.HOMEOWNER);
    hugo = await createUser(t.dataSource, 'hugo', UserRole.HOMEOWNER);
    token = {
      carlos: await loginAs(t.app, 'carlos'),
      diana: await loginAs(t.app, 'diana'),
      hannah: await loginAs(t.app, 'hannah'),
      hugo: await loginAs(t.app, 'hugo'),
    };
  });

  afterAll(async () => {
    await t.app.close();
  });

  const update = (as: string, id: string, input: Record<string, unknown>) =>
    gql(
      t.app,
      `mutation ($id: ID!, $input: UpdateJobInput!) { updateJob(id: $id, input: $input) { ${JOB_FIELDS} } }`,
      { id, input },
      as,
    );

  describe('create', () => {
    it('lets a contractor create a job, starting in PLANNING', async () => {
      const res = await gql(
        t.app,
        `mutation ($input: CreateJobInput!) { createJob(input: $input) { ${JOB_FIELDS} contractor { username } } }`,
        { input: { description: '  New deck  ', address: '9 Oak Ave', costCents: 500000 } },
        token.carlos,
      );

      expect(res.body.data.createJob).toMatchObject({
        description: 'New deck', // trimmed
        status: 'PLANNING',
        costCents: 500000,
        version: 1,
        contractor: { username: 'carlos' },
      });
    });

    it('forbids homeowners from creating jobs', async () => {
      const res = await gql(
        t.app,
        'mutation { createJob(input: { description: "x", address: "y" }) { id } }',
        undefined,
        token.hannah,
      );

      expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
    });

    it('rejects a negative cost with field details', async () => {
      const res = await gql(
        t.app,
        'mutation { createJob(input: { description: "x", address: "y", costCents: -1 }) { id } }',
        undefined,
        token.carlos,
      );

      expect(res.body.errors[0].extensions).toEqual({
        code: 'BAD_REQUEST',
        details: ['costCents must not be less than 0'],
      });
    });
  });

  describe('who can see what', () => {
    let carlosJob: Job;
    let dianaJob: Job;

    beforeAll(async () => {
      carlosJob = await createJob(t.dataSource, carlos, [hannah], { description: 'Carlos job' });
      dianaJob = await createJob(t.dataSource, diana, [hugo], { description: 'Diana job' });
    });

    const listed = async (as: string) =>
      (
        (await gql(t.app, '{ jobs { description } }', undefined, as)).body.data.jobs as {
          description: string;
        }[]
      ).map((j) => j.description);

    it('lists only the jobs a user owns or belongs to', async () => {
      expect(await listed(token.carlos)).toContain('Carlos job');
      expect(await listed(token.carlos)).not.toContain('Diana job');
      expect(await listed(token.hannah)).toEqual(['Carlos job']);
      expect(await listed(token.hugo)).toEqual(['Diana job']);
    });

    it.each([
      ['another contractor', 'diana'],
      ['a homeowner not on the job', 'hugo'],
    ] as const)('hides a job from %s as NOT_FOUND, not FORBIDDEN', async (_who, user) => {
      const res = await gql(
        t.app,
        '{ job(id: "' + carlosJob.id + '") { id } }',
        undefined,
        token[user],
      );

      expect(res.body.errors[0].extensions.code).toBe('NOT_FOUND');
    });

    it('lets a homeowner on the job read it', async () => {
      const res = await gql(
        t.app,
        `{ job(id: "${carlosJob.id}") { description status } }`,
        undefined,
        token.hannah,
      );

      expect(res.body.data.job).toEqual({ description: 'Carlos job', status: 'PLANNING' });
    });

    it('does not let a contractor edit another contractor’s job', async () => {
      const res = await update(token.carlos, dianaJob.id, { costCents: 1 });

      expect(res.body.errors[0].extensions.code).toBe('NOT_FOUND');
    });

    it('forbids a homeowner from editing, even on their own job', async () => {
      const res = await update(token.hannah, carlosJob.id, { costCents: 1 });

      expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
    });
  });

  describe('update', () => {
    it('changes only the fields sent and bumps the version', async () => {
      const job = await createJob(t.dataSource, carlos);

      const res = await update(token.carlos, job.id, { costCents: 25000, status: 'IN_PROGRESS' });

      expect(res.body.data.updateJob).toMatchObject({
        description: 'Test job',
        costCents: 25000,
        status: 'IN_PROGRESS',
        version: 2,
      });
    });

    it('treats an edit that changes nothing as a no-op', async () => {
      const job = await createJob(t.dataSource, carlos);

      const res = await update(token.carlos, job.id, { costCents: job.costCents });

      expect(res.body.data.updateJob.version).toBe(1);
    });

    it('rejects a stale expectedVersion with CONFLICT', async () => {
      const job = await createJob(t.dataSource, carlos);
      await update(token.carlos, job.id, { costCents: 1 }); // now version 2

      const res = await update(token.carlos, job.id, { costCents: 2, expectedVersion: 1 });

      expect(res.body.errors[0].extensions.code).toBe('CONFLICT');
    });

    it('rejects a status change the workflow does not allow', async () => {
      const job = await createJob(t.dataSource, carlos);

      const res = await update(token.carlos, job.id, { status: 'COMPLETED' }); // PLANNING -> COMPLETED

      expect(res.body.errors[0]).toMatchObject({
        message: 'A job cannot move from PLANNING to COMPLETED',
        extensions: { code: 'BAD_REQUEST' },
      });
    });

    it('applies two concurrent edits one after the other', async () => {
      const job = await createJob(t.dataSource, carlos);

      const [a, b] = await Promise.all([
        update(token.carlos, job.id, { costCents: 111 }),
        update(token.carlos, job.id, { description: 'Renamed' }),
      ]);

      const versions = [a.body.data.updateJob.version, b.body.data.updateJob.version].sort(
        (x, y) => x - y,
      );
      expect(versions).toEqual([2, 3]);
      const final = await gql(
        t.app,
        `{ job(id: "${job.id}") { description costCents version } }`,
        undefined,
        token.carlos,
      );
      expect(final.body.data.job).toEqual({ description: 'Renamed', costCents: 111, version: 3 });
    });
  });

  describe('delete', () => {
    it('soft-deletes: the job disappears from the API but the row stays', async () => {
      const job = await createJob(t.dataSource, carlos, [hannah]);

      const res = await gql(
        t.app,
        `mutation { deleteJob(id: "${job.id}") }`,
        undefined,
        token.carlos,
      );

      expect(res.body.data.deleteJob).toBe(true);
      const read = await gql(t.app, `{ job(id: "${job.id}") { id } }`, undefined, token.hannah);
      expect(read.body.errors[0].extensions.code).toBe('NOT_FOUND');
      const [row] = await t.dataSource.query('SELECT deleted_at FROM jobs WHERE id = $1', [job.id]);
      expect(row.deleted_at).toBeInstanceOf(Date);
    });
  });

  describe('homeowners', () => {
    it('adds a homeowner by username, idempotently, and removes them', async () => {
      const job = await createJob(t.dataSource, carlos);
      const add = () =>
        gql(
          t.app,
          `mutation { addHomeowner(jobId: "${job.id}", username: "hugo") { homeowners { username } } }`,
          undefined,
          token.carlos,
        );

      await add();
      const again = await add();
      expect(again.body.data.addHomeowner.homeowners).toEqual([{ username: 'hugo' }]);

      const removed = await gql(
        t.app,
        `mutation { removeHomeowner(jobId: "${job.id}", homeownerId: "${hugo.id}") { homeowners { username } } }`,
        undefined,
        token.carlos,
      );
      expect(removed.body.data.removeHomeowner.homeowners).toEqual([]);
    });

    it('refuses to add a contractor as a homeowner', async () => {
      const job = await createJob(t.dataSource, carlos);

      const res = await gql(
        t.app,
        `mutation { addHomeowner(jobId: "${job.id}", username: "diana") { id } }`,
        undefined,
        token.carlos,
      );

      expect(res.body.errors[0].extensions.code).toBe('BAD_REQUEST');
    });
  });
});
