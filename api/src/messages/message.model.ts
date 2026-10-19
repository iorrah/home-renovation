import { Field, ID, ObjectType } from '@nestjs/graphql';
import { UserModel } from '../users/user.model.js';

@ObjectType('Message')
export class MessageModel {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  jobId: string;

  @Field()
  body: string;

  @Field(() => UserModel)
  author: UserModel;

  @Field()
  createdAt: Date;
}
