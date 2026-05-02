import {MigrationInterface, QueryRunner} from "typeorm";

export class uniqueCodeComponentDraft1650670423640 implements MigrationInterface {
    name = 'uniqueCodeComponentDraft1650670423640'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "component_drafts" ADD "component_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "component_drafts" ADD CONSTRAINT "UQ_fe3255bad3346aae2bf24c237e2" UNIQUE ("component_id")`);
        await queryRunner.query(`ALTER TABLE "components" ADD "component_draft_id" uuid`);
        await queryRunner.query(`ALTER TABLE "components" ADD CONSTRAINT "UQ_b38729f93c8d543f831c6477836" UNIQUE ("component_draft_id")`);        
        await queryRunner.query(`ALTER TABLE "component_drafts" ADD CONSTRAINT "UQ_da89611353529039e2ae6520174" UNIQUE ("code")`);
        await queryRunner.query(`ALTER TABLE "component_drafts" ALTER COLUMN "code" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "component_drafts" ADD CONSTRAINT "FK_fe3255bad3346aae2bf24c237e2" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "components" ADD CONSTRAINT "FK_b38729f93c8d543f831c6477836" FOREIGN KEY ("component_draft_id") REFERENCES "component_drafts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "name" SET DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "department" SET DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "modality" SET DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "program" SET DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "semester" SET DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "prerequeriments" SET DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "methodology" SET DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "objective" SET DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "syllabus" SET DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "learningAssessment" SET DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "bibliography" SET DEFAULT ''`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "bibliography" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "learningAssessment" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "syllabus" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "objective" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "methodology" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "prerequeriments" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "semester" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "program" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "modality" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "department" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "name" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "components" DROP CONSTRAINT "FK_b38729f93c8d543f831c6477836"`);
        await queryRunner.query(`ALTER TABLE "component_drafts" DROP CONSTRAINT "FK_fe3255bad3346aae2bf24c237e2"`);
        await queryRunner.query(`ALTER TABLE "component_drafts" ALTER COLUMN "code" SET DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "component_drafts" DROP CONSTRAINT "UQ_da89611353529039e2ae6520174"`);
        await queryRunner.query(`ALTER TABLE "components" DROP CONSTRAINT "UQ_b38729f93c8d543f831c6477836"`);
        await queryRunner.query(`ALTER TABLE "components" DROP COLUMN "component_draft_id"`);
        await queryRunner.query(`ALTER TABLE "component_drafts" DROP CONSTRAINT "UQ_fe3255bad3346aae2bf24c237e2"`);
        await queryRunner.query(`ALTER TABLE "component_drafts" DROP COLUMN "component_id"`);
    }

}
