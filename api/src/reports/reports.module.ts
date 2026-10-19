import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsModule } from '../jobs/jobs.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { ReportExport } from './report-export.entity.js';
import { ReportsController } from './reports.controller.js';
import { ReportsResolver } from './reports.resolver.js';
import { ReportsService } from './reports.service.js';

/** API side only. The processor lives in WorkerModule, so the API never generates PDFs. */
@Module({
  imports: [TypeOrmModule.forFeature([ReportExport]), JobsModule, QueueModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsResolver],
})
export class ReportsModule {}
