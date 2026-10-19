import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module.js';
import { JobAccessService } from './job-access.service.js';
import { JobHomeowner } from './job-homeowner.entity.js';
import { Job } from './job.entity.js';
import { JobsResolver } from './jobs.resolver.js';
import { JobsService } from './jobs.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Job, JobHomeowner]), UsersModule],
  providers: [JobAccessService, JobsService, JobsResolver],
  exports: [JobAccessService],
})
export class JobsModule {}
