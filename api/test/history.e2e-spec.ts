import { UserRole, type User } from '../src/users/user.entity.js';
import { createTestApp, gql, loginAs, type TestApp } from './support/app.js';
import { createUser, resetDatabase } from './support/database.js';

type Change = {
  changeNumber: number;
  type: string;
  state: string | null;
  summary: string;
  responsibleUser: { username: string };
};
type JobView = {
  id: string;
  costCents: number;
  status: string;
  version: number;
  canUndo: boolean;
  canRedo: boolean;
};

const JOB = 'id costCents status version canUndo canRedo';

describe('History, undo and redo (e2e)', () => {
  let t: TestApp;
  let hannah: User;
  let token: Record<'carlos' | 'diana' | 'hannah' | 'hugo', string>;

  beforeAll(async () => {
    t = await createTestApp();
    await resetDatabase(t.dataSource);
    await createUser(t.dataSource, 'carlos', UserRole.CONTRACTOR);
    await createUser(t.dataSource, 'diana', UserRole.CONTRACTOR);
    hannah = await createUser(t.dataSource, 'hannah', UserRole.HOMEOWNER);
    await createUser(t.dataSource, 'hugo', UserRole.HOMEOWNER);
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

  // --- helpers: each one is a single GraphQL call made as carlos unless stated otherwise ---

  async function newJob(costCents = 10_000): Promise<JobView> {
    const res = await gql(
      t.app,
      `mutation ($input: CreateJobInput!) { createJob(input: $input) { ${JOB} } }`,
      { input: { description: 'Deck', address: '1 Oak St', costCents } },
      token.carlos,
    );
    return res.body.data.createJob;
  }
  const edit = (id: string, input: Record<string, unknown>, as = token.carlos) =>
    gql(
      t.app,
      `mutation ($id: ID!, $input: UpdateJobInput!) { updateJob(id: $id, input: $input) { ${JOB} } }`,
      { id, input },
      as,
    );
  const undo = (id: string, as = token.carlos, expectedVersion?: number) =>
    gql(
      t.app,
      `mutation ($id: ID!, $v: Int) { undoJobChange(jobId: $id, expectedVersion: $v) { ${JOB} } }`,
      { id, v: expectedVersion },
      as,
    );
  const redo = (id: string, as = token.carlos) =>
    gql(t.app, `mutation ($id: ID!) { redoJobChange(jobId: $id) { ${JOB} } }`, { id }, as);
  const historyOf = async (id: string, as = token.carlos): Promise<Change[]> =>
    (
      await gql(
        t.app,
        `{ jobHistory(jobId: "${id}") { changeNumber type state summary responsibleUser { username } } }`,
        undefined,
        as,
      )
    ).body.data.jobHistory;
  const errorCode = (res: { body: { errors?: { extensions: { code: string } }[] } }) =>
    res.body.errors?.[0]?.extensions.code;

  it('records the creation and every edit, in order, with who made them', async () => {
    const job = await newJob(10_000);
    await edit(job.id, { costCents: 15_000 });
    await edit(job.id, { status: 'IN_PROGRESS' });

    const history = await historyOf(job.id);

    expect(history.map((c) => [c.changeNumber, c.type, c.state])).toEqual([
      [1, 'CREATE', null],
      [2, 'UPDATE', 'APPLIED'],
      [3, 'UPDATE', 'APPLIED'],
    ]);
    expect(history[1].summary).toBe('cost: $100.00 -> $150.00');
    expect(history[2].responsibleUser.username).toBe('carlos');
  });

  it('round trip: edit -> undo -> redo restores each state and logs every step', async () => {
    const job = await newJob(10_000);
    await edit(job.id, { costCents: 15_000 });

    const undone = (await undo(job.id)).body.data.undoJobChange as JobView;
    expect(undone).toMatchObject({ costCents: 10_000, canUndo: false, canRedo: true });

    const redone = (await redo(job.id)).body.data.redoJobChange as JobView;
    expect(redone).toMatchObject({ costCents: 15_000, canUndo: true, canRedo: false });

    const history = await historyOf(job.id);
    expect(history.map((c) => [c.type, c.state, c.summary])).toEqual([
      ['CREATE', null, expect.any(String)],
      ['UPDATE', 'APPLIED', 'cost: $100.00 -> $150.00'], // undone, then redone
      ['UNDO', null, 'cost: $150.00 -> $100.00'],
      ['REDO', null, 'cost: $100.00 -> $150.00'],
    ]);
  });

  it('undoes several edits newest first and redoes them oldest first', async () => {
    const job = await newJob(100);
    await edit(job.id, { costCents: 200 });
    await edit(job.id, { costCents: 300 });

    expect((await undo(job.id)).body.data.undoJobChange.costCents).toBe(200);
    expect((await undo(job.id)).body.data.undoJobChange.costCents).toBe(100);
    expect((await redo(job.id)).body.data.redoJobChange.costCents).toBe(200);
    expect((await redo(job.id)).body.data.redoJobChange.costCents).toBe(300);
  });

  it('a new edit after an undo discards the redo stack', async () => {
    const job = await newJob(100);
    await edit(job.id, { costCents: 200 });
    await undo(job.id);

    const edited = (await edit(job.id, { costCents: 999 })).body.data.updateJob as JobView;

    expect(edited.canRedo).toBe(false);
    expect(errorCode(await redo(job.id))).toBe('BAD_REQUEST');
    const states = (await historyOf(job.id)).filter((c) => c.type === 'UPDATE').map((c) => c.state);
    expect(states).toEqual(['DISCARDED', 'APPLIED']); // kept for the audit trail, not deleted
  });

  it('gives a clear error when there is nothing to undo or redo', async () => {
    const job = await newJob();

    const undoRes = await undo(job.id);
    const redoRes = await redo(job.id);

    expect(undoRes.body.errors[0]).toMatchObject({
      message: 'Nothing to undo',
      extensions: { code: 'BAD_REQUEST' },
    });
    expect(redoRes.body.errors[0]).toMatchObject({
      message: 'Nothing to redo',
      extensions: { code: 'BAD_REQUEST' },
    });
  });

  it('rejects an undo from a stale view with CONFLICT', async () => {
    const job = await newJob(100); // version 1
    await edit(job.id, { costCents: 200 }); // version 2

    expect(errorCode(await undo(job.id, token.carlos, 1))).toBe('CONFLICT');
    expect((await undo(job.id, token.carlos, 2)).body.data.undoJobChange.costCents).toBe(100);
  });

  it('refuses to undo if the job was changed outside the history log', async () => {
    const job = await newJob(100);
    await edit(job.id, { costCents: 200 });
    await t.dataSource.query('UPDATE jobs SET cost_cents = 12345 WHERE id = $1', [job.id]);

    const res = await undo(job.id);

    expect(errorCode(res)).toBe('CONFLICT');
    const [{ cost_cents }] = await t.dataSource.query('SELECT cost_cents FROM jobs WHERE id = $1', [
      job.id,
    ]);
    expect(cost_cents).toBe(12345); // untouched
  });

  it('undo may move status backwards, even where the workflow would not allow it', async () => {
    const job = await newJob();
    await edit(job.id, { status: 'IN_PROGRESS' });
    await edit(job.id, { status: 'COMPLETED' }); // COMPLETED is final for normal edits

    const res = await undo(job.id);

    expect(res.body.data.undoJobChange.status).toBe('IN_PROGRESS');
  });

  it('numbers concurrent changes without gaps or duplicates', async () => {
    const job = await newJob(0);

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => edit(job.id, { costCents: i + 1 })),
    );

    expect(results.every((r) => !r.body.errors)).toBe(true);
    const numbers = (await historyOf(job.id)).map((c) => c.changeNumber);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('serializes concurrent undos: each reverses a different edit', async () => {
    const job = await newJob(100);
    await edit(job.id, { costCents: 200 });
    await edit(job.id, { costCents: 300 });

    const [a, b] = await Promise.all([undo(job.id), undo(job.id)]);

    const costs = [a.body.data.undoJobChange.costCents, b.body.data.undoJobChange.costCents].sort(
      (x, y) => x - y,
    );
    expect(costs).toEqual([100, 200]);
  });

  it('records membership changes and deletion too', async () => {
    const job = await newJob();
    await gql(
      t.app,
      `mutation { addHomeowner(jobId: "${job.id}", username: "hannah") { id } }`,
      undefined,
      token.carlos,
    );
    await gql(
      t.app,
      `mutation { removeHomeowner(jobId: "${job.id}", homeownerId: "${hannah.id}") { id } }`,
      undefined,
      token.carlos,
    );
    await gql(t.app, `mutation { deleteJob(id: "${job.id}") }`, undefined, token.carlos);

    const types = (
      await t.dataSource.query(
        'SELECT type FROM job_changes WHERE job_id = $1 ORDER BY change_number',
        [job.id],
      )
    ).map((r: { type: string }) => r.type);
    expect(types).toEqual(['CREATE', 'HOMEOWNER_ADDED', 'HOMEOWNER_REMOVED', 'DELETE']);
  });

  it('blocks undo on a deleted job', async () => {
    const job = await newJob(100);
    await edit(job.id, { costCents: 200 });
    await gql(t.app, `mutation { deleteJob(id: "${job.id}") }`, undefined, token.carlos);

    expect(errorCode(await undo(job.id))).toBe('NOT_FOUND');
  });

  describe('permissions', () => {
    let jobId: string;

    beforeAll(async () => {
      jobId = (await newJob(100)).id;
      await edit(jobId, { costCents: 200 });
      await gql(
        t.app,
        `mutation { addHomeowner(jobId: "${jobId}", username: "hannah") { id } }`,
        undefined,
        token.carlos,
      );
    });

    it('lets a homeowner on the job read its history', async () => {
      const history = await historyOf(jobId, token.hannah);

      expect(history.map((c) => c.type)).toEqual(['CREATE', 'UPDATE', 'HOMEOWNER_ADDED']);
    });

    it('forbids homeowners from undoing or redoing', async () => {
      expect(errorCode(await undo(jobId, token.hannah))).toBe('FORBIDDEN');
      expect(errorCode(await redo(jobId, token.hannah))).toBe('FORBIDDEN');
    });

    it('hides the history from people outside the job', async () => {
      const asHugo = await gql(
        t.app,
        `{ jobHistory(jobId: "${jobId}") { id } }`,
        undefined,
        token.hugo,
      );

      expect(errorCode(asHugo)).toBe('NOT_FOUND');
      expect(errorCode(await undo(jobId, token.diana))).toBe('NOT_FOUND');
    });
  });
});
