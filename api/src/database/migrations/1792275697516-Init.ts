import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1792275697516 implements MigrationInterface {
  name = 'Init1792275697516';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."user_role" AS ENUM('CONTRACTOR', 'HOMEOWNER')`);
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "username" text NOT NULL, "password_hash" text NOT NULL, "role" "public"."user_role" NOT NULL, CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."job_status" AS ENUM('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "jobs" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contractor_id" uuid NOT NULL, "description" text NOT NULL, "address" text NOT NULL, "status" "public"."job_status" NOT NULL DEFAULT 'PLANNING', "cost_cents" integer NOT NULL DEFAULT '0', "version" integer NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "jobs_cost_cents_non_negative" CHECK ("cost_cents" >= 0), CONSTRAINT "PK_cf0a6c42b72fcc7f7c237def345" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "jobs_contractor_id_idx" ON "jobs"  ("contractor_id") `);
    await queryRunner.query(
      `CREATE TYPE "public"."job_change_type" AS ENUM('CREATE', 'UPDATE', 'UNDO', 'REDO', 'HOMEOWNER_ADDED', 'HOMEOWNER_REMOVED', 'DELETE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."job_change_state" AS ENUM('APPLIED', 'UNDONE', 'DISCARDED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "job_changes" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "job_id" uuid NOT NULL, "change_number" integer NOT NULL, "responsible_user_id" uuid NOT NULL, "type" "public"."job_change_type" NOT NULL, "diff" jsonb NOT NULL, "state" "public"."job_change_state", "target_change_id" uuid, CONSTRAINT "job_changes_job_id_change_number_key" UNIQUE ("job_id", "change_number"), CONSTRAINT "job_changes_target_only_for_undo_redo" CHECK (("type" IN ('UNDO', 'REDO')) = ("target_change_id" IS NOT NULL)), CONSTRAINT "job_changes_state_only_for_updates" CHECK (("type" = 'UPDATE') = ("state" IS NOT NULL)), CONSTRAINT "PK_fb7661237a369bce02b56d163f4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "job_homeowners" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "job_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "job_homeowners_job_id_user_id_key" UNIQUE ("job_id", "user_id"), CONSTRAINT "PK_2923df637a954cb49fc9fcfb41f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "job_homeowners_user_id_idx" ON "job_homeowners"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "job_id" uuid NOT NULL, "author_id" uuid NOT NULL, "body" text NOT NULL, CONSTRAINT "messages_body_not_blank" CHECK (length(trim("body")) > 0), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "messages_job_id_created_at_idx" ON "messages"  ("job_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."report_export_status" AS ENUM('QUEUED', 'PROCESSING', 'DONE', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "report_exports" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "job_id" uuid NOT NULL, "requested_by" uuid NOT NULL, "status" "public"."report_export_status" NOT NULL DEFAULT 'QUEUED', "file_path" text, "error" text, CONSTRAINT "PK_831f34e4d6c47ec2bb42a614465" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "report_exports_one_active_per_job" ON "report_exports"  ("job_id") WHERE "status" IN ('QUEUED', 'PROCESSING')`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD CONSTRAINT "FK_43dbedf09c441744202dd946164" FOREIGN KEY ("contractor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_changes" ADD CONSTRAINT "FK_0176de6c5a6e562b051433ea731" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_changes" ADD CONSTRAINT "FK_2490f7dd567d65c1b32606efec3" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_changes" ADD CONSTRAINT "FK_017cf23fe110cffb87bf283f75a" FOREIGN KEY ("target_change_id") REFERENCES "job_changes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_homeowners" ADD CONSTRAINT "FK_3ad303ad0726b186b8b777983b4" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_homeowners" ADD CONSTRAINT "FK_b775b6c6576ff8af035c8aa41b3" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_51c763e3b2f56cf7265e569d3ab" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_05535bc695e9f7ee104616459d3" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_exports" ADD CONSTRAINT "FK_991cfc92abdee5cc8de34496534" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_exports" ADD CONSTRAINT "FK_a650cf168b56ac60fbebe8fc9be" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "report_exports" DROP CONSTRAINT "FK_a650cf168b56ac60fbebe8fc9be"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_exports" DROP CONSTRAINT "FK_991cfc92abdee5cc8de34496534"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_05535bc695e9f7ee104616459d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_51c763e3b2f56cf7265e569d3ab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_homeowners" DROP CONSTRAINT "FK_b775b6c6576ff8af035c8aa41b3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_homeowners" DROP CONSTRAINT "FK_3ad303ad0726b186b8b777983b4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_changes" DROP CONSTRAINT "FK_017cf23fe110cffb87bf283f75a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_changes" DROP CONSTRAINT "FK_2490f7dd567d65c1b32606efec3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_changes" DROP CONSTRAINT "FK_0176de6c5a6e562b051433ea731"`,
    );
    await queryRunner.query(`ALTER TABLE "jobs" DROP CONSTRAINT "FK_43dbedf09c441744202dd946164"`);
    await queryRunner.query(`DROP INDEX "public"."report_exports_one_active_per_job"`);
    await queryRunner.query(`DROP TABLE "report_exports"`);
    await queryRunner.query(`DROP TYPE "public"."report_export_status"`);
    await queryRunner.query(`DROP INDEX "public"."messages_job_id_created_at_idx"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP INDEX "public"."job_homeowners_user_id_idx"`);
    await queryRunner.query(`DROP TABLE "job_homeowners"`);
    await queryRunner.query(`DROP TABLE "job_changes"`);
    await queryRunner.query(`DROP TYPE "public"."job_change_state"`);
    await queryRunner.query(`DROP TYPE "public"."job_change_type"`);
    await queryRunner.query(`DROP INDEX "public"."jobs_contractor_id_idx"`);
    await queryRunner.query(`DROP TABLE "jobs"`);
    await queryRunner.query(`DROP TYPE "public"."job_status"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
  }
}
