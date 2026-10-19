import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { UserModel } from '../users/user.model.js';
import { JobStatus } from './job.entity.js';

registerEnumType(JobStatus, { name: 'JobStatus' });

@ObjectType('Job')
export class JobModel {
  @Field(() => ID)
  id: string;

  @Field()
  description: string;

  @Field({ description: 'Street address of the renovation.' })
  address: string;

  @Field(() => JobStatus)
  status: JobStatus;

  @Field(() => Int, { description: 'Cost in cents, e.g. 150000 for $1,500.00.' })
  costCents: number;

  @Field(() => Int, { description: 'Increases on every change. Send it back as expectedVersion.' })
  version: number;

  @Field(() => UserModel)
  contractor: UserModel;

  @Field(() => [UserModel])
  homeowners: UserModel[];

  @Field({ description: 'Whether undoJobChange has an edit to reverse.' })
  canUndo: boolean;

  @Field({ description: 'Whether redoJobChange has an undone edit to reapply.' })
  canRedo: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
