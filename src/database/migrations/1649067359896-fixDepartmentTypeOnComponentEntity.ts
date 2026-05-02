import {MigrationInterface, QueryRunner} from "typeorm";

export class fixDepartmentTypeOnComponentEntity1649067359896 implements MigrationInterface {
    name = 'fixDepartmentTypeOnComponentEntity1649067359896'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "components" DROP COLUMN "type"`);
        await queryRunner.query(`ALTER TABLE "components" DROP CONSTRAINT "FK_0b1ca44a41a5f6aead9de582a6b"`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "workload_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "components" DROP COLUMN "department"`);
        await queryRunner.query(`ALTER TABLE "components" ADD "department" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "components" ADD CONSTRAINT "FK_0b1ca44a41a5f6aead9de582a6b" FOREIGN KEY ("workload_id") REFERENCES "component_workloads"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "components" DROP CONSTRAINT "FK_0b1ca44a41a5f6aead9de582a6b"`);
        await queryRunner.query(`ALTER TABLE "components" DROP COLUMN "department"`);
        await queryRunner.query(`ALTER TABLE "components" ADD "department" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "workload_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "components" ADD CONSTRAINT "FK_0b1ca44a41a5f6aead9de582a6b" FOREIGN KEY ("workload_id") REFERENCES "component_workloads"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "components" ADD "type" character varying NOT NULL`);
    }

}
