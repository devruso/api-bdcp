import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class newComponentFields1650309500580 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns('components', [
            new TableColumn({
                name: 'modality',
                type: 'varchar',
                isNullable: true,
            }),
            new TableColumn({
                name: 'learningAssessment',
                type: 'varchar',
                isNullable: true,
            })
        ])
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumns('components', ['modality', 'learningAssessment'])
    }

}
