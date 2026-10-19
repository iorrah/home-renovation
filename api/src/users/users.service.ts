import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity.js';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  findByUsername(username: string): Promise<User | null> {
    return this.users.findOneBy({ username });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  findHomeownersOfJob(jobId: string): Promise<User[]> {
    return this.users
      .createQueryBuilder('user')
      .innerJoin('job_homeowners', 'member', 'member.user_id = user.id')
      .where('member.job_id = :jobId', { jobId })
      .orderBy('user.username')
      .getMany();
  }
}
