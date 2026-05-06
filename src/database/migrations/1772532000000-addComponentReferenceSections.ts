import { MigrationInterface, QueryRunner } from 'typeorm';

export class addComponentReferenceSections1772532000000 implements MigrationInterface {
    name = 'addComponentReferenceSections1772532000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "components" ADD COLUMN "referencesBasic" character varying NOT NULL DEFAULT \'\'');
        await queryRunner.query('ALTER TABLE "components" ADD COLUMN "referencesComplementary" character varying NOT NULL DEFAULT \'\'');
        await queryRunner.query('ALTER TABLE "component_drafts" ADD COLUMN "referencesBasic" character varying NOT NULL DEFAULT \'\'');
        await queryRunner.query('ALTER TABLE "component_drafts" ADD COLUMN "referencesComplementary" character varying NOT NULL DEFAULT \'\'');

        await queryRunner.query('UPDATE "components" SET "referencesBasic" = COALESCE("bibliography", \'\') WHERE COALESCE("referencesBasic", \'\') = \'\'');
        await queryRunner.query('UPDATE "component_drafts" SET "referencesBasic" = COALESCE("bibliography", \'\') WHERE COALESCE("referencesBasic", \'\') = \'\'');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "component_drafts" DROP COLUMN "referencesComplementary"');
        await queryRunner.query('ALTER TABLE "component_drafts" DROP COLUMN "referencesBasic"');
        await queryRunner.query('ALTER TABLE "components" DROP COLUMN "referencesComplementary"');
        await queryRunner.query('ALTER TABLE "components" DROP COLUMN "referencesBasic"');
    }
}
