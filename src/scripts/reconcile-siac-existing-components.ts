import 'reflect-metadata';
import { createConnection, getConnectionOptions, getCustomRepository } from 'typeorm';

import { CrawlerService } from '../services/CrawlerService';
import { UserRepository } from '../repositories/UserRepository';
import { UserRole } from '../interfaces/UserRole';
import crypto from 'crypto';

interface CliOptions {
    cdCurso: string;
    nuPerCursoInicial: string;
    userEmail?: string;
}

function parseArgs(argv: string[]): CliOptions {
    const options: Partial<CliOptions> = {};

    for (const arg of argv) {
        if (!arg.startsWith('--')) {
            continue;
        }

        const [rawKey, rawValue] = arg.slice(2).split('=');
        const key = rawKey?.trim();
        const value = rawValue?.trim();

        if (!key || value === undefined) {
            continue;
        }

        if (key === 'cdCurso') {
            options.cdCurso = value;
            continue;
        }

        if (key === 'nuPerCursoInicial') {
            options.nuPerCursoInicial = value;
            continue;
        }

        if (key === 'userEmail') {
            options.userEmail = value;
        }
    }

    if (!options.cdCurso) {
        throw new Error('Missing --cdCurso. Example: --cdCurso=112140');
    }

    if (!options.nuPerCursoInicial) {
        throw new Error('Missing --nuPerCursoInicial. Example: --nuPerCursoInicial=20111');
    }

    return options as CliOptions;
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

async function run(): Promise<void> {
    if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
        throw new Error('Refusing to reconcile in production environment.');
    }

    const options = parseArgs(process.argv.slice(2));
    const connectionOptions = await getConnectionOptions();
    const connection = await createConnection(connectionOptions);

    try {
        const crawlerService = new CrawlerService();
        const userId = await resolveOperatorUserId(options.userEmail);

        const summary = await crawlerService.importComponentsFromSiac(
            userId,
            options.cdCurso,
            options.nuPerCursoInicial
        );

        process.stdout.write(
            `${JSON.stringify(
                {
                    ok: true,
                    mode: 'siac-reconcile',
                    parameters: {
                        cdCurso: options.cdCurso,
                        nuPerCursoInicial: options.nuPerCursoInicial,
                        userEmail: options.userEmail ?? null,
                    },
                    summary,
                },
                null,
                2
            )}\n`
        );
    } finally {
        await connection.close();
    }
}

run().catch((error) => {
    process.stderr.write(`${error?.stack ?? error?.message ?? String(error)}\n`);
    process.exit(1);
});
