module.exports = {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    entities: [
        'src/entities/*.{ts,js}',
    ],
    migrations: [
        'src/database/migrations/*.{ts,js}',
    ],
    cli: {
        entitiesDir: 'src/entities',
        migrationsDir: 'src/database/migrations',
    },
    logging: false,
    dropSchema: process.env.NODE_ENV === 'test',
    migrationsRun: true,
};
