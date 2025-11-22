import * as sql from 'mssql';
import { SqlConfig } from 'src/shared/types/database/sql-config.interface';

async function waitForDatabase(): Promise<boolean> {
  console.log('Waiting for SQL Server to be ready...');
  const maxAttempts = 30;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // When connecting from Docker container to another container, use container port (1433)
      // When connecting from host to container, use host port (1434)
      const dbHost = process.env.DB_HOST || 'sqlserver';
      const isDockerNetwork = dbHost === 'sqlserver' || dbHost.includes('.docker');
      const defaultPort = isDockerNetwork ? 1433 : 1434;
      
      const config: SqlConfig = {
        server: dbHost,
        port: parseInt(process.env.DB_PORT || defaultPort.toString(), 10),
        user: process.env.DB_USER || 'sa',
        password: process.env.DB_PASS || process.env.SA_PASSWORD || 'Passw0rd123!',
        database: process.env.DB_NAME || 'master',
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

waitForDatabase()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

