import { DataSource } from 'typeorm';
import * as sql from 'mssql';
import * as path from 'path';

/**
 * Create database if it doesn't exist
 */
async function createDatabase(): Promise<boolean> {
  console.log('Creating database...');
  try {
    // Use SA password from environment (set in docker-compose.yml) or default
    const saPassword = process.env.SA_PASSWORD || 'Passw0rd123!';
    const config: sql.config = {
      server: process.env.DB_HOST || 'sqlserver',
      port: parseInt(process.env.DB_PORT || '1433', 10),
      user: 'sa',
      password: saPassword,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
      },
    };

    const pool = await sql.connect(config);

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
    // In Docker, environment variables are set from docker-compose.yml
    const dataSource = new DataSource({
      type: 'mssql',
      host: process.env.DB_HOST || 'sqlserver',
      port: parseInt(process.env.DB_PORT || '1433', 10),
      username: process.env.DB_USER || 'sa',
      password: process.env.DB_PASS || 'Passw0rd123!',
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
 * Main function to initialize database
 */
async function main(): Promise<void> {
  const dbCreated = await createDatabase();
  if (!dbCreated) {
    process.exit(1);
  }

  const migrationsRun = await runMigrations();
  if (!migrationsRun) {
    console.warn('Migration execution had issues, but continuing...');
  }

  console.log('Database initialization completed!');
  process.exit(0);
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

