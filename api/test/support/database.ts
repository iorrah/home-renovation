import type { DataSource } from 'typeorm';
import { hashPassword } from '../../src/auth/password.js';
import { JobHomeowner } from '../../src/jobs/job-homeowner.entity.js';
import { Job, JobStatus } from '../../src/jobs/job.entity.js';
import { User, UserRole } from '../../src/users/user.entity.js';

/** Empties every table so each test file starts from a known state. */
export async function resetDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE report_exports, job_changes, messages, job_homeowners, jobs, users CASCADE',
  );
}

// Hashing is deliberately slow (~100 ms), so every test user shares one precomputed hash.
let sharedHash: Promise<string> | undefined;

export async function createUser(
  dataSource: DataSource,
  username: string,
  role: UserRole,
): Promise<User> {
  sharedHash ??= hashPassword('password123');
  const repo = dataSource.getRepository(User);
  return repo.save(repo.create({ username, role, passwordHash: await sharedHash }));
}

export async function createJob(
  dataSource: DataSource,
  contractor: User,
  homeowners: User[] = [],
  overrides: Partial<Job> = {},
): Promise<Job> {
  const job = await dataSource.getRepository(Job).save(
    dataSource.getRepository(Job).create({
      contractorId: contractor.id,
      description: 'Test job',
      address: '1 Test Street',
      status: JobStatus.PLANNING,
      costCents: 10_000,
      ...overrides,
    }),
  );
  for (const homeowner of homeowners) {
    await dataSource.getRepository(JobHomeowner).save({ jobId: job.id, userId: homeowner.id });
  }
  return job;
}
