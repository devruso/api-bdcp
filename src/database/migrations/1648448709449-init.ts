import { MigrationInterface, QueryRunner } from "typeorm";

export class init1648448709449 implements MigrationInterface {
    name = 'init1648448709449'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "component_workloads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "teacher_theory" integer NOT NULL DEFAULT '0', "teacher_practice" integer NOT NULL DEFAULT '0', "teacher_theory_practice" integer NOT NULL DEFAULT '0', "teacher_internship" integer NOT NULL DEFAULT '0', "teacher_practice_internship" integer NOT NULL DEFAULT '0', "student_theory" integer NOT NULL DEFAULT '0', "student_practice" integer NOT NULL DEFAULT '0', "student_theory_practice" integer NOT NULL DEFAULT '0', "student_internship" integer NOT NULL DEFAULT '0', "student_practice_internship" integer NOT NULL DEFAULT '0', "module_theory" integer NOT NULL DEFAULT '0', "module_practice" integer NOT NULL DEFAULT '0', "module_theory_practice" integer NOT NULL DEFAULT '0', "module_internship" integer NOT NULL DEFAULT '0', "module_practice_internship" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_6b22dc5fc5d3afbf77b14834da0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "components" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "workload_id" uuid NOT NULL, "status" character varying NOT NULL, "code" character varying NOT NULL, "name" character varying NOT NULL, "department" integer NOT NULL, "type" character varying NOT NULL, "program" character varying NOT NULL, "semester" character varying NOT NULL, "prerequeriments" character varying NOT NULL, "methodology" character varying NOT NULL, "objective" character varying NOT NULL, "syllabus" character varying NOT NULL, "bibliography" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), CONSTRAINT "REL_0b1ca44a41a5f6aead9de582a6" UNIQUE ("workload_id"), CONSTRAINT "PK_0d742661c63926321b5f5eac1ad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "component_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "component_id" character varying NOT NULL, "updated_by" character varying, "agreement_number" character varying, "agreement_date" TIMESTAMP WITH TIME ZONE, "description" character varying NOT NULL, "type" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "componentId" uuid, "userId" uuid, CONSTRAINT "PK_99322145f32cfa1d11f40f16470" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "components" ADD CONSTRAINT "FK_66eac0e85fefda34b5b53dbc0d9" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "components" ADD CONSTRAINT "FK_0b1ca44a41a5f6aead9de582a6b" FOREIGN KEY ("workload_id") REFERENCES "component_workloads"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "component_logs" ADD CONSTRAINT "FK_140407b98b950fb9e9618ffaee0" FOREIGN KEY ("componentId") REFERENCES "components"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "component_logs" ADD CONSTRAINT "FK_7794ebe3a888bccd448dffad054" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "component_logs" DROP CONSTRAINT "FK_7794ebe3a888bccd448dffad054"`);
        await queryRunner.query(`ALTER TABLE "component_logs" DROP CONSTRAINT "FK_140407b98b950fb9e9618ffaee0"`);
        await queryRunner.query(`ALTER TABLE "components" DROP CONSTRAINT "FK_0b1ca44a41a5f6aead9de582a6b"`);
        await queryRunner.query(`ALTER TABLE "components" DROP CONSTRAINT "FK_66eac0e85fefda34b5b53dbc0d9"`);
        await queryRunner.query(`DROP TABLE "component_logs"`);
        await queryRunner.query(`DROP TABLE "components"`);
        await queryRunner.query(`DROP TABLE "component_workloads"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
