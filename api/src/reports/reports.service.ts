import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { In, Repository } from 'typeorm';
import type { AuthUser } from '../auth/auth-user.js';
import { isUniqueViolation } from '../database/errors.js';
import { JobAccessService } from '../jobs/job-access.service.js';
import {
  GENERATE_REPORT_TASK,
  REPORT_QUEUE_NAME,
  reportTaskOptions,
  type ReportExportTaskData,
} from '../queue/report-queue.js';
import { ReportExport, ReportExportStatus } from './report-export.entity.js';
import type { ReportExportModel } from './report-export.model.js';

const ACTIVE = [ReportExportStatus.QUEUED, ReportExportStatus.PROCESSING];

/**
 * The API side of report export. It never builds a PDF: it records the request, puts a task on
 * the queue and returns at once. The worker process does the slow part.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(ReportExport) private readonly exports: Repository<ReportExport>,
    @InjectQueue(REPORT_QUEUE_NAME) private readonly queue: Queue<ReportExportTaskData>,
    private readonly access: JobAccessService,
  ) {}

  /**
   * Idempotent: while an export for the job is still queued or processing, asking again returns
   * that export instead of starting a second one.
   *
   * Postgres and Redis cannot share a transaction, so the row is committed first and the task
   * added second. If adding the task fails, the row is marked FAILED rather than left QUEUED
   * forever; the worker's startup sweep re-adds rows left QUEUED by a crash between the two.
   */
  async requestReport(user: AuthUser, jobId: string): Promise<ReportExport> {
    const job = await this.access.findOwned(user, jobId);

    let reportExport: ReportExport;
    try {
      reportExport = await this.exports.save(
        this.exports.create({ jobId: job.id, requestedById: user.id }),
      );
    } catch (error) {
      // The partial unique index allows one active export per job; a concurrent request won.
      if (isUniqueViolation(error, 'report_exports_one_active_per_job')) {
        return this.exports.findOneByOrFail({ jobId: job.id, status: In(ACTIVE) });
      }
      throw error;
    }

    try {
      await this.enqueue(reportExport.id);
    } catch (error) {
      this.logger.error(`Could not enqueue export ${reportExport.id}`, error);
      reportExport.status = ReportExportStatus.FAILED;
      reportExport.error = 'Could not queue the report. Please try again.';
      await this.exports.save(reportExport);
    }
    return reportExport;
  }

  enqueue(exportId: string) {
    return this.queue.add(GENERATE_REPORT_TASK, { exportId }, reportTaskOptions(exportId));
  }

  /** The export, if the caller owns its job. Otherwise "not found", like jobs. */
  async findForOwner(user: AuthUser, exportId: string): Promise<ReportExport> {
    const reportExport = await this.exports.findOneBy({ id: exportId });
    if (!reportExport) throw new NotFoundException('Report export not found');
    await this.access.findOwned(user, reportExport.jobId).catch(() => {
      throw new NotFoundException('Report export not found');
    });
    return reportExport;
  }

  toModel(reportExport: ReportExport): ReportExportModel {
    return {
      id: reportExport.id,
      jobId: reportExport.jobId,
      status: reportExport.status,
      error: reportExport.error,
      createdAt: reportExport.createdAt,
      updatedAt: reportExport.updatedAt,
      // file_path stays internal; clients get the download route instead.
      downloadPath:
        reportExport.status === ReportExportStatus.DONE ? `/reports/${reportExport.id}/file` : null,
    };
  }
}
