import * as sql from 'mssql';
import { SqlConfig } from 'src/shared/types/database/sql-config.interface';

/**
 * Wait for SQL Server to be ready (connect to 'master' database only)
 * This is used BEFORE creating the target database
 */
async function waitForSQLServer(): Promise<boolean> {
  console.log('Waiting for SQL Server to be ready...');
  const maxAttempts = 30;
  
  // Detect if running locally (not in Docker container)
  // If DB_HOST is not set, use 'localhost' for local development, 'sqlserver' only works inside Docker network
  let dbHost = process.env.DB_HOST;
  if (!dbHost) {
    // Default to localhost for local development (when connecting from host machine to Docker container)
    dbHost = 'localhost';
    console.log('ℹ️  DB_HOST not set, using localhost (assuming local development)');
  }
  
  const isDockerNetwork = dbHost === 'sqlserver' || dbHost.includes('.docker');
  const defaultPort = isDockerNetwork ? 1433 : 1434; // 1434 is host port mapped from Docker container 1433
  const dbPort = parseInt(process.env.DB_PORT || defaultPort.toString(), 10);
  const dbUser = process.env.DB_USER || 'sa';
  const dbPassword = process.env.DB_PASS || process.env.SA_PASSWORD || 'Passw0rd123!';
  
  console.log(`Connection info: ${dbHost}:${dbPort} (user: ${dbUser})`);
  if (isDockerNetwork) {
    console.log(`Connecting from Docker network (container-to-container)`);
  } else {
    console.log(`Connecting from host machine to Docker container (port ${dbPort} on host)`);
  }
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // Always connect to 'master' database to check if SQL Server is ready
      const config: SqlConfig = {
        server: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPassword,
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
      console.log('✅ SQL Server is ready!');
      return true;
    } catch (error) {
      const err = error as Error;
      if (i < maxAttempts - 1) {
        const errorMsg = err.message || String(err);
        // Only show detailed error on first attempt and every 5 attempts
        if (i === 0 || (i + 1) % 5 === 0) {
          console.log(`⏳ Waiting for SQL Server... (${i + 1}/${maxAttempts})`);
          console.log(`   Error: ${errorMsg.split('\n')[0]}`);
          console.log(`   Trying to connect to: ${dbHost}:${dbPort}`);
        } else {
          console.log(`⏳ Waiting for SQL Server... (${i + 1}/${maxAttempts})`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.error('❌ Failed to connect to SQL Server after', maxAttempts, 'attempts');
        console.error('Connection details:');
        console.error(`  Host: ${dbHost}`);
        console.error(`  Port: ${dbPort}`);
        console.error(`  User: ${dbUser}`);
        console.error(`  Error: ${err.message}`);
        console.error('\n💡 Troubleshooting:');
        console.error('  1. Check if Docker container is running: docker ps');
        console.error('  2. Check if port is correct (should be 1434 for localhost): docker compose -f docker-compose.services.yml ps');
        console.error('  3. Check .env file: DB_HOST=localhost, DB_PORT=1434');
        console.error('  4. Verify SQL Server is accessible: docker logs sqlserver');
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

