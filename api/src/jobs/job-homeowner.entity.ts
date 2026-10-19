import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AppBaseEntity } from '../database/base.entity.js';
import { User } from '../users/user.entity.js';
import { Job } from './job.entity.js';

@Entity({ name: 'job_homeowners' })
@Unique('job_homeowners_job_id_user_id_key', ['jobId', 'userId'])
@Index('job_homeowners_user_id_idx', ['userId'])
export class JobHomeowner extends AppBaseEntity {
  @Column({ name: 'job_id', type: 'uuid' })
  jobId: string;

  @ManyToOne(() => Job, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
