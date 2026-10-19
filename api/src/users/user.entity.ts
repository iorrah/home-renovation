import { Column, Entity } from 'typeorm';
import { AppBaseEntity } from '../database/base.entity.js';

export enum UserRole {
  CONTRACTOR = 'CONTRACTOR',
  HOMEOWNER = 'HOMEOWNER',
}

@Entity({ name: 'users' })
export class User extends AppBaseEntity {
  @Column({ type: 'text', unique: true })
  username: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role' })
  role: UserRole;
}
