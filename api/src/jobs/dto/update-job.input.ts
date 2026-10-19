import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { trim } from '../../common/transforms.js';
import { JobStatus } from '../job.entity.js';

/** Every field is optional: only the fields sent are changed. */
@InputType()
export class UpdateJobInput {
  @Field({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address?: string;

  @Field(() => JobStatus, { nullable: true })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  costCents?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'The version you last read. If the job changed since, the update is rejected.',
  })
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
