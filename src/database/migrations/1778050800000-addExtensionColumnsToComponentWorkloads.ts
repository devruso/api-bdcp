import { MigrationInterface, QueryRunner } from 'typeorm';

export class addExtensionColumnsToComponentWorkloads1778050800000 implements MigrationInterface {
    name = 'addExtensionColumnsToComponentWorkloads1778050800000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "component_workloads" ADD COLUMN IF NOT EXISTS "student_extension" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "component_workloads" ADD COLUMN IF NOT EXISTS "teacher_extension" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "component_workloads" ADD COLUMN IF NOT EXISTS "module_extension" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "component_workloads" DROP COLUMN IF EXISTS "module_extension"`);
        await queryRunner.query(`ALTER TABLE "component_workloads" DROP COLUMN IF EXISTS "teacher_extension"`);
        await queryRunner.query(`ALTER TABLE "component_workloads" DROP COLUMN IF EXISTS "student_extension"`);
    }
}
