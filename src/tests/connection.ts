import { createConnection, getConnection, getConnectionOptions } from 'typeorm';
/* eslint-disable */
require('dotenv').config();
/* eslint-enable */

const connection = {
    async create(){
        process.env.DB_NAME = process.env.DB_TEST_NAME;
    
        await getConnectionOptions()
            .then(async options => {
                return createConnection({ ...options, dropSchema:true, migrationsRun:true });
            })
            .catch(err => {
                console.log(err);
                throw err;
            });
    },

    async close(){
        await getConnection().close(); 
    },

    async clear(){
        const entities = getConnection().entityMetadatas;
        const tableNames = entities.map(entity => `"${entity.tableName}"`).join(', ');

        if (!tableNames) {
            return;
        }

        await getConnection().query(`TRUNCATE ${tableNames} RESTART IDENTITY CASCADE;`);
    },
};
export default connection;