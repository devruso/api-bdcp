import {MigrationInterface, QueryRunner} from "typeorm";

export class userAddColumnRoleAndActive1652465677648 implements MigrationInterface {
    name = 'userAddColumnRoleAndActive1652465677648'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "is_user_active" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "users" ADD "role" character varying NOT NULL DEFAULT 'teacher'`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "modality" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "learningAssessment" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "learningAssessment" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "modality" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_user_active"`);
    }

}
