import { resolve } from 'node:path';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

// Determine which .env file to load based on NODE_ENV
const envFile =
    process.env.NODE_ENV === 'production'
        ? '.env.prod'
        : process.env.NODE_ENV === 'staging'
          ? '.env.staging'
          : '.env.development';

config({ path: resolve(process.cwd(), envFile) });

// Running from host — when DB_HOST points to a Docker service name, switch to localhost
// (containers are not reachable from the host by their compose service name).
const isHostExecution = process.env.DB_HOST === 'sqlserver' && !process.env.DB_HOST_OVERRIDE;
const dbHost = isHostExecution ? 'localhost' : process.env.DB_HOST;
const dbPort = Number(process.env.DB_PORT);

// SQL Server 2022 requires encrypted TDS connections by default.
// Always use encrypt=true; the local self-signed dev certificate is trusted via
// trustServerCertificate=true. Production should set DB_TRUST_CERT=false and
// provision a real certificate.
const dbEncrypt = process.env.DB_ENCRYPT === 'true';
const dbTrustCert = process.env.DB_TRUST_CERT === 'true';

export default new DataSource({
    type: 'mssql',
    host: dbHost,
    port: dbPort,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    options: { encrypt: dbEncrypt, trustServerCertificate: dbTrustCert },
    extra: { trustServerCertificate: dbTrustCert },
    entities: [`${__dirname}/../entities/**/*.entity.{ts,js}`],
    migrations: [`${__dirname}/../../migrations/*.{ts,js}`],
    migrationsTableName: 'migrations',
    synchronize: false,
});
