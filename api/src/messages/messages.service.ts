import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthUser } from '../auth/auth-user.js';
import { JobAccessService } from '../jobs/job-access.service.js';
import { Message } from './message.entity.js';

export const MAX_MESSAGE_PAGE = 200;

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    private readonly access: JobAccessService,
  ) {}

  /** Any member of the job (its contractor or one of its homeowners) can post. */
  async send(user: AuthUser, jobId: string, body: string): Promise<Message> {
    const job = await this.access.findViewable(user, jobId);
    const saved = await this.messages.save(
      this.messages.create({ jobId: job.id, authorId: user.id, body }),
    );
    return this.messages.findOneOrFail({ where: { id: saved.id }, relations: { author: true } });
  }

  /**
   * Oldest first. With `after` (a message id), returns the messages that came after it, which is
   * how a client catches up after reconnecting. Without it, returns the most recent page.
   *
   * Paging uses the (created_at, id) position of the cursor message rather than OFFSET, so it
   * stays fast on long conversations and never skips or repeats a message.
   */
  async list(user: AuthUser, jobId: string, options: { after?: string; limit: number }) {
    const job = await this.access.findViewable(user, jobId);
    const limit = Math.min(Math.max(options.limit, 1), MAX_MESSAGE_PAGE);

    const query = this.messages
      .createQueryBuilder('message')
      .innerJoinAndSelect('message.author', 'author')
      .where('message.jobId = :jobId', { jobId: job.id })
      // limit, not take: the join is many-to-one, so it cannot multiply rows.
      .limit(limit);

    if (options.after) {
      return query
        .andWhere(
          '(message.created_at, message.id) > (SELECT created_at, id FROM messages WHERE id = :after)',
          { after: options.after },
        )
        .orderBy('message.createdAt', 'ASC')
        .addOrderBy('message.id', 'ASC')
        .getMany();
    }

    const latest = await query
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .getMany();
    return latest.reverse();
  }
}
