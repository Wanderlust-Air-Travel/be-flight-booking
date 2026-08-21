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
 * Wait for specific database to be created and accessible
 * This is used AFTER creating the target database
 */
async function waitForDatabaseCreated(): Promise<boolean> {
  const dbName = process.env.DB_NAME!;
  console.log(`Waiting for database '${dbName}' to be created...`);
  const maxAttempts = 30;

  // When running from host machine, DB_HOST=sqlserver is not reachable - use localhost
  let dbHost = process.env.DB_HOST;
  if (!dbHost) {
    dbHost = 'localhost';
  }
  if (dbHost === 'sqlserver' && !process.env.DB_HOST_OVERRIDE) {
    dbHost = 'localhost';
  }

  const isDockerNetwork = dbHost === 'sqlserver' || dbHost.includes('.docker');
  const defaultPort = isDockerNetwork ? 1433 : 1434;
  const dbPort = parseInt(process.env.DB_PORT || defaultPort.toString(), 10);
  const dbUser = process.env.DB_USER!;
  const dbPassword = process.env.DB_PASS!;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const config: SqlConfig = {
        server: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPassword,
        database: dbName,
        options: {
          encrypt: process.env.DB_ENCRYPT === 'true',
          trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
          enableArithAbort: true,
        },
        connectionTimeout: 5000,
      };

      const pool = new sql.ConnectionPool(config as sql.config);
      await pool.connect();
      await pool.request().query('SELECT 1');
      await pool.close();
      console.log(`Database '${dbName}' is ready!`);
      return true;
    } catch (error) {
      const err = error as Error;
      if (i < maxAttempts - 1) {
        if ((i + 1) % 5 === 0 || i === 0) {
          console.log(`Waiting for database '${dbName}'... (${i + 1}/${maxAttempts})`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.error(`Failed to connect to database '${dbName}':`, err.message);
        return false;
      }
    }
  }
  return false;
}

waitForDatabaseCreated()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
