import {
  Check,
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  VersionColumn,
} from 'typeorm';
import { AppUpdatableEntity } from '../database/base.entity.js';
import { User } from '../users/user.entity.js';

export enum JobStatus {
  PLANNING = 'PLANNING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
}

@Entity({ name: 'jobs' })
@Check('jobs_cost_cents_non_negative', '"cost_cents" >= 0')
@Index('jobs_contractor_id_idx', ['contractorId'])
export class Job extends AppUpdatableEntity {
  @Column({ name: 'contractor_id', type: 'uuid' })
  contractorId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'contractor_id' })
  contractor: User;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'enum', enum: JobStatus, enumName: 'job_status', default: JobStatus.PLANNING })
  status: JobStatus;

  // Integer cents: floats cannot represent money exactly (0.1 + 0.2 !== 0.3).
  @Column({ name: 'cost_cents', type: 'integer', default: 0 })
  costCents: number;

  // Incremented on every save; lets clients detect that they are editing a stale copy.
  @VersionColumn({ type: 'integer' })
  version: number;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
