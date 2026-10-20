'use client';

import { DownloadIcon, FileTextIcon, Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  downloadReport,
  useReportExport,
  useRequestReport,
  type ReportStatus,
} from '@/lib/reports';

const STATUS_TEXT: Record<Exclude<ReportStatus, 'DONE'>, string> = {
  QUEUED: 'Requesting report...',
  PROCESSING: 'Building the PDF…',
  FAILED: 'The report could not be built.',
};

function formatGeneratedAt(iso: string): string {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  const dateText = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

  return `Generated at ${time}, ${dateText}`;
}

/** Contractor only: builds the full job report (details, history, messages) as a PDF. */
export function ReportCard({ jobId }: { jobId: string }) {
  const [exportId, setExportId] = useState<string>();
  const requestReport = useRequestReport(jobId);
  const report = useReportExport(exportId);
  const [downloading, setDownloading] = useState(false);

  const status = report.data?.status;
  const working = requestReport.isPending || status === 'QUEUED' || status === 'PROCESSING';

  function start() {
    requestReport.mutate(undefined, {
      onSuccess: (reportExport) => setExportId(reportExport.id),
      onError: (error) => toast.error(error.message),
    });
  }

  async function download(path: string) {
    setDownloading(true);
    try {
      await downloadReport(path, `job-report-${jobId}.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileTextIcon className="size-5" /> Report
        </CardTitle>
        <CardDescription>
          Export a PDF with the job details, its full history and every message.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={start} disabled={working}>
          {working ? <Loader2Icon className="animate-spin" /> : <FileTextIcon />}
          {status === 'DONE' || status === 'FAILED' ? 'Generate again' : 'Generate PDF'}
        </Button>
        {status === 'DONE' && report.data?.downloadPath && (
          <Button onClick={() => download(report.data.downloadPath!)} disabled={downloading}>
            <DownloadIcon /> {downloading ? 'Downloading…' : 'Download PDF'}
          </Button>
        )}
        {status && (
          <p
            className={
              status === 'FAILED' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'
            }
          >
            {status === 'DONE' && report.data?.updatedAt
              ? formatGeneratedAt(report.data.updatedAt)
              : status !== 'DONE'
                ? STATUS_TEXT[status]
                : ''}
            {status === 'FAILED' && report.data?.error ? ` ${report.data.error}` : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
