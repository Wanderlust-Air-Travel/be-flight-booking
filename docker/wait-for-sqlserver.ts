import * as sql from 'mssql';
import { SqlConfig } from 'src/shared/types/database/sql-config.interface';

/**
 * Wait for SQL Server to be ready (connect to 'master' database only)
 * This is used BEFORE creating the target database
 */
async function waitForSQLServer(): Promise<boolean> {
  console.log('Waiting for SQL Server to be ready...');
  const maxAttempts = 30;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const dbHost = process.env.DB_HOST || 'sqlserver';
      const isDockerNetwork = dbHost === 'sqlserver' || dbHost.includes('.docker');
      const defaultPort = isDockerNetwork ? 1433 : 1434;
      
      // Always connect to 'master' database to check if SQL Server is ready
      const config: SqlConfig = {
        server: dbHost,
        port: parseInt(process.env.DB_PORT || defaultPort.toString(), 10),
        user: process.env.DB_USER || 'sa',
        password: process.env.DB_PASS || process.env.SA_PASSWORD || 'Passw0rd123!',
        database: 'master', // Always use 'master' to check SQL Server availability
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
      console.log('SQL Server is ready!');
      return true;
    } catch (error) {
      const err = error as Error;
      if (i < maxAttempts - 1) {
        console.log(`Waiting for SQL Server... (${i + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.error('Failed to connect to SQL Server:', err.message);
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

