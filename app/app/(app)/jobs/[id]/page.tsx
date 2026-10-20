import { JobPage } from '@/components/jobs/job-page';

export default async function Page({ params }: PageProps<'/jobs/[id]'>) {
  const { id } = await params;
  return <JobPage jobId={id} />;
}
