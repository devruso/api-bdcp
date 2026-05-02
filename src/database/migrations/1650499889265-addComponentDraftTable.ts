import {MigrationInterface, QueryRunner} from "typeorm";

export class addComponentDraftTable1650499889265 implements MigrationInterface {
    name = 'addComponentDraftTable1650499889265'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "component_drafts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_by" uuid NOT NULL, "workload_id" uuid, "code" character varying NOT NULL DEFAULT '', "name" character varying NOT NULL DEFAULT '', "department" character varying NOT NULL DEFAULT '', "modality" character varying NOT NULL DEFAULT '', "program" character varying NOT NULL DEFAULT '', "semester" character varying NOT NULL DEFAULT '', "prerequeriments" character varying NOT NULL DEFAULT '', "methodology" character varying NOT NULL DEFAULT '', "objective" character varying NOT NULL DEFAULT '', "syllabus" character varying NOT NULL DEFAULT '', "learningAssessment" character varying NOT NULL DEFAULT '', "bibliography" character varying NOT NULL DEFAULT '', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), CONSTRAINT "REL_d67562e0144765b0c9b2b55570" UNIQUE ("workload_id"), CONSTRAINT "PK_ed9d7b7a98302a71818770f67a3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "component_drafts" ADD CONSTRAINT "FK_8943af425c65f08185c0e3ba5ce" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "component_drafts" ADD CONSTRAINT "FK_d67562e0144765b0c9b2b555707" FOREIGN KEY ("workload_id") REFERENCES "component_workloads"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "component_drafts" DROP CONSTRAINT "FK_d67562e0144765b0c9b2b555707"`);
        await queryRunner.query(`ALTER TABLE "component_drafts" DROP CONSTRAINT "FK_8943af425c65f08185c0e3ba5ce"`);
        await queryRunner.query(`DROP TABLE "component_drafts"`);
    }

}
