import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { AuthUser } from '../auth/auth-user.js';
import { User, UserRole } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import type { CreateJobInput } from './dto/create-job.input.js';
import type { UpdateJobInput } from './dto/update-job.input.js';
import { computeJobDiff, type JobChanges } from './job-diff.js';
import { JobAccessService } from './job-access.service.js';
import { JobHomeowner } from './job-homeowner.entity.js';
import { assertStatusTransition } from './job-status.js';
import { Job, JobStatus } from './job.entity.js';

@Injectable()
export class JobsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(JobHomeowner) private readonly members: Repository<JobHomeowner>,
    private readonly access: JobAccessService,
    private readonly users: UsersService,
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
        {
          userId: user.id,
        },
      );
    }
    return query.getMany();
  }

  findForUser(user: AuthUser, jobId: string): Promise<Job> {
    return this.access.findViewable(user, jobId);
  }

  create(user: AuthUser, input: CreateJobInput): Promise<Job> {
    return this.jobs.save(
      this.jobs.create({
        contractorId: user.id,
        description: input.description,
        address: input.address,
        costCents: input.costCents,
        status: input.status ?? JobStatus.PLANNING,
      }),
    );
  }

  /**
   * The only code path that changes a job's editable fields. It runs in one transaction with the
   * job row locked, so two edits of the same job queue up instead of overwriting each other.
   * Step 5 adds the history record inside this same transaction.
   */
  update(user: AuthUser, jobId: string, input: UpdateJobInput): Promise<Job> {
    return this.dataSource.transaction(async (manager) => {
      const job = await this.access.findOwned(user, jobId, { manager, lock: true });

      if (input.expectedVersion !== undefined && input.expectedVersion !== job.version) {
        throw new ConflictException(
          `The job changed since you loaded it (version ${input.expectedVersion}, now ${job.version}). Reload and try again.`,
        );
      }

      const changes: JobChanges = {
        description: input.description,
        address: input.address,
        status: input.status,
        costCents: input.costCents,
      };
      const diff = computeJobDiff(job, changes);
      if (Object.keys(diff).length === 0) return job;

      if (diff.status) assertStatusTransition(job.status, input.status!);

      for (const [field, change] of Object.entries(diff)) {
        Object.assign(job, { [field]: change.to });
      }
      return manager.save(job);
    });
  }

  /** Soft delete: the row stays, with deleted_at set, so its history and messages survive. */
  async remove(user: AuthUser, jobId: string): Promise<boolean> {
    const job = await this.access.findOwned(user, jobId);
    await this.jobs.softDelete(job.id);
    return true;
  }

  async addHomeowner(user: AuthUser, jobId: string, username: string): Promise<Job> {
    const job = await this.access.findOwned(user, jobId);
    const homeowner = await this.users.findByUsername(username);
    if (homeowner?.role !== UserRole.HOMEOWNER) {
      throw new BadRequestException(`No homeowner with username "${username}"`);
    }
    // Adding someone who is already on the job is a no-op, not an error.
    await this.members
      .createQueryBuilder()
      .insert()
      .values({ jobId: job.id, userId: homeowner.id })
      .orIgnore()
      .execute();
    return job;
  }

  async removeHomeowner(user: AuthUser, jobId: string, homeownerId: string): Promise<Job> {
    const job = await this.access.findOwned(user, jobId);
    await this.members.delete({ jobId: job.id, userId: homeownerId });
    return job;
  }

  homeownersOf(jobId: string): Promise<User[]> {
    return this.users.findHomeownersOfJob(jobId);
  }
}
