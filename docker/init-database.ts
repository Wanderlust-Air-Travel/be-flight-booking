import { DataSource } from 'typeorm';
import * as sql from 'mssql';
import * as path from 'path';
import { config } from 'dotenv';
import { SqlConfig } from 'src/shared/types/database/sql-config.interface';

// Load environment from .env file based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production'
    ? '.env.prod'
    : process.env.NODE_ENV === 'staging'
        ? '.env.staging'
        : '.env.development';

config({ path: path.resolve(process.cwd(), envFile) });

/**
 * Get database configuration, switching DB_HOST to localhost when running from host
 */
function getDbConfig() {
  let dbHost = process.env.DB_HOST;
  if (!dbHost) {
    throw new Error('DB_HOST is required in environment');
  }
  // When running from host machine, DB_HOST=sqlserver is not reachable - use localhost
  if (dbHost === 'sqlserver' && !process.env.DB_HOST_OVERRIDE) {
    dbHost = 'localhost';
  }

  const isDockerNetwork = dbHost === 'sqlserver' || dbHost.includes('.docker');
  const defaultPort = isDockerNetwork ? 1433 : 1434;
  const dbPort = parseInt(process.env.DB_PORT || defaultPort.toString(), 10);
  const dbUser = process.env.DB_USER!;
  const dbPassword = process.env.DB_PASS!;
  const dbName = process.env.DB_NAME!;

  if (!dbUser || !dbPassword || !dbName) {
    throw new Error('DB_USER, DB_PASS, and DB_NAME are required in environment');
  }

  return { dbHost, dbPort, dbUser, dbPassword, dbName };
}

/**
 * Create database if it doesn't exist
 */
async function createDatabase(): Promise<boolean> {
  console.log('Creating database...');
  try {
    const { dbHost, dbPort, dbUser, dbPassword } = getDbConfig();

    const config: SqlConfig = {
      server: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: 'master',
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
        enableArithAbort: true,
      },
      connectionTimeout: 5000,
    };

    const pool = new sql.ConnectionPool(config as sql.config);
    await pool.connect();

    const dbName = process.env.DB_NAME!;
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '${dbName}')
      BEGIN
        CREATE DATABASE ${dbName};
      END
    `);
    console.log(`Database '${dbName}' created or already exists`);

    await pool.close();
    return true;
  } catch (error) {
    console.error('Error creating database:', error);
    return false;
  }
}

/**
 * Run TypeORM migrations
 */
async function runMigrations(): Promise<boolean> {
  console.log('Running TypeORM migrations...');
  try {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const { dbHost, dbPort, dbUser, dbPassword } = getDbConfig();
    const dbName = process.env.DB_NAME!;

    const dataSource = new DataSource({
      type: 'mssql',
      host: dbHost,
      port: dbPort,
      username: dbUser,
      password: dbPassword,
      database: dbName,
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
      },
      extra: {
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
      },
      entities: [path.join(__dirname, '../dist/shared/entities/**/*.entity.js')],
      migrations: [path.join(__dirname, '../dist/migrations/*.js')],
      migrationsTableName: 'migrations',
      synchronize: false,
    });

    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      console.log('TypeORM DataSource initialized');
    }

    const migrations = await dataSource.runMigrations();

    if (migrations && migrations.length > 0) {
      console.log(`Executed ${migrations.length} migration(s):`);
      migrations.forEach((migration) => {
        console.log(`  - ${migration.name}`);
      });
    } else {
      console.log('No pending migrations, database is up to date');
    }

    await dataSource.destroy();
    console.log('Migrations executed successfully');
    return true;
  } catch (error: any) {
    console.error('Error running migrations:', error.message);
    if (
      error.message &&
      (error.message.includes('No migrations') ||
        error.message.includes('already been executed'))
    ) {
      console.log('No pending migrations, database is up to date');
      return true;
    }
    return false;
  }
}

/**
 * Verify database is accessible
 */
async function verifyDatabase(): Promise<boolean> {
  console.log('Verifying database is accessible...');
  try {
    const { dbHost, dbPort, dbUser, dbPassword } = getDbConfig();
    const dbName = process.env.DB_NAME!;

    const dataSource = new DataSource({
      type: 'mssql',
      host: dbHost,
      port: dbPort,
      username: dbUser,
      password: dbPassword,
      database: dbName,
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
      },
      extra: {
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
      },
      entities: [],
      synchronize: false,
    });

    await dataSource.initialize();
    await dataSource.query('SELECT 1');
    await dataSource.destroy();
    console.log('Database verification successful!');
    return true;
  } catch (error: any) {
    console.error('Database verification failed:', error.message);
    return false;
  }
}

/**
 * Main function to initialize database
 */
async function main(): Promise<void> {
  const dbCreated = await createDatabase();
  if (!dbCreated) {
    console.error('Failed to create database');
    process.exit(1);
  }

  console.log('Waiting for database to be fully ready...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const migrationsRun = await runMigrations();
  if (!migrationsRun) {
    console.error('Failed to run migrations');
    process.exit(1);
  }

  const verified = await verifyDatabase();
  if (!verified) {
    console.error('Database verification failed');
    process.exit(1);
  }

  console.log('Database initialization completed successfully!');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
