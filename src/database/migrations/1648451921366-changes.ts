import {MigrationInterface, QueryRunner} from "typeorm";

export class changes1648451921366 implements MigrationInterface {
    name = 'changes1648451921366'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "component_logs" DROP CONSTRAINT "FK_140407b98b950fb9e9618ffaee0"`);
        await queryRunner.query(`ALTER TABLE "component_logs" DROP CONSTRAINT "FK_7794ebe3a888bccd448dffad054"`);
        await queryRunner.query(`ALTER TABLE "components" DROP CONSTRAINT "FK_66eac0e85fefda34b5b53dbc0d9"`);
        await queryRunner.query(`ALTER TABLE "components" RENAME COLUMN "user_id" TO "created_by"`);
        await queryRunner.query(`ALTER TABLE "component_logs" DROP COLUMN "componentId"`);
        await queryRunner.query(`ALTER TABLE "component_logs" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "component_logs" DROP COLUMN "component_id"`);
        await queryRunner.query(`ALTER TABLE "component_logs" ADD "component_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "component_logs" DROP COLUMN "updated_by"`);
        await queryRunner.query(`ALTER TABLE "component_logs" ADD "updated_by" uuid`);
        await queryRunner.query(`ALTER TABLE "component_logs" ALTER COLUMN "description" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "component_logs" ADD CONSTRAINT "FK_814bba35e0bbfa447f97dc5ac17" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "component_logs" ADD CONSTRAINT "FK_29ff82d098439f52a59acebaac5" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "components" ADD CONSTRAINT "FK_c3aee5bfd6d9c32e77fbdc17a46" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "components" DROP CONSTRAINT "FK_c3aee5bfd6d9c32e77fbdc17a46"`);
        await queryRunner.query(`ALTER TABLE "component_logs" DROP CONSTRAINT "FK_29ff82d098439f52a59acebaac5"`);
        await queryRunner.query(`ALTER TABLE "component_logs" DROP CONSTRAINT "FK_814bba35e0bbfa447f97dc5ac17"`);
        await queryRunner.query(`ALTER TABLE "component_logs" ALTER COLUMN "description" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "component_logs" DROP COLUMN "updated_by"`);
        await queryRunner.query(`ALTER TABLE "component_logs" ADD "updated_by" character varying`);
        await queryRunner.query(`ALTER TABLE "component_logs" DROP COLUMN "component_id"`);
        await queryRunner.query(`ALTER TABLE "component_logs" ADD "component_id" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "component_logs" ADD "userId" uuid`);
        await queryRunner.query(`ALTER TABLE "component_logs" ADD "componentId" uuid`);
        await queryRunner.query(`ALTER TABLE "components" RENAME COLUMN "created_by" TO "user_id"`);
        await queryRunner.query(`ALTER TABLE "components" ADD CONSTRAINT "FK_66eac0e85fefda34b5b53dbc0d9" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "component_logs" ADD CONSTRAINT "FK_7794ebe3a888bccd448dffad054" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "component_logs" ADD CONSTRAINT "FK_140407b98b950fb9e9618ffaee0" FOREIGN KEY ("componentId") REFERENCES "components"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
