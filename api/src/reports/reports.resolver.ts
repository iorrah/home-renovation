import { ParseUUIDPipe } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/user.entity.js';
import { ReportExportModel } from './report-export.model.js';
import { ReportsService } from './reports.service.js';

const uuid = new ParseUUIDPipe();

@Roles(UserRole.CONTRACTOR)
@Resolver(() => ReportExportModel)
export class ReportsResolver {
  constructor(private readonly reportsService: ReportsService) {}

  @Mutation(() => ReportExportModel, {
    description: 'Starts building a PDF report in the background. Poll reportExport for status.',
  })
  async requestReport(
    @CurrentUser() user: AuthUser,
    @Args('jobId', { type: () => ID }, uuid) jobId: string,
  ): Promise<ReportExportModel> {
    return this.reportsService.toModel(await this.reportsService.requestReport(user, jobId));
  }

  @Query(() => ReportExportModel)
  async reportExport(
    @CurrentUser() user: AuthUser,
    @Args('id', { type: () => ID }, uuid) id: string,
  ): Promise<ReportExportModel> {
    return this.reportsService.toModel(await this.reportsService.findForOwner(user, id));
  }
}
