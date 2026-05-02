import { MigrationInterface, QueryRunner } from 'typeorm';

export class addOfficialVersionToComponentLog1772324400000 implements MigrationInterface {
    name = 'addOfficialVersionToComponentLog1772324400000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "component_logs" ADD "version_code" character varying');
        await queryRunner.query('ALTER TABLE "component_logs" ADD "official_program" text');
        await queryRunner.query('ALTER TABLE "component_logs" ADD "official_syllabus" text');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "component_logs" DROP COLUMN "official_syllabus"');
        await queryRunner.query('ALTER TABLE "component_logs" DROP COLUMN "official_program"');
        await queryRunner.query('ALTER TABLE "component_logs" DROP COLUMN "version_code"');
    }
}
