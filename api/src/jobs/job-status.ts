import { BadRequestException } from '@nestjs/common';
import { JobStatus } from './job.entity.js';

/**
 * Which status a job may move to next. COMPLETED is final; a canceled job can be reopened into
 * planning. Undo (step 5) restores an earlier valid state, so it does not go through this check.
 */
const ALLOWED_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  [JobStatus.PLANNING]: [JobStatus.IN_PROGRESS, JobStatus.CANCELED],
  [JobStatus.IN_PROGRESS]: [JobStatus.PLANNING, JobStatus.COMPLETED, JobStatus.CANCELED],
  [JobStatus.COMPLETED]: [],
  [JobStatus.CANCELED]: [JobStatus.PLANNING],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertStatusTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException(`A job cannot move from ${from} to ${to}`);
  }
}
