import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import type { AuthUser } from '../auth/auth-user.js';
import { JobAccessService } from '../jobs/job-access.service.js';
import { EDITABLE_JOB_FIELDS, type EditableJobField } from '../jobs/job-diff.js';
import { assertExpectedVersion } from '../jobs/job-version.js';
import type { Job } from '../jobs/job.entity.js';
import type { User } from '../users/user.entity.js';
import { JobChange, JobChangeState, JobChangeType, type JobDiff } from './job-change.entity.js';

type NewChange = {
  jobId: string;
  responsibleUserId: string;
  type: JobChangeType;
  diff: JobDiff;
  state?: JobChangeState | null;
  targetChangeId?: string | null;
};

/**
 * The history log of every job, and undo/redo on top of it.
 *
 * Model: `jobs` holds the current state; `job_changes` is an append-only log of what changed,
 * numbered 1, 2, 3... per job. Each UPDATE row stores only the fields it changed, as
 * { field: { from, to } }. Undo applies the `from` values; redo applies the `to` values.
 *
 * UPDATE rows also carry an undo state, which works like an editor's undo/redo stacks:
 *   APPLIED   - in effect. The newest APPLIED update is the next one undo reverses.
 *   UNDONE    - reversed. The oldest UNDONE update is the next one redo reapplies.
 *   DISCARDED - was UNDONE when a new edit was made, so it can no longer be redone.
 * Because a new edit discards every UNDONE row, APPLIED rows always come before UNDONE ones in
 * change-number order. Nothing is ever deleted, so the log is a complete audit trail.
 *
 * Every write runs inside a transaction that holds a lock on the job's row (SELECT ... FOR
 * UPDATE). That makes edits, undos and redos of one job happen strictly one at a time, which is
 * also what makes "next change number = current max + 1" safe.
 */
