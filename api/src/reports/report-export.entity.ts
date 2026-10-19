import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppUpdatableEntity } from '../database/base.entity.js';
import { Job } from '../jobs/job.entity.js';
import { User } from '../users/user.entity.js';

export enum ReportExportStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

@Entity({ name: 'report_exports' })
// At most one unfinished export per job, enforced by the database so double clicks cannot race.
@Index('report_exports_one_active_per_job', ['jobId'], {
  unique: true,
  where: `"status" IN ('QUEUED', 'PROCESSING')`,
})
export class ReportExport extends AppUpdatableEntity {
  @Column({ name: 'job_id', type: 'uuid' })
  jobId: string;

  @ManyToOne(() => Job, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requested_by' })
  requestedBy: User;

  @Column({
    type: 'enum',
    enum: ReportExportStatus,
    enumName: 'report_export_status',
    default: ReportExportStatus.QUEUED,
  })
  status: ReportExportStatus;

  @Column({ name: 'file_path', type: 'text', nullable: true })
  filePath: string | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;
}
