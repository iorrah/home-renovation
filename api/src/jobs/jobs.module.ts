import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistoryModule } from '../history/history.module.js';
import { UsersModule } from '../users/users.module.js';
import { JobAccessModule } from './job-access.module.js';
import { Job } from './job.entity.js';
import { JobsResolver } from './jobs.resolver.js';
import { JobsService } from './jobs.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Job]), UsersModule, JobAccessModule, HistoryModule],
  providers: [JobsService, JobsResolver],
  exports: [JobsService],
})
export class JobsModule {}
