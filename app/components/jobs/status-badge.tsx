import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS, type JobStatus } from '@/lib/jobs';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<JobStatus, string> = {
  PLANNING: 'bg-secondary text-secondary-foreground',
  IN_PROGRESS: 'bg-primary text-primary-foreground',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELED: 'bg-destructive/10 text-destructive',
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return <Badge className={cn(STATUS_STYLES[status])}>{STATUS_LABELS[status]}</Badge>;
}
