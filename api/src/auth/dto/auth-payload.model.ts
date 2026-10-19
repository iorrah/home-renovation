import { Field, ObjectType } from '@nestjs/graphql';
import { UserModel } from '../../users/user.model.js';

@ObjectType()
export class AuthPayload {
  @Field({ description: 'Send as "Authorization: Bearer <accessToken>".' })
  accessToken: string;

  @Field(() => UserModel)
  user: UserModel;
}
