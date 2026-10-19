import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobAccessModule } from '../jobs/job-access.module.js';
import { HistoryResolver } from './history.resolver.js';
import { HistoryService } from './history.service.js';
import { JobChange } from './job-change.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([JobChange]), JobAccessModule],
  providers: [HistoryService, HistoryResolver],
  exports: [HistoryService],
})
export class HistoryModule {}
