import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { PubSubEngine } from 'graphql-subscriptions';
import { Repository } from 'typeorm';
import type { AuthUser } from '../auth/auth-user.js';
import type { Env } from '../config/env.js';
import { JobAccessService } from '../jobs/job-access.service.js';
import { jobMessagesChannel, PUB_SUB } from '../pubsub/pubsub.module.js';
import { Message } from './message.entity.js';
import type { MessageModel } from './message.model.js';

export const MAX_MESSAGE_PAGE = 200;

@Injectable()
export class MessagesService {
  private readonly redisPrefix: string;

  constructor(
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @Inject(PUB_SUB) private readonly pubSub: PubSubEngine,
    private readonly access: JobAccessService,
    config: ConfigService<Env, true>,
  ) {
    this.redisPrefix = config.get('REDIS_PREFIX', { infer: true });
  }

  /**
   * Any member of the job (its contractor or one of its homeowners) can post. The message is
   * saved first and published second, so the database stays the source of truth: a subscriber
   * never sees a message that was not stored, and one that missed the live event (offline,
   * reconnecting) gets it from the messages query with `after`.
   */
  async send(user: AuthUser, jobId: string, body: string): Promise<Message> {
    const job = await this.access.findViewable(user, jobId);
    const saved = await this.messages.save(
      this.messages.create({ jobId: job.id, authorId: user.id, body }),
    );
    const message = await this.messages.findOneOrFail({
      where: { id: saved.id },
      relations: { author: true },
    });

    const event: MessageModel = {
      id: message.id,
      jobId: message.jobId,
      body: message.body,
      createdAt: message.createdAt,
      author: {
        id: message.author.id,
        username: message.author.username,
        role: message.author.role,
      },
    };
    await this.pubSub.publish(jobMessagesChannel(this.redisPrefix, job.id), event);
    return message;
  }

  /**
   * Live feed of new messages on one job. Access is checked once, when the subscription starts.
   * Trade-off: a homeowner removed from the job keeps receiving until they reconnect.
   */
  async subscribe(user: AuthUser, jobId: string): Promise<AsyncIterableIterator<MessageModel>> {
    const job = await this.access.findViewable(user, jobId);
    return this.pubSub.asyncIterableIterator<MessageModel>(
      jobMessagesChannel(this.redisPrefix, job.id),
    );
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
