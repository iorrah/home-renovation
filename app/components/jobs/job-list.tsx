'use client';

import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useJobs } from '@/lib/jobs';
import { formatCents } from '@/lib/money';
import { useCurrentUser } from '@/lib/session';
import { StatusBadge } from './status-badge';

export function JobList() {
  const user = useCurrentUser();
  const jobs = useJobs();
  const isContractor = user.role === 'CONTRACTOR';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            {isContractor ? 'The jobs you run.' : 'The renovation jobs you are part of.'}
          </p>
        </div>
        {isContractor && (
          <Button asChild>
            <Link href="/jobs/new">
              <PlusIcon />
              New job
            </Link>
          </Button>
        )}
      </div>

      {jobs.isPending && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}
      {jobs.isError && <p className="text-destructive">{jobs.error.message}</p>}
      {jobs.data?.length === 0 && (
        <p className="text-muted-foreground">
          {isContractor
            ? 'No jobs yet. Create your first one.'
            : 'You have not been added to any job yet.'}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {jobs.data?.map((job) => (
          <Link key={job.id} href={`/jobs/${job.id}`} className="group">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-2">{job.description}</CardTitle>
                  <StatusBadge status={job.status} />
                </div>
                <CardDescription>{job.address}</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-between text-sm">
                <span className="font-medium">{formatCents(job.costCents)}</span>
                <span className="text-muted-foreground">
                  {isContractor
                    ? `${job.homeowners.length} homeowner${job.homeowners.length === 1 ? '' : 's'}`
                    : `Contractor: ${job.contractor.username}`}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
