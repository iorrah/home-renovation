import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { REPORT_QUEUE_NAME } from './report-queue.js';

/** The Redis connection and the queue. Imported by both the API (adds tasks) and the worker. */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: { url: config.get('REDIS_URL', { infer: true }) },
        prefix: config.get('REDIS_PREFIX', { infer: true }),
      }),
    }),
    BullModule.registerQueue({ name: REPORT_QUEUE_NAME }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
