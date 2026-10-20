'use client';

import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateJob } from '@/lib/jobs';
import { useCurrentUser } from '@/lib/session';
import { JobForm } from './job-form';

export function NewJob() {
  const user = useCurrentUser();
  const router = useRouter();
  const createJob = useCreateJob();

  if (user.role !== 'CONTRACTOR') {
    return <p className="text-muted-foreground">Only contractors can create jobs.</p>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeftIcon className="size-4" /> All jobs
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>New job</CardTitle>
        </CardHeader>
        <CardContent>
          <JobForm
            submitLabel="Create job"
            pending={createJob.isPending}
            onSubmit={(values) =>
              createJob.mutate(values, {
                onSuccess: (job) => {
                  toast.success('Job created');
                  router.push(`/jobs/${job.id}`);
                },
                onError: (error) => toast.error(error.message),
              })
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
