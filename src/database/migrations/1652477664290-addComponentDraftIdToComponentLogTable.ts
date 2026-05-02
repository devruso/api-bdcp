import {MigrationInterface, QueryRunner} from "typeorm";

export class addComponentDraftIdToComponentLogTable1652477664290 implements MigrationInterface {
    name = 'addComponentDraftIdToComponentLogTable1652477664290'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "component_logs" ADD "component_draft_id" uuid`);
        await queryRunner.query(`ALTER TABLE "component_logs" ALTER COLUMN "component_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "component_logs" ADD CONSTRAINT "FK_242b46d870b1c6ebd5887e468ee" FOREIGN KEY ("component_draft_id") REFERENCES "component_drafts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "component_logs" DROP CONSTRAINT "FK_242b46d870b1c6ebd5887e468ee"`);
        await queryRunner.query(`ALTER TABLE "component_logs" ALTER COLUMN "component_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "component_logs" DROP COLUMN "component_draft_id"`);
    }

}
