import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
// BullMQ calls queue items "jobs"; renamed here so "Job" only ever means a renovation job.
import type { Job as QueueTask } from 'bullmq';
import { Repository } from 'typeorm';
import type { Env } from '../config/env.js';
import { REPORT_QUEUE_NAME, type ReportExportTaskData } from '../queue/report-queue.js';
import { ReportPdfGenerator } from '../reports/pdf/report-pdf.generator.js';
import { ReportExport, ReportExportStatus } from '../reports/report-export.entity.js';
import { reportFileName, reportFilePath, reportsDir } from '../reports/reports-dir.js';

/**
 * Runs in the worker process only. BullMQ calls process() for each task taken off the queue;
 * if it throws, BullMQ retries with backoff (see reportTaskOptions) before giving up.
 */
@Processor(REPORT_QUEUE_NAME, { concurrency: 2 })
export class ReportExportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportExportProcessor.name);
  private readonly dir: string;

  constructor(
    @InjectRepository(ReportExport) private readonly exports: Repository<ReportExport>,
    private readonly generator: ReportPdfGenerator,
    config: ConfigService<Env, true>,
  ) {
    super();
    this.dir = reportsDir(config);
  }

  async process(task: QueueTask<ReportExportTaskData>): Promise<void> {
    const { exportId } = task.data;
    const reportExport = await this.exports.findOneBy({ id: exportId });
    // Already finished (e.g. a duplicate delivery after a crash): nothing to do.
    if (!reportExport || reportExport.status === ReportExportStatus.DONE) return;

    await this.exports.update(exportId, { status: ReportExportStatus.PROCESSING, error: null });
    const startedAt = Date.now();

    const fileName = reportFileName(exportId);
    await this.generator.generate(reportExport.jobId, reportFilePath(this.dir, fileName));

    await this.exports.update(exportId, { status: ReportExportStatus.DONE, filePath: fileName });
    this.logger.log(`Export ${exportId} done in ${Date.now() - startedAt} ms`);
  }

  /** After the last retry fails, record why, so the client stops polling and sees the error. */
  @OnWorkerEvent('failed')
  async onFailed(task: QueueTask<ReportExportTaskData> | undefined, error: Error): Promise<void> {
    if (!task) return;
    const attempts = task.opts.attempts ?? 1;
    this.logger.warn(
      `Export ${task.data.exportId} attempt ${task.attemptsMade}/${attempts}: ${error.message}`,
    );
    if (task.attemptsMade >= attempts) {
      await this.exports.update(task.data.exportId, {
        status: ReportExportStatus.FAILED,
        error: error.message,
      });
    }
  }
}
