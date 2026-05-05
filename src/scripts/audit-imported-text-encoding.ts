import 'reflect-metadata';
import { createConnection, getConnection, getConnectionOptions, getCustomRepository } from 'typeorm';

import { getTextCorruptionScore, repairLikelyUtf8Mojibake } from '../helpers/repairMojibake';
import { ComponentRepository } from '../repositories/ComponentRepository';
import { ComponentDraftRepository } from '../repositories/ComponentDraftRepository';
import { ComponentLogRepository } from '../repositories/ComponentLogRepository';
import { UserRepository } from '../repositories/UserRepository';

type AuditIssue = {
    id: string;
    field: string;
    score: number;
    preview: string;
    repairedPreview: string;
};

type AuditSectionReport = {
    entity: string;
    scannedRows: number;
    affectedRows: number;
    affectedFields: number;
    samples: AuditIssue[];
};

const MAX_SAMPLES_PER_ENTITY = 12;

function normalizePreview(value: string): string {
    return value.replace(/\s+/g, ' ').trim().slice(0, 140);
}

function inspectEntityRows<T extends Record<string, unknown>>(
    entityName: string,
    rows: T[],
    idField: keyof T,
    textFields: Array<keyof T>
): AuditSectionReport {
    const sampleIssues: AuditIssue[] = [];
    let affectedFields = 0;
    const affectedRowIds = new Set<string>();

    for (const row of rows) {
        const rowId = String(row[idField] || 'unknown');

        for (const field of textFields) {
            const rawValue = row[field];

            if (typeof rawValue !== 'string' || !rawValue.trim()) {
                continue;
            }

            const repairedValue = repairLikelyUtf8Mojibake(rawValue);

            if (repairedValue === rawValue) {
                continue;
            }

            const score = getTextCorruptionScore(rawValue);

            if (score <= 0) {
                continue;
            }

            affectedFields += 1;
            affectedRowIds.add(rowId);

            if (sampleIssues.length < MAX_SAMPLES_PER_ENTITY) {
                sampleIssues.push({
                    id: rowId,
                    field: String(field),
                    score,
                    preview: normalizePreview(rawValue),
                    repairedPreview: normalizePreview(repairedValue),
                });
            }
        }
    }

    return {
        entity: entityName,
        scannedRows: rows.length,
        affectedRows: affectedRowIds.size,
        affectedFields,
        samples: sampleIssues,
    };
}

async function main() {
    const options = await getConnectionOptions();
    const connection = await createConnection(options);

    try {
        const componentRepository = getCustomRepository(ComponentRepository);
        const componentDraftRepository = getCustomRepository(ComponentDraftRepository);
        const componentLogRepository = getCustomRepository(ComponentLogRepository);
        const userRepository = getCustomRepository(UserRepository);

        const [components, drafts, logs, users] = await Promise.all([
            componentRepository.find(),
            componentDraftRepository.find(),
            componentLogRepository.find(),
            userRepository.find(),
        ]);

        const reports: AuditSectionReport[] = [
            inspectEntityRows('components', components as unknown as Record<string, unknown>[], 'id', [
                'name',
                'department',
                'semester',
                'description',
                'objective',
                'syllabus',
                'bibliography',
                'prerequeriments',
                'methodology',
                'modality',
                'learningAssessment',
            ]),
            inspectEntityRows('component_drafts', drafts as unknown as Record<string, unknown>[], 'id', [
                'name',
                'department',
                'semester',
                'description',
                'objective',
                'syllabus',
                'bibliography',
                'prerequeriments',
                'methodology',
                'modality',
                'learningAssessment',
            ]),
            inspectEntityRows('component_logs', logs as unknown as Record<string, unknown>[], 'id', [
                'description',
                'agreementNumber',
                'versionCode',
                'officialProgram',
                'officialSyllabus',
            ]),
            inspectEntityRows('users', users as unknown as Record<string, unknown>[], 'id', [
                'name',
                'email',
            ]),
        ];

        const totals = reports.reduce(
            (acc, report) => {
                acc.scannedRows += report.scannedRows;
                acc.affectedRows += report.affectedRows;
                acc.affectedFields += report.affectedFields;
                return acc;
            },
            { scannedRows: 0, affectedRows: 0, affectedFields: 0 }
        );

        console.log(JSON.stringify({
            totals,
            reports,
        }, null, 2));
    } finally {
        await connection.close();
    }
}

main().catch(async (error) => {
    console.error(error);

    try {
        await getConnection().close();
    } catch {
        // noop
    }

    process.exit(1);
});