import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Queue } from 'bullmq';
import request from 'supertest';
import type { Job } from '../src/jobs/job.entity.js';
import { Message } from '../src/messages/message.entity.js';
import { REPORT_QUEUE_NAME } from '../src/queue/report-queue.js';
import { UserRole } from '../src/users/user.entity.js';
import { WorkerModule } from '../src/worker/worker.module.js';
import { createTestApp, gql, loginAs, type TestApp } from './support/app.js';
import { createJob, createUser, resetDatabase } from './support/database.js';

const REQUEST =
  'mutation ($jobId: ID!) { requestReport(jobId: $jobId) { id status downloadPath } }';
const STATUS = 'query ($id: ID!) { reportExport(id: $id) { id status downloadPath error } }';

describe('Report export (e2e)', () => {
  let t: TestApp;
  let worker: INestApplicationContext | undefined;
  let job: Job;
  let token: Record<'carlos' | 'diana' | 'hannah', string>;

  beforeAll(async () => {
    t = await createTestApp();
    await resetDatabase(t.dataSource);
    // Clear leftovers from earlier runs. The test queue uses its own Redis prefix.
    await t.app.get<Queue>(getQueueToken(REPORT_QUEUE_NAME)).obliterate({ force: true });

    const carlos = await createUser(t.dataSource, 'carlos', UserRole.CONTRACTOR);
    await createUser(t.dataSource, 'diana', UserRole.CONTRACTOR);
    const hannah = await createUser(t.dataSource, 'hannah', UserRole.HOMEOWNER);
    job = await createJob(t.dataSource, carlos, [hannah], { description: 'Report job' });
    await t.dataSource.getRepository(Message).save(
      Array.from({ length: 1200 }, (_, i) => ({
        jobId: job.id,
        authorId: carlos.id,
        body: `msg ${i}`,
      })),
    );
    token = {
      carlos: await loginAs(t.app, 'carlos'),
      diana: await loginAs(t.app, 'diana'),
      hannah: await loginAs(t.app, 'hannah'),
    };
  });

  afterAll(async () => {
    await worker?.close();
    await t.app.close();
  });

  it('records the request and returns at once, without a worker running', async () => {
    const res = await gql(t.app, REQUEST, { jobId: job.id }, token.carlos);

    expect(res.body.data.requestReport).toMatchObject({ status: 'QUEUED', downloadPath: null });
  });

  it('is idempotent: asking again while queued returns the same export', async () => {
    const first = await gql(t.app, REQUEST, { jobId: job.id }, token.carlos);
    const second = await gql(t.app, REQUEST, { jobId: job.id }, token.carlos);

    expect(second.body.data.requestReport.id).toBe(first.body.data.requestReport.id);
    const [{ count }] = await t.dataSource.query(
      'SELECT count(*)::int AS count FROM report_exports',
    );
    expect(count).toBe(1);
  });

  it('is for contractors who own the job only', async () => {
    const homeowner = await gql(t.app, REQUEST, { jobId: job.id }, token.hannah);
    const otherContractor = await gql(t.app, REQUEST, { jobId: job.id }, token.diana);

    expect(homeowner.body.errors[0].extensions.code).toBe('FORBIDDEN');
    expect(otherContractor.body.errors[0].extensions.code).toBe('NOT_FOUND');
  });

  it('is built by the worker, then downloadable by its owner only', async () => {
    const { id } = (await gql(t.app, REQUEST, { jobId: job.id }, token.carlos)).body.data
      .requestReport;

    // Start the real worker process module, as `pnpm start:worker` would.
    worker = await NestFactory.createApplicationContext(WorkerModule, { logger: false });

    let status: { status: string; downloadPath: string | null; error: string | null };
    const deadline = Date.now() + 20_000;
    do {
      await new Promise((resolve) => setTimeout(resolve, 200));
      status = (await gql(t.app, STATUS, { id }, token.carlos)).body.data.reportExport;
    } while (!['DONE', 'FAILED'].includes(status.status) && Date.now() < deadline);

    expect(status).toMatchObject({
      status: 'DONE',
      downloadPath: `/reports/${id}/file`,
      error: null,
    });

    const download = await request(t.app.getHttpServer())
      .get(status.downloadPath!)
      .set('Authorization', `Bearer ${token.carlos}`)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200)
      .expect('Content-Type', 'application/pdf');
    expect((download.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

    const asDiana = await request(t.app.getHttpServer())
      .get(status.downloadPath!)
      .set('Authorization', `Bearer ${token.diana}`);
    expect(asDiana.status).toBe(404);
    const anonymous = await request(t.app.getHttpServer()).get(status.downloadPath!);
    expect(anonymous.status).toBe(401);
  }, 30_000);
});
