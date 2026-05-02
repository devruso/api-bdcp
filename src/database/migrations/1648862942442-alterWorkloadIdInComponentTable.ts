import {MigrationInterface, QueryRunner} from "typeorm";

export class alterWorkloadIdInComponentTable1648862942442 implements MigrationInterface {
    name = 'alterWorkloadIdInComponentTable1648862942442'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "workload_id" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "components" ALTER COLUMN "workload_id" SET NOT NULL`);
    }

}
