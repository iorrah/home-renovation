import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { UserModel } from '../users/user.model.js';
import { JobChangeState, JobChangeType } from './job-change.entity.js';

registerEnumType(JobChangeType, { name: 'JobChangeType' });
registerEnumType(JobChangeState, {
  name: 'JobChangeState',
  description: 'Undo/redo position of an UPDATE: APPLIED, UNDONE or DISCARDED.',
});

@ObjectType('FieldChange', { description: 'One field before and after, formatted for display.' })
export class FieldChangeModel {
  @Field({ description: 'description, address, status, costCents or homeowner' })
  field: string;

  @Field(() => String, { nullable: true })
  from: string | null;

  @Field(() => String, { nullable: true })
  to: string | null;
}

@ObjectType('JobChange')
export class JobChangeModel {
  @Field(() => ID)
  id: string;

  @Field(() => Int, { description: "Position in the job's history: 1, 2, 3..." })
  changeNumber: number;

  @Field(() => JobChangeType)
  type: JobChangeType;

  @Field(() => JobChangeState, { nullable: true })
  state: JobChangeState | null;

  @Field(() => [FieldChangeModel])
  changes: FieldChangeModel[];

  @Field({ description: 'e.g. "cost: $100.00 -> $150.00; status: PLANNING -> IN_PROGRESS"' })
  summary: string;

  @Field(() => UserModel, { description: 'The user who made this change.' })
  responsibleUser: UserModel;

  @Field(() => ID, { nullable: true, description: 'For UNDO and REDO: the update they acted on.' })
  targetChangeId: string | null;

  @Field()
  createdAt: Date;
}
