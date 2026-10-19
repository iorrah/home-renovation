import { computeJobDiff } from './job-diff.js';
import { Job, JobStatus } from './job.entity.js';

describe('computeJobDiff', () => {
  const job = Object.assign(new Job(), {
    description: 'Kitchen',
    address: '1 Main St',
    status: JobStatus.PLANNING,
    costCents: 1000,
  });

  it('records only fields whose value changes', () => {
    expect(computeJobDiff(job, { description: 'Kitchen', costCents: 1500 })).toEqual({
      costCents: { from: 1000, to: 1500 },
    });
  });

  it('is empty when nothing changes', () => {
    expect(computeJobDiff(job, { address: '1 Main St' })).toEqual({});
  });

  it('treats 0 as a real value, not as missing', () => {
    expect(computeJobDiff(job, { costCents: 0 })).toEqual({ costCents: { from: 1000, to: 0 } });
  });
});
