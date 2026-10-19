'use client';

import { useQueryClient } from '@tanstack/react-query';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import {
  jobKeys,
  NEXT_STATUSES,
  useDeleteJob,
  useUpdateJob,
  type Job,
  type JobInput,
} from '@/lib/jobs';
import { formatCents } from '@/lib/money';
import { JobForm } from './job-form';
import { StatusBadge } from './status-badge';

export function JobDetailsCard({ job, canEdit }: { job: Job; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const updateJob = useUpdateJob(job.id);

  function save(values: Required<JobInput>) {
    // Send only what changed, with the version the form was based on.
    const changes = Object.fromEntries(
      Object.entries(values).filter(([field, value]) => job[field as keyof JobInput] !== value),
    );
    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }
    updateJob.mutate(
      { ...changes, expectedVersion: job.version },
      {
        onSuccess: () => {
          toast.success('Job updated');
          setEditing(false);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'CONFLICT') {
            toast.error('Someone else changed this job. Showing the latest version.');
            setEditing(false);
            // A prefix match: refetches the job and its history (['jobs', id, 'history']).
            void queryClient.invalidateQueries({ queryKey: jobKeys.detail(job.id) });
          } else {
            toast.error(error.message);
          }
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{editing ? 'Edit job' : 'Details'}</CardTitle>
        {canEdit && !editing && (
          <CardAction className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <PencilIcon /> Edit
            </Button>
            <DeleteJobButton jobId={job.id} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <JobForm
            initial={job}
            statusOptions={[job.status, ...NEXT_STATUSES[job.status]]}
            submitLabel="Save changes"
            pending={updateJob.isPending}
            onSubmit={save}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Detail label="Description" className="sm:col-span-2">
              {job.description}
            </Detail>
            <Detail label="Address" className="sm:col-span-2">
              {job.address}
            </Detail>
            <Detail label="Status">
              <StatusBadge status={job.status} />
            </Detail>
            <Detail label="Cost">{formatCents(job.costCents)}</Detail>
            <Detail label="Contractor">{job.contractor.username}</Detail>
            <Detail label="Last updated">
              {formatDateTime(job.updatedAt)} · version {job.version}
            </Detail>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function Detail({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  );
}

function DeleteJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const deleteJob = useDeleteJob(jobId);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive">
          <Trash2Icon /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this job?</AlertDialogTitle>
          <AlertDialogDescription>
            It disappears for you and its homeowners. Its history is kept, but you cannot undo a
            deletion.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep job</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() =>
              deleteJob.mutate(undefined, {
                onSuccess: () => {
                  toast.success('Job deleted');
                  router.push('/jobs');
                },
                onError: (error) => toast.error(error.message),
              })
            }
          >
            Delete job
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
