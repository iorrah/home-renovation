import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { LessThan, Repository } from 'typeorm';
import {
  GENERATE_REPORT_TASK,
  REPORT_QUEUE_NAME,
  reportTaskOptions,
  type ReportExportTaskData,
} from '../queue/report-queue.js';
import { ReportExport, ReportExportStatus } from '../reports/report-export.entity.js';

const STUCK_AFTER_MS = 5 * 60 * 1000;

/**
 * Covers the gap between Postgres and Redis: if the API saved an export row but crashed before
 * adding its task, the row would stay QUEUED forever. On startup, the worker re-adds a task for
 * every export that has been QUEUED too long. Re-adding is safe: the task id is the export id,
 * so BullMQ ignores it when the task is already on the queue.
 *
 * Exports stuck in PROCESSING need no sweep: if a worker dies mid-task, BullMQ notices the task
 * stopped renewing its lock ("stalled") and hands it to another worker.
 */
@Injectable()
export class StuckExportSweeper implements OnApplicationBootstrap {
  private readonly logger = new Logger(StuckExportSweeper.name);

  constructor(
    @InjectRepository(ReportExport) private readonly exports: Repository<ReportExport>,
    @InjectQueue(REPORT_QUEUE_NAME) private readonly queue: Queue<ReportExportTaskData>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const stuck = await this.exports.findBy({
      status: ReportExportStatus.QUEUED,
      createdAt: LessThan(new Date(Date.now() - STUCK_AFTER_MS)),
    });
    for (const { id } of stuck) {
      await this.queue.add(GENERATE_REPORT_TASK, { exportId: id }, reportTaskOptions(id));
    }
    if (stuck.length) this.logger.log(`Re-queued ${stuck.length} stuck report export(s)`);
  }
}
