import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { AuthUser } from '../auth/auth-user.js';
import { HistoryService } from '../history/history.service.js';
import { User, UserRole } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import type { CreateJobInput } from './dto/create-job.input.js';
import type { UpdateJobInput } from './dto/update-job.input.js';
import { computeJobDiff, type JobChanges } from './job-diff.js';
import { JobAccessService } from './job-access.service.js';
import { JobHomeowner } from './job-homeowner.entity.js';
import { assertStatusTransition } from './job-status.js';
import { assertExpectedVersion } from './job-version.js';
import { Job, JobStatus } from './job.entity.js';

/**
 * Every change to a job goes through here, and each one writes its history entry in the same
 * transaction as the change itself: either both are saved or neither is.
 */
@Injectable()
export class JobsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    private readonly access: JobAccessService,
    private readonly users: UsersService,
    private readonly history: HistoryService,
  ) {}

  /** Contractors see the jobs they own; homeowners see the jobs they were added to. */
  listForUser(user: AuthUser): Promise<Job[]> {
    const query = this.jobs.createQueryBuilder('job').orderBy('job.createdAt', 'DESC');
    if (user.role === UserRole.CONTRACTOR) {
      query.where('job.contractorId = :userId', { userId: user.id });
    } else {
      query.innerJoin(
        'job_homeowners',
        'member',
        'member.job_id = job.id AND member.user_id = :userId',
        { userId: user.id },
      );
    }
    return query.getMany();
  }

  findForUser(user: AuthUser, jobId: string): Promise<Job> {
    return this.access.findViewable(user, jobId);
  }

  create(user: AuthUser, input: CreateJobInput): Promise<Job> {
    return this.dataSource.transaction(async (manager) => {
      const job = await manager.save(
        manager.create(Job, {
          contractorId: user.id,
          description: input.description,
          address: input.address,
          costCents: input.costCents,
          status: input.status ?? JobStatus.PLANNING,
        }),
      );
      await this.history.recordCreate(manager, job, user.id);
      return job;
    });
  }

  /**
   * The only code path that edits a job's fields (undo and redo live in HistoryService). It runs
   * in one transaction with the job row locked, so two edits of the same job queue up instead
   * of overwriting each other.
   */
  update(user: AuthUser, jobId: string, input: UpdateJobInput): Promise<Job> {
    return this.dataSource.transaction(async (manager) => {
      const job = await this.access.findOwned(user, jobId, { manager, lock: true });
      assertExpectedVersion(job, input.expectedVersion);

      const changes: JobChanges = {
        description: input.description,
        address: input.address,
        status: input.status,
        costCents: input.costCents,
      };
      const diff = computeJobDiff(job, changes);
      if (Object.keys(diff).length === 0) return job; // nothing changed: no version bump, no history

      if (diff.status) assertStatusTransition(job.status, input.status!);

      for (const [field, change] of Object.entries(diff)) {
        Object.assign(job, { [field]: change.to });
      }
      const saved = await manager.save(job);
      await this.history.recordUpdate(manager, job.id, diff, user.id);
      return saved;
    });
  }

  /** Soft delete: the row stays, with deleted_at set, so its history and messages survive. */
  remove(user: AuthUser, jobId: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const job = await this.access.findOwned(user, jobId, { manager, lock: true });
      await manager.softDelete(Job, job.id);
      await this.history.recordDelete(manager, job.id, user.id);
      return true;
    });
  }

  addHomeowner(user: AuthUser, jobId: string, username: string): Promise<Job> {
    return this.dataSource.transaction(async (manager) => {
      const job = await this.access.findOwned(user, jobId, { manager, lock: true });
      const homeowner = await this.users.findByUsername(username);
      if (homeowner?.role !== UserRole.HOMEOWNER) {
        throw new BadRequestException(`No homeowner with username "${username}"`);
      }
      // Adding someone who is already on the job is a no-op: no error, and no history entry.
      const result = await manager
        .createQueryBuilder()
        .insert()
        .into(JobHomeowner)
        .values({ jobId: job.id, userId: homeowner.id })
        .orIgnore()
        .returning(['id'])
        .execute();
      if ((result.raw as unknown[]).length > 0) {
        await this.history.recordHomeownerAdded(manager, job.id, user.id, homeowner);
      }
      return job;
    });
  }

  removeHomeowner(user: AuthUser, jobId: string, homeownerId: string): Promise<Job> {
    return this.dataSource.transaction(async (manager) => {
      const job = await this.access.findOwned(user, jobId, { manager, lock: true });
      const homeowner = await this.users.findById(homeownerId);
      const result = await manager.delete(JobHomeowner, { jobId: job.id, userId: homeownerId });
      if (homeowner && result.affected) {
        await this.history.recordHomeownerRemoved(manager, job.id, user.id, homeowner);
      }
      return job;
    });
  }

  homeownersOf(jobId: string): Promise<User[]> {
    return this.users.findHomeownersOfJob(jobId);
  }
}
