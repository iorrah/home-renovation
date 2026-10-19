import { ParseUUIDPipe } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { Job } from '../jobs/job.entity.js';
import { JobModel } from '../jobs/job.model.js';
import { UserRole } from '../users/user.entity.js';
import { HistoryService } from './history.service.js';
import { JobChangeModel } from './job-change.model.js';
import { toJobChangeModel } from './job-change.presenter.js';

const uuid = new ParseUUIDPipe();
const VERSION_HELP =
  'The job version you last read. Rejected with CONFLICT if the job changed since.';

@Resolver(() => JobChangeModel)
export class HistoryResolver {
  constructor(private readonly historyService: HistoryService) {}

  @Query(() => [JobChangeModel], {
    description: 'Every change to the job, oldest first. Contractor and homeowners can read it.',
  })
  async jobHistory(
    @CurrentUser() user: AuthUser,
    @Args('jobId', { type: () => ID }, uuid) jobId: string,
  ): Promise<JobChangeModel[]> {
    return (await this.historyService.list(user, jobId)).map(toJobChangeModel);
  }

  @Roles(UserRole.CONTRACTOR)
  @Mutation(() => JobModel, { description: 'Reverses the most recent edit still in effect.' })
  undoJobChange(
    @CurrentUser() user: AuthUser,
    @Args('jobId', { type: () => ID }, uuid) jobId: string,
    @Args('expectedVersion', { type: () => Int, nullable: true, description: VERSION_HELP })
    expectedVersion?: number,
  ): Promise<Job> {
    return this.historyService.undo(user, jobId, expectedVersion ?? undefined);
  }

  @Roles(UserRole.CONTRACTOR)
  @Mutation(() => JobModel, { description: 'Reapplies the edit undone most recently.' })
  redoJobChange(
    @CurrentUser() user: AuthUser,
    @Args('jobId', { type: () => ID }, uuid) jobId: string,
    @Args('expectedVersion', { type: () => Int, nullable: true, description: VERSION_HELP })
    expectedVersion?: number,
  ): Promise<Job> {
    return this.historyService.redo(user, jobId, expectedVersion ?? undefined);
  }
}
