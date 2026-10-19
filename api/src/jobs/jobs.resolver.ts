import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/user.entity.js';
import { UserModel } from '../users/user.model.js';
import { UsersService } from '../users/users.service.js';
import { CreateJobInput } from './dto/create-job.input.js';
import { UpdateJobInput } from './dto/update-job.input.js';
import { Job } from './job.entity.js';
import { JobModel } from './job.model.js';
import { JobsService } from './jobs.service.js';

// Rejects malformed ids with a clear 400 before they reach Postgres, which would also reject them.
const uuid = new ParseUUIDPipe();

@Resolver(() => JobModel)
export class JobsResolver {
  constructor(
    private readonly jobsService: JobsService,
    private readonly users: UsersService,
  ) {}

  @Query(() => [JobModel], { description: 'Jobs you own (contractor) or belong to (homeowner).' })
  jobs(@CurrentUser() user: AuthUser): Promise<Job[]> {
    return this.jobsService.listForUser(user);
  }

  @Query(() => JobModel)
  job(
    @CurrentUser() user: AuthUser,
    @Args('id', { type: () => ID }, uuid) id: string,
  ): Promise<Job> {
    return this.jobsService.findForUser(user, id);
  }

  @Roles(UserRole.CONTRACTOR)
  @Mutation(() => JobModel)
  createJob(@CurrentUser() user: AuthUser, @Args('input') input: CreateJobInput): Promise<Job> {
    return this.jobsService.create(user, input);
  }

  @Roles(UserRole.CONTRACTOR)
  @Mutation(() => JobModel)
  updateJob(
    @CurrentUser() user: AuthUser,
    @Args('id', { type: () => ID }, uuid) id: string,
    @Args('input') input: UpdateJobInput,
  ): Promise<Job> {
    return this.jobsService.update(user, id, input);
  }

  @Roles(UserRole.CONTRACTOR)
  @Mutation(() => Boolean, { description: 'Soft delete: hides the job but keeps its history.' })
  deleteJob(
    @CurrentUser() user: AuthUser,
    @Args('id', { type: () => ID }, uuid) id: string,
  ): Promise<boolean> {
    return this.jobsService.remove(user, id);
  }

  @Roles(UserRole.CONTRACTOR)
  @Mutation(() => JobModel)
  addHomeowner(
    @CurrentUser() user: AuthUser,
    @Args('jobId', { type: () => ID }, uuid) jobId: string,
    @Args('username') username: string,
  ): Promise<Job> {
    return this.jobsService.addHomeowner(user, jobId, username);
  }

  @Roles(UserRole.CONTRACTOR)
  @Mutation(() => JobModel)
  removeHomeowner(
    @CurrentUser() user: AuthUser,
    @Args('jobId', { type: () => ID }, uuid) jobId: string,
    @Args('homeownerId', { type: () => ID }, uuid) homeownerId: string,
  ): Promise<Job> {
    return this.jobsService.removeHomeowner(user, jobId, homeownerId);
  }

  // Field resolvers run only when the client asks for the field. Each one is a query per job,
  // which is fine at this scale; a DataLoader would batch them for long lists.
  @ResolveField(() => UserModel)
  async contractor(@Parent() job: Job): Promise<UserModel> {
    const contractor = await this.users.findById(job.contractorId);
    if (!contractor) throw new NotFoundException('Contractor not found');
    return contractor;
  }

  @ResolveField(() => [UserModel])
  homeowners(@Parent() job: Job): Promise<UserModel[]> {
    return this.jobsService.homeownersOf(job.id);
  }
}
