import { MigrationInterface, QueryRunner } from 'typeorm';

export class addUniqueApprovalAgreementNumber1778122800000 implements MigrationInterface {
    name = 'addUniqueApprovalAgreementNumber1778122800000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "component_logs"
            SET "agreement_number" = NULL
            WHERE BTRIM(COALESCE("agreement_number", '')) = ''
        `);

        const duplicatedAgreementNumbers = await queryRunner.query(`
            SELECT
                LOWER(BTRIM("agreement_number")) AS "normalizedAgreementNumber",
                COUNT(*)::int AS "total"
            FROM "component_logs"
            WHERE "type" = 'approval'
              AND "agreement_number" IS NOT NULL
              AND BTRIM("agreement_number") <> ''
            GROUP BY LOWER(BTRIM("agreement_number"))
            HAVING COUNT(*) > 1
            ORDER BY "total" DESC, "normalizedAgreementNumber" ASC
            LIMIT 10
        `) as Array<{ normalizedAgreementNumber: string; total: number }>;

        if (duplicatedAgreementNumbers.length > 0) {
            const summary = duplicatedAgreementNumbers
                .map((item) => `${item.normalizedAgreementNumber} (${item.total})`)
                .join(', ');

            throw new Error(
                `Não foi possível aplicar a unicidade do número de ATA. Existem duplicidades em logs de aprovação: ${summary}`
            );
        }

        await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_component_logs_approval_agreement_number_normalized"
            ON "component_logs" ((LOWER(BTRIM("agreement_number"))))
            WHERE "type" = 'approval'
              AND "agreement_number" IS NOT NULL
              AND BTRIM("agreement_number") <> ''
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX "UQ_component_logs_approval_agreement_number_normalized"');
    }
}
