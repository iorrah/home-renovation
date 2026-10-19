// Resets the development database to a known state. Run with `pnpm seed`.
import { DataSource } from 'typeorm';
import { hashPassword } from '../auth/password.js';
import { JobHomeowner } from '../jobs/job-homeowner.entity.js';
import { Job, JobStatus } from '../jobs/job.entity.js';
import { Message } from '../messages/message.entity.js';
import { User, UserRole } from '../users/user.entity.js';
import { buildDataSourceOptions } from './database.options.js';

const SEED_PASSWORD = 'password123';
const LARGE_JOB_MESSAGE_COUNT = 5_000;

try {
  process.loadEnvFile();
} catch {
  // No .env file: use the real environment.
}

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed a production database');
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const dataSource = await new DataSource(buildDataSourceOptions(databaseUrl)).initialize();

try {
  await dataSource.transaction(async (manager) => {
    await manager.query(
      'TRUNCATE report_exports, job_changes, messages, job_homeowners, jobs, users CASCADE',
    );

    const passwordHash = await hashPassword(SEED_PASSWORD);
    const user = (username: string, role: UserRole) =>
      manager.create(User, { username, role, passwordHash });

    const [carlos, diana, hannah, henry, hugo] = await manager.save([
      user('carlos', UserRole.CONTRACTOR),
      user('diana', UserRole.CONTRACTOR),
      user('hannah', UserRole.HOMEOWNER),
      user('henry', UserRole.HOMEOWNER),
      user('hugo', UserRole.HOMEOWNER),
    ]);

    const [kitchen, bathroom, basement] = await manager.save([
      manager.create(Job, {
        contractorId: carlos.id,
        description: 'Kitchen remodel: new cabinets, quartz countertops, island',
        address: '742 Evergreen Terrace, Springfield',
        status: JobStatus.IN_PROGRESS,
        costCents: 2_450_000,
      }),
      manager.create(Job, {
        contractorId: diana.id,
        description: 'Primary bathroom: walk-in shower and double vanity',
        address: '31 Spooner Street, Quahog',
        status: JobStatus.PLANNING,
        costCents: 1_200_000,
      }),
      manager.create(Job, {
        contractorId: carlos.id,
        description: 'Basement finish (large job for report export demo)',
        address: '1640 Riverside Drive, Hill Valley',
        status: JobStatus.IN_PROGRESS,
        costCents: 6_800_000,
      }),
    ]);

    await manager.save([
      manager.create(JobHomeowner, { jobId: kitchen.id, userId: hannah.id }),
      manager.create(JobHomeowner, { jobId: kitchen.id, userId: henry.id }),
      manager.create(JobHomeowner, { jobId: bathroom.id, userId: hugo.id }),
      manager.create(JobHomeowner, { jobId: basement.id, userId: hannah.id }),
    ]);

    await manager.save([
      manager.create(Message, {
        jobId: kitchen.id,
        authorId: carlos.id,
        body: 'Cabinets arrive Monday.',
      }),
      manager.create(Message, {
        jobId: kitchen.id,
        authorId: hannah.id,
        body: 'Great, we will clear the space.',
      }),
      manager.create(Message, {
        jobId: bathroom.id,
        authorId: diana.id,
        body: 'Tile samples are ready to review.',
      }),
    ]);

    // One set-based INSERT is far faster than 5,000 ORM saves. Timestamps are spread one
    // minute apart so ordering by created_at is meaningful.
    await manager.query(
      `INSERT INTO messages (job_id, author_id, body, created_at)
       SELECT $1, CASE WHEN i % 2 = 0 THEN $2::uuid ELSE $3::uuid END,
              'Progress update #' || i, now() - make_interval(mins => $4 - i)
       FROM generate_series(1, $4) AS i`,
      [basement.id, carlos.id, hannah.id, LARGE_JOB_MESSAGE_COUNT],
    );
  });

  console.log(`Seeded. Every user's password is "${SEED_PASSWORD}".`);
} finally {
  await dataSource.destroy();
}
