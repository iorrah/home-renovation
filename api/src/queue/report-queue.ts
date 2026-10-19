import type { JobsOptions } from 'bullmq';

// Naming rule: in this codebase "job" always means a renovation job. Work items on the queue are
// "tasks", even though BullMQ calls them jobs (that is why its option below is named jobId).
export const REPORT_QUEUE_NAME = 'report-exports';
export const GENERATE_REPORT_TASK = 'generate-report';

export type ReportExportTaskData = { exportId: string };

/** BullMQ task options for report generation. */
export function reportTaskOptions(exportId: string): JobsOptions {
  return {
    // Using our export id as the task id makes enqueueing idempotent: BullMQ ignores an add for
    // an id it already holds, so a retry or the startup sweep can never create a duplicate task.
    jobId: exportId,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 }, // waits 5s, then 10s
    // Postgres is the record of each export; Redis only needs to keep tasks briefly.
    removeOnComplete: { age: 24 * 3600 },
    removeOnFail: { age: 7 * 24 * 3600 },
  };
}
