import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ReportExportStatus } from './report-export.entity.js';

registerEnumType(ReportExportStatus, { name: 'ReportExportStatus' });

@ObjectType('ReportExport')
export class ReportExportModel {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  jobId: string;

  @Field(() => ReportExportStatus)
  status: ReportExportStatus;

  @Field(() => String, { nullable: true, description: 'Why the export failed, when FAILED.' })
  error: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'When DONE: GET this path with your Authorization header to download the PDF.',
  })
  downloadPath: string | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
