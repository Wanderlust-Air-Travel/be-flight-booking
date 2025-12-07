import * as sql from 'mssql';
import { SqlConfig } from 'src/shared/types/database/sql-config.interface';

/**
 * Wait for specific database to be created and accessible
 * This is used AFTER creating the target database
 */
async function waitForDatabaseCreated(): Promise<boolean> {
  const dbName = process.env.DB_NAME || 'flight_booking_db';
  console.log(`Waiting for database '${dbName}' to be created...`);
  const maxAttempts = 30;
  
  // Detect if running locally (not in Docker container)
  let dbHost = process.env.DB_HOST;
  if (!dbHost) {
    dbHost = 'localhost'; // Default to localhost for local development
  }
  const isDockerNetwork = dbHost === 'sqlserver' || dbHost.includes('.docker');
  const defaultPort = isDockerNetwork ? 1433 : 1434;
  const dbPort = parseInt(process.env.DB_PORT || defaultPort.toString(), 10);
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const config: SqlConfig = {
        server: dbHost,
        port: dbPort,
        user: process.env.DB_USER || 'sa',
        password: process.env.DB_PASS || process.env.SA_PASSWORD || 'Passw0rd123!',
        database: dbName, // Try to connect to the target database
        options: {
          encrypt: false,
          trustServerCertificate: true,
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
        // Only log every 5 attempts to reduce noise
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

