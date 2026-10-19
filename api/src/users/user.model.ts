import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { UserRole } from './user.entity.js';

registerEnumType(UserRole, { name: 'UserRole' });

/** The public face of a user in the API. Never exposes the password hash. */
@ObjectType('User')
export class UserModel {
  @Field(() => ID)
  id: string;

  @Field()
  username: string;

  @Field(() => UserRole)
  role: UserRole;
}