@Injectable()
export class HistoryService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(JobChange) private readonly changes: Repository<JobChange>,
    private readonly access: JobAccessService,
  ) {}

  // ---------------------------------------------------------------------------------------------
  // Recording. Called by JobsService inside its transaction, after it has locked the job row.
  // ---------------------------------------------------------------------------------------------

  recordCreate(manager: EntityManager, job: Job, userId: string): Promise<JobChange> {
    const diff: JobDiff = {};
    for (const field of EDITABLE_JOB_FIELDS) diff[field] = { from: null, to: job[field] };
    return this.insert(manager, {
      jobId: job.id,
      responsibleUserId: userId,
      type: JobChangeType.CREATE,
      diff,
    });
  }

  async recordUpdate(
    manager: EntityManager,
    jobId: string,
    diff: JobDiff,
    userId: string,
  ): Promise<JobChange> {
    // A new edit starts a new line of history: whatever was undone can no longer be redone,
    // exactly like typing after pressing undo in an editor.
    await manager.update(
      JobChange,
      { jobId, state: JobChangeState.UNDONE },
      { state: JobChangeState.DISCARDED },
    );
    return this.insert(manager, {
      jobId,
      responsibleUserId: userId,
      type: JobChangeType.UPDATE,
      diff,
      state: JobChangeState.APPLIED,
    });
  }

  recordHomeownerAdded(manager: EntityManager, jobId: string, userId: string, homeowner: User) {
    const diff = { homeowner: { from: null, to: homeowner.username } };
    return this.insert(manager, {
      jobId,
      responsibleUserId: userId,
      type: JobChangeType.HOMEOWNER_ADDED,
      diff,
    });
  }

  recordHomeownerRemoved(manager: EntityManager, jobId: string, userId: string, homeowner: User) {
    const diff = { homeowner: { from: homeowner.username, to: null } };
    return this.insert(manager, {
      jobId,
      responsibleUserId: userId,
      type: JobChangeType.HOMEOWNER_REMOVED,
      diff,
    });
  }

  recordDelete(manager: EntityManager, jobId: string, userId: string) {
    return this.insert(manager, {
      jobId,
      responsibleUserId: userId,
      type: JobChangeType.DELETE,
      diff: {},
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Undo and redo. Only the job's contractor; never on a deleted job (findOwned hides those).
  // ---------------------------------------------------------------------------------------------

  /** Reverses the most recent update that is still in effect. */
  undo(user: AuthUser, jobId: string, expectedVersion?: number): Promise<Job> {
    return this.dataSource.transaction(async (manager) => {
      const job = await this.access.findOwned(user, jobId, { manager, lock: true });
      assertExpectedVersion(job, expectedVersion);

      const target = await manager.findOne(JobChange, {
        where: { jobId, type: JobChangeType.UPDATE, state: JobChangeState.APPLIED },
        order: { changeNumber: 'DESC' },
      });
      if (!target) throw new BadRequestException('Nothing to undo');

      // The job must still look exactly as this update left it. If not, something changed it
      // outside this log, and blindly writing the old values back would destroy that change.
      this.assertFieldsMatch(job, target.diff, 'to');
      this.applyValues(job, target.diff, 'from');
      const saved = await manager.save(job); // also bumps job.version

      target.state = JobChangeState.UNDONE;
      await manager.save(target);
      await this.insert(manager, {
        jobId,
        responsibleUserId: user.id,
        type: JobChangeType.UNDO,
        diff: this.reverse(target.diff), // reads as what actually happened: cost $150 -> $100
        targetChangeId: target.id,
      });
      return saved;
    });
  }

  /**
   * Reapplies the update that was undone most recently. Undo walks backwards (#5, then #4), so
   * the most recently undone update is the UNDONE one with the lowest change number (#4).
   */
  redo(user: AuthUser, jobId: string, expectedVersion?: number): Promise<Job> {
    return this.dataSource.transaction(async (manager) => {
      const job = await this.access.findOwned(user, jobId, { manager, lock: true });
      assertExpectedVersion(job, expectedVersion);

      const target = await manager.findOne(JobChange, {
        where: { jobId, type: JobChangeType.UPDATE, state: JobChangeState.UNDONE },
        order: { changeNumber: 'ASC' },
      });
      if (!target) throw new BadRequestException('Nothing to redo');

      this.assertFieldsMatch(job, target.diff, 'from');
      this.applyValues(job, target.diff, 'to');
      const saved = await manager.save(job);

      target.state = JobChangeState.APPLIED;
      await manager.save(target);
      await this.insert(manager, {
        jobId,
        responsibleUserId: user.id,
        type: JobChangeType.REDO,
        diff: target.diff,
        targetChangeId: target.id,
      });
      return saved;
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Reading. Any member of the job; homeowners get read-only access to the same log.
  // ---------------------------------------------------------------------------------------------

  async list(user: AuthUser, jobId: string): Promise<JobChange[]> {
    const job = await this.access.findViewable(user, jobId);
    return this.changes.find({
      where: { jobId: job.id },
      relations: { responsibleUser: true },
      order: { changeNumber: 'ASC' },
    });
  }

  canUndo(jobId: string): Promise<boolean> {
    return this.changes.existsBy({
      jobId,
      type: JobChangeType.UPDATE,
      state: JobChangeState.APPLIED,
    });
  }

  canRedo(jobId: string): Promise<boolean> {
    return this.changes.existsBy({
      jobId,
      type: JobChangeType.UPDATE,
      state: JobChangeState.UNDONE,
    });
  }

  // ---------------------------------------------------------------------------------------------

  /**
   * Appends one row with the job's next change number. The caller's lock on the job row
   * guarantees no one else is numbering this job's changes at the same moment; the unique
   * (job_id, change_number) constraint makes the transaction fail loudly if that is ever wrong.
   */
  private async insert(manager: EntityManager, change: NewChange): Promise<JobChange> {
    const [{ next }] = await manager.query<{ next: number }[]>(
      'SELECT COALESCE(MAX(change_number), 0) + 1 AS next FROM job_changes WHERE job_id = $1',
      [change.jobId],
    );
    return manager.save(manager.create(JobChange, { ...change, changeNumber: next }));
  }

  private assertFieldsMatch(job: Job, diff: JobDiff, side: 'from' | 'to'): void {
    for (const [field, values] of Object.entries(diff)) {
      if (job[field as EditableJobField] !== values[side]) {
        throw new ConflictException(
          `Cannot ${side === 'to' ? 'undo' : 'redo'}: the job's ${field} no longer matches its history.`,
        );
      }
    }
  }

  private applyValues(job: Job, diff: JobDiff, side: 'from' | 'to'): void {
    for (const [field, values] of Object.entries(diff)) {
      // Undo restores an earlier valid state, so it deliberately skips the status workflow rules.
      Object.assign(job, { [field as EditableJobField]: values[side] });
    }
  }

  private reverse(diff: JobDiff): JobDiff {
    return Object.fromEntries(
      Object.entries(diff).map(([field, { from, to }]) => [field, { from: to, to: from }]),
    );
  }
}
