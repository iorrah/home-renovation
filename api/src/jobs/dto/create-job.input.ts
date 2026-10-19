import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { trim } from '../../common/transforms.js';
import { JobStatus } from '../job.entity.js';

@InputType()
export class CreateJobInput {
  @Field()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @Field()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @Field(() => Int, { defaultValue: 0 })
  @IsInt()
  @Min(0)
  costCents: number;

  @Field(() => JobStatus, { nullable: true })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;
}
