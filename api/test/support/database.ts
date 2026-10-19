import type { DataSource } from 'typeorm';
import { hashPassword } from '../../src/auth/password.js';
import { User, UserRole } from '../../src/users/user.entity.js';

/** Empties every table so each test file starts from a known state. */
export async function resetDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE report_exports, job_changes, messages, job_homeowners, jobs, users CASCADE',
  );
}

export async function createUser(
  dataSource: DataSource,
  username: string,
  role: UserRole,
  password = 'password123',
): Promise<User> {
  const repo = dataSource.getRepository(User);
  return repo.save(repo.create({ username, role, passwordHash: await hashPassword(password) }));
}
