import { JobChange } from '../history/job-change.entity.js';
import { JobHomeowner } from '../jobs/job-homeowner.entity.js';
import { Job } from '../jobs/job.entity.js';
import { Message } from '../messages/message.entity.js';
import { ReportExport } from '../reports/report-export.entity.js';
import { User } from '../users/user.entity.js';

// Listed explicitly: file globs break between src/ and dist/ under ESM.
export const entities = [User, Job, JobHomeowner, Message, JobChange, ReportExport];
