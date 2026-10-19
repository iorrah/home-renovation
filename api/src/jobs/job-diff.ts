import type { JobDiff } from '../history/job-change.entity.js';
import type { Job } from './job.entity.js';

/** The job fields a contractor can edit, and that history records and undo can restore. */
export const EDITABLE_JOB_FIELDS = ['description', 'address', 'status', 'costCents'] as const;
export type EditableJobField = (typeof EDITABLE_JOB_FIELDS)[number];
export type JobChanges = Partial<Pick<Job, EditableJobField>>;

/** Only the fields whose value actually changes. An empty result means the edit is a no-op. */
export function computeJobDiff(job: Job, changes: JobChanges): JobDiff {
  const diff: JobDiff = {};
  for (const field of EDITABLE_JOB_FIELDS) {
    const to = changes[field];
    if (to !== undefined && to !== job[field]) {
      diff[field] = { from: job[field], to };
    }
  }
  return diff;
}
