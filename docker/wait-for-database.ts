import * as sql from 'mssql';

interface SqlConfig {
  server: string;
  port: number;
  user: string;
  password: string;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
    enableArithAbort: boolean;
  };
  connectionTimeout: number;
}

async function waitForDatabase(): Promise<boolean> {
  console.log('Waiting for SQL Server to be ready...');
  const maxAttempts = 30;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const config: SqlConfig = {
        server: process.env.DB_HOST || 'sqlserver',
        port: parseInt(process.env.DB_PORT || '1433', 10),
        user: 'sa',
        password: process.env.SA_PASSWORD || 'Passw0rd123!',
        options: {
          encrypt: false,
          trustServerCertificate: true,
          enableArithAbort: true,
        },
        connectionTimeout: 5000,
      };
      
      const pool = await sql.connect(config);
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

