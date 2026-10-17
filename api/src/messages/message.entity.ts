import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../database/base.entity.js';
import { Job } from '../jobs/job.entity.js';
import { User } from '../users/user.entity.js';

@Entity({ name: 'messages' })
@Check('messages_body_not_blank', `length(trim("body")) > 0`)
@Index('messages_job_id_created_at_idx', ['jobId', 'createdAt'])
export class Message extends AppBaseEntity {
  @Column({ name: 'job_id', type: 'uuid' })
  jobId: string;

  @ManyToOne(() => Job, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ type: 'text' })
  body: string;
}
