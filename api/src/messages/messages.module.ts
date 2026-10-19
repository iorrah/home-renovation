import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobAccessModule } from '../jobs/job-access.module.js';
import { Message } from './message.entity.js';
import { MessagesResolver } from './messages.resolver.js';
import { MessagesService } from './messages.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Message]), JobAccessModule],
  providers: [MessagesService, MessagesResolver],
})
export class MessagesModule {}
