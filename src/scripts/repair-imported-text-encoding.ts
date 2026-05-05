import 'reflect-metadata';
import { createConnection, getConnection, getConnectionOptions, getCustomRepository } from 'typeorm';

import { Component } from '../entities/Component';
import { ComponentDraft } from '../entities/ComponentDraft';
import { ComponentRepository } from '../repositories/ComponentRepository';
import { ComponentDraftRepository } from '../repositories/ComponentDraftRepository';
import { repairLikelyUtf8Mojibake } from '../helpers/repairMojibake';

const TEXT_FIELDS = [
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
] as const;

type TextFieldName = typeof TEXT_FIELDS[number];
type RepairableEntity = Record<TextFieldName, string | null | undefined>;

function repairEntityFields<T extends RepairableEntity>(entity: T): { changed: boolean; entity: T } {
    let changed = false;

    for (const field of TEXT_FIELDS) {
        const currentValue = entity[field];

        if (typeof currentValue !== 'string' || !currentValue) {
            continue;
        }

        const repairedValue = repairLikelyUtf8Mojibake(currentValue);

        if (repairedValue !== currentValue) {
            entity[field] = repairedValue as T[TextFieldName];
            changed = true;
        }
    }

    return { changed, entity };
}

async function main() {
    const options = await getConnectionOptions();
    const connection = await createConnection(options);

    try {
        const componentRepository = getCustomRepository(ComponentRepository);
        const componentDraftRepository = getCustomRepository(ComponentDraftRepository);

        const components = await componentRepository.find();
        const drafts = await componentDraftRepository.find();

        const repairedComponents = components
            .map((component) => repairEntityFields(component as Component & RepairableEntity))
            .filter((entry) => entry.changed)
            .map((entry) => entry.entity);

        const repairedDrafts = drafts
            .map((draft) => repairEntityFields(draft as ComponentDraft & RepairableEntity))
            .filter((entry) => entry.changed)
            .map((entry) => entry.entity);

        if (repairedComponents.length > 0) {
            await componentRepository.save(repairedComponents);
        }

        if (repairedDrafts.length > 0) {
            await componentDraftRepository.save(repairedDrafts);
        }

        console.log(JSON.stringify({
            repairedComponents: repairedComponents.length,
            repairedDrafts: repairedDrafts.length,
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