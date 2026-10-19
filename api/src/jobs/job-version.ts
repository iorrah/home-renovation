import { ConflictException } from '@nestjs/common';
import type { Job } from './job.entity.js';

/**
 * Optimistic concurrency: a client sends the version it last read. If the job has changed since,
 * its view is stale, and acting on it (an edit, an undo) could silently overwrite someone else's
 * change, so the request is refused and the client reloads.
 */
export function assertExpectedVersion(job: Job, expectedVersion: number | undefined): void {
  if (expectedVersion !== undefined && expectedVersion !== job.version) {
    throw new ConflictException(
      `The job changed since you loaded it (version ${expectedVersion}, now ${job.version}). Reload and try again.`,
    );
  }
}
