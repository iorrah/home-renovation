import { Check, Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AppBaseEntity } from '../database/base.entity.js';
import { Job } from '../jobs/job.entity.js';
import { User } from '../users/user.entity.js';

export enum JobChangeType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  UNDO = 'UNDO',
  REDO = 'REDO',
  HOMEOWNER_ADDED = 'HOMEOWNER_ADDED',
  HOMEOWNER_REMOVED = 'HOMEOWNER_REMOVED',
  DELETE = 'DELETE',
}

/** Undo/redo position of an UPDATE. Null for every other change type. */
export enum JobChangeState {
  APPLIED = 'APPLIED',
  UNDONE = 'UNDONE',
  DISCARDED = 'DISCARDED',
}

/** One field's before and after value, e.g. { from: 1000, to: 1500 }. */
export type FieldChange = { from: unknown; to: unknown };
export type JobDiff = Record<string, FieldChange>;

@Entity({ name: 'job_changes' })
@Unique('job_changes_job_id_change_number_key', ['jobId', 'changeNumber'])
@Check('job_changes_state_only_for_updates', `("type" = 'UPDATE') = ("state" IS NOT NULL)`)
@Check(
  'job_changes_target_only_for_undo_redo',
  `("type" IN ('UNDO', 'REDO')) = ("target_change_id" IS NOT NULL)`,
)
export class JobChange extends AppBaseEntity {
  @Column({ name: 'job_id', type: 'uuid' })
  jobId: string;

  @ManyToOne(() => Job, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  /** Position of this change in the job's history: 1, 2, 3… with no gaps or repeats. */
  @Column({ name: 'change_number', type: 'integer' })
  changeNumber: number;

  /** The user who made this change. */
  @Column({ name: 'responsible_user_id', type: 'uuid' })
  responsibleUserId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'responsible_user_id' })
  responsibleUser: User;

  @Column({ type: 'enum', enum: JobChangeType, enumName: 'job_change_type' })
  type: JobChangeType;

  // No column default: TypeORM misreads jsonb defaults and reports schema drift on every run.
  @Column({ type: 'jsonb' })
  diff: JobDiff;

  @Column({ type: 'enum', enum: JobChangeState, enumName: 'job_change_state', nullable: true })
  state: JobChangeState | null;

  /** For UNDO and REDO: the UPDATE that was reversed or reapplied. */
  @Column({ name: 'target_change_id', type: 'uuid', nullable: true })
  targetChangeId: string | null;

  @ManyToOne(() => JobChange, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'target_change_id' })
  targetChange: JobChange | null;
}
