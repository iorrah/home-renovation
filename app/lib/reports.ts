'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, graphql } from './api';
import { API_URL } from './config';
import { getSession } from './session';

export type ReportStatus = 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';

export type ReportExport = {
  id: string;
  status: ReportStatus;
  error: string | null;
  downloadPath: string | null;
  updatedAt: string;
};

const REPORT_FIELDS = 'id status error downloadPath updatedAt';
const FINISHED: ReportStatus[] = ['DONE', 'FAILED'];

/**
 * Asks the API to build the PDF. It answers at once with a QUEUED export; a background worker
 * does the slow part. Asking again while one is running returns the same export.
 */
export function useRequestReport(jobId: string) {
  return useMutation({
    mutationFn: async () =>
      (
        await graphql<{ requestReport: ReportExport }>(
          `mutation ($jobId: ID!) { requestReport(jobId: $jobId) { ${REPORT_FIELDS} } }`,
          { jobId },
        )
      ).requestReport,
  });
}

/** Polls the export's status every second until the worker reports DONE or FAILED. */
export function useReportExport(exportId: string | undefined) {
  return useQuery({
    queryKey: ['reportExports', exportId],
    enabled: !!exportId,
    queryFn: async () =>
      (
        await graphql<{ reportExport: ReportExport }>(
          `query ($id: ID!) { reportExport(id: $id) { ${REPORT_FIELDS} } }`,
          { id: exportId },
        )
      ).reportExport,
    refetchInterval: (query) =>
      query.state.data && FINISHED.includes(query.state.data.status) ? false : 1000,
  });
}

/**
 * The PDF comes from a plain REST route that needs the Authorization header, so a normal link
 * cannot fetch it. Fetch it as a file, then hand it to the browser as a download. The file is
 * named here: the API's Content-Disposition header is not readable from another origin.
 */
export async function downloadReport(downloadPath: string, fileName: string): Promise<void> {
  const session = getSession();
  const response = await fetch(`${API_URL}${downloadPath}`, {
    headers: session ? { Authorization: `Bearer ${session.accessToken}` } : {},
  });
  if (!response.ok)
    throw new ApiError('The report could not be downloaded.', String(response.status));

  const url = URL.createObjectURL(await response.blob());
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  link.click();
  URL.revokeObjectURL(url);
}
