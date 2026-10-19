'use client';

import { useQueryClient } from '@tanstack/react-query';
import { HistoryIcon, Redo2Icon, Undo2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useJobHistory, useRedo, useUndo, type JobChange, type JobChangeType } from '@/lib/history';
import { jobKeys, type Job } from '@/lib/jobs';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<JobChangeType, string> = {
  CREATE: 'Created',
  UPDATE: 'Edited',
  UNDO: 'Undo',
  REDO: 'Redo',
  HOMEOWNER_ADDED: 'Homeowner added',
  HOMEOWNER_REMOVED: 'Homeowner removed',
  DELETE: 'Deleted',
};

export function HistoryCard({ job, canEdit }: { job: Job; canEdit: boolean }) {
  const history = useJobHistory(job.id);
  const undo = useUndo(job.id);
  const redo = useRedo(job.id);
  const queryClient = useQueryClient();
  const busy = undo.isPending || redo.isPending;

  function run(action: typeof undo, done: string) {
    action.mutate(job.version, {
      onSuccess: () => toast.success(done),
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'CONFLICT') {
          toast.error('The job changed since you loaded it. Showing the latest version.');
          // A prefix match: refetches the job and its history (['jobs', id, 'history']).
          void queryClient.invalidateQueries({ queryKey: jobKeys.detail(job.id) });
        } else {
          toast.error(error.message);
        }
      },
    });
  }

  // The API lists oldest first; the newest change is the most useful one to see first.
  const changes = history.data ? [...history.data].reverse() : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <HistoryIcon className="size-5" /> History
        </CardTitle>
        <CardDescription>
          {canEdit
            ? 'Every change to this job. Undo and redo apply to edits.'
            : 'Every change to this job.'}
        </CardDescription>
        {canEdit && (
          <CardAction className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!job.canUndo || busy}
              onClick={() => run(undo, 'Last edit undone')}
            >
              <Undo2Icon /> Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!job.canRedo || busy}
              onClick={() => run(redo, 'Edit redone')}
            >
              <Redo2Icon /> Redo
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {history.isPending && <Skeleton className="h-24" />}
        {history.isError && <p className="text-sm text-destructive">{history.error.message}</p>}
        {history.data && (
          <ol className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {changes.map((change) => (
              <HistoryEntry key={change.id} change={change} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryEntry({ change }: { change: JobChange }) {
  // Undone and discarded edits stay in the log (it is an audit trail) but are no longer in effect.
  const inactive = change.state === 'UNDONE' || change.state === 'DISCARDED';

  return (
    <li className="rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">#{change.changeNumber}</span>
        <span className="font-medium">{TYPE_LABELS[change.type]}</span>
        {change.state === 'UNDONE' && <Badge variant="secondary">Undone</Badge>}
        {change.state === 'DISCARDED' && (
          <Badge
            variant="outline"
            title="Undone, then replaced by a newer edit, so it cannot be redone"
          >
            Discarded
          </Badge>
        )}
      </div>
      {change.summary && (
        <p className={cn('mt-1 break-words', inactive && 'text-muted-foreground line-through')}>
          {change.summary}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {change.responsibleUser.username} · {formatDateTime(change.createdAt)}
      </p>
    </li>
  );
}
