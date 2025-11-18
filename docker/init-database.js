const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const path = require('path');

async function createDatabaseAndUser() {
  console.log('Creating database and user...');
  try {
    const sql = require('mssql');
    const config = {
      server: process.env.DB_HOST || 'sqlserver',
      port: parseInt(process.env.DB_PORT || '1433'),
      user: 'sa',
      password: 'YourStrong@Passw0rd',
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

    // Create login and user
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = 'maxnoah')
      BEGIN
        CREATE LOGIN maxnoah WITH PASSWORD = '12341234';
      END
    `);
    console.log('Login created or already exists');

    // Switch to flight_booking_db and create user
    const dbPool = await sql.connect({
      ...config,
      database: 'flight_booking_db',
    });
    
    await dbPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'maxnoah')
      BEGIN
        CREATE USER maxnoah FOR LOGIN maxnoah;
        ALTER ROLE db_owner ADD MEMBER maxnoah;
      END
    `);
    await dbPool.close();
    console.log('User created or already exists');

    await pool.close();
    return true;
  } catch (error) {
    console.error('Error creating database and user:', error);
    return false;
  }
}

async function runSchema() {
  console.log('Running database schema...');
  try {
    const sql = require('mssql');
    const config = {
      server: process.env.DB_HOST || 'sqlserver',
      port: parseInt(process.env.DB_PORT || '1433'),
      user: process.env.DB_USER || 'maxnoah',
      password: process.env.DB_PASS || '12341234',
      database: process.env.DB_NAME || 'flight_booking_db',
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
        enableArithAbort: true,
      },
    };

    const pool = await sql.connect(config);
    const schemaPath = path.join(__dirname, '../sql/schema/flight_booking_db.sql');
    const schemaSQL = await fs.readFile(schemaPath, 'utf8');
    
    // Remove CREATE DATABASE statement if exists (already created)
    let cleanedSQL = schemaSQL.replace(/CREATE DATABASE.*?GO/gi, '');
    
    // Split by GO statements and execute each batch
    const batches = cleanedSQL.split(/\bGO\b/i).filter(batch => batch.trim());
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < batches.length; i++) {
      const trimmedBatch = batches[i].trim();
      if (trimmedBatch && !trimmedBatch.match(/^\s*USE\s+master/i)) {
        try {
          await pool.request().query(trimmedBatch);
          successCount++;
        } catch (error) {
          // Ignore errors for existing objects
          const errorMsg = error.message || '';
          if (errorMsg.includes('already exists') || 
              errorMsg.includes('There is already') ||
              errorMsg.includes('duplicate key') ||
              errorMsg.includes('Cannot drop') ||
              errorMsg.includes('does not exist')) {
            // Expected errors, ignore
          } else {
            console.warn(`Warning executing batch ${i + 1}:`, errorMsg.substring(0, 100));
            errorCount++;
          }
        }
      }
    }
    
    console.log(`Schema execution: ${successCount} batches succeeded, ${errorCount} warnings`);

    await pool.close();
    console.log('Schema executed successfully');
    return true;
  } catch (error) {
    console.error('Error running schema:', error);
    return false;
  }
}

async function main() {
  const dbCreated = await createDatabaseAndUser();
  if (!dbCreated) {
    process.exit(1);
  }

  const schemaRun = await runSchema();
  if (!schemaRun) {
    console.warn('Schema execution had warnings, but continuing...');
  }

  console.log('Database initialization completed!');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

