import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type { AuthUser } from '../auth/auth-user.js';
import { UserRole } from '../users/user.entity.js';
import { Job } from './job.entity.js';

/**
 * The one place that decides who can see or change a job. Guards only know the caller's role;
 * this checks the relationship to the specific job.
 *
 * Both methods throw "not found" rather than "forbidden" when access is denied, so a caller
 * cannot tell a job they may not see apart from one that does not exist.
 */
@Injectable()
export class JobAccessService {
  constructor(@InjectRepository(Job) private readonly jobs: Repository<Job>) {}

  /** The job's contractor, or a homeowner on the job. Soft-deleted jobs are invisible. */
  async findViewable(user: AuthUser, jobId: string): Promise<Job> {
    const query = this.jobs.createQueryBuilder('job').where('job.id = :jobId', { jobId });
    if (user.role === UserRole.CONTRACTOR) {
      query.andWhere('job.contractorId = :userId', { userId: user.id });
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
    const job = await query.getOne();
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  /**
   * Only the contractor who owns the job. Pass a transaction's manager and `lock: true` to hold
   * a row lock until that transaction ends, which serializes concurrent edits of one job.
   */
  async findOwned(
    user: AuthUser,
    jobId: string,
    options: { manager?: EntityManager; lock?: boolean } = {},
  ): Promise<Job> {
    const manager = options.manager ?? this.jobs.manager;
    const job =
      user.role === UserRole.CONTRACTOR
        ? await manager.findOne(Job, {
            where: { id: jobId, contractorId: user.id },
            lock: options.lock ? { mode: 'pessimistic_write' } : undefined,
          })
        : null;
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }
}
