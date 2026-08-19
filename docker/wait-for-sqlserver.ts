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
 * Wait for SQL Server to be ready (connect to 'master' database only)
 * This is used BEFORE creating the target database
 */
async function waitForSQLServer(): Promise<boolean> {
  console.log('Waiting for SQL Server to be ready...');
  const maxAttempts = 30;

  // When running from host machine, DB_HOST=sqlserver is not reachable - use localhost
  let dbHost = process.env.DB_HOST;
  if (!dbHost) {
    dbHost = 'localhost';
    console.log('DB_HOST not set, using localhost');
  }
  if (dbHost === 'sqlserver' && !process.env.DB_HOST_OVERRIDE) {
    dbHost = 'localhost';
  }

  const isDockerNetwork = dbHost === 'sqlserver' || dbHost.includes('.docker');
  const defaultPort = isDockerNetwork ? 1433 : 1434;
  const dbPort = parseInt(process.env.DB_PORT || defaultPort.toString(), 10);
  const dbUser = process.env.DB_USER!;
  const dbPassword = process.env.DB_PASS!;

  console.log(`Connection info: ${dbHost}:${dbPort} (user: ${dbUser})`);
  if (isDockerNetwork) {
    console.log('Connecting from Docker network (container-to-container)');
  } else {
    console.log(`Connecting from host machine to Docker container (port ${dbPort} on host)`);
  }

  for (let i = 0; i < maxAttempts; i++) {
    try {
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
      await pool.request().query('SELECT 1');
      await pool.close();
      console.log('SQL Server is ready!');
      return true;
    } catch (error) {
      const err = error as Error;
      if (i < maxAttempts - 1) {
        if (i === 0 || (i + 1) % 5 === 0) {
          console.log(`Waiting for SQL Server... (${i + 1}/${maxAttempts})`);
          console.log(`  Error: ${err.message.split('\n')[0]}`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.error('Failed to connect to SQL Server after', maxAttempts, 'attempts');
        console.error('Connection details:');
        console.error(`  Host: ${dbHost}`);
        console.error(`  Port: ${dbPort}`);
        console.error(`  User: ${dbUser}`);
        console.error(`  Error: ${err.message}`);
        return false;
      }
    }
  }
  return false;
}

waitForSQLServer()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
