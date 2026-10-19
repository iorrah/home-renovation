import { BadRequestException } from '@nestjs/common';
import { JobStatus } from './job.entity.js';
import { assertStatusTransition, canTransition } from './job-status.js';

describe('job status transitions', () => {
  it.each([
    [JobStatus.PLANNING, JobStatus.IN_PROGRESS],
    [JobStatus.IN_PROGRESS, JobStatus.COMPLETED],
    [JobStatus.IN_PROGRESS, JobStatus.CANCELED],
    [JobStatus.CANCELED, JobStatus.PLANNING],
  ])('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    [JobStatus.PLANNING, JobStatus.COMPLETED],
    [JobStatus.COMPLETED, JobStatus.IN_PROGRESS],
    [JobStatus.CANCELED, JobStatus.COMPLETED],
  ])('rejects %s -> %s', (from, to) => {
    expect(() => assertStatusTransition(from, to)).toThrow(BadRequestException);
  });
});
