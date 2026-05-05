import 'reflect-metadata';
import { createConnection, getConnectionOptions } from 'typeorm';

async function main() {
    if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
        throw new Error('Refusing to reset database in production environment.');
    }

    const options = await getConnectionOptions();
    const connection = await createConnection(options);

    try {
        await connection.query('DROP SCHEMA IF EXISTS public CASCADE;');
        await connection.query('CREATE SCHEMA public;');
        await connection.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
        await connection.runMigrations();

        console.log(JSON.stringify({
            ok: true,
            action: 'reset-development-database',
            database: (options as any).database,
            migrations: 'applied',
        }, null, 2));
    } finally {
        await connection.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
