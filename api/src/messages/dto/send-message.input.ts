import { Field, ID, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { trim } from '../../common/transforms.js';

@InputType()
export class SendMessageInput {
  @Field(() => ID)
  @IsUUID()
  jobId: string;

  @Field()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}
