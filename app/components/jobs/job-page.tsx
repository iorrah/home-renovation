'use client';

import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { useJob } from '@/lib/jobs';
import { useCurrentUser } from '@/lib/session';
import { ChatCard } from './chat-card';
import { HistoryCard } from './history-card';
import { HomeownersCard } from './homeowners-card';
import { JobDetailsCard } from './job-details-card';
import { ReportCard } from './report-card';
import { StatusBadge } from './status-badge';

/**
 * Two columns on wide screens: the job on the left, the conversation on the right, so the live
 * chat stays in view. On narrow screens they stack.
 */
export function JobPage({ jobId }: { jobId: string }) {
  const user = useCurrentUser();
  const job = useJob(jobId);
  // The API only lets the owning contractor change a job; this just hides controls that would fail.
  const canEdit = user.role === 'CONTRACTOR';

  if (job.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (job.isError) {
    const notFound = job.error instanceof ApiError && job.error.code === 'NOT_FOUND';
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {notFound ? 'Job not found' : 'Something went wrong'}
        </h1>
        <p className="text-muted-foreground">
          {notFound
            ? 'It may have been deleted, or you do not have access to it.'
            : job.error.message}
        </p>
        <BackLink />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackLink />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{job.data.description}</h1>
        <StatusBadge status={job.data.status} />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <JobDetailsCard job={job.data} canEdit={canEdit} />
          <HomeownersCard job={job.data} canEdit={canEdit} />
          {canEdit && <ReportCard jobId={job.data.id} />}
          <HistoryCard job={job.data} canEdit={canEdit} />
        </div>
        <ChatCard jobId={job.data.id} />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <ArrowLeftIcon className="size-4" /> All jobs
    </Link>
  );
}
