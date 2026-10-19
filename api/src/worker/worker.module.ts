import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envSchema } from '../config/env.js';
import { DatabaseModule } from '../database/database.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { ReportPdfGenerator } from '../reports/pdf/report-pdf.generator.js';
import { ReportExport } from '../reports/report-export.entity.js';
import { ReportExportProcessor } from './report-export.processor.js';
import { StuckExportSweeper } from './stuck-export.sweeper.js';

/** Everything the worker process needs, and nothing HTTP or GraphQL related. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    DatabaseModule,
    QueueModule,
    TypeOrmModule.forFeature([ReportExport]),
  ],
  providers: [ReportPdfGenerator, ReportExportProcessor, StuckExportSweeper],
})
export class WorkerModule {}
