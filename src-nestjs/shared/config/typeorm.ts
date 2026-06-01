import { DataSource } from "typeorm";
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file
config({ path: resolve(process.cwd(), '.env') });

export default new DataSource({
    type: 'mssql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    options: { encrypt: process.env.DB_ENCRYPT === 'true'},
    extra: { trustServerCertificate: process.env.DB_TRUST_CERT === 'true'},
    entities: [__dirname + '/../entities/**/*.entity.{ts,js}'],
    migrations: [__dirname + '/../../migrations/*.{ts,js}'],
    migrationsTableName: 'migrations',
    synchronize: false,
})