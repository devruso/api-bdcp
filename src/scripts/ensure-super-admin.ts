import 'reflect-metadata';
import crypto from 'crypto';
import { createConnection, getConnectionOptions, getCustomRepository } from 'typeorm';

import { UserRepository } from '../repositories/UserRepository';
import { UserRole } from '../interfaces/UserRole';

function getArgValue(flag: string): string | undefined {
    const match = process.argv.find((arg) => arg.startsWith(`${flag}=`));
    return match ? match.substring(flag.length + 1) : undefined;
}

function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

function assertUfbaEmail(email: string) {
    return /@ufba\.br$/i.test(email);
}

async function main() {
    const emailArg = getArgValue('--email') || process.env.SUPER_ADMIN_EMAIL;

    if (!emailArg) {
        throw new Error('Missing --email argument or SUPER_ADMIN_EMAIL environment variable.');
    }

    const normalizedEmail = normalizeEmail(emailArg);

    if (!assertUfbaEmail(normalizedEmail)) {
        throw new Error('Only UFBA institutional email addresses are allowed for super admin bootstrap.');
    }

    const name = (getArgValue('--name') || process.env.SUPER_ADMIN_NAME || 'Super Admin').trim();
    const password = getArgValue('--password') || process.env.SUPER_ADMIN_PASSWORD;
    const generatedPassword = password || crypto.randomBytes(12).toString('base64url');
    const passwordHash = crypto.createHmac('sha256', generatedPassword).digest('hex');

    const options = await getConnectionOptions();
    const connection = await createConnection(options);

    try {
        const userRepository = getCustomRepository(UserRepository);
        const existing = await userRepository.findOne({ where: { email: normalizedEmail } });

        if (existing) {
            existing.name = existing.name || name;
            existing.role = UserRole.SUPER_ADMIN;
            existing.isDeleted = false;
            existing.isUserActive = true;

            if (password) {
                existing.password = passwordHash;
            }

            await userRepository.save(existing);

            console.log(JSON.stringify({
                ok: true,
                action: 'promoted-existing-user',
                email: normalizedEmail,
                id: existing.id,
                role: existing.role,
                passwordUpdated: Boolean(password),
            }, null, 2));

            return;
        }

        const created = await userRepository.save(userRepository.create({
            name,
            email: normalizedEmail,
            password: passwordHash,
            role: UserRole.SUPER_ADMIN,
            isDeleted: false,
            isUserActive: true,
        }));

        console.log(JSON.stringify({
            ok: true,
            action: 'created-super-admin',
            email: normalizedEmail,
            id: created.id,
            role: created.role,
            generatedPassword: password ? undefined : generatedPassword,
        }, null, 2));
    } finally {
        await connection.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
