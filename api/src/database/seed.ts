// Resets the development database to a known state. Run with `pnpm seed`.
//
// Jobs, edits, undos and membership changes go through the real services, so the seeded history
// is exactly what the app itself would have written. Only bulk messages use raw SQL, for speed.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../auth/auth-user.js';
import { hashPassword } from '../auth/password.js';
import { envSchema } from '../config/env.js';
import { HistoryService } from '../history/history.service.js';
import { JobStatus } from '../jobs/job.entity.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { JobsService } from '../jobs/jobs.service.js';
import { Message } from '../messages/message.entity.js';
import { User, UserRole } from '../users/user.entity.js';
import { DatabaseModule } from './database.module.js';

const SEED_PASSWORD = 'password123';
const LARGE_JOB_EDIT_COUNT = 300;
const LARGE_JOB_MESSAGE_COUNT = 5_000;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    DatabaseModule,
    JobsModule,
  ],
})
class SeedModule {}

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed a production database');
}

const app = await NestFactory.createApplicationContext(SeedModule, { logger: ['error'] });
const dataSource = app.get(DataSource);
const jobs = app.get(JobsService);
const history = app.get(HistoryService);

try {
  await dataSource.query(
    'TRUNCATE report_exports, job_changes, messages, job_homeowners, jobs, users CASCADE',
  );

  const passwordHash = await hashPassword(SEED_PASSWORD);
  const users = dataSource.getRepository(User);
  const [carlos, diana, hannah] = await users.save(
    [
      { username: 'carlos', role: UserRole.CONTRACTOR },
      { username: 'diana', role: UserRole.CONTRACTOR },
      { username: 'hannah', role: UserRole.HOMEOWNER },
      { username: 'henry', role: UserRole.HOMEOWNER },
      { username: 'hugo', role: UserRole.HOMEOWNER },
    ].map((u) => users.create({ ...u, passwordHash })),
  );
  const asCarlos: AuthUser = { id: carlos.id, role: carlos.role };
  const asDiana: AuthUser = { id: diana.id, role: diana.role };

  // Kitchen: a normal job whose history includes an undo and a redo.
  const kitchen = await jobs.create(asCarlos, {
    description: 'Kitchen remodel: new cabinets, quartz countertops, island',
    address: '742 Evergreen Terrace, Springfield',
    costCents: 2_300_000,
  });
  await jobs.addHomeowner(asCarlos, kitchen.id, 'hannah');
  await jobs.addHomeowner(asCarlos, kitchen.id, 'henry');
  await jobs.update(asCarlos, kitchen.id, { status: JobStatus.IN_PROGRESS });
  await jobs.update(asCarlos, kitchen.id, { costCents: 2_450_000 });
  await history.undo(asCarlos, kitchen.id);
  await history.redo(asCarlos, kitchen.id);

  // Bathroom: Diana's job, left with an undone edit so "redo" is available in the demo.
  const bathroom = await jobs.create(asDiana, {
    description: 'Primary bathroom: walk-in shower and double vanity',
    address: '31 Spooner Street, Quahog',
    costCents: 1_200_000,
  });
  await jobs.addHomeowner(asDiana, bathroom.id, 'hugo');
  await jobs.update(asDiana, bathroom.id, { costCents: 1_350_000 });
  await history.undo(asDiana, bathroom.id);

  // Basement: a long-running job with a large history and message log, to show that report
  // export takes a while without slowing the API down.
  const basement = await jobs.create(asCarlos, {
    description: 'Basement finish (large job for report export demo)',
    address: '1640 Riverside Drive, Hill Valley',
    costCents: 6_000_000,
    status: JobStatus.IN_PROGRESS,
  });
  await jobs.addHomeowner(asCarlos, basement.id, 'hannah');
  for (let i = 1; i <= LARGE_JOB_EDIT_COUNT; i++) {
    await jobs.update(
      asCarlos,
      basement.id,
      i % 25 === 0
        ? { description: `Basement finish, phase ${i / 25} (large job for report export demo)` }
        : { costCents: 6_000_000 + i * 2_500 },
    );
  }

  await dataSource.getRepository(Message).save([
    { jobId: kitchen.id, authorId: carlos.id, body: 'Cabinets arrive Monday.' },
    { jobId: kitchen.id, authorId: hannah.id, body: 'Great, we will clear the space.' },
    { jobId: bathroom.id, authorId: diana.id, body: 'Tile samples are ready to review.' },
  ]);
  // One set-based INSERT is far faster than 5,000 ORM saves. Timestamps are spread one minute
  // apart so ordering by created_at is meaningful.
  await dataSource.query(
    `INSERT INTO messages (job_id, author_id, body, created_at)
     SELECT $1, CASE WHEN i % 2 = 0 THEN $2::uuid ELSE $3::uuid END,
            'Progress update #' || i, now() - make_interval(mins => $4 - i)
     FROM generate_series(1, $4) AS i`,
    [basement.id, carlos.id, hannah.id, LARGE_JOB_MESSAGE_COUNT],
  );

  console.log(`Seeded. Every user's password is "${SEED_PASSWORD}".`);
} finally {
  await app.close();
}
