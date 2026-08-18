import { DataSource } from 'typeorm';
import * as sql from 'mssql';
import * as path from 'path';
import { SqlConfig } from 'src/shared/types/database/sql-config.interface';

/**
 * Create database if it doesn't exist
 */
async function createDatabase(): Promise<boolean> {
  console.log('Creating database...');
  try {
    // Use DB credentials from environment (set in docker-compose.development.yml) or default
    // For creating database, we may need SA user or user with sysadmin role
    const dbUser = process.env.DB_USER || 'sa';
    const dbPassword = process.env.DB_PASS || process.env.SA_PASSWORD || 'Strong!Pass1234';
    // When connecting from Docker container to another container, use container port (1433)
    // When connecting from host to container, use host port (1434)
    let dbHost = process.env.DB_HOST;
    if (!dbHost) {
      dbHost = 'localhost'; // Default to localhost for local development
    }
    const isDockerNetwork = dbHost === 'sqlserver' || dbHost.includes('.docker');
    const defaultPort = isDockerNetwork ? 1433 : 1434;
    const dbPort = parseInt(process.env.DB_PORT || defaultPort.toString(), 10);
    
    const config: SqlConfig = {
      server: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: 'master',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
      },
      connectionTimeout: 5000,
    };

    const pool = new sql.ConnectionPool(config as sql.config);
    await pool.connect();

    // Create database
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'flight_booking_db')
      BEGIN
        CREATE DATABASE flight_booking_db;
      END
    `);
    console.log('Database created or already exists');

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
    // Wait a bit for database to be fully ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Create DataSource directly from environment variables (not from .env file)
    // In Docker, environment variables are set from docker-compose.development.yml
    // When connecting from Docker container to another container, use container port (1433)
    // When connecting from host to container, use host port (1434)
    let dbHost = process.env.DB_HOST;
    if (!dbHost) {
      dbHost = 'localhost'; // Default to localhost for local development
    }
    const isDockerNetwork = dbHost === 'sqlserver' || dbHost.includes('.docker');
    const defaultPort = isDockerNetwork ? 1433 : 1434;
    const dbPort = parseInt(process.env.DB_PORT || defaultPort.toString(), 10);
    
    const dataSource = new DataSource({
      type: 'mssql',
      host: dbHost,
      port: dbPort,
      username: process.env.DB_USER || 'sa',
      password: process.env.DB_PASS || 'Strong!Pass1234',
      database: process.env.DB_NAME || 'flight_booking_db',
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
    console.error('Error details:', error);
    // Check if it's just "no migrations pending" error
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
    let dbHost = process.env.DB_HOST;
    if (!dbHost) {
      dbHost = 'localhost'; // Default to localhost for local development
    }
    const isDockerNetwork = dbHost === 'sqlserver' || dbHost.includes('.docker');
    const defaultPort = isDockerNetwork ? 1433 : 1434;
    const dbPort = parseInt(process.env.DB_PORT || defaultPort.toString(), 10);
    
    const dataSource = new DataSource({
      type: 'mssql',
      host: dbHost,
      port: dbPort,
      username: process.env.DB_USER || 'sa',
      password: process.env.DB_PASS || process.env.SA_PASSWORD || 'Strong!Pass1234',
      database: process.env.DB_NAME || 'flight_booking_db',
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

  // Wait longer for database to be fully ready after creation
  // SQL Server needs time to finalize database creation
  console.log('Waiting for database to be fully ready...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const migrationsRun = await runMigrations();
  if (!migrationsRun) {
    console.error('Failed to run migrations');
    process.exit(1);
  }

  // Verify database is accessible before proceeding
  const verified = await verifyDatabase();
  if (!verified) {
    console.error('Database verification failed');
    process.exit(1);
  }

  console.log('Database initialization completed successfully!');
  process.exit(0);
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

