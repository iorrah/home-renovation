'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from './api';
import type { User } from './types';

export type JobStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

export type Job = {
  id: string;
  description: string;
  address: string;
  status: JobStatus;
  costCents: number;
  version: number;
  canUndo: boolean;
  canRedo: boolean;
  contractor: Pick<User, 'id' | 'username'>;
  homeowners: Pick<User, 'id' | 'username'>[];
  createdAt: string;
  updatedAt: string;
};

export const STATUS_LABELS: Record<JobStatus, string> = {
  PLANNING: 'Planning',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
};

/**
 * Same rules as the API (api/src/jobs/job-status.ts), so the form only offers moves the server
 * will accept. The server still enforces them.
 */
export const NEXT_STATUSES: Record<JobStatus, JobStatus[]> = {
  PLANNING: ['IN_PROGRESS', 'CANCELED'],
  IN_PROGRESS: ['PLANNING', 'COMPLETED', 'CANCELED'],
  COMPLETED: [],
  CANCELED: ['PLANNING'],
};

export const JOB_FIELDS = `
  id description address status costCents version canUndo canRedo createdAt updatedAt
  contractor { id username }
  homeowners { id username }`;

export type JobInput = {
  description: string;
  address: string;
  costCents: number;
  status?: JobStatus;
};

/** Cache keys, in one place so mutations refresh the right queries. */
export const jobKeys = {
  all: ['jobs'] as const,
  detail: (id: string) => ['jobs', id] as const,
  history: (id: string) => ['jobs', id, 'history'] as const,
};

export function useJobs() {
  return useQuery({
    queryKey: jobKeys.all,
    queryFn: async () => (await graphql<{ jobs: Job[] }>(`{ jobs { ${JOB_FIELDS} } }`)).jobs,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: async () =>
      (await graphql<{ job: Job }>(`query ($id: ID!) { job(id: $id) { ${JOB_FIELDS} } }`, { id }))
        .job,
  });
}

/**
 * After a change, show the job the server returned, and refresh the list and the job's history
 * in the background (every change adds a history entry).
 */
export function useStoreJob() {
  const queryClient = useQueryClient();
  return (job: Job) => {
    queryClient.setQueryData(jobKeys.detail(job.id), job);
    void queryClient.invalidateQueries({ queryKey: jobKeys.all, exact: true });
    void queryClient.invalidateQueries({ queryKey: jobKeys.history(job.id), exact: true });
  };
}

export function useCreateJob() {
  const storeJob = useStoreJob();
  return useMutation({
    mutationFn: async (input: JobInput) =>
      (
        await graphql<{ createJob: Job }>(
          `mutation ($input: CreateJobInput!) { createJob(input: $input) { ${JOB_FIELDS} } }`,
          { input },
        )
      ).createJob,
    onSuccess: storeJob,
  });
}

/**
 * Sends only the fields that changed, plus the version the user was looking at. If someone
 * else changed the job in the meantime, the API answers CONFLICT instead of overwriting.
 */
export function useUpdateJob(id: string) {
  const storeJob = useStoreJob();
  return useMutation({
    mutationFn: async (input: Partial<JobInput> & { expectedVersion: number }) =>
      (
        await graphql<{ updateJob: Job }>(
          `mutation ($id: ID!, $input: UpdateJobInput!) { updateJob(id: $id, input: $input) { ${JOB_FIELDS} } }`,
          { id, input },
        )
      ).updateJob,
    onSuccess: storeJob,
  });
}

export function useDeleteJob(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      graphql<{ deleteJob: boolean }>('mutation ($id: ID!) { deleteJob(id: $id) }', { id }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: jobKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: jobKeys.all, exact: true });
    },
  });
}

export function useAddHomeowner(jobId: string) {
  const storeJob = useStoreJob();
  return useMutation({
    mutationFn: async (username: string) =>
      (
        await graphql<{ addHomeowner: Job }>(
          `mutation ($jobId: ID!, $username: String!) { addHomeowner(jobId: $jobId, username: $username) { ${JOB_FIELDS} } }`,
          { jobId, username },
        )
      ).addHomeowner,
    onSuccess: storeJob,
  });
}

export function useRemoveHomeowner(jobId: string) {
  const storeJob = useStoreJob();
  return useMutation({
    mutationFn: async (homeownerId: string) =>
      (
        await graphql<{ removeHomeowner: Job }>(
          `mutation ($jobId: ID!, $homeownerId: ID!) { removeHomeowner(jobId: $jobId, homeownerId: $homeownerId) { ${JOB_FIELDS} } }`,
          { jobId, homeownerId },
        )
      ).removeHomeowner,
    onSuccess: storeJob,
  });
}
