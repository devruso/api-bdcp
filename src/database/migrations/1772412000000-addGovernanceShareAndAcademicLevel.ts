import { MigrationInterface, QueryRunner } from 'typeorm';

export class addGovernanceShareAndAcademicLevel1772412000000 implements MigrationInterface {
    name = 'addGovernanceShareAndAcademicLevel1772412000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE \"users\" ADD \"signature_hash\" character varying");
        await queryRunner.query("ALTER TABLE \"users\" ADD \"signature_updated_at\" TIMESTAMP WITH TIME ZONE");

        await queryRunner.query("ALTER TABLE \"components\" ADD \"academic_level\" character varying NOT NULL DEFAULT 'graduacao'");
        await queryRunner.query("ALTER TABLE \"component_drafts\" ADD \"academic_level\" character varying NOT NULL DEFAULT 'graduacao'");

        await queryRunner.query("CREATE TABLE \"component_public_shares\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"component_id\" uuid NOT NULL, \"created_by\" uuid NOT NULL, \"token\" character varying NOT NULL, \"expires_at\" TIMESTAMP WITH TIME ZONE NOT NULL, \"revoked_at\" TIMESTAMP WITH TIME ZONE, \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT \"UQ_component_public_shares_token\" UNIQUE (\"token\"), CONSTRAINT \"PK_component_public_shares_id\" PRIMARY KEY (\"id\"))");
        await queryRunner.query("ALTER TABLE \"component_public_shares\" ADD CONSTRAINT \"FK_component_public_shares_component\" FOREIGN KEY (\"component_id\") REFERENCES \"components\"(\"id\") ON DELETE CASCADE ON UPDATE NO ACTION");
        await queryRunner.query("ALTER TABLE \"component_public_shares\" ADD CONSTRAINT \"FK_component_public_shares_user\" FOREIGN KEY (\"created_by\") REFERENCES \"users\"(\"id\") ON DELETE CASCADE ON UPDATE NO ACTION");

        await queryRunner.query("UPDATE \"users\" SET \"role\" = 'super_admin' WHERE LOWER(\"email\") IN ('fdurao@ufba', 'fdurao@ufba.br')");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("UPDATE \"users\" SET \"role\" = 'admin' WHERE LOWER(\"email\") IN ('fdurao@ufba', 'fdurao@ufba.br') AND \"role\" = 'super_admin'");

        await queryRunner.query("ALTER TABLE \"component_public_shares\" DROP CONSTRAINT \"FK_component_public_shares_user\"");
        await queryRunner.query("ALTER TABLE \"component_public_shares\" DROP CONSTRAINT \"FK_component_public_shares_component\"");
        await queryRunner.query("DROP TABLE \"component_public_shares\"");

        await queryRunner.query("ALTER TABLE \"component_drafts\" DROP COLUMN \"academic_level\"");
        await queryRunner.query("ALTER TABLE \"components\" DROP COLUMN \"academic_level\"");

        await queryRunner.query("ALTER TABLE \"users\" DROP COLUMN \"signature_updated_at\"");
        await queryRunner.query("ALTER TABLE \"users\" DROP COLUMN \"signature_hash\"");
    }
}
