import 'reflect-metadata';
import { createConnection, getConnectionOptions, getCustomRepository } from 'typeorm';

import { CrawlerService } from '../services/CrawlerService';
import { AcademicLevel } from '../interfaces/AcademicLevel';
import { UserRepository } from '../repositories/UserRepository';
import { UserRole } from '../interfaces/UserRole';
import crypto from 'crypto';

type SourceType = 'department' | 'program';

function getArgValue(flag: string): string | undefined {
    const match = process.argv.find((arg) => arg.startsWith(`${flag}=`));
    return match ? match.substring(flag.length + 1) : undefined;
}

function requireArg(flag: string): string {
    const value = getArgValue(flag);

    if (!value) {
        throw new Error(`Missing required argument: ${flag}`);
    }

    return value;
}

function parseAcademicLevel(raw: string): AcademicLevel {
    if (!Object.values(AcademicLevel).includes(raw as AcademicLevel)) {
        throw new Error('Invalid academicLevel. Use: graduacao, mestrado ou doutorado.');
    }

    return raw as AcademicLevel;
}

function parseSourceType(raw: string): SourceType {
    if (raw !== 'department' && raw !== 'program') {
        throw new Error('Invalid sourceType. Use: department ou program.');
    }

    return raw;
}

async function resolveOperatorUserId(preferredEmail?: string): Promise<string> {
    const userRepository = getCustomRepository(UserRepository);

    if (preferredEmail) {
        const byEmail = await userRepository.findOne({
            where: { email: preferredEmail.trim().toLowerCase() },
        });

        if (!byEmail) {
            throw new Error(`User not found for email: ${preferredEmail}`);
        }

        return byEmail.id;
    }

    const governanceUser = await userRepository.findOne({
        where: [{ role: UserRole.SUPER_ADMIN }, { role: UserRole.ADMIN }],
        order: { createdAt: 'ASC' },
    });

    if (governanceUser) {
        return governanceUser.id;
    }

    const bootstrapEmail = String(process.env.RECONCILE_BOOTSTRAP_EMAIL || 'reconcile.bot@ufba.br')
        .trim()
        .toLowerCase();
    const bootstrapName = String(process.env.RECONCILE_BOOTSTRAP_NAME || 'Reconcile Bot').trim();
    const bootstrapPassword = String(process.env.RECONCILE_BOOTSTRAP_PASSWORD || 'Reconcile123!');

    const existingBootstrap = await userRepository.findOne({ where: { email: bootstrapEmail } });

    if (existingBootstrap) {
        if (existingBootstrap.role !== UserRole.SUPER_ADMIN) {
            existingBootstrap.role = UserRole.SUPER_ADMIN;
            await userRepository.save(existingBootstrap);
        }

        return existingBootstrap.id;
    }

    const created = await userRepository.save(userRepository.create({
        name: bootstrapName,
        email: bootstrapEmail,
        password: crypto.createHmac('sha256', bootstrapPassword).digest('hex'),
        role: UserRole.SUPER_ADMIN,
    }));

    return created.id;
}

async function main() {
    if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
        throw new Error('Refusing to reconcile in production environment.');
    }

    const sourceType = parseSourceType(requireArg('--sourceType'));
    const sourceId = requireArg('--sourceId');
    const academicLevel = parseAcademicLevel(requireArg('--academicLevel'));
    const userEmail = getArgValue('--userEmail');

    const options = await getConnectionOptions();
    const connection = await createConnection(options);

    try {
        const userId = await resolveOperatorUserId(userEmail);
        const crawlerService = new CrawlerService();

        const summary = await crawlerService.importComponentsFromSigaaPublic(
            userId,
            sourceType,
            sourceId,
            academicLevel,
            { reconcileExisting: true }
        );

        console.log(JSON.stringify({
            ok: true,
            mode: 'sigaa-reconcile',
            parameters: { sourceType, sourceId, academicLevel, userEmail: userEmail || null },
            summary,
        }, null, 2));
    } finally {
        await connection.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
