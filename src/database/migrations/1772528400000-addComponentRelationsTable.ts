import { MigrationInterface, QueryRunner } from 'typeorm';

export class addComponentRelationsTable1772528400000 implements MigrationInterface {
    name = 'addComponentRelationsTable1772528400000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("CREATE TABLE \"component_relations\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"component_id\" uuid NOT NULL, \"relation_type\" character varying NOT NULL, \"related_code\" character varying NOT NULL, \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT \"UQ_component_relations_component_type_code\" UNIQUE (\"component_id\", \"relation_type\", \"related_code\"), CONSTRAINT \"CHK_component_relations_type\" CHECK (\"relation_type\" IN ('co_requisite', 'equivalence')), CONSTRAINT \"PK_component_relations_id\" PRIMARY KEY (\"id\"))");
        await queryRunner.query("CREATE INDEX \"IDX_component_relations_component_id\" ON \"component_relations\" (\"component_id\")");
        await queryRunner.query("ALTER TABLE \"component_relations\" ADD CONSTRAINT \"FK_component_relations_component\" FOREIGN KEY (\"component_id\") REFERENCES \"components\"(\"id\") ON DELETE CASCADE ON UPDATE NO ACTION");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE \"component_relations\" DROP CONSTRAINT \"FK_component_relations_component\"");
        await queryRunner.query("DROP INDEX \"IDX_component_relations_component_id\"");
        await queryRunner.query("DROP TABLE \"component_relations\"");
    }
}
