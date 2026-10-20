'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { graphql } from './api';
import { JOB_FIELDS, jobKeys, useStoreJob, type Job } from './jobs';

export type JobChangeType =
  | 'CREATE'
  | 'UPDATE'
  | 'UNDO'
  | 'REDO'
  | 'HOMEOWNER_ADDED'
  | 'HOMEOWNER_REMOVED'
  | 'DELETE';

/** Only UPDATE entries have a state: whether that edit is in effect, undone, or can no longer be redone. */
export type JobChangeState = 'APPLIED' | 'UNDONE' | 'DISCARDED';

export type JobChange = {
  id: string;
  changeNumber: number;
  type: JobChangeType;
  state: JobChangeState | null;
  summary: string;
  responsibleUser: { username: string };
  createdAt: string;
};

export function useJobHistory(jobId: string) {
  return useQuery({
    queryKey: jobKeys.history(jobId),
    queryFn: async () =>
      (
        await graphql<{ jobHistory: JobChange[] }>(
          `
            query ($jobId: ID!) {
              jobHistory(jobId: $jobId) {
                id
                changeNumber
                type
                state
                summary
                createdAt
                responsibleUser {
                  username
                }
              }
            }
          `,
          { jobId },
        )
      ).jobHistory,
  });
}

/**
 * Undo or redo, sent with the job version on screen. If the job changed in the meantime, the
 * API refuses with CONFLICT rather than undoing something the user has not seen.
 */
function useHistoryAction(jobId: string, operation: 'undoJobChange' | 'redoJobChange') {
  const storeJob = useStoreJob();
  return useMutation({
    mutationFn: async (expectedVersion: number) =>
      (
        await graphql<Record<typeof operation, Job>>(
          `mutation ($jobId: ID!, $expectedVersion: Int) {
            ${operation}(jobId: $jobId, expectedVersion: $expectedVersion) { ${JOB_FIELDS} }
          }`,
          { jobId, expectedVersion },
        )
      )[operation],
    onSuccess: storeJob,
  });
}

export const useUndo = (jobId: string) => useHistoryAction(jobId, 'undoJobChange');
export const useRedo = (jobId: string) => useHistoryAction(jobId, 'redoJobChange');
