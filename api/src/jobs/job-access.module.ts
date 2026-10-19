import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobAccessService } from './job-access.service.js';
import { Job } from './job.entity.js';

/**
 * Its own module so that history, messages and reports can check job access without importing
 * JobsModule, which itself depends on history (that would be a circular import).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Job])],
  providers: [JobAccessService],
  exports: [JobAccessService],
})
export class JobAccessModule {}
