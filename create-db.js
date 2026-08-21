/**
 * Simple database creation script.
 * ALL configuration is loaded from .env file based on NODE_ENV.
 *
 * Usage:
 *   # Development (default):
 *   node create-db.js
 *
 *   # With specific environment:
 *   NODE_ENV=staging node create-db.js
 *
 *   # Or use the npm script:
 *   npm run create-db
 */

const path = require('node:path');
const sql = require('mssql');

// Load environment from .env file based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production'
    ? '.env.prod'
    : process.env.NODE_ENV === 'staging'
        ? '.env.staging'
        : '.env.development';

require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

// When running from host machine, DB_HOST=sqlserver is not reachable - use localhost
let dbHost = process.env.DB_HOST || 'localhost';
if (dbHost === 'sqlserver' && !process.env.DB_HOST_OVERRIDE) {
    dbHost = 'localhost';
}

const isDockerNetwork = dbHost === 'sqlserver' || dbHost.includes('.docker');
const defaultPort = isDockerNetwork ? 1433 : 1434;
const dbPort = parseInt(process.env.DB_PORT || defaultPort.toString(), 10);
const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASS;

if (!dbHost || !dbPort || !dbName || !dbUser || !dbPassword) {
    console.error('Missing required environment variables. Please ensure .env file is configured.');
    console.error('Required: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS');
    process.exit(1);
}

(async () => {
    console.log(`Connecting to ${dbHost}:${dbPort}...`);

    const cfg = {
        server: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPassword,
        options: {
            encrypt: process.env.DB_ENCRYPT === 'true',
            trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
        },
    };

    await sql.connect(cfg);

    const result = await sql.query(
        `IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '${dbName}') CREATE DATABASE ${dbName}`
    );

    if (result.rowsAffected[0] > 0) {
        console.log(`Database '${dbName}' created.`);
    } else {
        console.log(`Database '${dbName}' already exists.`);
    }

    const databases = await sql.query('SELECT name FROM sys.databases');
    console.log('Available databases:', databases.recordset.map(d => d.name).join(', '));

    await sql.close();
})().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
