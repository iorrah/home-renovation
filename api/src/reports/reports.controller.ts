import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { Env } from '../config/env.js';
import { UserRole } from '../users/user.entity.js';
import { ReportExportStatus } from './report-export.entity.js';
import { reportFilePath, reportsDir } from './reports-dir.js';
import { ReportsService } from './reports.service.js';

/**
 * The one REST route. Binary files do not fit GraphQL's JSON responses, so the PDF is streamed
 * over plain HTTP. The same global guards protect it as the GraphQL API.
 */
@Roles(UserRole.CONTRACTOR)
@Controller('reports')
export class ReportsController {
  private readonly dir: string;

  constructor(
    private readonly reportsService: ReportsService,
    config: ConfigService<Env, true>,
  ) {
    this.dir = reportsDir(config);
  }

  @Get(':exportId/file')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('exportId', new ParseUUIDPipe()) exportId: string,
  ): Promise<StreamableFile> {
    const reportExport = await this.reportsService.findForOwner(user, exportId);
    if (reportExport.status !== ReportExportStatus.DONE || !reportExport.filePath) {
      throw new NotFoundException('This report is not ready');
    }
    const path = reportFilePath(this.dir, reportExport.filePath);
    await access(path).catch(() => {
      throw new NotFoundException('The report file is no longer available');
    });

    return new StreamableFile(createReadStream(path), {
      type: 'application/pdf',
      disposition: `attachment; filename="job-report-${reportExport.jobId}.pdf"`,
    });
  }
}
